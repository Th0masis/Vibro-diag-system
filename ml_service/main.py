from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import joblib
import numpy as np
import pandas as pd

from rul_models import RULPredictor


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
    """
    Vypočítá RUL pomocí lineární a exponenciální regrese.
    """
    predictor = RULPredictor(limit_threshold=data.limit)
    
    lin_rul = predictor.predict_linear(data.history)
    exp_rul = predictor.predict_exponential(data.history)
    
    # Jednoduchá logika pro doporučení "lepšího" modelu
    # Pokud poslední hodnota rychle roste (exponenciála existuje), věříme jí víc.
    recommended_model = "linear"
    final_prediction = lin_rul
    
    if exp_rul is not None:
        # Pokud exponenciální model dává smysl a predikuje něco rozumného
        recommended_model = "exponential"
        final_prediction = exp_rul
        
    return {
        "models": {
            "linear_rul_days": round(lin_rul, 1) if lin_rul else None,
            "exponential_rul_days": round(exp_rul, 1) if exp_rul else None
        },
        "recommended_model": recommended_model,
        "final_prediction_days": round(final_prediction, 1) if final_prediction else None
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)