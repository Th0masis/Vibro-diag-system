from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from scipy.stats import kurtosis
from scipy.fft import rfft, rfftfreq
import joblib
import numpy as np
import pandas as pd
import io, base64, pywt
import matplotlib.pyplot as plt
from rul_models import RULPredictor, LSTMPredictor


# Definice vstupních dat (co nám pošle backend nebo frontend)
class VibrationData(BaseModel):
    rms: float
    kurtosis: float
    ptp: float

# Nový model pro vstup dat RUL
class RULRequest(BaseModel):
    history: List[float]    # Seznam RMS hodnot (např. [0.5, 0.6, 0.8...])
    limit: float = 10.0     # Kdy to bouchne (default 10)

app = FastAPI(title="Machine Learning Service")
# Nastaveni middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],    
)

# Načtení natrénovaného modelu hned při startu
model = joblib.load('models/mafaulda_model.joblib')
lstm_model = LSTMPredictor(model_path="./models/model_rul.h5", scaler_path="./models/scaler_rul.pkl")
# CWT konfigurace
IMG_SIZE = 256
WAVELET = 'cmor1.5-1.0'

@app.get("/")
def home():
    return {"message": "Inference service is running"}

@app.post("/predict")
def predict(data: VibrationData):
    # Převod dat pro model (vstup musí být 2D pole)
    features_df = pd.DataFrame([{
        "rms": data.rms,
        "kurtosis": data.kurtosis,
        "ptp": data.ptp
    }])
    
    # Výpočet predikce
    prediction = model.predict(features_df)[0]
    
    # Výpočet pravděpodobnosti (jak moc si je model jistý)
    probabilities = model.predict_proba(features_df)[0]
    confidence = float(np.max(probabilities))
    
    result = "PORUCHA" if prediction == 1 else "V POŘÁDKU"
    
    return {
        "status": result,
        "label": int(prediction),
        "confidence": round(confidence, 4)
    }

@app.post("/predict-rul")
def predict_remaining_life(data: RULRequest):
    # 1. Matematické modely
    math_predictor = RULPredictor(limit_threshold=data.limit)
    lin_rul = math_predictor.predict_linear(data.history)
    exp_rul = math_predictor.predict_exponential(data.history)
    
    # 2. AI Model (LSTM)
    lstm_rul_days = lstm_model.predict(data.history)
    
    # 3. Logika pro výběr vítěze
    # Priorita: LSTM (pokud funguje) -> Exponenciála -> Lineární
    final_prediction = lin_rul
    selected_method = "linear"

    if exp_rul is not None:
        final_prediction = exp_rul
        selected_method = "exponential"
        
    if lstm_rul_days is not None:
        final_prediction = lstm_rul_days
        selected_method = "lstm_ai"

    return {
        "models": {
            "linear_rul_days": round(lin_rul, 1) if lin_rul else None,
            "exponential_rul_days": round(exp_rul, 1) if exp_rul else None,
            "lstm_ai_rul_days": round(lstm_rul_days, 1) if lstm_rul_days else None
        },
        "recommended_model": selected_method,
        "final_prediction_days": round(final_prediction, 1) if final_prediction else None
    }

# DATA PART
@app.post("/process-features")
def process_features(payload: dict):
    path = payload.get("path")
    try:
        df = pd.read_csv(path)
        signal = df.iloc[:, 0].values # První sloupec (H nebo V dle souboru)
        
        # Výpočty
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
    # Downsampling pro frontend (např. každý 16. bod)
    step = payload.get("step", 16) 
    try:
        df = pd.read_csv(path)
        signal = df.iloc[::step, 0].tolist() # Každý n-tý bod
        return signal
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))   
    
@app.post("/get-fft")
def get_fft(payload: dict):
    path = payload.get("path")
    fs = payload.get("fs", 25600)  # Výchozí vzorkovací frekvence pro XJTU-SY
    
    try:
        df = pd.read_csv(path)
        signal = df.iloc[:, 0].values
        
        # 1. Odstranění stejnosměrné složky (DC offset)
        signal = signal - np.mean(signal)
        
        n = len(signal)
        
        # 2. Výpočet reálné FFT (efektivnější než klasická FFT)
        yf = np.abs(rfft(signal)) / n * 2  # Normalizace amplitudy
        xf = rfftfreq(n, 1 / fs)
        
        # 3. Downsampling pro frontend (prohlížeč by se zbláznil vykreslovat 16000 bodů)
        # Zredukujeme to např. na cca 2000-3000 bodů pro plynulý graf
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
    fs = payload.get("fs", 25600)  # XJTU-SY frekvence
    
    try:
        df = pd.read_csv(path)
        signal = df.iloc[:, 0].values # Celý snapshot (cca 32768 bodů = 1.28 s)
        
        # Odečtení DC offsetu
        signal = signal - np.mean(signal)

        # 1. DOWNSAMPLING pro CWT vizualizaci
        # Zredukujeme 32k bodů na zhruba 2000 bodů, ať to netrvá věčnost.
        # Poměr zmenšení (downsample factor)
        factor = max(1, len(signal) // 2000) 
        signal_reduced = signal[::factor]
        fs_reduced = fs / factor # Musíme úměrně snížit i vzorkovací frekvenci!

        # 2. Výpočet scales pro ZMENŠENOU frekvenci
        frequencies = np.linspace(50, 6500, IMG_SIZE)
        scales = pywt.frequency2scale(WAVELET, frequencies / fs_reduced)
        
        # 3. Transformace (teď to bude rychlé)
        coeffs, _ = pywt.cwt(signal_reduced, scales, WAVELET)
        amplitude = np.abs(coeffs)
        
        # --- Vykreslení obrázku ---
        fig, ax = plt.subplots(figsize=(6, 4))
        
        # Skutečná délka měření v sekundách (z původního signálu)
        time_extent = len(signal) / fs 
        
        ax.imshow(amplitude, cmap='jet', aspect='auto', origin='lower', 
                  extent=[0, time_extent, 50, 6500])
        
        ax.set_ylabel("Frekvence (Hz)", fontsize=10)
        ax.set_xlabel("Čas (s)", fontsize=10)
        plt.tight_layout()
        
        # Uložení do paměti a Base64
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