import os
import math
import requests
import traceback
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import TensorDataset, DataLoader
from sklearn.preprocessing import MinMaxScaler

from models import BiLSTM_RUL
from utils import extract_14_features

DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
RUL_MODEL_DIR = "./models/Bi-LSTM"
WINDOW_SIZE = 10


def _safe_num(value, default=0.0):
    try:
        num = float(value)
        if math.isnan(num) or math.isinf(num):
            return float(default)
        return num
    except Exception:
        return float(default)


def _to_rul_feature_vector(raw_feats):
    """
    Normalizuje výstup extrakce na 6-D vektor pro Bi-LSTM.
    Podporuje současně dict i list/tuple (kvůli staršímu extract_14_features).
    """
    if isinstance(raw_feats, dict):
        rms = _safe_num(raw_feats.get('rms_raw', 0.0))
        kurt = _safe_num(raw_feats.get('kurtosis_raw', 0.0))
        skew = _safe_num(raw_feats.get('skewness_raw', 0.0))
        rms_env = _safe_num(raw_feats.get('rms_acl_env', 0.0))
        dif = _safe_num(raw_feats.get('dif_kt_raw', kurt))
        speed = _safe_num(raw_feats.get('act_speed', 1500.0), 1500.0)
        return [rms, kurt, skew, rms_env, dif, speed]

    if isinstance(raw_feats, (list, tuple, np.ndarray)):
        vals = [_safe_num(v) for v in list(raw_feats)]
        rms = vals[0] if len(vals) > 0 else 0.0
        skew = vals[2] if len(vals) > 2 else 0.0
        kurt = vals[3] if len(vals) > 3 else 0.0
        rms_env = vals[7] if len(vals) > 7 else 0.0
        dif = kurt
        speed = 1500.0
        return [rms, kurt, skew, rms_env, dif, speed]

    raise TypeError(f"Nepodporovaný typ feature dat: {type(raw_feats)}")

def create_sequences(data, labels, window_size):
    X, y = [], []
    for i in range(len(data) - window_size):
        X.append(data[i:(i + window_size)])
        y.append(labels[i + window_size - 1])
    return np.array(X), np.array(y)

