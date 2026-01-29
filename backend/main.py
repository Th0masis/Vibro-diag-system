from datetime import datetime, timezone
import os, json, seed, requests, uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from auth import verify_password, create_access_token, get_password_hash
from sqlalchemy import create_engine, text
from jose import JWTError, jwt

# Script FastAPI
load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
ML_SERVICE_URL = os.getenv("ML_SERVICE_URL", "http://localhost:8001")

app = FastAPI(title="VibroDiag API")

# Nastaveni Cross-Origin Resource Sharing
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],    
)

# Pripojeni k DB
DB_URL = os.getenv("DATABASE_URL")
engine = create_engine(DB_URL)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def get_current_user_role(token: str = Depends(oauth2_scheme)):
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    return payload.get("role")

@app.get("/")
def home():
    return {"massage":"Vibrodiagnosticky system bezi!"}

@app.get("/latest-data")
def get_latest_data():
    """Vytahne posledni zaznam z databaze"""
    with engine.connect() as conn:
        query = text("SELECT * FROM feature_data ORDER BY time DESC LIMIT 1")
        result = conn.execute(query).fetchone()
        # Pokud v DB nic neni
        if not result:
            return {"massage":"Zadna data nebyla nalezena"}
        # Prevedeni vysledku na JSON slovnik
        data = {
            "time": result[0],
            "rms_raw": result[11],
            "peak_raw": result[6],
            "kurtosis": result[9],
            "asset_id": result[1]    
        }
        return data

@app.get("/history")
def get_history(limit: int = 100):
    """Vrati poslednich 'limit' zaznamu z databaze pro grafy"""
    with engine.connect() as conn:
        query = text("SELECT * FROM feature_data ORDER BY time DESC LIMIT :limit")
        result = conn.execute(query, {"limit":limit}).fetchall()
        # Pokud v DB nic neni
        if not result:
            return {"massage":"Zadna data nebyla nalezena"}
        # Prevedeni vysledku na JSON slovnik
        history = []
        for row in result:
            history.append({
                "time": row[0],
                "asset_id": row[1],
                "peak_raw": row[6],
                "kurtosis": row[9],
                "rms_raw": row[11]  
            })
        # Vratime data 
        return history
    
# --- SEKCE UŽIVATELŮ ---

@app.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    with engine.connect() as conn:
        # 1. Ujisti se, že id_user je PRVNÍ (index 0)
        query = text("SELECT id_user, username, hashed_password, role FROM users WHERE username = :user")
        user_record = conn.execute(query, {"user": form_data.username}).fetchone()

        if not user_record:
            raise HTTPException(status_code=401, detail="Uživatel neexistuje")

        # 2. Ověření hesla - teď je to index [2], protože heslo je v SELECTu třetí
        if not verify_password(form_data.password, user_record[2]):
            raise HTTPException(status_code=401, detail="Nesprávné heslo")

        # 3. UPDATE - uid musí být integer (user_record[0])
        update_query = text("UPDATE users SET last_login = :now WHERE id_user = :uid")
        conn.execute(update_query, {
            "now": datetime.now(timezone.utc), 
            "uid": user_record[0]  # Toto musí být to číslo ID
        })
        conn.commit()

        # 4. Token - sub je jméno (index 1), role je index 3
        access_token = create_access_token(
            data={"sub": user_record[1], "role": user_record[3]}
        )
        
        return {"access_token": access_token, "token_type": "bearer", "role": user_record[3]}
    
# Seznam uzivatelu
@app.get("/users")
def get_all_users(token: str = Depends(oauth2_scheme)):
    """Vrátí seznam všech uživatelů (pouze pro přihlášené)"""
    with engine.connect() as conn:
        # Přidali jsme email, creation_time a last_login
        query = text("SELECT id_user, username, email, role, creation_time, last_login FROM users ORDER BY id_user ASC")
        result = conn.execute(query).fetchall()
        
        users_list = [
            {
                "id_user": row[0], 
                "username": row[1], 
                "email": row[2], 
                "role": row[3],
                "creation_time": row[4],
                "last_login": row[5]
            } 
            for row in result
        ]
        return users_list
    
