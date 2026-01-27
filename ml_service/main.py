from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import joblib
import numpy as np
import pandas as pd

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