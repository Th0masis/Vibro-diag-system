import os
import time
import requests
import traceback
import numpy as np
import scipy.io as sio
import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
import random

# Importy tvých modelů a našeho nového datasetu z utils
from models import Generator, Discriminator, Encoder
from utils import DatabaseFinetuneDataset

# Konfigurace pro modely
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
ANOMALY_MODEL_DIR = "./models/AE_ANOWGAN"
V2_MODEL_DIR = os.path.join(ANOMALY_MODEL_DIR, "v2")

def compute_gradient_penalty(D, real_samples, fake_samples, device):
    """Z tvého původního skriptu - výpočet GP pro WGAN."""
    alpha = torch.rand(real_samples.size(0), 1, 1, 1, device=device)
    interpolates = (alpha * real_samples + ((1 - alpha) * fake_samples)).requires_grad_(True)
    d_interpolates = D(interpolates)
    fake = torch.ones(real_samples.size(0), 1, device=device)
    gradients = torch.autograd.grad(
        outputs=d_interpolates, inputs=interpolates, grad_outputs=fake,
        create_graph=True, retain_graph=True, only_inputs=True,
    )[0]
    gradients = gradients.view(gradients.size(0), -1)
    return ((gradients.norm(2, dim=1) - 1) ** 2).mean()

def load_raw_data_from_paths(file_paths):
    """Načte 1D signály z předaných cest k souborům (MAT nebo CSV)."""
    all_signals = []
    for path in file_paths:
        try:
            if path.endswith('.mat'):
                mat_data = sio.loadmat(path)
                root_key = [k for k in mat_data.keys() if not k.startswith('__')][0]
                Y_data = mat_data[root_key][0, 0]['Y'][0]
                for i in range(Y_data.size):
                    channel_name = Y_data[i]['Name'][0]
                    if isinstance(channel_name, np.ndarray) and channel_name.size > 0:
                        channel_name = channel_name[0]
                    # Uprav podle toho, jak se jmenuje tvůj kanál s vibracemi
                    if 'vibration' in channel_name.lower(): 
                        all_signals.append(Y_data[i]['Data'].flatten())
                        break
            elif path.endswith('.csv'):
                # Načteme normálně s hlavičkou (pro MAFAULDU se obětuje 1. vzorek, což u desetitisíců nevadí)
                df = pd.read_csv(path)
                
                # Zjistíme, jestli jde o tvá data z databáze (obsahují sloupec 'yAxis')
                if 'yAxis' in df.columns:
                    signal_series = df['yAxis']
                else:
                    # Fallback pro MAFAULDA a jiné: vezmeme poslední sloupec (ne první, kvůli indexům)
                    signal_series = df.iloc[:, -1]
                
                # Magická funkce: vše převede na čísla a zahodí NaN/prázdné znaky
                signal = pd.to_numeric(signal_series, errors='coerce').dropna().values
                
                # Pro jistotu explicitně přetypujeme na float32 pro PyTorch/NumPy
                signal = np.array(signal, dtype=np.float32)
                
                if len(signal) > 0:
                    all_signals.append(signal)
                else:
                    print(f"[VAROVÁNÍ] Soubor {path} neobsahuje žádná platná číselná data.")
                    
        except Exception as e:
            print(f"[BACKGROUND TASK] Varování: Nelze načíst {path} - {e}")
            
    if not all_signals:
        raise ValueError("Nepodařilo se načíst žádná platná data ze zadaných souborů.")
        
    return np.concatenate(all_signals)

