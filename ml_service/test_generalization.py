import os
# Vynutíme CPU pro inferenci (prevence konfliktů paměti a OOM)
os.environ["CUDA_VISIBLE_DEVICES"] = "-1"

import glob
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.metrics import mean_squared_error

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset
import tensorflow as tf
from tensorflow.keras.models import load_model

# ==========================================
# 1. KONFIGURACE
# ==========================================
DATASET_PATH = r'C:\Code\Vibro-diag-system\ml_service\data\XJTU-SY\XJTU-SY_Bearing_Datasets'
TARGET_BEARING = 'Bearing2_2' # Porucha klece (Cage Fault) - Test generalizace
WINDOW_SIZE = 1024

# === ZDE BYLA CHYBA: Cesty k novým modelům ===
# PyTorch: Musíme brát ty z 'saved_models_pytorch', které mají správnou architekturu
PATH_PT_CDAE = 'saved_models_pytorch/CDAE_best.pth'
PATH_PT_RUL = 'saved_models_pytorch/BiLSTM_best.pth'

# TensorFlow
PATH_TF_CDAE = 'models/cdae_model.keras'
PATH_TF_RUL = 'models/rul_model.keras'

# Parametr pro PyTorch denormalizaci (Max RUL z trénovací sady)
TRAIN_MAX_RUL = 161.0 

# ==========================================
# 2. DEFINICE PYTORCH TŘÍD (Musí odpovídat uloženému modelu)
# ==========================================
class CDAE(nn.Module):
    def __init__(self):
        super(CDAE, self).__init__()
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
    def forward(self, x): return self.decoder(self.encoder(x))

class BiLSTM_RUL(nn.Module):
    def __init__(self):
        super(BiLSTM_RUL, self).__init__()
        self.lstm1 = nn.LSTM(input_size=1, hidden_size=16, batch_first=True, bidirectional=True)
        self.lstm2 = nn.LSTM(input_size=32, hidden_size=32, batch_first=True, bidirectional=True)
        # Toto je ta "nová" struktura s nn.Sequential, kterou vyžaduje best.pth
        self.fc = nn.Sequential(
            nn.Linear(64, 64), 
            nn.ReLU(), 
            nn.Linear(64, 1), 
            nn.ReLU()
        )
    def forward(self, x):
        x = x.permute(0, 2, 1) 
        out, _ = self.lstm1(x)
        out, _ = self.lstm2(out)
        return self.fc(out[:, -1, :])

# ==========================================
# 3. NAČÍTÁNÍ DAT
# ==========================================
def load_bearing_data(root_path, bearing_name):
    print(f"--- Načítám data pro: {bearing_name} ---")
    search_path = os.path.join(root_path, "**", bearing_name)
    found = glob.glob(search_path, recursive=True)
    if not found: raise ValueError(f"Složka {bearing_name} nenalezena!")
        
    bearing_path = found[0]
    files = glob.glob(os.path.join(bearing_path, "*.csv"))
    files = sorted(files, key=lambda x: int(os.path.basename(os.path.splitext(x)[0])))
    
    total_life_min = len(files)
    X, y = [], []
    for i, file_path in enumerate(files):
        try:
            df = pd.read_csv(file_path, header=0)
            signal = df.iloc[:, 0].values
            # Z-score
            mean_val, std_val = np.mean(signal), np.std(signal)
            if std_val == 0: std_val = 1
            signal_norm = (signal - mean_val) / std_val
            
            num_windows = len(signal_norm) // WINDOW_SIZE
            for w in range(num_windows):
                X.append(signal_norm[w*WINDOW_SIZE : (w+1)*WINDOW_SIZE])
                y.append(total_life_min - i)
        except: continue
    return np.array(X), np.array(y)

