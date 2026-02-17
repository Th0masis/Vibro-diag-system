import os
import glob
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error
import matplotlib.pyplot as plt

# ==========================================
# 1. KONFIGURACE
# ==========================================
DATASET_PATH = 'C:/Code/Vibro-diag-system/ml_service/data/XJTU-SY/XJTU-SY_Bearing_Datasets'
TARGET_BEARINGS = ['Bearing1_1', 'Bearing1_2', 'Bearing1_3']
WINDOW_SIZE = 1024
BATCH_SIZE = 32
EPOCHS = 50
NOISE_FACTOR = 0.5
LEARNING_RATE = 0.001

# Nastavení zařízení (GPU pokud je dostupné, jinak CPU)
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"Používám zařízení: {device}")

# Nastavení náhody
torch.manual_seed(42)
np.random.seed(42)

# ==========================================
# 2. PŘÍPRAVA DAT (Zůstává stejná, jen převod na Tensor)
# ==========================================
# ... (Zde použijeme stejnou logiku načítání jako minule, pro úsporu místa zkopíruji jen finále)

def load_and_process_bearing(bearing_path, window_size=1024):
    """
    Načte CSV soubory pro jedno ložisko, provede Z-score a vytvoří okna.
    """
    # Získání a seřazení souborů (1.csv, 2.csv, ...)
    files = glob.glob(os.path.join(bearing_path, "*.csv"))
    if not files:
        print(f"Varování: Žádné CSV v {bearing_path}")
        return np.array([]), np.array([])
        
    # Seřazení podle čísla v názvu souboru
    files = sorted(files, key=lambda x: int(os.path.basename(os.path.splitext(x)[0])))
    
    total_life_min = len(files) # Celková životnost v minutách
    X_bearing = []
    y_bearing = []
    
    for i, file_path in enumerate(files):
        # [cite_start]Načtení CSV - 1. sloupec je horizontální vibrace [cite: 804]
        try:
            df = pd.read_csv(file_path, header=0)
            signal = df.iloc[:, 0].values 
        except Exception as e:
            print(f"Chyba při čtení {file_path}: {e}")
            continue

        # [cite_start]A) Z-score normalizace (Rovnice 10) [cite: 312]
        mean_val = np.mean(signal)
        std_val = np.std(signal)
        if std_val == 0: std_val = 1 # Pojistka proti dělení nulou
        signal_norm = (signal - mean_val) / std_val
        
        # [cite_start]B) Sliding Window (segmentace) [cite: 323]
        # Bez překryvu (stride = window_size) pro zjednodušení
        num_windows = len(signal_norm) // window_size
        
        for w in range(num_windows):
            start = w * window_size
            end = start + window_size
            X_bearing.append(signal_norm[start:end])
            
            # RUL: Zbývající čas v minutách
            y_bearing.append(total_life_min - i)
            
    return np.array(X_bearing), np.array(y_bearing)

def prepare_dataset(root_path, target_bearings):
    """
    Projdede složky, najde cílová ložiska a sloučí jejich data.
    """
    X_all = []
    y_all = []
    
    # Rekurzivní hledání složek ložisek
    for bearing_name in target_bearings:
        print(f"Hledám data pro: {bearing_name}...")
        search_path = os.path.join(root_path, "**", bearing_name)
        found_folders = glob.glob(search_path, recursive=True)
        
        if not found_folders:
            print(f" -> NENALEZENO: {bearing_name}")
            continue
            
        bearing_path = found_folders[0]
        print(f" -> Načítám z: {bearing_path}")
        
        X, y = load_and_process_bearing(bearing_path, WINDOW_SIZE)
        
        if len(X) > 0:
            X_all.append(X)
            y_all.append(y)
            print(f" -> Načteno {len(X)} vzorků.")

    if not X_all:
        raise ValueError("Nebyla načtena žádná data. Zkontrolujte cestu k datasetu!")

    X_all = np.concatenate(X_all, axis=0)
    y_all = np.concatenate(y_all, axis=0)
    
    # Reshape pro Conv1D: (Počet vzorků, 1024, 1)
    X_all = X_all.reshape(X_all.shape[0], X_all.shape[1], 1)
    
    return X_all, y_all

# ==========================================
# 3. DEFINICE MODELŮ V PYTORCH
# ==========================================

