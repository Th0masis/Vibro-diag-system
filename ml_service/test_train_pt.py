import os
import glob
import time
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset

# ==========================================
# 1. KONFIGURACE
# ==========================================
DATASET_PATH = r'C:\Code\Vibro-diag-system\ml_service\data\XJTU-SY\XJTU-SY_Bearing_Datasets'
TARGET_BEARINGS = ['Bearing1_1', 'Bearing1_2', 'Bearing1_3']
WINDOW_SIZE = 1024
BATCH_SIZE = 32
EPOCHS = 80         # Více epoch, protože teď trénujeme poctivě s šumem
LEARNING_RATE = 0.001
NOISE_FACTOR = 0.5

device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"=== ZAŘÍZENÍ: {device} ===")

# Fixní seed pro reprodukovatelnost
torch.manual_seed(42)
np.random.seed(42)
os.makedirs('saved_models_pytorch', exist_ok=True)

# ==========================================
# 2. DATA (Načítání)
# ==========================================
def load_and_process_bearing(bearing_path, window_size=1024):
    files = glob.glob(os.path.join(bearing_path, "*.csv"))
    if not files: return np.array([]), np.array([])
    files = sorted(files, key=lambda x: int(os.path.basename(os.path.splitext(x)[0])))
    total_life_min = len(files)
    X_bearing, y_bearing = [], []
    for i, file_path in enumerate(files):
        try:
            df = pd.read_csv(file_path, header=0)
            signal = df.iloc[:, 0].values
            mean_val = np.mean(signal)
            std_val = np.std(signal)
            if std_val == 0: std_val = 1
            signal_norm = (signal - mean_val) / std_val
            num_windows = len(signal_norm) // window_size
            for w in range(num_windows):
                X_bearing.append(signal_norm[w*window_size : (w+1)*window_size])
                y_bearing.append(total_life_min - i)
        except: continue
    return np.array(X_bearing), np.array(y_bearing)

def prepare_dataset(root_path, target_bearings):
    X_all, y_all = [], []
    for bearing_name in target_bearings:
        print(f"Načítám: {bearing_name}...")
        search_path = os.path.join(root_path, "**", bearing_name)
        found = glob.glob(search_path, recursive=True)
        if found:
            X, y = load_and_process_bearing(found[0], WINDOW_SIZE)
            if len(X) > 0:
                X_all.append(X)
                y_all.append(y)
    if not X_all: raise ValueError("Žádná data!")
    return np.concatenate(X_all, axis=0), np.concatenate(y_all, axis=0)

# ==========================================
# 3. MODELY (Doladěné)
# ==========================================
def keras_init_weights(m):
    if isinstance(m, nn.Conv1d) or isinstance(m, nn.Linear):
        nn.init.xavier_uniform_(m.weight)
        if m.bias is not None: nn.init.zeros_(m.bias)
    elif isinstance(m, nn.LSTM):
        for name, param in m.named_parameters():
            if 'weight_ih' in name: nn.init.xavier_uniform_(param.data)
            elif 'weight_hh' in name: nn.init.orthogonal_(param.data)
            elif 'bias' in name: nn.init.zeros_(param.data)

class CDAE(nn.Module):
    def __init__(self):
        super(CDAE, self).__init__()
        # Padding je nastaven tak, aby přesně odpovídal 'same' v Kerasu
        self.encoder = nn.Sequential(
            nn.Conv1d(1, 128, 7, stride=2, padding=3), nn.ReLU(), nn.Dropout(0.5),
            nn.Conv1d(128, 64, 5, stride=2, padding=2), nn.ReLU(),
            nn.Conv1d(64, 32, 5, stride=1, padding=2), nn.ReLU(),
            nn.Conv1d(32, 16, 3, stride=1, padding=1), nn.ReLU()
        )
        self.decoder = nn.Sequential(
            nn.Conv1d(16, 32, 3, stride=1, padding=1), nn.ReLU(),
            nn.Upsample(scale_factor=2, mode='nearest'),
            nn.Conv1d(32, 64, 5, stride=1, padding=2), nn.ReLU(),
            nn.Upsample(scale_factor=2, mode='nearest'),
            nn.Dropout(0.5),
            nn.Conv1d(64, 128, 5, stride=1, padding=2), nn.ReLU(),
            nn.Conv1d(128, 1, 7, stride=1, padding=3)
        )
        self.apply(keras_init_weights)

    def forward(self, x):
        return self.decoder(self.encoder(x))

