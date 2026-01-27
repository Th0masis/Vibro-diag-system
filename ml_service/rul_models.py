import numpy as np
import warnings
import os
import pickle

# Importy pro AI (TensorFlow)
# Dáme je do try-except bloku, aby nám služba nespadla, kdyby TF chybělo
try:
    from tensorflow.keras.models import load_model
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False
    print("⚠️ TensorFlow není nainstalován. LSTM model nebude fungovat.")

warnings.filterwarnings('ignore')

class RULPredictor:
    """Třída pro klasickou matematickou regresi (Lineární/Exponenciální)"""
    def __init__(self, limit_threshold=10.0):
        self.limit = limit_threshold

    def predict_linear(self, history):
        if len(history) < 3: return None
        y = np.array(history)
        x = np.arange(len(y))
        try:
            m, c = np.polyfit(x, y, 1)
            if m <= 0.0001: return None
            x_target = (self.limit - c) / m
            rul = x_target - (len(y) - 1)
            return max(0.0, float(rul))
        except Exception:
            return None

    def predict_exponential(self, history):
        if len(history) < 3: return None
        y = np.array(history)
        x = np.arange(len(y))
        try:
            y_safe = np.where(y <= 0, 0.001, y)
            fit = np.polyfit(x, np.log(y_safe), 1)
            b = fit[0]
            log_a = fit[1]
            if b <= 0.00001: return None
            x_target = (np.log(self.limit) - log_a) / b
            rul = x_target - (len(y) - 1)
            return max(0.0, float(rul))
        except Exception:
            return None


class LSTMPredictor:
    """Třída pro AI predikci (Deep Learning)"""
    def __init__(self, model_path="./models/model_rul.h5", scaler_path="./models/scaler_rul.pkl"):
        self.model = None
        self.scaler = None
        self.sequence_length = 10 # Musí odpovídat tomu, na čem jsme trénovali
        
        if TF_AVAILABLE and os.path.exists(model_path) and os.path.exists(scaler_path):
            try:
                print(f"Loading LSTM model from {model_path}...")
                
                # --- OPRAVA ZDE ---
                # Přidali jsme compile=False. 
                # Tím říkáme: "Načti jen váhy a strukturu, nezajímají nás metriky pro trénink."
                self.model = load_model(model_path, compile=False)
                
                with open(scaler_path, 'rb') as f:
                    self.scaler = pickle.load(f)
                print("✅ LSTM Model loaded successfully.")
            except Exception as e:
                print(f"❌ Chyba při načítání modelu: {e}")
        else:
            print(f"⚠️ Model nenalezen na cestě: {model_path} nebo chybí TF.")

    def predict(self, history):
        """
        Přijme historii RMS hodnot. Vezme posledních 10, normalizuje je a pošle do LSTM.
        """
        # Pokud nemáme model nebo dostatek dat, vracíme None
        if not self.model or not self.scaler:
            return None
        
        if len(history) < self.sequence_length:
            return None # Potřebujeme aspoň 10 bodů historie

        try:
            # 1. Vezmeme posledních 10 bodů
            input_seq = history[-self.sequence_length:]
            
            # 2. Převedeme na numpy array a reshape pro scaler (n, 1)
            input_array = np.array(input_seq).reshape(-1, 1)
            
            # 3. Normalizace (škálování 0-1 podle trénovacích dat)
            scaled_seq = self.scaler.transform(input_array)
            
            # 4. Reshape pro LSTM [1 sample, 10 time steps, 1 feature]
            lstm_input = scaled_seq.reshape(1, self.sequence_length, 1)
            
            # 5. Predikce
            prediction = self.model.predict(lstm_input, verbose=0)
            
            # Výsledek je přímo v hodinách (tak jsme to trénovali)
            rul_hours = prediction[0][0]
            
            # Převedeme na dny (aby to ladilo s regresními modely)
            rul_days = rul_hours / 24.0
            
            return max(0.0, float(rul_days))

        except Exception as e:
            print(f"Chyba při LSTM predikci: {e}")
            return None