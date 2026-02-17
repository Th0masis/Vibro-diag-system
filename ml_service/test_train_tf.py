import os
import glob
import numpy as np
import pandas as pd
import tensorflow as tf
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error

from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Conv1D, UpSampling1D, Dropout, Bidirectional, LSTM, Dense, Input
from tensorflow.keras.optimizers import Adam

# ==========================================
# 1. KONFIGURACE A PARAMETRY (dle článku)
# ==========================================
# [ZMENA PRO WSL] Cesta musí začínat /mnt/c/ a používat lomítka '/'
DATASET_PATH = '/mnt/c/Code/Vibro-diag-system/ml_service/data/XJTU-SY/XJTU-SY_Bearing_Datasets'

TARGET_BEARINGS = ['Bearing1_1', 'Bearing1_2', 'Bearing1_3'] # [cite: 302]
WINDOW_SIZE = 1024  # [cite: 323, 379]
BATCH_SIZE = 32
EPOCHS = 50         # V článku je 200
NOISE_FACTOR = 0.5  # Faktor šumu pro CDAE trénink

# Nastavení náhody pro reprodukovatelnost
np.random.seed(42)
tf.random.set_seed(42)

# ==========================================
# 2. NAČÍTÁNÍ A PŘÍPRAVA DAT
# ==========================================

def load_and_process_bearing(bearing_path, window_size=1024):
    """
    Načte CSV soubory pro jedno ložisko, provede Z-score a vytvoří okna.
    """
    # Získání a seřazení souborů (1.csv, 2.csv, ...)
    files = glob.glob(os.path.join(bearing_path, "*.csv"))
    if not files:
        print(f"Varování: Žádné CSV v {bearing_path}")
        return np.array([]), np.array([])
        
    # Seřazení podle čísla v názvu souboru
    files = sorted(files, key=lambda x: int(os.path.basename(os.path.splitext(x)[0])))
    
    total_life_min = len(files) # Celková životnost v minutách
    X_bearing = []
    y_bearing = []
    
    for i, file_path in enumerate(files):
        # [cite_start]Načtení CSV - 1. sloupec je horizontální vibrace [cite: 804]
        try:
            df = pd.read_csv(file_path, header=0)
            signal = df.iloc[:, 0].values 
        except Exception as e:
            print(f"Chyba při čtení {file_path}: {e}")
            continue

        # [cite_start]A) Z-score normalizace (Rovnice 10) [cite: 312]
        mean_val = np.mean(signal)
        std_val = np.std(signal)
        if std_val == 0: std_val = 1 # Pojistka proti dělení nulou
        signal_norm = (signal - mean_val) / std_val
        
        # [cite_start]B) Sliding Window (segmentace) [cite: 323]
        # Bez překryvu (stride = window_size) pro zjednodušení
        num_windows = len(signal_norm) // window_size
        
        for w in range(num_windows):
            start = w * window_size
            end = start + window_size
            X_bearing.append(signal_norm[start:end])
            
            # RUL: Zbývající čas v minutách
            y_bearing.append(total_life_min - i)
            
    return np.array(X_bearing), np.array(y_bearing)

def prepare_dataset(root_path, target_bearings):
    """
    Projdede složky, najde cílová ložiska a sloučí jejich data.
    """
    X_all = []
    y_all = []
    
    # Rekurzivní hledání složek ložisek
    for bearing_name in target_bearings:
        print(f"Hledám data pro: {bearing_name}...")
        search_path = os.path.join(root_path, "**", bearing_name)
        found_folders = glob.glob(search_path, recursive=True)
        
        if not found_folders:
            print(f" -> NENALEZENO: {bearing_name}")
            continue
            
        bearing_path = found_folders[0]
        print(f" -> Načítám z: {bearing_path}")
        
        X, y = load_and_process_bearing(bearing_path, WINDOW_SIZE)
        
        if len(X) > 0:
            X_all.append(X)
            y_all.append(y)
            print(f" -> Načteno {len(X)} vzorků.")

    if not X_all:
        raise ValueError("Nebyla načtena žádná data. Zkontrolujte cestu k datasetu!")

    X_all = np.concatenate(X_all, axis=0)
    y_all = np.concatenate(y_all, axis=0)
    
    # Reshape pro Conv1D: (Počet vzorků, 1024, 1)
    X_all = X_all.reshape(X_all.shape[0], X_all.shape[1], 1)
    
    return X_all, y_all

