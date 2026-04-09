import os
import pandas as pd
import requests
import time
from datetime import datetime, timedelta

# --- KONFIGURACE ---
DATASET_PATH = r"C:\Code\Vibro-diag-system\ml_service\data\XJTU-SY\XJTU-SY_Bearing_Datasets\35Hz12kN\Bearing1_1"
BASE_URL = "http://127.0.0.1:8000"
TOKEN_URL = f"{BASE_URL}/login"          # Endpoint pro přihlášení
API_URL = f"{BASE_URL}/measurements"     # Endpoint pro data

# Přihlašovací údaje (musí odpovídat tomu, co máš v DB/backendu)
USERNAME = "admin"
PASSWORD = ".admin" 

# ID senzorů z tvé databáze
ID_SENSOR_H = 6 
ID_SENSOR_V = 7

def login():
    """Získá přístupový token pro admina."""
    print(f"🔑 Přihlašuji se jako '{USERNAME}'...")
    try:
        # FastAPI očekává form-data, ne JSON pro login!
        payload = {"username": USERNAME, "password": PASSWORD}
        response = requests.post(TOKEN_URL, data=payload)
        
        if response.status_code == 200:
            token = response.json().get("access_token")
            print("✅ Přihlášení úspěšné.")
            return token
        else:
            print(f"❌ Chyba přihlášení: {response.status_code} - {response.text}")
            exit(1)
    except Exception as e:
        print(f"❌ Chyba připojení k backendu: {e}")
        exit(1)

def process_batch():
    # 1. Získat token
    token = login()
    
    # 2. Nastavit hlavičku pro další requesty
    headers = {
        "Authorization": f"Bearer {token}"
    }

    # 3. Načíst soubory
    files = [f for f in os.listdir(DATASET_PATH) if f.endswith('.csv') and '_' not in f]
    files.sort(key=lambda x: int(os.path.splitext(x)[0]))

    print(f"📦 Nalezeno {len(files)} souborů k importu.")
    
    start_time = datetime.now() - timedelta(minutes=len(files))

    for i, filename in enumerate(files):
        base_path = os.path.join(DATASET_PATH, filename)
        file_root = os.path.splitext(filename)[0] # např. "1"
        
        # Cesty pro nové soubory
        path_h = os.path.join(DATASET_PATH, f"{file_root}_h.csv")
        path_v = os.path.join(DATASET_PATH, f"{file_root}_v.csv")

        # A) Rozdělení souboru (Split) - pokud soubory ještě neexistují
        if not os.path.exists(path_h) or not os.path.exists(path_v):
            try:
                df = pd.read_csv(base_path)
                df.iloc[:, 0].to_csv(path_h, index=False)
                df.iloc[:, 1].to_csv(path_v, index=False)
            except Exception as e:
                print(f"❌ Chyba při dělení {filename}: {e}")
                continue
        
        # B) Odeslání do API
        current_time = (start_time + timedelta(minutes=i)).isoformat()
        
        # Payload pro Horizontální
        payload_h = {
            "id_sensor": ID_SENSOR_H,
            "timestamp": current_time,
            "raw_data_path": path_h,
            "notes": f"Batch import: {filename} (H)"
        }
        
        # Payload pro Vertikální
        payload_v = {
            "id_sensor": ID_SENSOR_V,
            "timestamp": current_time,
            "raw_data_path": path_v,
            "notes": f"Batch import: {filename} (V)"
        }

        # Odeslání s HEADERS (tokenem)
        try:
            res_h = requests.post(API_URL, json=payload_h, headers=headers)
            res_v = requests.post(API_URL, json=payload_v, headers=headers)

            if res_h.status_code == 200 and res_v.status_code == 200:
                print(f"✅ [{i+1}/{len(files)}] Importováno: {filename}")
            else:
                # Výpis chyby, pokud nastane (např. 422 Unprocessable Entity)
                print(f"⚠️ Chyba API u {filename}:")
                if res_h.status_code != 200: print(f"   H: {res_h.status_code} {res_h.text}")
                if res_v.status_code != 200: print(f"   V: {res_v.status_code} {res_v.text}")

        except Exception as e:
            print(f"❌ Chyba komunikace: {e}")

    print("🎉 Hotovo! Všechna měření jsou v databázi.")

if __name__ == "__main__":
    process_batch()