# ==========================================
# 4. HLAVNÍ PROCES
# ==========================================
if __name__ == "__main__":
    # 1. DATA
    try:
        X_raw, y_true = load_bearing_data(DATASET_PATH, TARGET_BEARING)
        print(f"Data načtena: {X_raw.shape} vzorků.")
    except Exception as e:
        print(f"Chyba při načítání dat: {e}")
        exit()

    # Inicializace proměnných pro případ chyby
    pred_pytorch = np.zeros_like(y_true)
    pred_tensorflow = np.zeros_like(y_true)
    rmse_pt = 0.0
    rmse_tf = 0.0
    run_pt = False
    run_tf = False

    # --------------------------------------
    # 2. PYTORCH PREDIKCE
    # --------------------------------------
    print("\n--- Spouštím PyTorch Model ---")
    try:
        if not os.path.exists(PATH_PT_RUL):
            raise FileNotFoundError(f"Nenalezen soubor modelu: {PATH_PT_RUL}")

        # Příprava dat: (Batch, 1, 1024)
        X_pt = torch.tensor(X_raw, dtype=torch.float32).unsqueeze(1)
        
        cdae_pt = CDAE()
        cdae_pt.load_state_dict(torch.load(PATH_PT_CDAE, map_location=torch.device('cpu')))
        cdae_pt.eval()
        
        rul_pt = BiLSTM_RUL()
        rul_pt.load_state_dict(torch.load(PATH_PT_RUL, map_location=torch.device('cpu')))
        rul_pt.eval()
        
        dataset = TensorDataset(X_pt)
        loader = DataLoader(dataset, batch_size=32, shuffle=False)
        preds_pt_list = []
        
        with torch.no_grad():
            for batch in loader:
                inputs = batch[0]
                clean_feat = cdae_pt(inputs)
                out = rul_pt(clean_feat)
                preds_pt_list.append(out.numpy())
        
        preds_pt_norm = np.concatenate(preds_pt_list, axis=0)
        pred_pytorch = preds_pt_norm * TRAIN_MAX_RUL # Denormalizace
        
        # Převedeme na 1D pole pro sklearn
        pred_pytorch = pred_pytorch.flatten()
        
        rmse_pt = np.sqrt(mean_squared_error(y_true, pred_pytorch))
        print(f"PyTorch RMSE: {rmse_pt:.2f} min")
        run_pt = True
        
    except Exception as e:
        print(f"Chyba u PyTorch: {e}")

    # --------------------------------------
    # 3. TENSORFLOW PREDIKCE
    # --------------------------------------
    print("\n--- Spouštím TensorFlow Model ---")
    try:
        if not os.path.exists(PATH_TF_RUL):
            raise FileNotFoundError(f"Nenalezen soubor modelu: {PATH_TF_RUL}")

        # Příprava dat: (Batch, 1024, 1)
        X_tf = X_raw.reshape(X_raw.shape[0], X_raw.shape[1], 1)
        
        cdae_tf = load_model(PATH_TF_CDAE)
        rul_tf = load_model(PATH_TF_RUL)
        
        X_tf_clean = cdae_tf.predict(X_tf, verbose=0)
        pred_tf_raw = rul_tf.predict(X_tf_clean, verbose=0)
        pred_tensorflow = pred_tf_raw.flatten()
        
        rmse_tf = np.sqrt(mean_squared_error(y_true, pred_tensorflow))
        print(f"TensorFlow RMSE: {rmse_tf:.2f} min")
        run_tf = True
        
    except Exception as e:
        print(f"Chyba u TensorFlow: {e}")

    # --------------------------------------
    # 4. VIZUALIZACE A SROVNÁNÍ
    # --------------------------------------
    print("\n--- Vykresluji výsledky ---")
    plt.figure(figsize=(12, 6))
    
    # Skutečná data
    plt.plot(y_true, label='Skutečná RUL', color='black', linewidth=2, linestyle='--')
    
    if run_pt:
        plt.plot(pred_pytorch, label=f'PyTorch (RMSE: {rmse_pt:.2f})', color='blue', alpha=0.7)
    
    if run_tf:
        plt.plot(pred_tensorflow, label=f'TensorFlow (RMSE: {rmse_tf:.2f})', color='red', alpha=0.7)
    
    plt.title(f"Srovnání modelů na neznámém ložisku: {TARGET_BEARING} (Porucha klece)\n(Trénováno na Outer Race)")
    plt.xlabel("Časová okna")
    plt.ylabel("RUL (min)")
    plt.legend()
    plt.grid(True, alpha=0.3)
    
    save_path = "comparison_result_fixed.png"
    plt.savefig(save_path)
    print(f"Graf uložen do: {save_path}")