def run_training_pipeline(file_paths, webhook_url, epochs=10, batch_size=16, save_path=None):
    """Hlavní asynchronní trénovací smyčka."""
    print(f"\n[BACKGROUND TASK] Startuji proces fine-tuningu na {len(file_paths)} souborech.")
    print(f"[BACKGROUND TASK] Zařízení: {DEVICE} | Epochy: {epochs} | Batch: {batch_size}")
    
    try:
        # 1. NAČTENÍ DAT A DATASET
        raw_signal = load_raw_data_from_paths(file_paths)
        dataset = DatabaseFinetuneDataset(raw_signal) # Vytvoří rámce a CWT za běhu
        dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True, drop_last=True)
        
        if len(dataloader) == 0:
            raise ValueError("Množství dat je příliš malé pro vytvoření alespoň jednoho batche.")

        # 2. INICIALIZACE MODELŮ A NAČTENÍ PŮVODNÍCH VAH
        latent_dim = 100
        I, J = 3, 3 
        
        encoders = [Encoder(latent_dim).to(DEVICE) for _ in range(I)]
        decoders = [Generator(latent_dim).to(DEVICE) for _ in range(I)]
        discriminators = [Discriminator().to(DEVICE) for _ in range(J)]
        
        print("[BACKGROUND TASK] Načítám stávající váhy modelů z produkce...")
        for idx in range(I):
            encoders[idx].load_state_dict(torch.load(f"{ANOMALY_MODEL_DIR}/encoder_final_{idx}.pth", map_location=DEVICE))
            decoders[idx].load_state_dict(torch.load(f"{ANOMALY_MODEL_DIR}/decoder_final_{idx}.pth", map_location=DEVICE))
            discriminators[idx].load_state_dict(torch.load(f"{ANOMALY_MODEL_DIR}/discriminator_final_{idx}.pth", map_location=DEVICE))
            
            # Zapneme trénovací mód
            encoders[idx].train()
            decoders[idx].train()
            discriminators[idx].train()

        # 3. OPTIMALIZÁTORY
        # DŮLEŽITÉ: Pro fine-tuning používáme mnohem menší learning rate! Původní byl 0.0002.
        lr = 0.00002 
        opt_Encs = [optim.Adam(e.parameters(), lr=lr, betas=(0.0, 0.9)) for e in encoders]
        opt_Decs = [optim.Adam(d.parameters(), lr=lr, betas=(0.0, 0.9)) for d in decoders]
        opt_Discs = [optim.Adam(d.parameters(), lr=lr, betas=(0.0, 0.9)) for d in discriminators]
        
        criterion_mse = nn.MSELoss()
        beta1, beta2, beta3 = 1.0, 10.0, 1.0

        # 4. TRÉNOVACÍ SMYČKA
        print("[BACKGROUND TASK] Začínám iterace...")
        for epoch in range(epochs):
            for batch_idx, real_imgs in enumerate(dataloader):
                real_imgs = real_imgs.to(DEVICE)
                
                # Náhodný výběr páru (z tvého původního skriptu)
                i = random.randint(0, I - 1)
                j = random.randint(0, J - 1)
                
                enc, dec, disc = encoders[i], decoders[i], discriminators[j]
                opt_E, opt_Dec, opt_D = opt_Encs[i], opt_Decs[i], opt_Discs[j]

                # --- KROK 1: Update Diskriminátoru ---
                opt_D.zero_grad()
                z = enc(real_imgs)
                rec_imgs = dec(z)
                
                real_validity = disc(real_imgs)
                fake_validity = disc(rec_imgs.detach())
                gp = compute_gradient_penalty(disc, real_imgs.data, rec_imgs.data, DEVICE)
                d_loss = -torch.mean(real_validity) + torch.mean(fake_validity) + 10 * gp
                
                d_loss.backward()
                opt_D.step()

                # --- KROK 2: Update Enkodéru a Dekodéru ---
                opt_E.zero_grad()
                opt_Dec.zero_grad()

                z = enc(real_imgs)
                rec_imgs = dec(z)

                l_a = -torch.mean(disc(rec_imgs))
                l_r = criterion_mse(rec_imgs, real_imgs)
                
                real_features = disc.extract_features(real_imgs).detach()
                fake_features = disc.extract_features(rec_imgs)
                l_d = criterion_mse(fake_features, real_features)

                total_loss = beta1 * l_a + beta2 * l_r + beta3 * l_d
                total_loss.backward()
                
                opt_E.step()
                opt_Dec.step()
                
            print(f"[BACKGROUND TASK] Epoch [{epoch+1}/{epochs}] dokončena. | L_r: {l_r.item():.4f} | L_tot: {total_loss.item():.4f}")

        # 5. ULOŽENÍ VAH (Změněno na dynamickou cestu)
        target_dir = os.path.dirname(save_path) if save_path and save_path.endswith('.pth') else save_path
        os.makedirs(target_dir, exist_ok=True)
        for idx in range(I):
            torch.save(encoders[idx].state_dict(), f"{target_dir}/encoder_final_{idx}.pth")
            torch.save(decoders[idx].state_dict(), f"{target_dir}/decoder_final_{idx}.pth")
            torch.save(discriminators[idx].state_dict(), f"{target_dir}/discriminator_final_{idx}.pth")
            
        print(f"[BACKGROUND TASK] Modely AE_ANOWGAN úspěšně uloženy do {target_dir}.")
        # 6. ODESLÁNÍ ÚSPĚŠNÉHO WEBHOOKU
        try:
            if webhook_url.startswith("http"):
                requests.post(webhook_url, json={
                    "status": "success",
                    "message": f"Fine-tuning dokončen na {len(file_paths)} souborech. Modely v2 uloženy.",
                }, timeout=10)
        except Exception as we:
            print(f"[BACKGROUND TASK] Webhook nelze odeslat: {we}")

    except Exception as e:
        error_msg = str(e)
        print(f"\n[BACKGROUND TASK] KRITICKÁ CHYBA:\n{traceback.format_exc()}")
        try:
            if webhook_url.startswith("http"):
                requests.post(webhook_url, json={"status": "error", "error_detail": error_msg}, timeout=10)
        except:
            pass