# Odstranění uživatele
@app.delete("/users/{user_id}")
def delete_user(user_id: int, role: str = Depends(get_current_user_role)):
    if role != "admin":
        raise HTTPException(status_code=403, detail="Pouze administrátor může mazat uživatele")
    with engine.connect() as conn:
        # Kontrola, aby admin nesmazal sám sebe (volitelné, ale doporučené)
        # 1. Zjistíme username z tokenu (sub) a ID smazaného uživatele
        
        delete_query = text("DELETE FROM users WHERE id_user = :uid")
        result = conn.execute(delete_query, {"uid": user_id})
        conn.commit()
        
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Uživatel nenalezen")
            
        return {"message": f"Uživatel s ID {user_id} byl úspěšně smazán"}

# Přidání uživatele
@app.post("/users")
def create_user(user_data: dict, token: str = Depends(oauth2_scheme)):
    # user_data bude obsahovat: username, password, email, role
    hashed_pwd = get_password_hash(user_data['password'])
    
    with engine.connect() as conn:
        # Kontrola, zda uživatel již neexistuje
        check_query = text("SELECT username FROM users WHERE username = :user")
        if conn.execute(check_query, {"user": user_data['username']}).fetchone():
            raise HTTPException(status_code=400, detail="Uživatel s tímto jménem již existuje")

        query = text("""
            INSERT INTO users (username, hashed_password, email, role, creation_time) 
            VALUES (:user, :pwd, :email, :role, :time)
        """)
        conn.execute(query, {
            "user": user_data['username'],
            "pwd": hashed_pwd,
            "email": user_data['email'],
            "role": user_data['role'],
            "time": datetime.now(timezone.utc)
        })
        conn.commit()
        return {"message": "Uživatel vytvořen"}
    
# Úprava uživatele
@app.put("/users/{user_id}")
def update_user(user_id: int, updated_data: dict, token: str = Depends(oauth2_scheme)):
    with engine.connect() as conn:
        # Základní SQL příkaz pro email a roli
        sql_text = "UPDATE users SET email = :email, role = :role"
        params = {
            "email": updated_data['email'],
            "role": updated_data['role'],
            "uid": user_id
        }

        # Pokud přišlo i heslo, přidáme ho do UPDATE příkazu
        if updated_data.get('password'):
            hashed_pwd = get_password_hash(updated_data['password'])
            sql_text += ", hashed_password = :pwd"
            params["pwd"] = hashed_pwd

        sql_text += " WHERE id_user = :uid"
        
        result = conn.execute(text(sql_text), params)
        conn.commit()
        
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Uživatel nenalezen")
            
        return {"message": "Uživatel byl aktualizován"}   
    
# --- SEKCE SENZORY ---

@app.get("/sensors")
def get_all_sensors(token: str = Depends(oauth2_scheme)):
    """Vrátí seznam všech senzorů včetně informace o přiřazeném stroji"""
    with engine.connect() as conn:
        # LEFT JOIN nám umožní vidět i senzory, které zatím nejsou na žádném stroji
        query = text("""
            SELECT s.id_sensor, s.serial_number, s.description, s.status, 
                   s.id_machine, s.position, s.sampling_rate, s.calibration_date
            FROM sensors s
            ORDER BY s.id_sensor ASC
        """)
        result = conn.execute(query).fetchall()
        
        sensors_list = []
        for row in result:
            sensors_list.append({
                "id_sensor": row[0],
                "serial_number": row[1],
                "description": row[2],
                "status": row[3],
                "id_machine": row[4],
                "position": row[5],
                "sampling_rate": row[6],
                "calibration_date": row[7]
            })
        return sensors_list