class CDAE(nn.Module):
    def __init__(self):
        super(CDAE, self).__init__()
        # Encoder
        # PyTorch Conv1d: (in_channels, out_channels, kernel_size, stride, padding)
        # Padding 'same' v Kerasu u stride 2 je složité, zde použijeme padding pro zachování tvaru cca
        self.encoder = nn.Sequential(
            nn.Conv1d(1, 128, kernel_size=7, stride=2, padding=3), # 1024 -> 512
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Conv1d(128, 64, kernel_size=5, stride=2, padding=2), # 512 -> 256
            nn.ReLU(),
            nn.Conv1d(64, 32, kernel_size=5, stride=1, padding=2), # 256 -> 256 (zachovat)
            nn.ReLU(),
            nn.Conv1d(32, 16, kernel_size=3, stride=1, padding=1), # 256 -> 256
            nn.ReLU()
        )
        
        # Decoder
        self.decoder = nn.Sequential(
            nn.Conv1d(16, 32, kernel_size=3, stride=1, padding=1),
            nn.ReLU(),
            nn.Upsample(scale_factor=2, mode='nearest'), # 256 -> 512
            nn.Conv1d(32, 64, kernel_size=5, stride=1, padding=2),
            nn.ReLU(),
            nn.Upsample(scale_factor=2, mode='nearest'), # 512 -> 1024
            nn.Dropout(0.5),
            nn.Conv1d(64, 128, kernel_size=5, stride=1, padding=2),
            nn.ReLU(),
            nn.Conv1d(128, 1, kernel_size=7, stride=1, padding=3) # Výstup 1 kanál
            # Poslední vrstva v Kerasu byla 'linear', tady taky (bez aktivace)
        )

    def forward(self, x):
        # x shape: (Batch, 1024, 1) -> Potřebujeme (Batch, 1, 1024)
        x = x.permute(0, 2, 1) 
        encoded = self.encoder(x)
        decoded = self.decoder(encoded)
        # Vrátíme do původního tvaru (Batch, 1024, 1)
        return decoded.permute(0, 2, 1)

class BiLSTM_RUL(nn.Module):
    def __init__(self):
        super(BiLSTM_RUL, self).__init__()
        # LSTM: input_size=1 (1 feature), hidden=16
        self.lstm1 = nn.LSTM(input_size=1, hidden_size=16, batch_first=True, bidirectional=True)
        # Druhá vrstva bere 16*2 (protože bidirectional)
        self.lstm2 = nn.LSTM(input_size=32, hidden_size=32, batch_first=True, bidirectional=True)
        
        self.fc1 = nn.Linear(32*2, 64) # 64 vstup (32 hidden * 2 směry)
        self.relu = nn.ReLU()
        self.fc2 = nn.Linear(64, 1) # Výstup RUL (1 číslo)

    def forward(self, x):
        # x shape: (Batch, 1024, 1)
        
        # LSTM 1 (return sequences = True)
        out, _ = self.lstm1(x) 
        
        # LSTM 2 (return sequences = False v Kerasu -> vezmeme poslední output)
        out, _ = self.lstm2(out)
        
        # Vezmeme jen poslední časový krok z sekvence: shape (Batch, Seq, Features) -> (Batch, Features)
        out = out[:, -1, :] 
        
        out = self.fc1(out)
        out = self.relu(out)
        out = self.fc2(out)
        return out # RUL

# ==========================================
# 4. TRÉNOVACÍ SMYČKA (To v Kerasu nevidíte)
# ==========================================
def train_model(model, train_loader, val_loader, criterion, optimizer, num_epochs, model_name="Model"):
    train_losses = []
    val_losses = []
    
    print(f"\nZačínám trénink {model_name}...")
    
    for epoch in range(num_epochs):
        model.train() # Přepnutí do trénovacího módu (důležité pro Dropout)
        running_loss = 0.0
        
        for inputs, targets in train_loader:
            inputs, targets = inputs.to(device), targets.to(device)
            
            # 1. Zero grad
            optimizer.zero_grad()
            
            # 2. Forward
            outputs = model(inputs)
            loss = criterion(outputs, targets)
            
            # 3. Backward
            loss.backward()
            optimizer.step()
            
            running_loss += loss.item() * inputs.size(0)
            
        epoch_loss = running_loss / len(train_loader.dataset)
        train_losses.append(epoch_loss)
        
        # Validace
        model.eval() # Přepnutí do eval módu
        val_loss = 0.0
        with torch.no_grad(): # Vypnutí gradientů (šetří paměť)
            for inputs, targets in val_loader:
                inputs, targets = inputs.to(device), targets.to(device)
                outputs = model(inputs)
                loss = criterion(outputs, targets)
                val_loss += loss.item() * inputs.size(0)
        
        epoch_val_loss = val_loss / len(val_loader.dataset)
        val_losses.append(epoch_val_loss)
        
        if (epoch+1) % 5 == 0:
            print(f"Epoch {epoch+1}/{num_epochs} | Train Loss: {epoch_loss:.4f} | Val Loss: {epoch_val_loss:.4f}")
            
    return train_losses, val_losses

