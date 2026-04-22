import os
import time
import requests
import traceback
import numpy as np
import scipy.io as sio
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader

from models import BearingFault1DCNN
from utils import Database1DCNNDataset

DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
CLASSIFY_MODEL_DIR = "./models/1DCNN"
V2_MODEL_DIR = os.path.join(CLASSIFY_MODEL_DIR, "v2")

def load_labeled_mat_files(measurements):
    """Načte surová data a spáruje je s labelem z frontendu."""
    results = []
    for m in measurements:
        try:
            mat_data = sio.loadmat(m['path'])
            # Hledáme DE signál (Drive End) - typické pro CWRU dataset
            de_key = next((k for k in mat_data.keys() if 'DE_time' in k or 'vibration' in k.lower()), None)
            if de_key:
                results.append({
                    "signal": mat_data[de_key].flatten(),
                    "label": m['label']
                })
        except Exception as e:
            print(f"[BACKGROUND TASK] Chyba při čtení {m['path']}: {e}")
    return results

def run_1dcnn_training_pipeline(measurements, webhook_url, epochs, batch_size):
    print(f"\n[BACKGROUND TASK] Startuji 1DCNN fine-tuning pro {len(measurements)} souborů.")
    
    try:
        # 1. Načtení dat
        raw_data = load_labeled_mat_files(measurements)
        if not raw_data:
            raise ValueError("Žádná platná data k tréninku.")
            
        dataset = Database1DCNNDataset(raw_data)
        dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True)

        # 2. Načtení modelu
        model = BearingFault1DCNN(num_classes=10).to(DEVICE)
        model.load_state_dict(torch.load(f"{CLASSIFY_MODEL_DIR}/bearing_fault_model.pth", map_location=DEVICE))
        model.train()

        # 3. Nastavení (Fine-tuning vyžaduje malý LR, např. 0.001)
        criterion = nn.CrossEntropyLoss()
        optimizer = optim.SGD(model.parameters(), lr=0.001, momentum=0.9)

        # 4. Tréninková smyčka
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

            print(f"[BACKGROUND TASK] 1DCNN Epoch [{epoch+1}/{epochs}] | Loss: {running_loss/len(dataloader):.4f} | Acc: {100*correct/total:.2f}%")

        # 5. Uložení verze v2
        os.makedirs(V2_MODEL_DIR, exist_ok=True)
        torch.save(model.state_dict(), f"{V2_MODEL_DIR}/bearing_fault_model.pth")
        print(f"[BACKGROUND TASK] Hotovo. Model v2 uložen v {V2_MODEL_DIR}.")

        # 6. Webhook
        if webhook_url.startswith("http"):
            requests.post(webhook_url, json={"status": "success", "message": "1DCNN v2 připraven."}, timeout=10)

    except Exception as e:
        print(f"[BACKGROUND TASK] KRITICKÁ CHYBA:\n{traceback.format_exc()}")
        if webhook_url.startswith("http"):
            requests.post(webhook_url, json={"status": "error", "error_detail": str(e)}, timeout=10)