@app.post("/sensors")
def create_sensor(sensor_data: dict, role: str = Depends(get_current_user_role)):
    """Registrace nového senzoru. Možnost rovnou přiřadit ke stroji."""
    if role != "admin":
        raise HTTPException(status_code=403, detail="Pouze administrátor může registrovat senzory")
    
    # Validace: Pokud je vybrán stroj, status musí být 'active'
    status = sensor_data.get('status', 'available')
    machine_id = sensor_data.get('id_machine')
    position = sensor_data.get('position')

    # Pokud uživatel vybral stroj, ale nechal status 'available', backend to opraví nebo vyčistí
    if machine_id and status == 'available':
        # Zde jsou dvě možnosti: buď vyhodit chybu, nebo automaticky nastavit active.
        # Zvolíme variantu: Pokud je stroj, status se stane 'active'.
        status = 'active'
    
    # Pokud není stroj, status nemůže být 'active' (pokud to tak uživatel omylem poslal)
    if not machine_id and status == 'active':
        status = 'available'

    with engine.connect() as conn:
        query = text("""
            INSERT INTO sensors (serial_number, description, sampling_rate, calibration_date, status, id_machine, position)
            VALUES (:sn, :desc, :rate, :cal, :status, :mid, :pos)
        """)
        try:
            conn.execute(query, {
                "sn": sensor_data['serial_number'],
                "desc": sensor_data['description'],
                "rate": sensor_data.get('sampling_rate'),
                "cal": sensor_data.get('calibration_date'),
                "status": status,
                "mid": machine_id,
                "pos": position
            })
            conn.commit()
        except Exception as e:
            # Ošetření chyby, např. duplicitní sériové číslo
            raise HTTPException(status_code=400, detail=str(e))
            
        return {"message": "Senzor byl úspěšně zaregistrován"}

@app.put("/sensors/{sensor_id}")
def update_sensor(sensor_id: int, updated_data: dict, role: str = Depends(get_current_user_role)):
    """Aktualizace údajů senzoru. Pokud se změní status na 'available' nebo 'maintenance', senzor se odpojí od stroje."""
    if role != "admin":
        raise HTTPException(status_code=403, detail="Pouze administrátor může upravovat senzory")

    # LOGIKA ODPOJENÍ:
    # Pokud senzor není aktivní, nesmí být na stroji.
    new_status = updated_data.get('status')
    machine_id = updated_data.get('id_machine')
    position = updated_data.get('position')

    if new_status in ['available', 'maintenance']:
        machine_id = None
        position = None

    with engine.connect() as conn:
        query = text("""
            UPDATE sensors 
            SET description = :desc, 
                status = :status, 
                id_machine = :machine_id, 
                position = :pos,
                sampling_rate = :rate,
                calibration_date = :cal
            WHERE id_sensor = :sid
        """)
        result = conn.execute(query, {
            "desc": updated_data['description'],
            "status": new_status,
            "machine_id": machine_id,
            "position": position, # Pozor, v SQL mám parametr :pos, ale tady posílám klíč
            "pos": position,      # Pro jistotu, aby sedělo jméno parametru
            "rate": updated_data.get('sampling_rate'),
            "cal": updated_data.get('calibration_date'),
            "sid": sensor_id
        })
        conn.commit()
        
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Senzor nenalezen")
            
        return {"message": "Senzor byl aktualizován"}

@app.delete("/sensors/{sensor_id}")
def delete_sensor(sensor_id: int, role: str = Depends(get_current_user_role)):
    """Odstranění senzoru z evidence"""
    if role != "admin":
        raise HTTPException(status_code=403, detail="Pouze administrátor může mazat senzory")
    
    with engine.connect() as conn:
        result = conn.execute(text("DELETE FROM sensors WHERE id_sensor = :sid"), {"sid": sensor_id})
        conn.commit()
        
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Senzor nenalezen")
        return {"message": "Senzor byl odstraněn"}