class BiLSTM_RUL(nn.Module):
    def __init__(self):
        super(BiLSTM_RUL, self).__init__()
        self.lstm1 = nn.LSTM(input_size=1, hidden_size=16, batch_first=True, bidirectional=True)
        self.lstm2 = nn.LSTM(input_size=32, hidden_size=32, batch_first=True, bidirectional=True)
        self.fc = nn.Sequential(
            nn.Linear(64, 64), nn.ReLU(),
            nn.Linear(64, 1),  nn.ReLU()
        )
        self.apply(keras_init_weights)

    def forward(self, x):
        x = x.permute(0, 2, 1) 
        out, _ = self.lstm1(x)
        out, _ = self.lstm2(out)
        out = out[:, -1, :]    
        return self.fc(out)

# ==========================================
# 4. TRÉNOVACÍ SMYČKA (OPRAVENÁ O DENOISING)
# ==========================================
def train_cdae(model, train_loader, val_loader, criterion, optimizer, epochs):
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, 'min', patience=5, factor=0.5, verbose=True)
    print("\nStart tréninku: CDAE (Denoising)")
    
    for epoch in range(epochs):
        model.train()
        train_loss = 0.0
        for X_batch, _ in train_loader: # Target pro AE je X_batch (čistý)
            X_batch = X_batch.to(device)
            
            # --- ZMĚNA: Přidání šumu přímo v GPU ---
            noise = torch.randn_like(X_batch) * NOISE_FACTOR
            noisy_input = X_batch + noise
            # Ořezání (Clip)
            noisy_input = torch.clamp(noisy_input, -3.0, 3.0)
            
            optimizer.zero_grad()
            outputs = model(noisy_input)
            loss = criterion(outputs, X_batch) # Rekonstrukce čistých dat z šumu
            loss.backward()
            optimizer.step()
            train_loss += loss.item() * X_batch.size(0)
            
        train_loss /= len(train_loader.dataset)
        
        # Validace
        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for X_batch, _ in val_loader:
                X_batch = X_batch.to(device)
                # Validace taky na šumu, abychom viděli, jak dobře odšumuje
                noise = torch.randn_like(X_batch) * NOISE_FACTOR
                noisy_input = torch.clamp(X_batch + noise, -3.0, 3.0)
                outputs = model(noisy_input)
                loss = criterion(outputs, X_batch)
                val_loss += loss.item() * X_batch.size(0)
        
        val_loss /= len(val_loader.dataset)
        scheduler.step(val_loss)
        
        if (epoch+1)%5 == 0:
            print(f"Epoch {epoch+1}/{epochs} | CDAE Train: {train_loss:.5f} | Val: {val_loss:.5f}")

    torch.save(model.state_dict(), "saved_models_pytorch/CDAE_best.pth")

def train_rul(model, train_loader, val_loader, criterion, optimizer, epochs):
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, 'min', patience=7, factor=0.5, verbose=True)
    best_loss = float('inf')
    print("\nStart tréninku: RUL (BiLSTM)")
    
    for epoch in range(epochs):
        model.train()
        train_loss = 0.0
        for X_batch, y_batch in train_loader:
            X_batch, y_batch = X_batch.to(device), y_batch.to(device)
            optimizer.zero_grad()
            outputs = model(X_batch)
            loss = criterion(outputs, y_batch)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            train_loss += loss.item() * X_batch.size(0)
        
        train_loss /= len(train_loader.dataset)
        
        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for X_batch, y_batch in val_loader:
                X_batch, y_batch = X_batch.to(device), y_batch.to(device)
                outputs = model(X_batch)
                loss = criterion(outputs, y_batch)
                val_loss += loss.item() * X_batch.size(0)
        val_loss /= len(val_loader.dataset)
        
        scheduler.step(val_loss)
        if (epoch+1)%5 == 0:
            print(f"Epoch {epoch+1}/{epochs} | RUL Train: {train_loss:.5f} | Val: {val_loss:.5f}")
            
        if val_loss < best_loss:
            best_loss = val_loss
            torch.save(model.state_dict(), "saved_models_pytorch/BiLSTM_best.pth")

