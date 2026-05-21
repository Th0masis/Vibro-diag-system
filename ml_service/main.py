import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
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
from utils import extract_14_features, clean_and_overwrite_csv
from train_aeanowgan import run_training_pipeline
from train_1dcnn import run_1dcnn_training_pipeline
from train_rul import run_rul_training_pipeline

# Načtení proměnných prostředí z .env souboru (pokud existuje)
load_dotenv()

# CWT konfigurace
IMG_SIZE = 256
WAVELET = 'cmor1.5-1.0'
FRAME_SIZE = 1024

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Dynamické URL s fallbackem pro lokální vývoj
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

encoders = []
decoders = []
discriminators = []
cnn_model = None
bilstm_models = {}

def load_models_from_backend():
    global encoders, decoders, discriminators, cnn_model, bilstm_models
    print(f"Dotazuji se backendu na nejnovější 'ready' modely přes: {BACKEND_URL}...")
    
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
            cnn_model = BearingFault1DCNN(num_classes=4).to(DEVICE) # <-- Opraveno na 4 třídy z naší diplomky
            cnn_model.load_state_dict(torch.load(cnn_path, map_location=DEVICE))
            cnn_model.eval()
            print(f"1D_CNN načten z: {cnn_path}")

        # 3. Načtení Bi-LSTM (očekává složku)
        lstm_dir = active_paths.get("Bi-LSTM")
        if lstm_dir:
            for cat in ['OR', 'IR', 'O']:
                try:
                    model_rul = BiLSTM_RUL(input_size=6).to(DEVICE) # <-- Opraveno na 6 příznaků z naší diplomky
                    model_rul.load_state_dict(torch.load(f"{lstm_dir}/bilstm_model_single_{cat}.pth", map_location=DEVICE))
                    model_rul.eval()
                    bilstm_models[cat] = model_rul
                except Exception as e:
                    print(f"Upozornění: RUL model {cat} nenačten ({e})")
            print(f"Bi-LSTM RUL modely načteny z: {lstm_dir}")

    except Exception as e:
        print(f"UPOZORNĚNÍ PŘI NAČÍTÁNÍ MODELŮ: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"ML Service startuje na zařízení: {DEVICE}")
    load_models_from_backend()
    yield
    print("Vypínám ML Servisu...")

app = FastAPI(title="Machine Learning Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],    
)

# Sloučené třídy z 1D-CNN (podle naší diplomky)
FAULT_CLASSES = {
    0: "Zdravé ložisko (Normal)",
    1: "Porucha vnitřního kroužku (Inner Race)",
    2: "Porucha valivého elementu (Ball Fault)",
    3: "Porucha vnějšího kroužku (Outer Race)"
}

def extract_valid_signal(df):
    """Pomocná funkce pro bezpečné načtení dat bez NaN chyb z prázdného indexu"""
    col_name = 'yAxis' if 'yAxis' in df.columns else df.columns[-1]
    signal = pd.to_numeric(df[col_name], errors='coerce').dropna().values
    return signal

def process_signal_to_tensor(signal_frame):
    fs = 25600
    frequencies = np.linspace(50, 6500, IMG_SIZE)
    scales = pywt.frequency2scale(WAVELET, frequencies / fs)
    
    coeffs, _ = pywt.cwt(signal_frame, scales, WAVELET)
    amplitude = np.abs(coeffs)
    
    tensor = torch.tensor(amplitude, dtype=torch.float32).unsqueeze(0).unsqueeze(0)
    net_tfr = F.interpolate(tensor, size=(IMG_SIZE, IMG_SIZE), mode='bilinear', align_corners=False)
    
    tfr_min = net_tfr.min()
    tfr_max = net_tfr.max()
    if tfr_max - tfr_min > 0:
        net_tfr = (net_tfr - tfr_min) / (tfr_max - tfr_min)
        net_tfr = net_tfr * 2.0 - 1.0
        
    return net_tfr

class FineTunePayload(BaseModel):
    file_paths: List[str]
    webhook_url: str
    save_path: str
    epochs: int = 10
    batch_size: int = 16

class LabeledMeasurement(BaseModel):
    path: str
    label: int

class FineTune1DCNNPayload(BaseModel):
    measurements: List[LabeledMeasurement]
    webhook_url: str
    save_path: str
    epochs: int = 10
    batch_size: int = 64

class RULMeasurement(BaseModel):
    path: str
    date: str

class FineTuneRULPayload(BaseModel):
    category: str
    measurements: List[RULMeasurement]
    lifecycle_info: dict
    webhook_url: str
    save_path: str
    epochs: int = 50
    batch_size: int = 32

@app.get("/")
def home():
    return {"message": "Inference service is running"}

@app.post("/analyze-anomaly")
def analyze_anomaly(payload: dict):
    path = payload.get("path")
    try:
        df = pd.read_csv(path)
        
        # Bezpečné načtení signálu (ignoruje prázdný nultý sloupec)
        signal = extract_valid_signal(df)
        
        if len(signal) < FRAME_SIZE:
            raise ValueError(f"Soubor neobsahuje dostatek platných dat. Minimum je {FRAME_SIZE} vzorků.")
            
        signal = signal[:FRAME_SIZE]
        signal = signal - np.mean(signal) # Odstranění stejnosměrné složky
        
        x_tensor = process_signal_to_tensor(signal).to(DEVICE)
        
        total_anomaly_score = 0.0
        criterion_mse = nn.MSELoss()
        
        with torch.no_grad():
            for i in range(3):
                if len(encoders) <= i:
                    return {"anomaly_score": 0.0, "is_anomaly": False, "error": "Modely nejsou načteny"}
                    
                enc = encoders[i]
                dec = decoders[i]
                disc = discriminators[i]
                
                z = enc(x_tensor)
                x_reconstructed = dec(z)
                
                loss_r = criterion_mse(x_reconstructed, x_tensor).item()
                
                feat_real = disc.extract_features(x_tensor)
                feat_reconstructed = disc.extract_features(x_reconstructed)
                loss_d = criterion_mse(feat_reconstructed, feat_real).item()
                
                total_anomaly_score += (loss_r + loss_d)
                
        final_score = total_anomaly_score / 3.0
        
        # Bezpečná pojistka pro JSON
        if np.isnan(final_score) or np.isinf(final_score):
            final_score = 0.0
            
        THRESHOLD = 0.75
        is_anomaly = bool(final_score > THRESHOLD)
        
        return {
            "anomaly_score": float(final_score),
            "is_anomaly": is_anomaly
        }
        
    except Exception as e:
        print(f"Chyba při výpočtu anomálie: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/classify-fault")
def classify_fault(payload: dict):
    path = payload.get("path")
    try:
        df = pd.read_csv(path)
        
        # Bezpečné načtení
        signal = extract_valid_signal(df)
        
        if len(signal) < 4096:
            # Padding nulami, pokud je signál moc krátký
            signal = np.pad(signal, (0, 4096 - len(signal)), 'constant')
        else:
            signal = signal[:4096]
        
        fft_complex = np.fft.fft(signal)
        fft_shifted = np.fft.fftshift(fft_complex)
        
        magnitude = np.abs(fft_shifted)
        phase = np.angle(fft_shifted)
        
        magnitude = (magnitude - np.mean(magnitude)) / (np.std(magnitude) + 1e-8)
        phase = phase / np.pi
        
        features = np.stack([magnitude, phase], axis=0)
        input_tensor = torch.tensor(features, dtype=torch.float32).unsqueeze(0).to(DEVICE)
        
        if cnn_model is None:
             return {"fault_type": "Model nenalezen", "confidence": 0.0}
             
        with torch.no_grad():
            output = cnn_model(input_tensor)
            probabilities = F.softmax(output, dim=1).squeeze()
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
    # Přijímáme přímo hotovou matici 10x6
    sequence_features = payload.get("features", [])
    category = payload.get("category", "O")
    
    if len(sequence_features) != 10:
        raise HTTPException(status_code=400, detail="Pro LSTM okno je vyžadována matice přesně 10 vektorů.")
        
    if category not in bilstm_models:
        category = "O" 
        
    try:
        # Převedeme čistě na numpy array (Tvar: 10, 6)
        seq_array = np.array(sequence_features)
        
        # Škálování aktuálního okna (v produkci ideálně nahradit scalerem z tréninku)
        scaler = MinMaxScaler()
        scaled_sequence = scaler.fit_transform(seq_array)
        
        # Příprava tenzoru pro LSTM -> tvar (Batch, Sequence, Features) -> (1, 10, 6)
        input_tensor = torch.tensor(scaled_sequence, dtype=torch.float32).unsqueeze(0).to(DEVICE)
        
        # Inference
        model = bilstm_models[category]
        with torch.no_grad():
            output = model(input_tensor)
            rul_fraction = output.item()
            
        rul_fraction = max(0.0, min(1.0, rul_fraction))
        
        return {
            "rul_fraction": rul_fraction,
            "used_model": f"Bi-LSTM ({category})"
        }
        
    except Exception as e:
        print(f"Chyba při RUL predikci: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/process-features")
def process_features(payload: dict):
    path = payload.get("path")
    if not path:
        raise HTTPException(status_code=400, detail="V požadavku chybí cesta")
    try:
        features = clean_and_overwrite_csv(path)
        return features
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/get-raw-data")
def get_raw_data(payload: dict):
    path = payload.get("path")
    step = payload.get("step", 16)
    if not path:
        raise HTTPException(status_code=400, detail="Chybí cesta")
    try:
        df = pd.read_csv(path)
        signal = extract_valid_signal(df)
        return {"signal": signal[::step].tolist()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/get-fft")
def get_fft(payload: dict):
    path = payload.get("path")
    if not path:
        raise HTTPException(status_code=400, detail="Chybí cesta")
    try:
        df = pd.read_csv(path)
        signal = extract_valid_signal(df)
        
        if len(signal) == 0:
            return {"frequencies": [], "amplitudes": []}

        fs = 12800 
        n = len(signal)
        
        fft_result = np.fft.fft(signal)
        freqs = np.fft.fftfreq(n, d=1/fs)

        half_n = n // 2
        pos_freqs = freqs[:half_n]
        pos_amps = (2.0 / n) * np.abs(fft_result[:half_n])

        step = 2
        return {
            "frequencies": pos_freqs[::step].tolist(),
            "amplitudes": pos_amps[::step].tolist()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/get-cwt")
def get_cwt(payload: dict):
    path = payload.get("path")
    if not path:
        raise HTTPException(status_code=400, detail="Chybí cesta")
    try:
        df = pd.read_csv(path)
        signal = extract_valid_signal(df)[::2] 
        fs = 12800 / 2 
        
        wavelet = 'cmor1.5-1.0'
        frequencies = np.linspace(50, fs/2, 128)
        scales = pywt.frequency2scale(wavelet, frequencies / fs)
        
        coeffs, _ = pywt.cwt(signal, scales, wavelet)
        amplitude = np.abs(coeffs)
        
        fig, ax = plt.subplots(figsize=(6, 4))
        time_max = len(signal) / fs
        ax.imshow(amplitude, extent=[0, time_max, frequencies[-1], frequencies[0]], 
                  aspect='auto', cmap='jet')
        ax.invert_yaxis()
        ax.set_ylabel("Frekvence [Hz]")
        ax.set_xlabel("Čas [s]")
        plt.tight_layout()
        
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=100)
        plt.close(fig)
        buf.seek(0)
        encoded = base64.b64encode(buf.read()).decode('utf-8')
        
        return {"cwt_image": f"data:image/png;base64,{encoded}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/trigger-finetuning")
def trigger_finetuning(payload: FineTunePayload, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_training_pipeline, file_paths=payload.file_paths, webhook_url=payload.webhook_url)
    return {"status": "accepted"}

@app.post("/trigger-finetuning-1dcnn")
def trigger_finetuning_1dcnn(payload: FineTune1DCNNPayload, background_tasks: BackgroundTasks):
    data_to_train = [{"path": m.path, "label": m.label} for m in payload.measurements]
    background_tasks.add_task(run_1dcnn_training_pipeline, measurements=data_to_train, webhook_url=payload.webhook_url)
    return {"status": "accepted"}

@app.post("/trigger-finetuning-rul")
def trigger_finetuning_rul(payload: FineTuneRULPayload, background_tasks: BackgroundTasks):
    # Převod Pydantic modelů na obyčejné slovníky pro trénovací skript
    data_to_train = [{"path": m.path, "date": m.date} for m in payload.measurements]
    
    background_tasks.add_task(
        run_rul_training_pipeline, 
        category=payload.category, 
        measurements=data_to_train, 
        lifecycle_info=payload.lifecycle_info,
        webhook_url=payload.webhook_url,
        save_path=payload.save_path,
        epochs=payload.epochs,
        batch_size=payload.batch_size
    )
    return {"status": "accepted"}

@app.post("/reload")
def reload_active_models():
    try:
        global encoders, decoders, discriminators, cnn_model, bilstm_models
        encoders, decoders, discriminators = [], [], []
        load_models_from_backend()
        return {"status": "success", "message": "Modely byly úspěšně přenačteny."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))