# Získání pouze VOLNÝCH senzorů pro dropdown menu
@app.get("/sensors/available")
def get_available_sensors(token: str = Depends(oauth2_scheme)):
    with engine.connect() as conn:
        # Vybereme jen ty, co jsou 'available' (skladem)
        query = text("SELECT id_sensor, serial_number, description FROM sensors WHERE status = 'available'")
        result = conn.execute(query).fetchall()
        
        return [
            {"id_sensor": row[0], "serial_number": row[1], "description": row[2]} 
            for row in result
        ]

# Samotné přiřazení senzoru ke stroji
@app.post("/machines/{machine_id}/sensors")
def attach_sensor(machine_id: int, payload: dict, token: str = Depends(oauth2_scheme)):
    """
    Payload očekává: { "sensor_id": int, "position": str }
    """
    with engine.connect() as conn:
        # 1. Zkontrolujeme, zda senzor existuje a je volný (volitelné, ale bezpečné)
        # 2. Provedeme UPDATE: přiřadíme stroj, pozici a změníme stav na ACTIVE
        query = text("""
            UPDATE sensors 
            SET id_machine = :mid, 
                position = :pos, 
                status = 'active' 
            WHERE id_sensor = :sid
        """)
        
        result = conn.execute(query, {
            "mid": machine_id,
            "pos": payload['position'],
            "sid": payload['sensor_id']
        })
        conn.commit()
        
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Senzor nenalezen nebo se nepodařilo aktualizovat")
            
        return {"message": "Senzor byl úspěšně namontován"}

# 1. Nový endpoint pro rychlé odpojení senzoru (tlačítko "X")
@app.post("/machines/{machine_id}/sensors/{sensor_id}/detach")
def detach_sensor_from_machine(machine_id: int, sensor_id: int, token: str = Depends(oauth2_scheme)):
    with engine.connect() as conn:
        # Nastavíme senzor zpět na 'available' a vymažeme vazby
        query = text("""
            UPDATE sensors 
            SET id_machine = NULL, position = NULL, status = 'available' 
            WHERE id_sensor = :sid AND id_machine = :mid
        """)
        result = conn.execute(query, {"sid": sensor_id, "mid": machine_id})
        conn.commit()
        
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Senzor nebyl na tomto stroji nalezen")
            
        return {"message": "Senzor byl odpojen"}

# --- SEKCE MACHINES ---

@app.get("/machines")
def get_machines(token: str = Depends(oauth2_scheme)):
    """Vrátí seznam strojů včetně detailů poslední poznámky a jejího autora"""
    with engine.connect() as conn:
        query = text("""
            SELECT 
                m.id_machine, 
                m.name, 
                m.type, 
                m.location, 
                m.status,
                -- Obsah poznámky
                (SELECT content FROM service_notes WHERE id_machine = m.id_machine ORDER BY timestamp DESC LIMIT 1) as last_note,
                -- Severity
                (SELECT severity FROM service_notes WHERE id_machine = m.id_machine ORDER BY timestamp DESC LIMIT 1) as last_note_severity,
                -- Autor (JOIN přímo v subquery)
                (SELECT u.username FROM service_notes sn JOIN users u ON sn.id_user = u.id_user 
                 WHERE sn.id_machine = m.id_machine ORDER BY sn.timestamp DESC LIMIT 1) as last_note_author,
                -- Čas (převedeme na ISO formát string pro JS)
                (SELECT to_char(timestamp, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') FROM service_notes 
                 WHERE id_machine = m.id_machine ORDER BY timestamp DESC LIMIT 1) as last_note_time
            FROM machines m
            ORDER BY m.id_machine ASC
        """)
        result = conn.execute(query).fetchall()
        
        machines_list = []
        for row in result:
            machines_list.append({
                "id_machine": row[0],
                "name": row[1],
                "type": row[2],
                "location": row[3],
                "status": row[4],
                "last_note": row[5],
                "last_note_severity": row[6],
                "last_note_author": row[7],
                "last_note_time": row[8]
            })
        return machines_list    

