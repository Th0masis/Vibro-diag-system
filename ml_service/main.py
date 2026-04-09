from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from scipy.stats import kurtosis, skew
from scipy.fft import rfft, rfftfreq
from sklearn.preprocessing import MinMaxScaler
import numpy as np
import pandas as pd
import io, base64, pywt
import matplotlib.pyplot as plt
import torch
import torch.nn as nn
import torch.nn.functional as F
# Importujeme tvé modely (Generator přejmenujeme na lokální Decoder pro přehlednost)
from models import Encoder, Generator as Decoder, Discriminator
from models import BearingFault1DCNN
from models import BiLSTM_RUL

app = FastAPI(title="Machine Learning Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],    
)

# CWT konfigurace
IMG_SIZE = 256
WAVELET = 'cmor1.5-1.0'
FRAME_SIZE = 1024

# ==========================================
# NAČTENÍ AI MODELŮ DO PAMĚTI (PŘI STARTU)
# ==========================================
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"ML Service běží na zařízení: {DEVICE}")

ANOMALY_MODEL_DIR = "./models/AE_ANOWGAN"
CLASSIFY_MODEL_DIR = "./models/1DCNN"
RUL_MODEL_DIR = "./models/Bi-LSTM"

FAULT_CLASSES = {
    0: "Zdravé ložisko (Normal)",
    1: "Porucha vnitřního kroužku (Inner Race) - IR_007",
    2: "Porucha vnitřního kroužku (Inner Race) - IR_014",
    3: "Porucha vnitřního kroužku (Inner Race) - IR_021",
    4: "Porucha valivého elementu (Ball Fault) - Ball_007",
    5: "Porucha valivého elementu (Ball Fault) - Ball_014",
    6: "Porucha valivého elementu (Ball Fault) - Ball_021",
    6: "Porucha vnějšího kroužku (Outer Race) - OR_007",
    7: "Porucha vnějšího kroužku (Outer Race) - OR_014",
    8: "Porucha vnějšího kroužku (Outer Race) - OR_021" 
}

encoders = []
decoders = []
discriminators = []

try:
    for i in range(3):
        enc = Encoder().to(DEVICE)
        dec = Decoder().to(DEVICE)
        disc = Discriminator().to(DEVICE)
        
        enc.load_state_dict(torch.load(f"{ANOMALY_MODEL_DIR}/encoder_final_{i}.pth", map_location=DEVICE))
        dec.load_state_dict(torch.load(f"{ANOMALY_MODEL_DIR}/decoder_final_{i}.pth", map_location=DEVICE))
        disc.load_state_dict(torch.load(f"{ANOMALY_MODEL_DIR}/discriminator_final_{i}.pth", map_location=DEVICE))
        
        # Přepnutí do inferenčního módu (vypne trénovací vlastnosti jako Dropout)
        enc.eval()
        dec.eval()
        disc.eval()
        
        encoders.append(enc)
        decoders.append(dec)
        discriminators.append(disc)
    print("Všechny 3 páry AE-AnoWGAN modelů úspěšně načteny!")
    cnn_model = BearingFault1DCNN().to(DEVICE)
    cnn_model.load_state_dict(torch.load(f"{CLASSIFY_MODEL_DIR}/bearing_fault_model.pth", map_location=DEVICE))
    cnn_model.eval()
    print("1D_CNNwWGN model úspěšně načten!")
    bilstm_models = {}
    for cat in ['OR', 'IR', 'O']:
        try:
            model_rul = BiLSTM_RUL(input_size=14).to(DEVICE)
            model_rul.load_state_dict(torch.load(f"{RUL_MODEL_DIR}/bilstm_model_single_{cat}.pth", map_location=DEVICE))
            model_rul.eval()
            bilstm_models[cat] = model_rul
            print(f"Bi-LSTM RUL model pro kategorii {cat} úspěšně načten!")
        except Exception as e:
            print(f"VAROVÁNÍ: Nepodařilo se načíst RUL model {cat}. Chyba: {e}")
except Exception as e:
    print(f"VAROVÁNÍ: Nepodařilo se načíst váhy modelů. Zkontroluj cestu. Chyba: {e}")


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

def extract_14_features(path):
    """Zkopírováno z tvého process_data.py - extrahuje 14 parametrů z H a V signálu."""
    try:
        # Tvá data mají H signál v 0. sloupci a V signál v 1. sloupci
        df = pd.read_csv(path, header=None)
        h_sig = pd.to_numeric(df.iloc[:, 0], errors='coerce').dropna().values
        v_sig = pd.to_numeric(df.iloc[:, 1], errors='coerce').dropna().values
        
        def calc_7_features(signal):
            if len(signal) == 0: return [0]*7
            rms = np.sqrt(np.mean(signal**2))
            var = np.var(signal)
            skewness = skew(signal)
            kurt = kurtosis(signal)
            peak = np.max(np.abs(signal))
            p2p = np.max(signal) - np.min(signal)
            crest = peak / rms if rms > 0 else 0
            return [rms, var, skewness, kurt, peak, p2p, crest]
            
        h_feats = calc_7_features(h_sig)
        v_feats = calc_7_features(v_sig)
        return h_feats + v_feats # Spojení do 1D pole o délce 14
    except Exception as e:
        print(f"Chyba při extrakci příznaků z {path}: {e}")
        return [0.0] * 14

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