# ==========================================
# 3. DEFINICE MODELŮ (dle Tabulky 1)
# ==========================================

def build_cdae(input_shape=(1024, 1)):
    """ Architektura Convolutional Denoising Autoencoder [cite: 423] """
    model = Sequential(name="CDAE")
    
    # --- ENCODER ---
    model.add(Conv1D(128, 7, strides=2, activation='relu', padding='same', input_shape=input_shape))
    model.add(Dropout(0.5))
    model.add(Conv1D(64, 5, strides=2, activation='relu', padding='same'))
    model.add(Conv1D(32, 5, strides=1, activation='relu', padding='same'))
    model.add(Conv1D(16, 3, strides=1, activation='relu', padding='same')) # Latent space
    
    # --- DECODER ---
    model.add(Conv1D(32, 3, strides=1, activation='relu', padding='same'))
    model.add(UpSampling1D(size=2))
    model.add(Conv1D(64, 5, strides=1, activation='relu', padding='same'))
    model.add(UpSampling1D(size=2))
    model.add(Dropout(0.5))
    model.add(Conv1D(128, 5, strides=1, activation='relu', padding='same'))
    # Výstupní vrstva (rekonstrukce signálu)
    model.add(Conv1D(1, 7, strides=1, activation='linear', padding='same')) 
    
    return model

def build_bilstm_rul(input_shape=(1024, 1)):
    """ Architektura Bi-LSTM pro predikci RUL [cite: 423] """
    model = Sequential(name="BiLSTM_RUL")
    
    # Layer 11
    model.add(Bidirectional(LSTM(16, return_sequences=True, activation='tanh'), input_shape=input_shape))
    # Layer 12
    model.add(Bidirectional(LSTM(32, return_sequences=False, activation='tanh')))
    # Layer 13
    model.add(Dense(64, activation='relu'))
    # Layer 14 (Output RUL)
    model.add(Dense(1, activation='relu')) 
    
    return model

# ==========================================
# 4. HLAVNÍ PROCES (Pipeline)
# ==========================================