# Pomocná funkce pro predikci
def predict_batches(model, tensor_data):
    model.eval()
    loader = DataLoader(TensorDataset(tensor_data), batch_size=32, shuffle=False)
    preds = []
    with torch.no_grad():
        for batch in loader:
            inputs = batch[0].to(device)
            preds.append(model(inputs).cpu().numpy())
    return np.concatenate(preds, axis=0)

# ==========================================
# 5. HLAVNÍ PROCES
# ==========================================
if __name__ == "__main__":
    X, y = prepare_dataset(DATASET_PATH, TARGET_BEARINGS)
    
    # Normalizace RUL (0-1)
    max_rul = np.max(y)
    y_norm = y / max_rul 
    
    X_train, X_temp, y_train, y_temp = train_test_split(X, y_norm, test_size=0.3, random_state=42)
    X_val, X_test, y_val, y_test = train_test_split(X_temp, y_temp, test_size=2/3, random_state=42)
    
    X_train_t = torch.tensor(X_train, dtype=torch.float32).unsqueeze(1)
    X_val_t = torch.tensor(X_val, dtype=torch.float32).unsqueeze(1)
    X_test_t = torch.tensor(X_test, dtype=torch.float32).unsqueeze(1)
    y_train_t = torch.tensor(y_train, dtype=torch.float32).unsqueeze(1)
    y_val_t = torch.tensor(y_val, dtype=torch.float32).unsqueeze(1)
    
    # --- A: CDAE ---
    # DataLoader jen s X (Target si vytvoříme v loopu)
    train_loader_ae = DataLoader(TensorDataset(X_train_t, X_train_t), batch_size=BATCH_SIZE, shuffle=True)
    val_loader_ae = DataLoader(TensorDataset(X_val_t, X_val_t), batch_size=BATCH_SIZE)
    
    cdae = CDAE().to(device)
    # Adam epsilon 1e-7 pro match s TensorFlow
    train_cdae(cdae, train_loader_ae, val_loader_ae, nn.MSELoss(), 
               optim.Adam(cdae.parameters(), lr=LEARNING_RATE, eps=1e-7), EPOCHS)
    
    # Odšumění
    cdae.load_state_dict(torch.load("saved_models_pytorch/CDAE_best.pth", weights_only=True))
    X_train_clean = torch.tensor(predict_batches(cdae, X_train_t), dtype=torch.float32)
    X_val_clean = torch.tensor(predict_batches(cdae, X_val_t), dtype=torch.float32)
    X_test_clean = torch.tensor(predict_batches(cdae, X_test_t), dtype=torch.float32)

    # --- B: Bi-LSTM ---
    train_loader_rul = DataLoader(TensorDataset(X_train_clean.cpu(), y_train_t), batch_size=BATCH_SIZE, shuffle=True)
    val_loader_rul = DataLoader(TensorDataset(X_val_clean.cpu(), y_val_t), batch_size=BATCH_SIZE)
    
    rul_model = BiLSTM_RUL().to(device)
    train_rul(rul_model, train_loader_rul, val_loader_rul, nn.MSELoss(), 
              optim.Adam(rul_model.parameters(), lr=LEARNING_RATE, eps=1e-7), EPOCHS)
    
    # --- C: Evaluace ---
    rul_model.load_state_dict(torch.load("saved_models_pytorch/BiLSTM_best.pth", weights_only=True))
    preds_norm = predict_batches(rul_model, X_test_clean)
    
    preds = preds_norm * max_rul
    y_test_min = y_test * max_rul
    
    rmse = np.sqrt(mean_squared_error(y_test_min, preds))
    print(f"\n>>> FINAL TEST RMSE: {rmse:.2f} min <<<")
    
    plt.figure(figsize=(10, 5))
    plt.scatter(y_test_min, preds, alpha=0.5, s=10)
    plt.plot([0, max(y_test_min)], [0, max(y_test_min)], 'r--')
    plt.title(f"PyTorch Result (RMSE: {rmse:.2f})")
    plt.savefig("vysledky_pytorch_final.png")