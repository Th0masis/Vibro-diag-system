import os
import requests
import traceback
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import TensorDataset, DataLoader
from sklearn.preprocessing import MinMaxScaler

from models import BiLSTM_RUL
from utils import extract_14_features

DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
RUL_MODEL_DIR = "./models/Bi-LSTM"
V2_MODEL_DIR = os.path.join(RUL_MODEL_DIR, "v2")
WINDOW_SIZE = 10

def create_sequences(data, labels, window_size):
    X, y = [], []
    for i in range(len(data) - window_size):
        X.append(data[i:(i + window_size)])
        y.append(labels[i + window_size - 1])
    return np.array(X), np.array(y)

def run_rul_training_pipeline(category, file_paths, webhook_url, epochs=50, batch_size=32, save_path=None):
    print(f"\n[BACKGROUND TASK] Startuji Bi-LSTM fine-tuning pro kategorii '{category}' ({len(file_paths)} souborů).")
    
    try:
        # 1. Extrakce příznaků (Doba trvání závisí na počtu souborů)
        print("[BACKGROUND TASK] Extrahuji 14 příznaků z CSV souborů...")
        features = []
        for path in file_paths:
            features.append(extract_14_features(path))
        features = np.array(features)

        # 2. Výpočet lineární RUL (1.0 -> 0.0)
        total_steps = len(features)
        rul_labels = np.array([(total_steps - t) / total_steps for t in range(total_steps)])

        # 3. Škálování dat
        scaler = MinMaxScaler()
        scaled_features = scaler.fit_transform(features)

        # 4. Vytvoření oken (Sequences)
        X_seq, y_seq = create_sequences(scaled_features, rul_labels, WINDOW_SIZE)
        
        if len(X_seq) == 0:
            raise ValueError("Nedostatek dat pro vytvoření okna o délce 10.")

        print(f"[BACKGROUND TASK] Vytvořeno {len(X_seq)} trénovacích oken.")

        # Převod na tensory
        X_t = torch.tensor(X_seq, dtype=torch.float32).to(DEVICE)
        y_t = torch.tensor(y_seq, dtype=torch.float32).view(-1, 1).to(DEVICE)
        
        dataloader = DataLoader(TensorDataset(X_t, y_t), batch_size=batch_size, shuffle=True)

        # 5. Načtení modelu
        model = BiLSTM_RUL(input_size=14).to(DEVICE)
        model_path = f"{RUL_MODEL_DIR}/bilstm_model_single_{category}.pth"
        if os.path.exists(model_path):
            model.load_state_dict(torch.load(model_path, map_location=DEVICE))
            print("[BACKGROUND TASK] Původní váhy modelu načteny.")
        else:
            print(f"[BACKGROUND TASK] VAROVÁNÍ: Původní model pro {category} nenalezen, začínám od nuly.")
            
        model.train()

        # 6. Optimalizátor (Pro fine-tuning snížený LR na 0.001)
        criterion = nn.MSELoss()
        optimizer = optim.Adam(model.parameters(), lr=0.001)

        # 7. Trénink
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
            if (epoch + 1) % 10 == 0 or epoch == 0:
                print(f"[BACKGROUND TASK] Bi-LSTM Epoch [{epoch+1}/{epochs}] | MSE Loss: {train_loss:.4f}")

        # 8. Uložení (Změněno na dynamickou cestu)
        target_dir = os.path.dirname(save_path) if save_path and save_path.endswith('.pth') else save_path
        os.makedirs(target_dir, exist_ok=True)
        torch.save(model.state_dict(), f"{target_dir}/bilstm_model_single_{category}.pth")
        print(f"[BACKGROUND TASK] Model Bi-LSTM uložen do {target_dir}.")
        # 9. Webhook
        if webhook_url.startswith("http"):
            requests.post(webhook_url, json={"status": "success", "message": f"Bi-LSTM ({category}) připraven."}, timeout=10)

    except Exception as e:
        print(f"[BACKGROUND TASK] KRITICKÁ CHYBA:\n{traceback.format_exc()}")
        if webhook_url.startswith("http"):
            requests.post(webhook_url, json={"status": "error", "error_detail": str(e)}, timeout=10)