@app.post("/machines")
def create_machine(machine_data: dict, role: str = Depends(get_current_user_role)):
    """
    Registrace nového stroje.
    Vyžaduje roli 'admin'.
    """
    if role != "admin":
        raise HTTPException(status_code=403, detail="Pouze administrátor může přidávat stroje")
    
    # Validace povinných polí
    name = machine_data.get('name')
    if not name:
        raise HTTPException(status_code=400, detail="Název stroje je povinný údaj.")

    # Extrakce dalších dat s defaultními hodnotami
    description = machine_data.get('description', '')
    m_type = machine_data.get('type', '')
    location = machine_data.get('location', '')
    status = machine_data.get('status', 'OFFLINE') # Pokud neuvedeno, začínáme jako OFFLINE


    # Ověření, zda je status validní (volitelné, ale doporučené)
    valid_statuses = ['OK', 'WARNING', 'CRITICAL', 'OFFLINE']
    if status not in valid_statuses:
        status = 'OFFLINE'

    with engine.connect() as conn:
        # SQL dotaz pro vložení
        query = text("""
            INSERT INTO machines (name, description, type, location, status)
            VALUES (:name, :description, :type, :loc, :status)
        """)
        
        try:
            conn.execute(query, {
                "name": name,
                "description": description,
                "type": m_type,
                "loc": location,
                "status": status
            })
            conn.commit()
        except Exception as e:
            # Nejčastější chyba bude UniqueConstraint na jméno stroje (pokud ho máš v DB nastavený)
            print(f"Chyba při vytváření stroje: {e}")
            raise HTTPException(status_code=400, detail="Nepodařilo se vytvořit stroj. Ověřte, zda název již neexistuje.")
            
    return {"message": "Stroj byl úspěšně přidán"}

@app.get("/machines/{machine_id}")
def get_machine_detail(machine_id: int, token: str = Depends(oauth2_scheme)):
    with engine.connect() as conn:
        # A) Info o stroji
        query_machine = text("SELECT * FROM machines WHERE id_machine = :mid")
        machine = conn.execute(query_machine, {"mid": machine_id}).fetchone()
        if not machine: raise HTTPException(status_code=404, detail="Stroj nenalezen")

        # B) Senzory
        query_sensors = text("SELECT * FROM sensors WHERE id_machine = :mid")
        sensors = [dict(row._mapping) for row in conn.execute(query_sensors, {"mid": machine_id}).fetchall()]

        # C) NOVÉ: Poslední poznámka (Latest Note)
        query_note = text("""
            SELECT content, timestamp, severity, username 
            FROM service_notes sn
            JOIN users u ON sn.id_user = u.id_user
            WHERE sn.id_machine = :mid 
            ORDER BY sn.timestamp DESC 
            LIMIT 1
        """)
        last_note = conn.execute(query_note, {"mid": machine_id}).fetchone()
        
        last_note_data = None
        if last_note:
            last_note_data = {
                "content": last_note[0],
                "timestamp": last_note[1],
                "severity": last_note[2],
                "author": last_note[3]
            }

        return {
            "info": dict(machine._mapping), # Převede SQLAlchemy row na dict
            "sensors": sensors,
            "last_note": last_note_data
        }

@app.get("/machines/{machine_id}/measurements")
def get_machine_measurements(machine_id: int, limit: int = 50, token: str = Depends(oauth2_scheme)):
    """Vrátí historii naměřených dat (Feature Data) pro tabulku historie"""
    with engine.connect() as conn:
        query = text("""
            SELECT 
                fd.time, 
                s.description as sensor_name,
                s.position,
                fd.rms_raw,
                fd.peak_raw,
                fd.iso_10816
            FROM feature_data fd
            JOIN measurements m ON fd.id_measurement = m.id_measurement
            JOIN sensors s ON m.id_sensor = s.id_sensor
            WHERE fd.id_machine = :mid
            ORDER BY fd.time DESC
            LIMIT :lim
        """)
        result = conn.execute(query, {"mid": machine_id, "lim": limit}).fetchall()
        
        return [
            {
                "time": row[0],
                "sensor": row[1],
                "position": row[2],
                "rms": row[3],
                "peak": row[4],
                "iso": row[5]
            }
            for row in result
        ]

