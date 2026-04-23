from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager  # <-- PŘIDÁNO PRO LIFESPAN
from scipy.stats import kurtosis, skew
from scipy.fft import rfft, rfftfreq
from sklearn.preprocessing import MinMaxScaler
from pydantic import BaseModel
from typing import List
import numpy as np
import pandas as pd
import io, base64, pywt
import matplotlib.pyplot as plt
import torch
import torch.nn as nn
import torch.nn.functional as F
import requests 

from models import Encoder, Generator as Decoder, Discriminator
from models import BearingFault1DCNN
from models import BiLSTM_RUL
from utils import extract_14_features
from train_aeanowgan import run_training_pipeline
from train_1dcnn import run_1dcnn_training_pipeline
from train_rul import run_rul_training_pipeline

# CWT konfigurace
IMG_SIZE = 256
WAVELET = 'cmor1.5-1.0'
FRAME_SIZE = 1024

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
BACKEND_URL = "http://127.0.0.1:8000" 

encoders = []
decoders = []
discriminators = []
cnn_model = None
bilstm_models = {}

# --- NOVÝ ZPŮSOB STARTU APLIKACE (LIFESPAN) ---
def load_models_from_backend():
    global encoders, decoders, discriminators, cnn_model, bilstm_models
    print("Dotazuji se backendu na nejnovější 'ready' modely...")
    
    try:
        response = requests.post(f"{BACKEND_URL}/models/sync-active")
        response.raise_for_status()
        active_paths = response.json()

        # 1. Načtení AE_ANOWGAN (očekává složku)
        anowgan_dir = active_paths.get("AE_ANOWGAN")
        if anowgan_dir:
            for i in range(3):
                enc = Encoder().to(DEVICE)
                dec = Decoder().to(DEVICE)
                disc = Discriminator().to(DEVICE)
                enc.load_state_dict(torch.load(f"{anowgan_dir}/encoder_final_{i}.pth", map_location=DEVICE))
                dec.load_state_dict(torch.load(f"{anowgan_dir}/decoder_final_{i}.pth", map_location=DEVICE))
                disc.load_state_dict(torch.load(f"{anowgan_dir}/discriminator_final_{i}.pth", map_location=DEVICE))
                enc.eval(); dec.eval(); disc.eval()
                encoders.append(enc); decoders.append(dec); discriminators.append(disc)
            print(f"AE-AnoWGAN načten z: {anowgan_dir}")

        # 2. Načtení 1D CNN (očekává soubor)
        cnn_path = active_paths.get("1D_CNN")
        if cnn_path:
            cnn_model = BearingFault1DCNN().to(DEVICE)
            cnn_model.load_state_dict(torch.load(cnn_path, map_location=DEVICE))
            cnn_model.eval()
            print(f"1D_CNN načten z: {cnn_path}")

        # 3. Načtení Bi-LSTM (očekává složku)
        lstm_dir = active_paths.get("Bi-LSTM")
        if lstm_dir:
            for cat in ['OR', 'IR', 'O']:
                try:
                    model_rul = BiLSTM_RUL(input_size=14).to(DEVICE)
                    model_rul.load_state_dict(torch.load(f"{lstm_dir}/bilstm_model_single_{cat}.pth", map_location=DEVICE))
                    model_rul.eval()
                    bilstm_models[cat] = model_rul
                except Exception as e:
                    print(f"Upozornění: RUL model {cat} nenačten ({e})")
            print(f"Bi-LSTM RUL modely načteny z: {lstm_dir}")

    except Exception as e:
        print(f"KRITICKÁ CHYBA PŘI NAČÍTÁNÍ MODELŮ Z BACKENDU: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"ML Service startuje na zařízení: {DEVICE}")
    load_models_from_backend()
    yield # Zde aplikace běží
    print("Vypínám ML Servisu...")

# Inicializace FastAPI aplikace s novým lifespan
app = FastAPI(title="Machine Learning Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],    
)

# ... (Níže už pokračují tvé pomocné funkce def process_signal_to_tensor() a všechny endpointy, beze změny) ...
FAULT_CLASSES = {
    0: "Zdravé ložisko (Normal)",
    1: "Porucha vnitřního kroužku (Inner Race) - IR_007",
    2: "Porucha vnitřního kroužku (Inner Race) - IR_014",
    3: "Porucha vnitřního kroužku (Inner Race) - IR_021",
    4: "Porucha valivého elementu (Ball Fault) - Ball_007",
    5: "Porucha valivého elementu (Ball Fault) - Ball_014",
    6: "Porucha valivého elementu (Ball Fault) - Ball_021",
    7: "Porucha vnějšího kroužku (Outer Race) - OR_007",
    8: "Porucha vnějšího kroužku (Outer Race) - OR_014",
    9: "Porucha vnějšího kroužku (Outer Race) - OR_021" 
}
# ==========================================
# POMOCNÁ FUNKCE PRO CWT DO TENZORU
# ==========================================
def process_signal_to_tensor(signal_frame):
    """Zpracuje 1D signál přes CWT přímo do PyTorch tenzoru o velikosti 256x256"""
    fs = 25600
    frequencies = np.linspace(50, 6500, IMG_SIZE)
    scales = pywt.frequency2scale(WAVELET, frequencies / fs)
    
    coeffs, _ = pywt.cwt(signal_frame, scales, WAVELET)
    amplitude = np.abs(coeffs)
    
    # Převod na PyTorch tensor: přidání batch a channel dimenze -> (1, 1, H, W)
    tensor = torch.tensor(amplitude, dtype=torch.float32).unsqueeze(0).unsqueeze(0)
    
    # Rychlý resize pomocí PyTorch (místo OpenCV)
    net_tfr = F.interpolate(tensor, size=(IMG_SIZE, IMG_SIZE), mode='bilinear', align_corners=False)
    
    # Normalizace do rozsahu [-1, 1] jako při tréninku
    tfr_min = net_tfr.min()
    tfr_max = net_tfr.max()
    if tfr_max - tfr_min > 0:
        net_tfr = (net_tfr - tfr_min) / (tfr_max - tfr_min) # [0, 1]
        net_tfr = net_tfr * 2.0 - 1.0                       # [-1, 1]
        
    return net_tfr

# ==========================================
# Base Model pro trenink
# ==========================================
class FineTunePayload(BaseModel):
    file_paths: List[str]     # Seznam cest k souborům na APC
    webhook_url: str          # URL na backendu (např. "http://backend:8000/api/webhook/train-done")
    save_path: str
    epochs: int = 10          # Volitelné, pro ladění z frontendu
    batch_size: int = 16

class LabeledMeasurement(BaseModel):
    path: str
    label: int  # 0 až 9 (indexy podle tvého FAULT_CLASSES)

class FineTune1DCNNPayload(BaseModel):
    measurements: List[LabeledMeasurement]
    webhook_url: str
    save_path: str
    epochs: int = 10
    batch_size: int = 64

class FineTuneRULPayload(BaseModel):
    category: str             # "OR", "IR", nebo "O"
    file_paths: List[str]     # MUSÍ BÝT CHRONOLOGICKY SEŘAZENÉ!
    webhook_url: str
    save_path: str
    epochs: int = 50          # Pro LSTM stačí méně epoch
    batch_size: int = 32

@app.get("/")
def home():
    return {"message": "Inference service is running"}

# ==========================================
# AI ENDPOINTY
# ==========================================
@app.post("/analyze-anomaly")
def analyze_anomaly(payload: dict):
    path = payload.get("path")
    try:
        # 1. Načtení dat a ořez na FRAME_SIZE (1024)
        df = pd.read_csv(path)
        signal = df.iloc[:, 0].values[:FRAME_SIZE]
        signal = signal - np.mean(signal) # Odstranění DC offsetu
        
        # 2. CWT Transformace na tensor
        x_tensor = process_signal_to_tensor(signal).to(DEVICE)
        
        # 3. Ensemble inference (Průměrování skóre ze 3 modelů)
        total_anomaly_score = 0.0
        criterion_mse = nn.MSELoss()
        
        with torch.no_grad():
            for i in range(3):
                enc = encoders[i]
                dec = decoders[i]
                disc = discriminators[i]
                
                # Průchod Enkodérem a Dekodérem
                z = enc(x_tensor)
                x_reconstructed = dec(z)
                
                # Výpočet L_r (Reconstruction Loss - jak špatně to dekodér poskládal)
                loss_r = criterion_mse(x_reconstructed, x_tensor).item()
                
                # Výpočet L_d (Discriminator / Feature Loss)
                # Použijeme tvou extract_features metodu z models.py!
                feat_real = disc.extract_features(x_tensor)
                feat_reconstructed = disc.extract_features(x_reconstructed)
                loss_d = criterion_mse(feat_reconstructed, feat_real).item()
                
                # Celkové skóre za jeden pár
                pair_score = loss_r + loss_d
                total_anomaly_score += pair_score
                
        # Průměr za všechny modely v ensemble
        final_score = total_anomaly_score / 3.0
        
        # 4. Vyhodnocení anomálie podle prahu
        # Hodnota odhadnutá z tvého článku. Pokud to bude házet false positives/negatives, tuto hodnotu změníš.
        THRESHOLD = 0.023 
        is_anomaly = bool(final_score > THRESHOLD)
        
        return {
            "anomaly_score": final_score,
            "is_anomaly": is_anomaly
        }
        
    except Exception as e:
        print(f"Chyba při výpočtu anomálie: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/classify-fault")
def classify_fault(payload: dict):
    path = payload.get("path")
    try:
        # 1. Načtení dat a ořez přesně na 4096 bodů (jako v CWRUDataset)
        df = pd.read_csv(path)
        signal = df.iloc[:, 0].values[:4096] 
        
        # 2. Výpočet komplexní FFT přesně podle dataset.py a článku
        fft_complex = np.fft.fft(signal)
        fft_shifted = np.fft.fftshift(fft_complex)
        
        # 3. Získání amplitudy a fáze do dvou samostatných kanálů
        magnitude = np.abs(fft_shifted)
        phase = np.angle(fft_shifted)
        
        # 4. Standardizace a normalizace (Klíčové pro to, aby síť poznala, co se učila)
        magnitude = (magnitude - np.mean(magnitude)) / (np.std(magnitude) + 1e-8)
        phase = phase / np.pi
        
        # 5. Složení do tenzoru o tvaru (2, 4096)
        features = np.stack([magnitude, phase], axis=0)
        
        # Převedení na PyTorch tensor s batch dimenzí -> tvar (1, 2, 4096)
        input_tensor = torch.tensor(features, dtype=torch.float32).unsqueeze(0).to(DEVICE)
        
        # 6. Inference přes CNN
        with torch.no_grad():
            output = cnn_model(input_tensor)
            
            # Aplikace softmaxu pro získání pravděpodobností 0-1
            probabilities = F.softmax(output, dim=1).squeeze()
            
            # Nalezení třídy s nejvyšší pravděpodobností
            predicted_class = torch.argmax(probabilities).item()
            confidence = probabilities[predicted_class].item()
            
        fault_type_text = FAULT_CLASSES.get(predicted_class, "Neznámá porucha")
        
        return {
            "fault_type": fault_type_text,
            "confidence": float(confidence)
        }
        
    except Exception as e:
        print(f"Chyba při klasifikaci poruchy (1D_CNN): {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict-rul")
def predict_rul(payload: dict):
    paths = payload.get("paths", [])
    category = payload.get("category", "O")
    
    if len(paths) != 10:
        raise HTTPException(status_code=400, detail="Pro LSTM okno je vyžadováno přesně 10 cest k měřením.")
        
    if category not in bilstm_models:
        category = "O" # Fallback na obecný model
        
    try:
        # 1. Extrakce 14 příznaků pro každé z 10 měření
        sequence_features = []
        for p in paths:
            features = extract_14_features(p)
            sequence_features.append(features)
            
        sequence_features = np.array(sequence_features) # Tvar (10, 14)
        
        # 2. ŠKÁLOVÁNÍ (Důležitá poznámka níže!)
        # Jelikož nemáme načtený globální scaler z tréninku, naškálujeme aktuální okno. 
        # (V produkci bys zde měl použít joblib.load('scaler.gz') z tvého tréninku).
        scaler = MinMaxScaler()
        scaled_sequence = scaler.fit_transform(sequence_features)
        
        # 3. Příprava tenzoru pro LSTM -> tvar (Batch, Sequence, Features) -> (1, 10, 14)
        input_tensor = torch.tensor(scaled_sequence, dtype=torch.float32).unsqueeze(0).to(DEVICE)
        
        # 4. Inference
        model = bilstm_models[category]
        with torch.no_grad():
            output = model(input_tensor)
            rul_fraction = output.item()
            
        # Oříznutí výsledku do mezí 0.0 - 1.0 (pro jistotu, regrese může občas ustřelit)
        rul_fraction = max(0.0, min(1.0, rul_fraction))
        
        return {
            "rul_fraction": rul_fraction,
            "used_model": f"Bi-LSTM ({category})"
        }
        
    except Exception as e:
        print(f"Chyba při RUL predikci: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# STÁVAJÍCÍ DATA ENDPOINTY
# ==========================================
@app.post("/process-features")
def process_features(payload: dict):
    path = payload.get("path")
    try:
        df = pd.read_csv(path)
        signal = df.iloc[:, 0].values 
        
        rms = np.sqrt(np.mean(signal**2))
        kurt = kurtosis(signal)
        peak = np.max(np.abs(signal))
        max_v = np.max(signal)
        min_v = np.min(signal)
        crest = peak / rms if rms != 0 else 0
        
        return {
            "rms_raw": float(rms),
            "kurtosis_raw": float(kurt),
            "peak_raw": float(peak),
            "max_val": float(max_v),
            "min_val": float(min_v),
            "crest_factor": float(crest)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/get-raw-data")
def get_raw_data(payload: dict):
    path = payload.get("path")
    step = payload.get("step", 16) 
    try:
        df = pd.read_csv(path)
        signal = df.iloc[::step, 0].tolist() 
        return signal
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))   
    
@app.post("/get-fft")
def get_fft(payload: dict):
    path = payload.get("path")
    fs = payload.get("fs", 25600)
    
    try:
        df = pd.read_csv(path)
        signal = df.iloc[:, 0].values
        signal = signal - np.mean(signal)
        n = len(signal)
        
        yf = np.abs(rfft(signal)) / n * 2 
        xf = rfftfreq(n, 1 / fs)
        step = max(1, len(xf) // 2000)
        
        return {
            "frequencies": xf[::step].tolist(),
            "amplitudes": yf[::step].tolist()
        }
    except Exception as e:
        print(f"Chyba při výpočtu FFT: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/get-cwt")
def get_cwt(payload: dict):
    path = payload.get("path")
    fs = payload.get("fs", 25600) 
    
    try:
        df = pd.read_csv(path)
        signal = df.iloc[:, 0].values
        signal = signal - np.mean(signal)

        factor = max(1, len(signal) // 2000) 
        signal_reduced = signal[::factor]
        fs_reduced = fs / factor 

        frequencies = np.linspace(50, 6500, IMG_SIZE)
        scales = pywt.frequency2scale(WAVELET, frequencies / fs_reduced)
        
        coeffs, _ = pywt.cwt(signal_reduced, scales, WAVELET)
        amplitude = np.abs(coeffs)
        
        fig, ax = plt.subplots(figsize=(6, 4))
        time_extent = len(signal) / fs 
        
        ax.imshow(amplitude, cmap='jet', aspect='auto', origin='lower', 
                  extent=[0, time_extent, 50, 6500])
        
        ax.set_ylabel("Frekvence (Hz)", fontsize=10)
        ax.set_xlabel("Čas (s)", fontsize=10)
        plt.tight_layout()
        
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=100)
        plt.close(fig)
        
        buf.seek(0)
        base64_str = base64.b64encode(buf.read()).decode('utf-8')
        img_data_url = f"data:image/png;base64,{base64_str}"
        
        return {"cwt_image": img_data_url}

    except Exception as e:
        print(f"Chyba při výpočtu CWT: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
# ==========================================
# FINE-TUNNING ENDPOINTY
# ==========================================
@app.post("/trigger-finetuning")
def trigger_finetuning(payload: FineTunePayload, background_tasks: BackgroundTasks):
    """
    Endpoint volaný backendem. Okamžitě vrací 200 OK a trénink spouští na pozadí.
    """
    if not payload.file_paths:
        raise HTTPException(status_code=400, detail="Nebyla dodána žádná data pro trénink.")
    
    # 2. Zařazení úlohy do fronty na pozadí
    background_tasks.add_task(
        run_training_pipeline, 
        file_paths=payload.file_paths, 
        webhook_url=payload.webhook_url,
        epochs=payload.epochs,
        batch_size=payload.batch_size
    )
    
    # 3. Okamžitá odpověď pro backend (timeout nehrozí)
    return {
        "status": "accepted",
        "message": "Trénink byl úspěšně spuštěn na pozadí.",
        "files_to_process": len(payload.file_paths)
    }

@app.post("/trigger-finetuning-1dcnn")
def trigger_finetuning_1dcnn(payload: FineTune1DCNNPayload, background_tasks: BackgroundTasks):
    """
    Endpoint pro spuštění přetrénování klasifikátoru.
    """
    if not payload.measurements:
        raise HTTPException(status_code=400, detail="Nebyla dodána žádná data pro trénink.")
    
    # Převod na list slovníků pro background task
    data_to_train = [{"path": m.path, "label": m.label} for m in payload.measurements]
    
    background_tasks.add_task(
        run_1dcnn_training_pipeline, 
        measurements=data_to_train, 
        webhook_url=payload.webhook_url,
        epochs=payload.epochs,
        batch_size=payload.batch_size
    )
    
    return {"status": "accepted", "message": "Fine-tuning 1DCNN spuštěn na pozadí."}

@app.post("/trigger-finetuning-rul")
def trigger_finetuning_rul(payload: FineTuneRULPayload, background_tasks: BackgroundTasks):
    if len(payload.file_paths) <= 10:
        raise HTTPException(status_code=400, detail="Pro okno velikosti 10 je potřeba více než 10 souborů.")
        
    background_tasks.add_task(
        run_rul_training_pipeline, 
        category=payload.category,
        file_paths=payload.file_paths,
        webhook_url=payload.webhook_url,
        epochs=payload.epochs,
        batch_size=payload.batch_size
    )
    return {"status": "accepted", "message": f"Bi-LSTM fine-tuning spuštěn pro kategorii {payload.category}."}

@app.post("/reload")
def reload_active_models():
    """
    Endpoint volaný backendem po změně produkční verze.
    Způsobí okamžité přenačtení modelů z disku do paměti.
    """
    try:
        print("\n[RELOAD] Přijat požadavek na aktualizaci produkčních modelů...")
        # Vymažeme staré seznamy, aby se modely neduplikovaly v paměti
        global encoders, decoders, discriminators, cnn_model, bilstm_models
        encoders, decoders, discriminators = [], [], []
        
        # Spustíme naši existující načítací funkci
        load_models_from_backend()
        
        return {"status": "success", "message": "Modely byly úspěšně přenačteny."}
    except Exception as e:
        print(f"[RELOAD] Chyba při přenačítání: {e}")
        raise HTTPException(status_code=500, detail=str(e))