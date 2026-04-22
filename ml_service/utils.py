import numpy as np
import pywt
import torch
from torch.utils.data import Dataset
import torch.nn.functional as F
from scipy.stats import kurtosis, skew
import pandas as pd

# --- KONFIGURACE ---
# POZOR: Nastav správnou FS podle toho, jaká data ti chodí z databáze!
FS = 25600  
FRAME_SIZE = 1024
IMG_SIZE = 256
WAVELET = 'cmor1.5-1.0'

print("[CHECKPOINT] utils.py: Modul načten. Konfigurace CWT nastavena.")

def process_signal_to_tensor(signal_frame):
    """
    Zpracuje 1D signál přes CWT přímo do PyTorch tenzoru o velikosti 256x256.
    Tuto funkci můžeš sdílet pro inferenci (main.py) i pro fine-tuning.
    """
    frequencies = np.linspace(50, 6500, IMG_SIZE)
    scales = pywt.frequency2scale(WAVELET, frequencies / FS)
    
    coeffs, _ = pywt.cwt(signal_frame, scales, WAVELET)
    amplitude = np.abs(coeffs)
    
    # Převod na PyTorch tensor: (1, 1, H, W)
    tensor = torch.tensor(amplitude, dtype=torch.float32).unsqueeze(0).unsqueeze(0)
    
    # Resize pomocí PyTorch (rychlejší na GPU a bez nutnosti cv2 v kontejneru)
    net_tfr = F.interpolate(tensor, size=(IMG_SIZE, IMG_SIZE), mode='bilinear', align_corners=False)
    
    # Normalizace [-1, 1]
    tfr_min = net_tfr.min()
    tfr_max = net_tfr.max()
    if tfr_max - tfr_min > 0:
        net_tfr = (net_tfr - tfr_min) / (tfr_max - tfr_min)
        net_tfr = net_tfr * 2.0 - 1.0
        
    return net_tfr.squeeze(0) # Odstranění batch dimenze -> (1, H, W)


class DatabaseFinetuneDataset(Dataset):
    """
    PyTorch Dataset, který za běhu generuje CWT matice z 1D signálů dodaných z DB.
    """
    def __init__(self, raw_signals, frame_size=FRAME_SIZE):
        """
        raw_signals: list nebo 1D numpy array dlouhého signálu z databáze.
        """
        print("[CHECKPOINT] Dataset: Inicializace datového setu pro fine-tuning...")
        self.frames = []
        
        # Spojíme všechna data do jednoho dlouhého pole (pokud přišel list měření)
        if isinstance(raw_signals, list):
            full_signal = np.concatenate(raw_signals)
        else:
            full_signal = raw_signals

        print(f"[CHECKPOINT] Dataset: Celková délka dostupného signálu: {len(full_signal)} bodů.")
        
        # Rozsekání na rámce (jako v tvém prepare_dataset skriptu)
        for i in range(0, len(full_signal) - frame_size + 1, frame_size):
            frame = full_signal[i : i + frame_size]
            # Odstranění DC offsetu (dobrá praxe z main.py)
            frame = frame - np.mean(frame)
            self.frames.append(frame)
            
        print(f"[CHECKPOINT] Dataset: Úspěšně vytvořeno {len(self.frames)} rámců o délce {frame_size}.")

    def __len__(self):
        return len(self.frames)

    def __getitem__(self, idx):
        frame = self.frames[idx]
        # Generování TFR za běhu! Ušetříme místo na disku v Docker kontejneru.
        tfr_tensor = process_signal_to_tensor(frame)
        return tfr_tensor
    
# --- Přidat do utils.py ---

def process_signal_to_fft_tensor(signal_window):
    """
    Zpracuje 4096 bodů do 2kanálového FFT tenzoru (Amplituda, Fáze).
    Standardizace podle tvého main.py a článku.
    """
    # 1. Komplexní FFT a shift
    fft_complex = np.fft.fft(signal_window)
    fft_shifted = np.fft.fftshift(fft_complex)
    
    # 2. Amplituda a fáze
    magnitude = np.abs(fft_shifted)
    phase = np.angle(fft_shifted)
    
    # 3. Standardizace (Z-score pro magnitudu, normalizace PI pro fázi)
    magnitude = (magnitude - np.mean(magnitude)) / (np.std(magnitude) + 1e-8)
    phase = phase / np.pi
    
    # 4. Složení do tenzoru (2, 4096)
    features = np.stack([magnitude, phase], axis=0)
    return torch.tensor(features, dtype=torch.float32)

class Database1DCNNDataset(Dataset):
    """
    Dataset pro řízený fine-tuning 1DCNN.
    """
    def __init__(self, raw_data_list, window_size=4096, shift=290):
        # raw_data_list: [{"signal": 1D array, "label": int}, ...]
        self.samples = []
        self.labels = []
        
        print("[CHECKPOINT] 1DCNN Dataset: Inicializace...")
        for item in raw_data_list:
            sig = item['signal']
            lab = item['label']
            
            # Nastříhání pomocí posuvného okna (sliding window)
            for i in range(0, len(sig) - window_size + 1, shift):
                self.samples.append(sig[i : i + window_size])
                self.labels.append(lab)
                
        print(f"[CHECKPOINT] 1DCNN Dataset: Vytvořeno {len(self.samples)} oken pro klasifikaci.")

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        # Počítáme FFT až teď – šetříme RAM
        tensor_fft = process_signal_to_fft_tensor(self.samples[idx])
        label = torch.tensor(self.labels[idx], dtype=torch.long)
        return tensor_fft, label
    
def extract_14_features(path):
    """Extrahuje 14 statistických příznaků z H a V signálu v CSV."""
    try:
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
        return h_feats + v_feats
    except Exception as e:
        print(f"[Varování] Chyba při extrakci příznaků z {path}: {e}")
        return [0.0] * 14