if __name__ == "__main__":
    print("=== ZAČÍNÁM PROCES (WSL Verze) ===")
    
    # 1. Načtení dat
    try:
        X, y = prepare_dataset(DATASET_PATH, TARGET_BEARINGS)
        print(f"Celkový dataset shape: {X.shape}")
    except Exception as e:
        print(f"KRITICKÁ CHYBA: {e}")
        print(f"Zkontrolujte cestu: {DATASET_PATH}")
        exit()
    
    # 2. [cite_start]Split dat (7:1:2) [cite: 324]
    X_train, X_temp, y_train, y_temp = train_test_split(X, y, test_size=0.3, random_state=42, shuffle=True)
    X_val, X_test, y_val, y_test = train_test_split(X_temp, y_temp, test_size=2/3, random_state=42, shuffle=True)
    
    print(f"Train set: {X_train.shape}")
    print(f"Val set:   {X_val.shape}")
    print(f"Test set:  {X_test.shape}")
    
    # ------------------------------------------
    # FÁZE A: Trénink CDAE (Odšumování)
    # ------------------------------------------
    print("\n=== FÁZE A: Trénink CDAE ===")
    
    # [cite_start]Přidání šumu [cite: 157]
    noise = np.random.normal(loc=0.0, scale=1.0, size=X_train.shape)
    X_train_noisy = X_train + NOISE_FACTOR * noise
    X_train_noisy = np.clip(X_train_noisy, -3., 3.) 
    
    X_val_noisy = X_val + NOISE_FACTOR * np.random.normal(0, 1, X_val.shape)
    X_val_noisy = np.clip(X_val_noisy, -3., 3.)

    cdae = build_cdae()
    cdae.compile(optimizer='adam', loss='mse') # [cite: 284]
    
    history_cdae = cdae.fit(
        X_train_noisy, X_train,
        validation_data=(X_val_noisy, X_val),
        epochs=EPOCHS,
        batch_size=BATCH_SIZE,
        verbose=1
    )
    
    # ------------------------------------------
    # FÁZE B: Příprava dat pro Bi-LSTM
    # ------------------------------------------
    print("\n=== FÁZE B: Odšumování dat pro predikci ===")
    X_train_denoised = cdae.predict(X_train)
    X_val_denoised = cdae.predict(X_val)
    X_test_denoised = cdae.predict(X_test)
    
    # ------------------------------------------
    # FÁZE C: Trénink Bi-LSTM (RUL Predikce)
    # ------------------------------------------
    print("\n=== FÁZE C: Trénink Bi-LSTM ===")
    
    rul_model = build_bilstm_rul()
    rul_model.compile(optimizer='adam', loss='mse', metrics=[tf.keras.metrics.RootMeanSquaredError()]) # [cite: 287]
    
    history_rul = rul_model.fit(
        X_train_denoised, y_train,
        validation_data=(X_val_denoised, y_val),
        epochs=EPOCHS,
        batch_size=BATCH_SIZE,
        verbose=1
    )
    
    # ------------------------------------------
    # FÁZE D: Evaluace a Vizualizace
    # ------------------------------------------
    print("\n=== FÁZE D: Výsledky ===")
    
    y_pred = rul_model.predict(X_test_denoised)
    
    # ... (předchozí kód FÁZE D - vizualizace) ...
    
    # Vizualizace - UKLÁDÁNÍ DO SOUBORU
    plt.tight_layout()
    plot_filename = 'vysledky_treninku.png'
    plt.savefig(plot_filename)
    print(f"Graf uložen: {plot_filename}")

    # ==========================================
    # FÁZE E: Uložení modelů
    # ==========================================
    print("\n=== FÁZE E: Ukládání modelů ===")
    
    # Vytvoření složky pro modely, pokud neexistuje
    models_dir = 'models'
    os.makedirs(models_dir, exist_ok=True)
    
    # Cesty k souborům
    cdae_path = os.path.join(models_dir, 'cdae_model.keras')
    rul_path = os.path.join(models_dir, 'rul_model.keras')
    
    # Uložení ve formátu Keras (doporučeno pro TF 2.x)
    try:
        cdae.save(cdae_path)
        print(f"Model CDAE uložen do: {cdae_path}")
        
        rul_model.save(rul_path)
        print(f"Model Bi-LSTM RUL uložen do: {rul_path}")
        
        print("\nTIP: Pro načtení modelu použijte:")
        print("from tensorflow.keras.models import load_model")
        print(f"model = load_model('{rul_path}')")
        
    except Exception as e:
        print(f"Chyba při ukládání: {e}")

    print("=== PROCES DOKONČEN ===")

    # [cite_start]Výpočet RMSE [cite: 363]
    rmse_score = np.sqrt(mean_squared_error(y_test, y_pred))
    print(f"Final Test RMSE: {rmse_score:.2f} minut")
    
    # Vizualizace - UKLÁDÁNÍ DO SOUBORU MÍSTO ZOBRAZENÍ
    plt.figure(figsize=(12, 5))
    
    plt.subplot(1, 2, 1)
    plt.plot(history_rul.history['root_mean_squared_error'], label='Train RMSE')
    plt.plot(history_rul.history['val_root_mean_squared_error'], label='Val RMSE')
    plt.title('Chyba modelu během tréninku')
    plt.xlabel('Epochs')
    plt.ylabel('RMSE (minuty)')
    plt.legend()
    
    plt.subplot(1, 2, 2)
    plt.scatter(y_test, y_pred, alpha=0.5, s=10)
    plt.plot([y_test.min(), y_test.max()], [y_test.min(), y_test.max()], 'r--', lw=2)
    plt.title(f'Predikce vs Realita (RMSE: {rmse_score:.2f})')
    plt.xlabel('Skutečná RUL (min)')
    plt.ylabel('Predikovaná RUL (min)')
    
    plt.tight_layout()
    
    # [ZMENA PRO WSL] Uložení grafu
    filename = 'vysledky_treninku.png'
    plt.savefig(filename)
    print(f"Graf uložen do souboru: {os.path.abspath(filename)}")
    print("Můžete ho otevřít ve Windows v téže složce.")