def run_rul_training_pipeline(category, measurements, lifecycle_info, webhook_url, epochs=50, batch_size=32, save_path=None):
    """
    measurements: List slovníků s 'path' a 'date' (čas měření)
    lifecycle_info: Slovník obsahující 'installed_at' a 'failed_at'
    """
    print(f"\n[BACKGROUND TASK] Startuji Bi-LSTM fine-tuning pro '{category}'.")
    
    try:
        # 1. Kontrola a výpočet celkového života ložiska z kalendářních dat
        if not lifecycle_info or not lifecycle_info.get('installed_at') or not lifecycle_info.get('failed_at'):
            raise ValueError("Chybí lifecycle_info (datum instalace a selhání) nutné pro výpočet exaktní RUL.")
            
        start_date = pd.to_datetime(lifecycle_info['installed_at']).timestamp()
        end_date = pd.to_datetime(lifecycle_info['failed_at']).timestamp()
        total_lifespan = end_date - start_date
        
        if total_lifespan <= 0:
            raise ValueError("Datum selhání (failed_at) musí být větší než datum instalace (installed_at).")

        print("[BACKGROUND TASK] Extrahuji 6 příznaků a počítám přesné časové RUL štítky...")
        features = []
        rul_labels = []
        
        for m in measurements:
            path = m['path']
            # Ošetření, pokud čas přijde z databáze nebo frontendu
            meas_date = pd.to_datetime(m['date']).timestamp()
            
            # Výpočet přesného RUL štítku (1.0 = instalace, 0.0 = selhání)
            current_rul = (end_date - meas_date) / total_lifespan
            current_rul = max(0.0, min(1.0, current_rul)) # Oříznutí pro jistotu
            
            # Extrakce funkcí (podpora dict i list výstupu)
            raw_feats = extract_14_features(path)
            vec = _to_rul_feature_vector(raw_feats)
            features.append(vec)
            rul_labels.append(current_rul)

        features = np.array(features)
        rul_labels = np.array(rul_labels)

        # 3. Škálování dat
        scaler = MinMaxScaler()
        scaled_features = scaler.fit_transform(features)

        # 4. Vytvoření oken (Sequences)
        X_seq, y_seq = create_sequences(scaled_features, rul_labels, WINDOW_SIZE)
        
        if len(X_seq) == 0:
            raise ValueError(f"Nedostatek dat pro vytvoření okna o délce {WINDOW_SIZE}.")

        print(f"[BACKGROUND TASK] Vytvořeno {len(X_seq)} trénovacích oken.")

        # Převod na tensory
        X_t = torch.tensor(X_seq, dtype=torch.float32).to(DEVICE)
        y_t = torch.tensor(y_seq, dtype=torch.float32).view(-1, 1).to(DEVICE)
        
        dataloader = DataLoader(TensorDataset(X_t, y_t), batch_size=batch_size, shuffle=True)

        # 5. Načtení modelu (OPRAVA na 6 příznaků)
        model = BiLSTM_RUL(input_size=6, hidden_size=64, num_layers=2).to(DEVICE)
        
        # OPRAVA názvu souboru na aktuální konvenci
        model_path = f"{RUL_MODEL_DIR}/bilstm_RUL_{category}.pth"
        if os.path.exists(model_path):
            model.load_state_dict(torch.load(model_path, map_location=DEVICE))
            print("[BACKGROUND TASK] Původní váhy modelu úspěšně načteny.")
        else:
            print(f"[BACKGROUND TASK] VAROVÁNÍ: Původní model {model_path} nenalezen, začínám od nuly.")
            
        model.train()

        # 6. Optimalizátor (Pro fine-tuning snížený LR na 0.001 pro stabilitu)
        criterion = nn.MSELoss()
        optimizer = optim.Adam(model.parameters(), lr=0.001)

        # 7. Trénink
        final_train_loss = None
        for epoch in range(epochs):
            train_loss = 0.0
            for batch_X, batch_y in dataloader:
                optimizer.zero_grad()
                outputs = model(batch_X)
                loss = criterion(outputs, batch_y)
                loss.backward()
                optimizer.step()
                train_loss += loss.item() * batch_X.size(0)
            
            train_loss /= len(dataloader.dataset)
            final_train_loss = train_loss
            if (epoch + 1) % 10 == 0 or epoch == 0:
                print(f"[BACKGROUND TASK] Bi-LSTM Epoch [{epoch+1}/{epochs}] | MSE Loss: {train_loss:.4f}")

        # 8. Uložení
        target_dir = os.path.dirname(save_path) if save_path and save_path.endswith('.pth') else save_path
        os.makedirs(target_dir, exist_ok=True)
        
        # Pojistka pro uložení pod správným názvem do v2 složky (nebo přepsání produkční)
        final_save_path = f"{target_dir}/bilstm_RUL_{category}.pth"
        torch.save(model.state_dict(), final_save_path)
        print(f"[BACKGROUND TASK] Model Bi-LSTM uložen do {final_save_path}.")
        
        # 9. Webhook
        if webhook_url.startswith("http"):
            score = max(0.0, min(1.0, 1.0 - _safe_num(final_train_loss, 1.0)))
            requests.post(
                webhook_url,
                json={
                    "status": "success",
                    "message": f"Bi-LSTM ({category}) připraven.",
                    "evaluation_score": score,
                    "evaluation": {
                        "metric": "train_mse",
                        "value": _safe_num(final_train_loss, 1.0),
                        "window_size": WINDOW_SIZE,
                        "samples": int(len(features)),
                    },
                },
                timeout=10,
            )

    except Exception as e:
        print(f"[BACKGROUND TASK] KRITICKÁ CHYBA:\n{traceback.format_exc()}")
        if webhook_url.startswith("http"):
            requests.post(webhook_url, json={"status": "error", "error_detail": str(e)}, timeout=10)