@app.post("/machines/{machine_id}/diagnose")
def run_machine_diagnostics(machine_id: int, token: str = Depends(oauth2_scheme)):
    """
    1. Načte poslední naměřená data stroje z DB.
    2. Odešle je do ML Service (port 8001).
    3. Zpracuje výsledek a aktualizuje stav stroje.
    """
    
    # 1. Získání posledních dat z DB
    with engine.connect() as conn:
        # Potřebujeme RMS, Peak (jako PTP) a Kurtosis
        # Pozor: V seed.py jsi ukládal 'kurtosis_raw', v GET /latest-data čteš index 9.
        # Ujistíme se, že čteme správné sloupce.
        query_data = text("""
            SELECT rms_raw, peak_raw, kurtosis_raw 
            FROM feature_data 
            WHERE id_machine = :mid 
            ORDER BY time DESC 
            LIMIT 1
        """)
        last_measurement = conn.execute(query_data, {"mid": machine_id}).fetchone()
        
        if not last_measurement:
            raise HTTPException(status_code=400, detail="Nedostatek dat. Nejdříve proveďte měření (Simulaci).")
            
        # Mapování DB sloupců na vstup ML modelu (VibrationData)
        # DB: (rms_raw, peak_raw, kurtosis_raw)
        ml_payload = {
            "rms": float(last_measurement[0]),
            "ptp": float(last_measurement[1]),       # Použijeme Peak jako PTP
            "kurtosis": float(last_measurement[2])
        }

        # 2. Volání ML Service
        ml_service_url = "http://127.0.0.1:8001/predict"
        
        try:
            print(f"Odesílám do ML: {ml_payload}") # Debug log
            response = requests.post(ml_service_url, json=ml_payload)
            response.raise_for_status()
            ml_result = response.json()
        except requests.exceptions.ConnectionError:
            raise HTTPException(status_code=503, detail="ML Service (port 8001) neodpovídá.")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Chyba ML predikce: {str(e)}")

        # 3. Překlad výsledku pro naši aplikaci
        # ML vrací: "status": "PORUCHA" nebo "V POŘÁDKU"
        # My chceme: "FAULT" nebo "OK"
        
        app_status = "OK"
        if ml_result["status"] == "PORUCHA":
            app_status = "FAULT"
            
        # Vytvoření popisu pro frontend
        description = "Vibrační hodnoty jsou v normě."
        recommendation = "Žádná akce není nutná."
        
        if app_status == "FAULT":
            description = f"Model detekoval anomálii! (Jistota: {ml_result['confidence']*100:.1f}%)"
            recommendation = "Doporučena okamžitá kontrola ložisek."

        # Update statusu stroje v DB
        conn.execute(text("UPDATE machines SET status = :st WHERE id_machine = :mid"), 
                     {"st": app_status, "mid": machine_id})
        conn.commit()

    # Vrátíme formát, který očekává naše React komponenta MachineDiagnostics.jsx
    return {
        "status": app_status,             # OK / FAULT
        "prediction": ml_result["status"], # "V POŘÁDKU" / "PORUCHA" (text z ML)
        "confidence": ml_result["confidence"],
        "description": description,
        "recommendation": recommendation,
        "model_version": "Mafalda Joblib Model v1"
    }

