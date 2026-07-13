import os
import requests
import traceback
import numpy as np
import pandas as pd
import scipy.io as sio
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader

from models import BearingFault1DCNN
from utils import Database1DCNNDataset

DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
CLASSIFY_MODEL_DIR = "./models/1DCNN"

def load_labeled_data(measurements):
    results = []
    for m in measurements:
        path = m['path']
        try:
            # 1. Podpora pro reálná CSV data z naší databáze
            if path.endswith('.csv'):
                df = pd.read_csv(path)
                
                # Nalezení správného sloupce s daty
                if 'yAxis' in df.columns:
                    signal_series = df['yAxis']
                else:
                    signal_series = df.iloc[:, -1]
                
                # Bezpečný převod na čísla a odstranění NaN (ochrana proti prázdnému indexu)
                signal = pd.to_numeric(signal_series, errors='coerce').dropna().values
                signal = np.array(signal, dtype=np.float32)
                
                if len(signal) > 0:
                    results.append({
                        "signal": signal,
                        "label": m['label']
                    })
                else:
                    print(f"[VAROVÁNÍ] Soubor {path} neobsahuje platná data.")

            # 2. Podpora pro starší datasety (CWRU) ve formátu .mat
            elif path.endswith('.mat'):
                mat_data = sio.loadmat(path)
                de_key = next((k for k in mat_data.keys() if 'DE_time' in k or 'vibration' in k.lower()), None)
                if de_key:
                    results.append({
                        "signal": mat_data[de_key].flatten(),
                        "label": m['label']
                    })
        except Exception as e:
            print(f"[BACKGROUND TASK] Chyba při čtení {path}: {e}")
            
    return results

def run_1dcnn_training_pipeline(measurements, webhook_url, epochs=10, batch_size=64, save_path=None):
    print(f"\n[BACKGROUND TASK] Startuji 1DCNN fine-tuning pro {len(measurements)} souborů.")
    
    try:
        raw_data = load_labeled_data(measurements)
        if not raw_data:
            raise ValueError("Žádná platná data k tréninku nebyla nalezena nebo extrahována.")
            
        dataset = Database1DCNNDataset(raw_data)
        dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True)

        # OPRAVA: Použití 4 tříd přesně podle naší diplomky a main.py
        model = BearingFault1DCNN(num_classes=4).to(DEVICE)
        
        # Pokus o načtení původních vah (pokud existují) - z produkční cesty
        # Můžeš to upravit, pokud si chceš cestu k base modelu posílat z API
        base_model_path = f"{CLASSIFY_MODEL_DIR}/v1/bearing_fault_model.pth"
        if os.path.exists(base_model_path):
            model.load_state_dict(torch.load(base_model_path, map_location=DEVICE))
            print(f"[BACKGROUND TASK] Načteny původní váhy z {base_model_path}")
        else:
            print("[BACKGROUND TASK] UPOZORNĚNÍ: Původní váhy nenalezeny, trénuji model od nuly.")
            
        model.train()

        criterion = nn.CrossEntropyLoss()
        optimizer = optim.SGD(model.parameters(), lr=0.001, momentum=0.9)

        final_acc = 0.0
        final_loss = 0.0
        for epoch in range(epochs):
            running_loss, correct, total = 0.0, 0, 0
            for inputs, labels in dataloader:
                inputs, labels = inputs.to(DEVICE), labels.to(DEVICE)
                
                optimizer.zero_grad()
                outputs = model(inputs)
                loss = criterion(outputs, labels)
                loss.backward()
                optimizer.step()
                
                running_loss += loss.item()
                _, predicted = torch.max(outputs.data, 1)
                total += labels.size(0)
                correct += (predicted == labels).sum().item()

            final_loss = running_loss / len(dataloader)
            final_acc = (correct / total) if total > 0 else 0.0
            print(f"[BACKGROUND TASK] 1DCNN Epoch [{epoch+1}/{epochs}] | Loss: {final_loss:.4f} | Acc: {100*final_acc:.2f}%")

        # Dynamické uložení pod novou verzí
        target_dir = os.path.dirname(save_path) if save_path else CLASSIFY_MODEL_DIR
        os.makedirs(target_dir, exist_ok=True)
        final_save_path = save_path if save_path else f"{target_dir}/bearing_fault_model_finetuned.pth"
        
        torch.save(model.state_dict(), final_save_path)
        print(f"[BACKGROUND TASK] Hotovo. Model uložen do {final_save_path}.")

        if webhook_url.startswith("http"):
            requests.post(
                webhook_url,
                json={
                    "status": "success",
                    "message": "1DCNN nová verze připravena.",
                    "evaluation_score": float(final_acc),
                    "evaluation": {
                        "metric": "train_accuracy",
                        "value": float(final_acc),
                        "train_loss": float(final_loss),
                        "samples": int(len(dataset)),
                    },
                },
                timeout=10,
            )

    except Exception as e:
        print(f"[BACKGROUND TASK] KRITICKÁ CHYBA:\n{traceback.format_exc()}")
        if webhook_url.startswith("http"):
            requests.post(webhook_url, json={"status": "error", "error_detail": str(e)}, timeout=10)