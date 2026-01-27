import pandas as pd
import numpy as np
import pickle
import tensorflow as tf
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout

# Nastavení
INPUT_FILE = "./data/nasa_rms_history.csv"
MODEL_PATH = "./models/model_rul.h5"
SCALER_PATH = "./models/scaler_rul.pkl"
SEQUENCE_LENGTH = 10  # Kolik minulých měření se díváme zpět (okno)

def create_sequences(data, target, seq_length):
    """
    Převede časovou řadu na formát pro LSTM: [vzorky, časové_kroky, features]
    """
    X, y = [], []
    for i in range(len(data) - seq_length):
        X.append(data[i : i + seq_length])
        y.append(target[i + seq_length])
    return np.array(X), np.array(y)

def train_model():
    print("Načítám data...")
    df = pd.read_csv(INPUT_FILE)
    
    # 1. Čištění dat: Odstraníme ten konec, kde stroj stál (hodnoty pod 0.01)
    # Najdeme index maxima a vezmeme všechno do té doby (plus kousek, dokud to neklesne k nule)
    # Pro jednoduchost: Usekneme všechno po řádku, kde to padne pod 0.01 (což jsou ty poslední řádky)
    cutoff_threshold = 0.01
    # Najdeme poslední index, kde je hodnota nad prahem
    valid_indices = df[df['rms'] > cutoff_threshold].index
    last_valid_idx = valid_indices[-1]
    
    # Ořízneme dataframe
    df = df.iloc[:last_valid_idx + 1]
    print(f"Data oříznuta na {len(df)} řádků (odstraněn vypnutý stroj).")

    # 2. Vytvoření Targetu (RUL)
    # Předpokládáme lineární degradaci času: Na začátku zbývá X minut, na konci 0.
    # Dataset je po 10 minutách.
    total_steps = len(df)
    # RUL v hodinách (každý řádek = 10 min = 1/6 hodiny)
    rul_hours = np.linspace(total_steps * 10 / 60, 0, total_steps)
    
    df['RUL'] = rul_hours
    print(f"Maximální životnost v datech: {df['RUL'].max():.1f} hodin")

    # 3. Normalizace (LSTM má rádo čísla 0-1)
    scaler = MinMaxScaler()
    # Trénujeme na RMS, predikujeme RUL
    data_scaled = scaler.fit_transform(df[['rms']].values)
    
    # Uložíme scaler pro pozdější použití (musíme stejně škálovat nová data)
    with open(SCALER_PATH, 'wb') as f:
        pickle.dump(scaler, f)

    # 4. Příprava sekvencí
    X, y = create_sequences(data_scaled, df['RUL'].values, SEQUENCE_LENGTH)
    
    # Rozdělení na Train/Test (necháme si kousek na ověření, ale u RUL často trénujeme na celém,
    # pokud máme jen jeden běh. Tady uděláme split 80/20)
    train_size = int(len(X) * 0.8)
    X_train, X_test = X[:train_size], X[train_size:]
    y_train, y_test = y[:train_size], y[train_size:]
    
    # Reshape pro LSTM [samples, time steps, features]
    # data_scaled má features=1 (jen RMS)
    
    print(f"Tvar trénovacích dat: {X_train.shape}")

    # 5. Stavba Modelu
    model = Sequential([
        LSTM(50, return_sequences=True, input_shape=(SEQUENCE_LENGTH, 1)),
        Dropout(0.2),
        LSTM(50, return_sequences=False),
        Dropout(0.2),
        Dense(20, activation='relu'),
        Dense(1) # Výstup je jedno číslo: RUL (hodiny)
    ])

    model.compile(optimizer='adam', loss='mse') # Mean Squared Error je dobrý pro regresi

    # 6. Trénink
    print("Spouštím trénink...")
    history = model.fit(
        X_train, y_train, 
        epochs=50, 
        batch_size=16, 
        validation_data=(X_test, y_test),
        verbose=1
    )

    # 7. Uložení
    model.save(MODEL_PATH)
    print(f"✅ Model uložen do {MODEL_PATH}")
    print(f"✅ Scaler uložen do {SCALER_PATH}")

if __name__ == "__main__":
    train_model()