@app.get("/machines/{machine_id}/rul")
def get_machine_rul(machine_id: int, token: str = Depends(oauth2_scheme)):
    """
    1. Vytáhne historii RMS z databáze.
    2. Pošle ji do ML Service.
    3. Vrátí predikci RUL.
    """
    with engine.connect() as conn:
        # 1. Kontrola, zda stroj existuje a má senzor
        # Pro zjednodušení bereme data z prvního aktivního senzoru
        sensor_query = text("SELECT id_sensor FROM sensors WHERE id_machine = :mid LIMIT 1")
        sensor = conn.execute(sensor_query, {"mid": machine_id}).fetchone()
        
        if not sensor:
             raise HTTPException(status_code=404, detail="Stroj nemá senzory.")
        sensor_id = sensor[0]

        # 2. Načtení historie RMS (seřazené od nejstarší po nejnovější)
        # Omezíme to třeba na posledních 500 měření, ať neposíláme tuny dat
        history_query = text("""
            SELECT rms_raw 
            FROM feature_data 
            JOIN measurements ON feature_data.id_measurement = measurements.id_measurement
            WHERE measurements.id_sensor = :sid
            ORDER BY measurements.timestamp ASC
            LIMIT 500
        """)
        
        result = conn.execute(history_query, {"sid": sensor_id}).fetchall()
        
        # Převedeme výsledek SQL na obyčejný list floatů [0.5, 0.6, ...]
        rms_history = [row[0] for row in result]
        
        if len(rms_history) < 10:
             return {"status": "warning", "message": "Nedostatek dat pro predikci (min 10)."}

    # 3. Volání ML Service
    try:
        payload = {
            "history": rms_history,
            "limit": 10.0 # ISO limit, můžeme to v budoucnu tahat z nastavení stroje
        }
        
        # Odeslání požadavku na ML mikroslužbu
        response = requests.post(f"{ML_SERVICE_URL}/predict-rul", json=payload, timeout=5)
        
        if response.status_code == 200:
            return response.json()
        else:
            raise HTTPException(status_code=503, detail=f"ML Service error: {response.text}")
            
    except requests.exceptions.ConnectionError:
        # Pokud ML service neběží, nechceme shodit backend, vrátíme info
        return {
            "models": None,
            "recommended_model": "none",
            "final_prediction_days": None,
            "error": "ML Service is offline"
        }
    except Exception as e:
        print(f"Chyba RUL predikce: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- SEKCE SERVICE NOTES ---

@app.get("/machines/{machine_id}/notes")
def get_machine_notes(machine_id: int, token: str = Depends(oauth2_scheme)):
    """Vrátí historii poznámek pro daný stroj"""
    with engine.connect() as conn:
        query = text("""
            SELECT sn.id_note, sn.content, sn.severity, sn.timestamp, u.username
            FROM service_notes sn
            JOIN users u ON sn.id_user = u.id_user
            WHERE sn.id_machine = :mid
            ORDER BY sn.timestamp DESC
        """)
        result = conn.execute(query, {"mid": machine_id}).fetchall()
        
        return [
            {
                "id_note": row[0],
                "content": row[1],
                "severity": row[2],
                "timestamp": row[3],
                "author": row[4]
            }
            for row in result
        ]

@app.post("/machines/{machine_id}/notes")
def add_service_note(machine_id: int, note: dict, token: str = Depends(oauth2_scheme)):
    """Přidání nové servisní poznámky (autor se bere z tokenu)"""
    # Získáme ID přihlášeného uživatele
    user = get_current_user_role(token) # Musíme najít ID uživatele podle username
    
    with engine.connect() as conn:
        # Nejdřív zjistíme ID usera (pokud get_current_user vrací jen jméno/objekt)
        # Předpokládám, že ve tvém auth.py get_current_user vrací username. 
        # Rychlý fix: dotaz na ID podle jména v tokenu (sub)
        
        # 1. Dekodování tokenu pro získání username (pokud nemáš pomocnou fci co vrací ID)
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        
        user_query = text("SELECT id_user FROM users WHERE username = :name")
        user_id = conn.execute(user_query, {"name": username}).scalar()

        if not user_id:
             raise HTTPException(status_code=401, detail="Neznámý uživatel")

        # 2. Vložení poznámky
        query = text("""
            INSERT INTO service_notes (id_machine, id_user, content, severity, timestamp)
            VALUES (:mid, :uid, :content, :severity, :now)
        """)
        conn.execute(query, {
            "mid": machine_id,
            "uid": user_id,
            "content": note['content'],
            "severity": note.get('severity', 'INFO'),
            "now": datetime.now(timezone.utc)
        })
        conn.commit()
        
        return {"message": "Poznámka uložena"}

@app.delete("/machines/{machine_id}/notes/{note_id}")
def delete_service_note(machine_id: int, note_id: int, token: str = Depends(oauth2_scheme)):
    """Smazání servisní poznámky"""
    # Zde by se dalo přidat ověření, že mazat může jen admin nebo autor
    with engine.connect() as conn:
        query = text("DELETE FROM service_notes WHERE id_note = :nid AND id_machine = :mid")
        result = conn.execute(query, {"nid": note_id, "mid": machine_id})
        conn.commit()
        
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Poznámka nenalezena")
            
        return {"message": "Poznámka smazána"}

# --- SEKCE MEASUREMENTS (DATA) ---

@app.post("/measurements")
def create_measurement(measurement_data: dict, role: str = Depends(get_current_user_role)):
    """
    Vytvoří nový záznam o měření (registruje raw soubor).
    Vrací ID nového měření.
    """
    # 1. Kontrola role (pokud chceš omezit zápis)
    # Pro účely skriptů to můžeš nechat volnější, nebo vyžadovat 'admin'
    if role not in ["admin", "operator"]:
         raise HTTPException(status_code=403, detail="Nemáte oprávnění přidávat měření.")

    # 2. Manuální validace povinných polí
    id_sensor = measurement_data.get('id_sensor')
    raw_data_path = measurement_data.get('raw_data_path')
    timestamp_str = measurement_data.get('timestamp') # Přijde jako string!

    if not id_sensor or not raw_data_path or not timestamp_str:
        raise HTTPException(status_code=400, detail="Chybí povinné pole (id_sensor, raw_data_path nebo timestamp).")

    notes = measurement_data.get('notes', '')

    with engine.connect() as conn:
        try:
            # 3. Kontrola, zda senzor existuje
            sensor_exists = conn.execute(
                text("SELECT id_sensor FROM sensors WHERE id_sensor = :id"),
                {"id": id_sensor}
            ).fetchone()
            
            if not sensor_exists:
                raise HTTPException(status_code=404, detail=f"Senzor s ID {id_sensor} neexistuje.")

            # 4. Vložení záznamu
            # Poznámka: Postgres je chytrý a obvykle umí převést ISO string na timestamp sám.
            # Pokud by to padalo, museli bychom použít: datetime.fromisoformat(timestamp_str)
            query = text("""
                INSERT INTO measurements (id_sensor, timestamp, raw_data_path, notes)
                VALUES (:sid, :ts, :path, :notes)
                RETURNING id_measurement
            """)
            
            result = conn.execute(query, {
                "sid": id_sensor,
                "ts": timestamp_str,
                "path": raw_data_path,
                "notes": notes
            })
            conn.commit()
            
            new_id = result.scalar()
            return {
                "message": "Measurement created", 
                "id_measurement": new_id
            }

        except Exception as e:
            print(f"Chyba při ukládání měření: {e}")
            raise HTTPException(status_code=500, detail=str(e))

@app.post("/machines/{machine_id}/simulate")
def simulate_measurement_endpoint(machine_id: int, token: str = Depends(oauth2_scheme)):
    """
    Spustí generátor dat ze souboru seed.py.
    """
    # Zavoláme funkci ze seed.py
    result = seed.simulate_machine_data(machine_id)
    
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])
        
    return {"message": result["message"], "simulated_fault": result.get("fault")}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)