# ==========================================
# 5. HLAVNÍ PROCES
# ==========================================
if __name__ == "__main__":
    
    # 1. Načtení dat (Použijte vaši funkci z minula!)
    X, y = prepare_dataset(DATASET_PATH, TARGET_BEARINGS) 
    
    # Split dat (stejný jako minule)
    X_train, X_temp, y_train, y_temp = train_test_split(X, y, test_size=0.3, random_state=42)
    X_val, X_test, y_val, y_test = train_test_split(X_temp, y_temp, test_size=2/3, random_state=42)
    
    # Převod na PyTorch Tenzory
    # Důležité: PyTorch pracuje s float32
    train_dataset = TensorDataset(torch.Tensor(X_train), torch.Tensor(X_train)) # Pro CDAE je target == input
    val_dataset = TensorDataset(torch.Tensor(X_val), torch.Tensor(X_val))
    
    # DataLoader (stará se o batchování)
    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE)
    
    # --- FÁZE A: Trénink CDAE ---
    cdae = CDAE().to(device)
    criterion_cdae = nn.MSELoss()
    optimizer_cdae = optim.Adam(cdae.parameters(), lr=LEARNING_RATE)
    
    # Šum musíme přidávat uvnitř smyčky nebo předem. Zde pro jednoduchost trénujeme clean-to-clean
    # Pokud chcete šum, museli byste upravit smyčku train_model, aby přidávala šum k 'inputs'.
    train_hist, val_hist = train_model(cdae, train_loader, val_loader, criterion_cdae, optimizer_cdae, EPOCHS, "CDAE")
    
    # Uložení CDAE
    torch.save(cdae.state_dict(), "cdae_pytorch.pth")
    
    # --- FÁZE B: Příprava dat pro Bi-LSTM (Odšumění) ---
    cdae.eval()
    with torch.no_grad():
        # Odšumíme data na GPU a pak vrátíme na CPU
        X_train_clean = cdae(torch.Tensor(X_train).to(device)).cpu()
        X_val_clean = cdae(torch.Tensor(X_val).to(device)).cpu()
        X_test_clean = cdae(torch.Tensor(X_test).to(device)).cpu()
        
    # --- FÁZE C: Trénink Bi-LSTM ---
    # Targety pro LSTM jsou y (RUL)
    # Musíme reshape y na (Batch, 1) protože MSELoss to vyžaduje
    y_train_ts = torch.Tensor(y_train).view(-1, 1)
    y_val_ts = torch.Tensor(y_val).view(-1, 1)
    
    rul_dataset = TensorDataset(X_train_clean, y_train_ts)
    rul_val_dataset = TensorDataset(X_val_clean, y_val_ts)
    
    rul_loader = DataLoader(rul_dataset, batch_size=BATCH_SIZE, shuffle=True)
    rul_val_loader = DataLoader(rul_val_dataset, batch_size=BATCH_SIZE)
    
    rul_model = BiLSTM_RUL().to(device)
    criterion_rul = nn.MSELoss() # RMSE je odmocnina z tohoto
    optimizer_rul = optim.Adam(rul_model.parameters(), lr=LEARNING_RATE)
    
    train_hist_rul, val_hist_rul = train_model(rul_model, rul_loader, rul_val_loader, criterion_rul, optimizer_rul, EPOCHS, "RUL Model")

    # Uložení RUL modelu
    torch.save(rul_model.state_dict(), "rul_pytorch.pth")

    # --- FÁZE D: Evaluace ---
    rul_model.eval()
    with torch.no_grad():
        preds = rul_model(X_test_clean.to(device)).cpu().numpy()
        
    rmse = np.sqrt(mean_squared_error(y_test, preds))
    print(f"Final Test RMSE: {rmse:.2f} minut")
    
    # Vizualizace
    plt.figure(figsize=(12, 5))
    plt.subplot(1, 2, 1)
    plt.plot(train_hist_rul, label='Train MSE')
    plt.plot(val_hist_rul, label='Val MSE')
    plt.legend()
    
    plt.subplot(1, 2, 2)
    plt.scatter(y_test, preds, alpha=0.5, s=10)
    plt.plot([y_test.min(), y_test.max()], [y_test.min(), y_test.max()], 'r--')
    plt.title(f"RMSE: {rmse:.2f}")
    plt.savefig("pytorch_result.png")
    print("Hotovo.")