import os
import json
import ssl
import logging
import asyncio
import requests
import uvicorn
import aioftp
import pandas as pd
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from contextlib import asynccontextmanager
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException, status, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy import create_engine, text
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from asyncua import Client, ua
from ftplib import FTP, FTP_TLS, error_perm

from auth import verify_password, create_access_token, get_password_hash
import seed

# Načtení konfigurace z prostředí
load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
ML_SERVICE_URL = os.getenv("ML_SERVICE_URL", "http://localhost:8001")
DB_URL = os.getenv("DATABASE_URL", "postgresql://admin:secret@localhost:5432/vibro_diag")

# CM4810 defaults (can be overridden by env):
# TRACE_BUFFER_CHANNEL_MAP="1:66,2:67,3:70,4:71"
# TRACE_BUFFER_LENGTH="4097"
TRACE_BUFFER_CHANNEL_MAP = os.getenv("TRACE_BUFFER_CHANNEL_MAP", "1:66,2:67,3:70,4:71")
TRACE_BUFFER_LENGTH = int(os.getenv("TRACE_BUFFER_LENGTH", "4097"))

ANOMALY_THRESHOLD = 0.75
FAULT_RUL_DAYS = 7.0
FAULT_CONFIDENCE = 0.90


def translate_path_for_ml(path: str) -> str:
    """
    Translate backend-stored CSV paths to ML service container paths.
    Backend writes to /app/data (host: ./backend/data), ML reads same host mount at /app/backend_data.
    """
    if not path:
        return path

    normalized = str(path).replace('\\', '/')

    if normalized.startswith('./data/'):
        return f"/app/backend_data/{normalized[len('./data/'):] }"
    if normalized.startswith('/app/data/'):
        return f"/app/backend_data/{normalized[len('/app/data/'):] }"

    return path


def _to_float(value):
    try:
        if value is None:
            return None
        return float(value)
    except Exception:
        return None


def _label_signals_fault(label: Optional[str]) -> bool:
    if not label:
        return False
    txt = str(label).lower()
    healthy_tokens = ["normal", "healthy", "zdrav"]
    fault_tokens = ["porucha", "fault", "race", "ball", "inner", "outer", "anom"]
    if any(token in txt for token in healthy_tokens):
        return False
    return any(token in txt for token in fault_tokens)


def recalculate_machine_status(conn, machine_id: int) -> str:
    """
    Přepočítá a uloží status stroje podle posledních AI výstupů.
    Pravidla:
    - FAULT: RUL <= 7 dní, nebo anomálie + vysoce jistá klasifikovaná porucha.
    - WARNING: anomálie, nebo klasifikovaná porucha.
    - OK: bez anomálie i bez poruchy.
    """
    query_anomaly = text("""
        SELECT ar.prediction_value, ar.prediction_label
        FROM analysis_results ar
        JOIN measurements m ON ar.id_measurement = m.id_measurement
        JOIN sensors s ON m.id_sensor = s.id_sensor
        WHERE s.id_machine = :mid AND ar.prediction_type = 'Anomaly Detection'
        ORDER BY ar.timestamp DESC
        LIMIT 1
    """)
    anomaly_row = conn.execute(query_anomaly, {"mid": machine_id}).fetchone()

    query_fault = text("""
        SELECT ar.prediction_label, ar.confidence
        FROM analysis_results ar
        JOIN measurements m ON ar.id_measurement = m.id_measurement
        JOIN sensors s ON m.id_sensor = s.id_sensor
        WHERE s.id_machine = :mid AND ar.prediction_type = 'Fault Classification'
        ORDER BY ar.timestamp DESC
        LIMIT 1
    """)
    fault_row = conn.execute(query_fault, {"mid": machine_id}).fetchone()

    query_rul = text("""
        SELECT ar.prediction_value
        FROM analysis_results ar
        JOIN measurements m ON ar.id_measurement = m.id_measurement
        JOIN sensors s ON m.id_sensor = s.id_sensor
        WHERE s.id_machine = :mid AND ar.prediction_type = 'RUL Prediction'
        ORDER BY ar.timestamp DESC
        LIMIT 1
    """)
    rul_row = conn.execute(query_rul, {"mid": machine_id}).fetchone()

    anomaly_score = _to_float(anomaly_row[0]) if anomaly_row else None
    anomaly_label = anomaly_row[1] if anomaly_row else None
    anomaly_by_score = anomaly_score is not None and anomaly_score > ANOMALY_THRESHOLD
    anomaly_by_label = _label_signals_fault(anomaly_label)
    is_anomaly = anomaly_by_score or anomaly_by_label

    fault_label = fault_row[0] if fault_row else None
    fault_conf = _to_float(fault_row[1]) if fault_row else None
    has_fault = _label_signals_fault(fault_label)
    high_conf_fault = has_fault and fault_conf is not None and fault_conf >= FAULT_CONFIDENCE

    rul_days = _to_float(rul_row[0]) if rul_row else None
    low_rul = rul_days is not None and rul_days <= FAULT_RUL_DAYS

    new_status = "OK"
    if low_rul or (is_anomaly and high_conf_fault):
        new_status = "FAULT"
    elif is_anomaly or has_fault:
        new_status = "WARNING"

    update_status = text("UPDATE machines SET status = :status WHERE id_machine = :mid")
    conn.execute(update_status, {"status": new_status, "mid": machine_id})
    return new_status

# Inicializace databázového jádra (Synchronní SQLAlchemy běžící ve vláknech FastAPI)
engine = create_engine(DB_URL)

# Konfigurace zabezpečení JWT OAuth2
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# --- PYDANTIC DATOVÉ MODELY (DTOs) ---

class TrainingSegmentFrontend(BaseModel):
    id_machine: int
    id_sensor: int
    dateFrom: str
    dateTo: str
    label: Optional[str] = None

class FineTuneStartRequest(BaseModel):
    segments: List[TrainingSegmentFrontend]

class WebhookPayload(BaseModel):
    status: str             # "success" / "failed"
    message: Optional[str] = None

class OPCSettings(BaseModel):
    url: Optional[str] = ""

class FTPSettings(BaseModel):
    host: Optional[str] = ""
    username: Optional[str] = ""
    password: Optional[str] = ""
    directory: Optional[str] = ""

class TestConnectionPayload(BaseModel):
    url: Optional[str] = None
    host: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    directory: Optional[str] = None

class MachineSettingsUpdate(BaseModel):
    is_active_collection: bool
    opc_ua: OPCSettings
    ftp: FTPSettings

class SegmentInfo(BaseModel):
    id_machine: int
    id_sensor: int
    dateFrom: str
    dateTo: str
    label: Optional[int] = None

class FineTuneStartRequest(BaseModel):
    segments: List[SegmentInfo]
    lifecycle_info: Optional[dict] = None

# --- ASYNCHRONNÍ SPRÁVA ŽIVOTNÍHO CYKLU (LIFESPAN) ---

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Správce životního cyklu aplikace. Nahrazuje zastaralý app.on_event.
    Při startu inicializuje a spustí asynchronní plánovač úloh pro sběr dat.
    """
    scheduler = AsyncIOScheduler()
    # Produkční plán: Sběr dat každé 4 hodiny
    scheduler.add_job(download_and_process_raw_data, 'cron', hour='2,6,10,14,18,22', minute=0)
    scheduler.start()
    print("Asynchronní scheduler úloh spuštěn v produkčním režimu.")
    
    yield  # Zde aplikace běží a obsluhuje požadavky
    
    # Logika při ukončení aplikace
    scheduler.shutdown()
    print("Asynchronní scheduler úloh byl bezpečně ukončen.")

# Inicializace FastAPI aplikace s definovaným lifespan kontextem
app = FastAPI(title="VibroDiag API", lifespan=lifespan)

# Nastavení Cross-Origin Resource Sharing (CORS) pro komunikaci s React frontendem
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",
        "http://localhost:80",
        "http://127.0.0.1",
        "http://127.0.0.1:80",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# --- POMOCNÉ FUNKCE AUTENTIZACE ---

def get_current_user_role(token: str = Depends(oauth2_scheme)):
    """
    Dekóduje JWT token z hlavičky požadavku a extrahuje roli přihlášeného uživatele.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        role: str = payload.get("role")
        if role is None:
            raise HTTPException(status_code=401, detail="Token neobsahuje uživatelskou roli.")
        return role
    except JWTError:
        raise HTTPException(status_code=401, detail="Neplatný nebo expirovaný přístupový token.")

# --- ZÁKLADNÍ TRASY ---

@app.get("/")
def home():
    """Veřejný testovací endpoint pro ověření stavu běžícího backendu."""
    return {"message": "Vibrodiagnosticky system bezi!"}


# ==========================================
# --- SEKCE DATA (HISTORIE A MONITORING) ---
# ==========================================

@app.get("/history")
def get_history(limit: int = 100, token: str = Depends(get_current_user_role)):
    """
    Vrátí pole posledních 'limit' záznamů z databáze pro globální vizualizaci.
    (Opraveno pro explicitní názvy sloupců kvůli změně struktury init.sql)
    """
    with engine.connect() as conn:
        # Přesně specifikujeme sloupce, ať se nespoléháme na jejich pořadí v DB
        query = text("SELECT time, id_machine, peak_raw, kurtosis_raw, rms_raw FROM feature_data ORDER BY time DESC LIMIT :limit")
        result = conn.execute(query, {"limit": limit}).fetchall()
        
        if not result:
            return {"message": "Žádná data nebyla nalezena"}
            
        history = []
        for row in result:
            history.append({
                "time": row[0],
                "asset_id": row[1],
                "peak_raw": row[2],
                "kurtosis": row[3],
                "rms_raw": row[4]  
            })
        return history

# ==========================================
# --- SEKCE UŽIVATELŮ (AUTHENTICATION) ---
# ==========================================

@app.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Ověří uživatelské jméno a heslo oproti DB a vygeneruje přístupový JWT token.
    Aktualizuje čas posledního přihlášení uživatele v DB.
    """
    with engine.connect() as conn:
        query = text("SELECT id_user, username, hashed_password, role FROM users WHERE username = :user")
        user_record = conn.execute(query, {"user": form_data.username}).fetchone()

        if not user_record:
            raise HTTPException(status_code=401, detail="Uživatel neexistuje")

        if not verify_password(form_data.password, user_record[2]):
            raise HTTPException(status_code=401, detail="Nesprávné heslo")

        # Aktualizace timestampu přihlášení (id_user je index 0)
        update_query = text("UPDATE users SET last_login = :now WHERE id_user = :uid")
        conn.execute(update_query, {
            "now": datetime.now(timezone.utc), 
            "uid": user_record[0]
        })
        conn.commit()

        # Generování JWT (sub = username na indexu 1, role na indexu 3)
        access_token = create_access_token(
            data={"sub": user_record[1], "role": user_record[3]}
        )
        
        return {"access_token": access_token, "token_type": "bearer", "role": user_record[3]}

@app.post("/auth/refresh")
def refresh_token(token: str = Depends(oauth2_scheme)):
    """
    Vydá nový JWT token s prodlouženou platností, pokud je stávající token stále platný.
    Volá se proaktivně z frontendu před vypršením tokenu.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub: str = payload.get("sub")
        role: str = payload.get("role")
        if not sub or not role:
            raise HTTPException(status_code=401, detail="Neplatný token.")
    except JWTError:
        raise HTTPException(status_code=401, detail="Neplatný nebo expirovaný přístupový token.")

    new_token = create_access_token(data={"sub": sub, "role": role})
    return {"access_token": new_token, "token_type": "bearer"}

@app.get("/users")
def get_all_users(token: str = Depends(oauth2_scheme)):
    """
    Vrátí kompletní seznam registrovaných uživatelů v systému.
    """
    with engine.connect() as conn:
        query = text("SELECT id_user, username, email, role, creation_time, last_login FROM users ORDER BY id_user ASC")
        result = conn.execute(query).fetchall()
        
        return [
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
    
@app.post("/users")
def create_user(user_data: dict, token: str = Depends(oauth2_scheme)):
    """
    Vytvoří a zaregistruje nového uživatele se zahešovaným heslem.
    """
    hashed_pwd = get_password_hash(user_data['password'])
    
    with engine.connect() as conn:
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

@app.put("/users/{user_id}")
def update_user(user_id: int, updated_data: dict, token: str = Depends(oauth2_scheme)):
    """
    Aktualizuje údaje uživatele (email, role, volitelně heslo) na základě jeho ID.
    """
    with engine.connect() as conn:
        sql_text = "UPDATE users SET email = :email, role = :role"
        params = {
            "email": updated_data['email'],
            "role": updated_data['role'],
            "uid": user_id
        }

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

@app.delete("/users/{user_id}")
def delete_user(user_id: int, role: str = Depends(get_current_user_role)):
    """
    Odstraní uživatele ze systému. Striktně vyžaduje roli administrátora.
    """
    if role != "admin":
        raise HTTPException(status_code=403, detail="Pouze administrátor může mazat uživatele")
        
    with engine.connect() as conn:
        delete_query = text("DELETE FROM users WHERE id_user = :uid")
        result = conn.execute(delete_query, {"uid": user_id})
        conn.commit()
        
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Uživatel nenalezen")
            
        return {"message": f"Uživatel s ID {user_id} byl úspěšně smazán"}


# ==========================================
# --- SEKCE SENZORY (HW MANAGEMENT) ---
# ==========================================

@app.get("/sensors")
def get_all_sensors(token: str = Depends(oauth2_scheme)):
    """
    Vrátí přehled všech fyzických senzorů evidovaných v systému.
    """
    with engine.connect() as conn:
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
    """
    Zaregistruje nový senzor do inventáře. Vyžaduje roli admin.
    Pokud je rovnou vybrán cílový stroj, stav se automaticky upraví na 'active'.
    """
    if role != "admin":
        raise HTTPException(status_code=403, detail="Pouze administrátor může registrovat senzory")
    
    status = sensor_data.get('status', 'available')
    machine_id = sensor_data.get('id_machine')
    position = sensor_data.get('position')

    if machine_id and status == 'available':
        status = 'active'
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
            raise HTTPException(status_code=400, detail=str(e))
            
        return {"message": "Senzor byl úspěšně zaregistrován"}

@app.put("/sensors/{sensor_id}")
def update_sensor(sensor_id: int, updated_data: dict, role: str = Depends(get_current_user_role)):
    """
    Aktualizuje parametry a stav senzoru. Pokud je senzor přepnut do stavu
    mimo provoz ('available', 'maintenance'), automaticky se zruší jeho vazba na stroj.
    """
    if role != "admin":
        raise HTTPException(status_code=403, detail="Pouze administrátor může upravovat senzory")

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
            "position": position,
            "pos": position,      
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
    """Odstraní senzor z databáze systému. Pouze pro administrátory."""
    if role != "admin":
        raise HTTPException(status_code=403, detail="Pouze administrátor může mazat senzory")
    
    with engine.connect() as conn:
        result = conn.execute(text("DELETE FROM sensors WHERE id_sensor = :sid"), {"sid": sensor_id})
        conn.commit()
        
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Senzor nenalezen")
        return {"message": "Senzor byl odstraněn"}

@app.get("/sensors/available")
def get_available_sensors(token: str = Depends(oauth2_scheme)):
    """Vrátí seznam dosud nepřiřazených (volných) senzorů pro osazení na stroje."""
    with engine.connect() as conn:
        query = text("SELECT id_sensor, serial_number, description FROM sensors WHERE status = 'available'")
        result = conn.execute(query).fetchall()
        
        return [
            {"id_sensor": row[0], "serial_number": row[1], "description": row[2]} 
            for row in result
        ]

@app.post("/machines/{machine_id}/sensors")
def attach_sensor(machine_id: int, payload: dict, token: str = Depends(oauth2_scheme)):
    """
    Montáž a logické přiřazení senzoru ke konkrétnímu stroji na specifikovanou pozici.
    """
    with engine.connect() as conn:
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
            raise HTTPException(status_code=404, detail="Senzor se nepodařilo aktualizovat")
            
        return {"message": "Senzor byl úspěšně namontován"}

@app.post("/machines/{machine_id}/sensors/{sensor_id}/detach")
def detach_sensor_from_machine(machine_id: int, sensor_id: int, token: str = Depends(oauth2_scheme)):
    """
    Rychlé odpojení senzoru od stroje, uvolnění měřící pozice a návrat HW do stavu 'available'.
    """
    with engine.connect() as conn:
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


# ==========================================
# --- SEKCE MACHINES (ASSET MONITORING) ---
# ==========================================

@app.get("/machines")
def get_machines(token: str = Depends(oauth2_scheme)):
    """
    Načte přehled všech výrobních strojů včetně agregačních poddotazů pro získání
    poslední servisní poznámky, její závažnosti a autora.
    """
    with engine.connect() as conn:
        query = text("""
            SELECT 
                m.id_machine, m.name, m.type, m.location, m.status,
                (SELECT content FROM service_notes WHERE id_machine = m.id_machine ORDER BY timestamp DESC LIMIT 1) as last_note,
                (SELECT severity FROM service_notes WHERE id_machine = m.id_machine ORDER BY timestamp DESC LIMIT 1) as last_note_severity,
                (SELECT u.username FROM service_notes sn JOIN users u ON sn.id_user = u.id_user 
                 WHERE sn.id_machine = m.id_machine ORDER BY sn.timestamp DESC LIMIT 1) as last_note_author,
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
    Registruje nový stroj do monitorovacího systému. Vyžaduje roli admin.
    """
    if role != "admin":
        raise HTTPException(status_code=403, detail="Pouze administrátor může přidávat stroje")
    
    name = machine_data.get('name')
    if not name:
        raise HTTPException(status_code=400, detail="Název stroje je povinný údaj.")

    description = machine_data.get('description', '')
    m_type = machine_data.get('type', '')
    location = machine_data.get('location', '')
    status = str(machine_data.get('status', 'STOPPED')).upper()

    # DB enum: machine_status_type = ('OK', 'WARNING', 'FAULT', 'STOPPED')
    legacy_status_map = {
        'CRITICAL': 'FAULT',
        'OFFLINE': 'STOPPED'
    }
    status = legacy_status_map.get(status, status)

    valid_statuses = ['OK', 'WARNING', 'FAULT', 'STOPPED']
    if status not in valid_statuses:
        status = 'STOPPED'

    with engine.connect() as conn:
        query = text("""
            INSERT INTO machines (name, description, type, location, status)
            VALUES (:name, :description, :type, :loc, :status)
        """)
        try:
            conn.execute(query, {"name": name, "description": description, "type": m_type, "loc": location, "status": status})
            conn.commit()
        except Exception:
            raise HTTPException(status_code=400, detail="Nepodařilo se vytvořit stroj. Název již existuje.")
            
    return {"message": "Stroj byl úspěšně přidán"}

@app.get("/machines/{machine_id}")
def get_machine_detail(machine_id: int, token: str = Depends(oauth2_scheme)):
    """
    Vrátí komplexní detail stroje: jeho konfiguraci, osazené senzory a poslední servisní záznam.
    """
    with engine.connect() as conn:
        query_machine = text("SELECT * FROM machines WHERE id_machine = :mid")
        machine = conn.execute(query_machine, {"mid": machine_id}).fetchone()
        if not machine: 
            raise HTTPException(status_code=404, detail="Stroj nenalezen")

        query_sensors = text("SELECT * FROM sensors WHERE id_machine = :mid")
        sensors = [dict(row._mapping) for row in conn.execute(query_sensors, {"mid": machine_id}).fetchall()]

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
            "info": dict(machine._mapping),
            "sensors": sensors,
            "last_note": last_note_data
        }

@app.get("/machines/{machine_id}/measurements")
def get_machine_measurements(machine_id: int, limit: int = 50, token: str = Depends(oauth2_scheme)):
    """
    Vrátí historii vypočtených deskriptorů (RMS, Peak, ISO normy) pro konkrétní stroj.
    """
    with engine.connect() as conn:
        query = text("""
            SELECT fd.time, s.description as sensor_name, s.position, fd.rms_raw, fd.peak_raw, fd.iso_10816
            FROM feature_data fd
            JOIN measurements m ON fd.id_measurement = m.id_measurement
            JOIN sensors s ON m.id_sensor = s.id_sensor
            WHERE fd.id_machine = :mid
            ORDER BY fd.time DESC LIMIT :lim
        """)
        result = conn.execute(query, {"mid": machine_id, "lim": limit}).fetchall()
        
        return [
            {"time": row[0], "sensor": row[1], "position": row[2], "rms": row[3], "peak": row[4], "iso": row[5]}
            for row in result
        ]

@app.get("/machines/{machine_id}/settings")
def get_machine_settings(machine_id: int, token: str = Depends(oauth2_scheme)):
    """
    Načte průmyslové komunikační nastavení stroje (OPC UA uzly, FTP přihlášení a aktivitu sběru).
    """
    with engine.connect() as conn:
        query = text("""
            SELECT is_active_collection, opc_ua_url, ftp_host, ftp_user, ftp_password, ftp_dir 
            FROM machines WHERE id_machine = :mid
        """)
        result = conn.execute(query, {"mid": machine_id}).fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="Stroj nenalezen")
            
        return {
            "is_active_collection": bool(result[0]) if result[0] is not None else False,
            "opc_ua": {"url": result[1] or ""},
            "ftp": {
                "host": result[2] or "",
                "username": result[3] or "",
                "password": result[4] or "",
                "directory": result[5] or ""
            }
        }

@app.put("/machines/{machine_id}/settings")
def update_machine_settings(machine_id: int, payload: MachineSettingsUpdate, role: str = Depends(get_current_user_role)):
    """
    Uloží novou průmyslovou konfiguraci pro automatizovaný sběr dat. (Admin/Operator)
    """
    if role not in ["admin", "operator"]:
        raise HTTPException(status_code=403, detail="Nemáte oprávnění měnit nastavení stroje.")
        
    with engine.connect() as conn:
        query = text("""
            UPDATE machines 
            SET is_active_collection = :is_active, opc_ua_url = :opc_url, ftp_host = :ftp_host,
                ftp_user = :ftp_user, ftp_password = :ftp_pass, ftp_dir = :ftp_dir
            WHERE id_machine = :mid
        """)
        result = conn.execute(query, {
            "is_active": payload.is_active_collection, "opc_url": payload.opc_ua.url,
            "ftp_host": payload.ftp.host, "ftp_user": payload.ftp.username,
            "ftp_pass": payload.ftp.password, "ftp_dir": payload.ftp.directory, "mid": machine_id
        })
        conn.commit()
        
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Stroj nenalezen")
            
        return {"message": "Nastavení stroje bylo úspěšně aktualizováno."}   

@app.post("/machines/{machine_id}/test-connection")
async def test_machine_connection(machine_id: int, type: str, payload: TestConnectionPayload, role: str = Depends(get_current_user_role)):
    """
    Asynchronní test konektivity k síťovému rozhraní PLC (buď test OPC UA handshake, nebo FTP TLS login).
    """
    if role not in ["admin", "operator"]:
        raise HTTPException(status_code=403, detail="Nemáte oprávnění testovat spojení.")

    if type == "opc":
        url = payload.url
        try:
            client = Client(url=url)
            await asyncio.wait_for(client.connect(), timeout=3.0)
            await client.disconnect()
            return {"status": "success", "message": "OPC UA spojení navázáno."}
        except asyncio.TimeoutError:
            raise HTTPException(status_code=400, detail="Vypršel časový limit. OPC server není dostupný.")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Chyba připojení: {str(e)}")

    elif type == "ftp":
        host = (payload.host or "").strip()
        user = (payload.username or "").strip()
        pwd = payload.password or ""
        directory = (payload.directory or "").strip()

        if not host:
            raise HTTPException(status_code=400, detail="FTP host není vyplněn.")

        # Pokud není uživatel zadán, zkusíme standardní anonymní přihlášení.
        if not user:
            user = "anonymous"
            if not pwd:
                pwd = "anonymous@"

        try:
            def try_ftp():
                # Create SSL context with legacy server support
                ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
                ctx.check_hostname = False
                ctx.verify_mode = ssl.CERT_NONE
                # Allow legacy DH keys
                ctx.set_ciphers('DEFAULT@SECLEVEL=1')

                errors = []

                # Režim 1: Explicit FTPES (AUTH TLS + login + PROT P)
                try:
                    ftp = FTP_TLS(context=ctx, timeout=30.0)
                    ftp.connect(host, 21, timeout=30.0)
                    ftp.auth()
                    ftp.login(user, pwd)
                    ftp.prot_p()
                    if directory:
                        ftp.cwd(directory)
                    ftp.quit()
                    return
                except Exception as e:
                    errors.append(f"FTPES(AUTH TLS): {str(e)}")

                # Režim 2: Explicit FTPES bez PROT P (některé legacy PLC servery)
                try:
                    ftp = FTP_TLS(context=ctx, timeout=30.0)
                    ftp.connect(host, 21, timeout=30.0)
                    ftp.auth()
                    ftp.login(user, pwd)
                    if directory:
                        ftp.cwd(directory)
                    ftp.quit()
                    return
                except Exception as e:
                    errors.append(f"FTPES(no PROT): {str(e)}")

                # Režim 3: Plain FTP (bez TLS) - část PLC serverů je jen FTP
                try:
                    ftp = FTP(timeout=30.0)
                    ftp.connect(host, 21, timeout=30.0)
                    ftp.login(user, pwd)
                    if directory:
                        ftp.cwd(directory)
                    ftp.quit()
                    return
                except Exception as e:
                    errors.append(f"FTP plain: {str(e)}")

                # Pokud jde o autentizační chybu, vracíme uživatelsky čitelnou zprávu.
                if any("530" in err or "authorization failed" in err.lower() for err in errors):
                    raise HTTPException(
                        status_code=400,
                        detail="FTP přihlášení selhalo (530). Zkontrolujte username/password a oprávnění účtu na PLC FTP serveru."
                    )

                raise HTTPException(status_code=400, detail=f"Chyba připojení FTP: {' | '.join(errors)}")
            
            await asyncio.to_thread(try_ftp)
            return {"status": "success", "message": "FTP spojení navázáno a ověřeno."}
        except HTTPException:
            raise
        except error_perm as e:
            if str(e).startswith("530"):
                raise HTTPException(
                    status_code=400,
                    detail="FTP přihlášení selhalo (530). Zkontrolujte username/password a oprávnění účtu na PLC FTP serveru."
                )
            raise HTTPException(status_code=400, detail=f"Chyba připojení FTP: {str(e)}")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Chyba připojení FTP: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail="Neznámý typ testu.")


# ==========================================
# --- SEKCE SERVISNÍ POZNÁMKY (LOGS) ---
# ==========================================

@app.get("/machines/{machine_id}/notes")
def get_machine_notes(machine_id: int, token: str = Depends(oauth2_scheme)):
    """Vrátí chronologický přehled servisních zásahů a poznámek u stroje."""
    with engine.connect() as conn:
        query = text("""
            SELECT sn.id_note, sn.content, sn.severity, sn.timestamp, u.username
            FROM service_notes sn JOIN users u ON sn.id_user = u.id_user
            WHERE sn.id_machine = :mid ORDER BY sn.timestamp DESC
        """)
        result = conn.execute(query, {"mid": machine_id}).fetchall()
        
        return [
            {"id_note": row[0], "content": row[1], "severity": row[2], "timestamp": row[3], "author": row[4]}
            for row in result
        ]

@app.post("/machines/{machine_id}/notes")
def add_service_note(machine_id: int, note: dict, token: str = Depends(oauth2_scheme)):
    """
    Uloží novou provozní/servisní poznámku ke stroji. Autor se automaticky páruje přes sub z JWT.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    username = payload.get("sub")
    
    with engine.connect() as conn:
        user_query = text("SELECT id_user FROM users WHERE username = :name")
        user_id = conn.execute(user_query, {"name": username}).scalar()
        if not user_id:
             raise HTTPException(status_code=401, detail="Unknown user.")

        query = text("""
            INSERT INTO service_notes (id_machine, id_user, content, severity, timestamp)
            VALUES (:mid, :uid, :content, CAST(:severity AS severity_type), :now)
        """)
        conn.execute(query, {
            "mid": machine_id, "uid": user_id, "content": note['content'],
            "severity": note.get('severity', 'INFO'), "now": datetime.now(timezone.utc)
        })
        conn.commit()
        return {"message": "Note saved"}

@app.delete("/machines/{machine_id}/notes/{note_id}")
def delete_service_note(machine_id: int, note_id: int, token: str = Depends(oauth2_scheme)):
    """Smaže vybranou servisní poznámku na základě ID."""
    with engine.connect() as conn:
        query = text("DELETE FROM service_notes WHERE id_note = :nid AND id_machine = :mid")
        result = conn.execute(query, {"nid": note_id, "mid": machine_id})
        conn.commit()
        
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Poznámka nenalezena")
        return {"message": "Poznámka smazána"}


# ==========================================
# --- SEKCE MĚŘENÍ (RAW DATA PIPELINE) ---
# ==========================================

@app.post("/measurements")
def create_measurement(measurement_data: dict, role: str = Depends(oauth2_scheme)):
    """
    Vytvoří nový záznam o provedeném měření (registrace cesty k surovému souboru).
    Používáno především automatizovanými skripty.
    """
    if role not in ["admin", "operator"]:
         raise HTTPException(status_code=403, detail="Nemáte oprávnění přidávat měření.")

    id_sensor = measurement_data.get('id_sensor')
    raw_data_path = measurement_data.get('raw_data_path')
    timestamp_str = measurement_data.get('timestamp') 

    if not id_sensor or not raw_data_path or not timestamp_str:
        raise HTTPException(status_code=400, detail="Chybí povinné pole (id_sensor, raw_data_path nebo timestamp).")

    notes = measurement_data.get('notes', '')

    with engine.connect() as conn:
        try:
            sensor_exists = conn.execute(text("SELECT id_sensor FROM sensors WHERE id_sensor = :id"), {"id": id_sensor}).fetchone()
            if not sensor_exists:
                raise HTTPException(status_code=404, detail=f"Senzor s ID {id_sensor} neexistuje.")

            query = text("""
                INSERT INTO measurements (id_sensor, timestamp, raw_data_path, notes)
                VALUES (:sid, :ts, :path, :notes) RETURNING id_measurement
            """)
            result = conn.execute(query, {"sid": id_sensor, "ts": timestamp_str, "path": raw_data_path, "notes": notes})
            conn.commit()
            
            return {"message": "Záznam měření úspěšně vytvořen", "id_measurement": result.scalar()}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

@app.post("/machines/{machine_id}/simulate")
def simulate_measurement_endpoint(machine_id: int, token: str = Depends(oauth2_scheme)):
    """
    Spustí generátor syntetických dat ze seed.py (simulace běhu a poruchy pro testování).
    """
    result = seed.simulate_machine_data(machine_id)
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return {"message": result["message"], "simulated_fault": result.get("fault")}

@app.get("/machines/{machine_id}/history")
def get_machine_history(machine_id: int, limit: int = 50, role: str = Depends(oauth2_scheme)):
    with engine.connect() as conn:
        # Bereme recent data z obou zdrojů samostatně, aby hustý IIoT stream
        # nepřehlušil čerstvě stažené raw buffer záznamy.
        source_limit = max(1, int(limit))
        combined_limit = source_limit * 2
        query = text("""
            (
                SELECT 
                    fd.id_featureset as id_record,
                    fd.time as timestamp, 
                    s.serial_number as sensor_name,
                    s.position,
                    fd.rms_raw, fd.peak_raw, fd.kurtosis_raw, fd.rms_acl_env, 
                    fd.dif_kt_raw, fd.skewness_raw, fd.act_speed,
                    'iiot_connector' as source,
                    NULL as raw_path
                FROM feature_data fd
                JOIN sensors s ON fd.id_sensor = s.id_sensor
                WHERE s.id_machine = :mid
                ORDER BY fd.time DESC
                LIMIT :source_lim
            )
            UNION ALL
            (
                SELECT 
                    m.id_measurement as id_record,
                    m.timestamp, 
                    s.serial_number as sensor_name,
                    s.position,
                    m.rms_raw, m.peak_raw, m.kurtosis_raw, m.rms_acl_env, 
                    m.dif_kt_raw, m.skewness_raw, m.act_speed,
                    'raw_analysis' as source,
                    m.raw_data_path as raw_path
                FROM measurements m
                JOIN sensors s ON m.id_sensor = s.id_sensor
                WHERE s.id_machine = :mid
                ORDER BY m.timestamp DESC
                LIMIT :source_lim
            )
            ORDER BY timestamp DESC
            LIMIT :combined_lim
        """)
        
        result = conn.execute(query, {
            "mid": machine_id,
            "source_lim": source_limit,
            "combined_lim": combined_limit
        }).fetchall()
        
        history = []
        for row in result:
            history.append({
                "id_measurement": row[0],  # Nyní se správně předává ID záznamu
                "timestamp": row[1],
                "sensor_name": row[2],
                "position": row[3],
                "rms": row[4],
                "peak": row[5],
                "kurtosis": row[6],
                "rms_acl_env": row[7],
                "dif_kt_raw": row[8],
                "skewness": row[9],
                "act_speed": row[10],
                "source": row[11],
                "raw_data_path": row[12]
            })
            
        return history
    
@app.post("/measurements/{id_measurement}/process")
def process_measurement_data(id_measurement: int, role: str = Depends(get_current_user_role)):
    if role not in ["admin", "operator"]:
        raise HTTPException(status_code=403, detail="Nedostatečná oprávnění")

    with engine.connect() as conn:
        # 1. Získáme pouze cestu k surovému souboru
        query_path = text("""
            SELECT raw_data_path 
            FROM measurements 
            WHERE id_measurement = :id
        """)
        
        res = conn.execute(query_path, {"id": id_measurement}).fetchone()
        if not res or not res[0]: 
            raise HTTPException(status_code=404, detail="Měření nebo soubor nebyl nalezen")
        
        path = res[0]
        ml_path = translate_path_for_ml(path)
        
        # 2. Volání ML Service pro vyčištění souboru a výpočet (zůstává strukturálně stejné)
        try:
            ml_res = requests.post(f"{ML_SERVICE_URL}/process-features", json={"path": ml_path})
            if ml_res.status_code != 200:
                raise HTTPException(status_code=500, detail=f"ML Service selhala při výpočtu: {ml_res.text}")
            
            features = ml_res.json()
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Nepodařilo se spojit s ML Service: {e}")
        
        # 3. Zápis výsledků: UPDATE stávajícího záznamu v tabulce measurements
        query_update = text("""
            UPDATE measurements 
            SET rms_raw = :rms, 
                kurtosis_raw = :kurt, 
                peak_raw = :peak,
                rms_acl_env = :env,
                dif_kt_raw = :dif,
                skewness_raw = :skew,
                act_speed = :speed
            WHERE id_measurement = :mid
        """)
        
        try:
            conn.execute(query_update, {
                "mid": id_measurement,
                "rms": features.get('rms_raw'), 
                "kurt": features.get('kurtosis_raw'),
                "peak": features.get('peak_raw'), 
                "env": features.get('rms_acl_env', 0.0),   # Ošetření, pokud by hodnota chyběla
                "dif": features.get('dif_kt_raw', 0.0),
                "skew": features.get('skewness_raw', 0.0),
                "speed": features.get('act_speed', 1480.0)
            })
            conn.commit()
        except Exception as e:
            print(f"Chyba při update features: {e}")
            raise HTTPException(status_code=500, detail="Chyba při zápisu výsledků do databáze")
        
    return {"message": "Data úspěšně zpracována a uložena", "id_measurement": id_measurement}

@app.get("/measurements/{id_measurement}/raw")
def proxy_raw_data(id_measurement: int):
    with engine.connect() as conn:
        res = conn.execute(text("SELECT raw_data_path FROM measurements WHERE id_measurement = :id"), {"id": id_measurement}).fetchone()
        
        if not res or not res[0]: 
            raise HTTPException(status_code=404, detail="Cesta nenalezena")
        
        path = res[0]
        ml_path = translate_path_for_ml(path)
        
        try:
            # Zavoláme ML službu o surová data pro graf
            ml_res = requests.post(f"{ML_SERVICE_URL}/get-raw-data", json={"path": ml_path, "step": 16})
            
            # Kontrola, zda ML služba nevrátila chybu (jinak by spadl .json() parser)
            if ml_res.status_code != 200:
                print(f"Chyba z ML Service: {ml_res.text}")
                raise HTTPException(status_code=500, detail="ML Service nedokázala načíst data")
                
            return ml_res.json()
            
        except requests.exceptions.RequestException as e:
            print(f"Selhalo spojení s ML Service: {e}")
            raise HTTPException(status_code=500, detail="Nelze se spojit s ML Service")

@app.get("/measurements/{id_measurement}/features")
def get_measurement_features(id_measurement: int):
    with engine.connect() as conn:
        # Data z raw měření se nyní updatují přímo v tabulce measurements
        query = text("SELECT * FROM measurements WHERE id_measurement = :id")
        row = conn.execute(query, {"id": id_measurement}).fetchone()
        
        if not row: 
            return None
            
        return dict(row._mapping)
    
@app.get("/measurements/{id_measurement}/fft")
def proxy_fft_data(id_measurement: int):
    with engine.connect() as conn:
        res = conn.execute(text("SELECT raw_data_path FROM measurements WHERE id_measurement = :id"), {"id": id_measurement}).fetchone()
        if not res or not res[0]: 
            raise HTTPException(status_code=404, detail="Cesta nenalezena")
            
        try:
            ml_res = requests.post(f"{ML_SERVICE_URL}/get-fft", json={"path": translate_path_for_ml(res[0])})
            if ml_res.status_code != 200:
                raise HTTPException(status_code=500, detail="Chyba výpočtu FFT v ML službě")
            return ml_res.json()
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
        
@app.get("/measurements/{id_measurement}/cwt")
def proxy_cwt_data(id_measurement: int):
    with engine.connect() as conn:
        res = conn.execute(text("SELECT raw_data_path FROM measurements WHERE id_measurement = :id"), {"id": id_measurement}).fetchone()
        if not res or not res[0]: 
            raise HTTPException(status_code=404, detail="Cesta nenalezena")
            
        try:
            ml_res = requests.post(f"{ML_SERVICE_URL}/get-cwt", json={"path": translate_path_for_ml(res[0])})
            if ml_res.status_code != 200:
                raise HTTPException(status_code=500, detail="Chyba výpočtu CWT v ML službě")
            return ml_res.json()
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# --- SEKCE MACHINE LEARNING (INFERENCE) ---
# ==========================================

@app.get("/ml-models")
def get_ml_models(role: str = Depends(get_current_user_role)):
    """Vrátí přehled všech ML modelů, jejich verzí, úspěšnosti a stavu trénování."""
    
    # Bezpečnostní pojistka: převedeme roli na čistý malý text
    safe_role = str(role).strip().lower()
    
    # Pokud role nesedí, vypíšeme ji přímo do erroru pro snazší debugování!
    if safe_role not in ["admin", "operator"]:
        raise HTTPException(status_code=403, detail=f"Nemáte oprávnění. Vaše role v tokenu je: '{role}'")

    with engine.connect() as conn:
        try:
            query = text("""
                SELECT id_model, name, version, type, path_to_model, accuracy, training_date, description, is_active
                FROM ml_models ORDER BY id_model ASC
            """)
            result = conn.execute(query).fetchall()
            return [dict(row._mapping) for row in result]
        except Exception:
            raise HTTPException(status_code=500, detail="Chyba databáze při načítání modelů.")
        
@app.post("/machines/{machine_id}/analyze-anomaly")
def analyze_machine_anomaly(machine_id: int, token: str = Depends(oauth2_scheme)):
    """
    Spustí na pozadí detekci anomálií pomocí generativního rekonstrukčního modelu
    AE-AnoWGAN na posledním staženém měření stroje a zapíše skóre do DB.
    """
    with engine.connect() as conn:
        query_meas = text("""
            SELECT m.id_measurement, m.raw_data_path FROM measurements m
            JOIN sensors s ON m.id_sensor = s.id_sensor WHERE s.id_machine = :mid
            ORDER BY m.timestamp DESC LIMIT 1
        """)
        meas = conn.execute(query_meas, {"mid": machine_id}).fetchone()
        if not meas:
            raise HTTPException(status_code=404, detail="Pro tento stroj nebylo nalezeno žádné lokální měření s raw daty.")
            
        id_measurement, raw_data_path = meas
        ml_path = translate_path_for_ml(raw_data_path)
        
        # ROBUSTNÍ DOTAZ: Hledáme cokoliv s "GAN" v názvu, co je aktivní (Ignoruje překlepy)
        query_model = text("SELECT id_model FROM ml_models WHERE name LIKE '%GAN%' AND is_active = true LIMIT 1")
        model = conn.execute(query_model).fetchone()
        if not model:
            raise HTTPException(status_code=404, detail="Aktivní model pro detekci anomálií (GAN) nebyl nalezen v databázi.")
        id_model = model[0]
        
        try:
            ml_res = requests.post(f"{ML_SERVICE_URL}/analyze-anomaly", json={"path": ml_path})
            ml_res.raise_for_status()
            ml_data = ml_res.json() 
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Chyba při komunikaci s ML Service: {e}")
            
        anomaly_score = ml_data.get("anomaly_score")
        is_anomaly = ml_data.get("is_anomaly")
        label = "Zjištěna anomálie" if is_anomaly else "Zdravý chod"
        
        # OPRAVENO: Musí se zapisovat 'Anomaly Detection', aby to React dokázal přečíst!
        query_insert = text("""
            INSERT INTO analysis_results (id_measurement, id_model, prediction_type, prediction_value, prediction_label, confidence, timestamp)
            VALUES (:mid, :modid, 'Anomaly Detection', :val, :label, :conf, NOW())
        """)
        try:
            conn.execute(query_insert, {"mid": id_measurement, "modid": id_model, "val": anomaly_score, "label": label, "conf": 1.0})
            machine_status = recalculate_machine_status(conn, machine_id)
            conn.commit()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Nepodařilo se uložit výsledek analýzy do databáze: {e}")
            
        return {"anomaly_score": anomaly_score, "is_anomaly": is_anomaly, "machine_status": machine_status, "message": "Analýza úspěšně dokončena"}
    
@app.post("/machines/{machine_id}/classify-fault")
def classify_machine_fault(machine_id: int, token: str = Depends(oauth2_scheme)):
    """
    Vyvolá klasifikaci typu lokalizované vady ložiska pomocí hluboké konvoluční sítě 1D-CNN.
    """
    with engine.connect() as conn:
        query_meas = text("""
            SELECT m.id_measurement, m.raw_data_path FROM measurements m
            JOIN sensors s ON m.id_sensor = s.id_sensor WHERE s.id_machine = :mid
            ORDER BY m.timestamp DESC LIMIT 1
        """)
        meas = conn.execute(query_meas, {"mid": machine_id}).fetchone()
        if not meas:
            raise HTTPException(status_code=404, detail="Žádné měření nenalezeno.")
            
        id_measurement, raw_data_path = meas
        ml_path = translate_path_for_ml(raw_data_path)
        
        # ROBUSTNÍ DOTAZ: Hledáme cokoliv s "CNN" v názvu
        query_model = text("SELECT id_model FROM ml_models WHERE name LIKE '%CNN%' AND is_active = true LIMIT 1")
        model = conn.execute(query_model).fetchone()
        if not model:
            raise HTTPException(status_code=404, detail="Aktivní model pro klasifikaci (CNN) nebyl nalezen v databázi.")
        id_model = model[0]
        
        try:
            ml_res = requests.post(f"{ML_SERVICE_URL}/classify-fault", json={"path": ml_path})
            ml_res.raise_for_status()
            ml_data = ml_res.json() 
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Chyba komunikace s ML Service: {e}")
            
        fault_type = ml_data.get("fault_type")
        confidence = ml_data.get("confidence")
        
        query_insert = text("""
            INSERT INTO analysis_results (id_measurement, id_model, prediction_type, prediction_label, confidence, timestamp)
            VALUES (:mid, :modid, 'Fault Classification', :label, :conf, NOW())
        """)
        try:
            conn.execute(query_insert, {"mid": id_measurement, "modid": id_model, "label": fault_type, "conf": confidence})
            machine_status = recalculate_machine_status(conn, machine_id)
            conn.commit()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Nepodařilo se uložit výsledek klasifikace: {e}")

        ml_data["machine_status"] = machine_status
        return ml_data

@app.post("/machines/{machine_id}/predict-rul")
def predict_machine_rul(machine_id: int, token: str = Depends(oauth2_scheme)):
    """
    Vypočítá RUL. Krmí ML mikroslužbu maticí 6x10 vytaženou přímo z DB.
    Spojuje data z FTP i IIoT.
    """
    with engine.connect() as conn:
        # Zjištění kategorie poruchy (Zůstává beze změny)
        query_label = text("""
            SELECT ar.prediction_label
            FROM analysis_results ar
            JOIN measurements m ON ar.id_measurement = m.id_measurement
            JOIN sensors s ON m.id_sensor = s.id_sensor
            WHERE s.id_machine = :mid AND ar.prediction_type = 'Fault Classification'
            ORDER BY ar.timestamp DESC
            LIMIT 1
        """)
        last_label_row = conn.execute(query_label, {"mid": machine_id}).fetchone()
        
        category = "O"
        if last_label_row and last_label_row[0]:
            label = last_label_row[0].lower()
            if "outer" in label or "vnější" in label:
                category = "OR"
            elif "inner" in label or "vnitřní" in label:
                category = "IR"

        # TAHÁME PŘÍMO TĚCH 6 CHARAKTERISTIK Z OBOU TABULEK
        query_features = text("""
            SELECT 
                COALESCE(f.rms_raw, m.rms_raw) as rms,
                COALESCE(f.peak_raw, m.peak_raw) as peak,
                COALESCE(f.kurtosis_raw, m.kurtosis_raw) as kurtosis,
                COALESCE(f.rms_acl_env, m.rms_acl_env) as env,
                COALESCE(f.dif_kt_raw, m.dif_kt_raw) as dif,
                COALESCE(f.skewness_raw, m.skewness_raw) as skew,
                COALESCE(m.id_measurement, f.id_featureset) as meas_id
            FROM measurements m
            FULL OUTER JOIN feature_data f ON m.id_measurement = f.id_measurement
            JOIN sensors s ON COALESCE(m.id_sensor, f.id_sensor) = s.id_sensor
            WHERE s.id_machine = :mid 
              AND COALESCE(f.rms_raw, m.rms_raw) IS NOT NULL -- Pouze zpracovaná data!
            ORDER BY COALESCE(m.timestamp, f.time) DESC LIMIT 10
        """)
        rows = conn.execute(query_features, {"mid": machine_id}).fetchall()
        
        if len(rows) == 0:
            raise HTTPException(status_code=400, detail="Nejsou k dispozici žádná data (RMS) pro výpočet RUL.")
            
        # Otočíme data z DB do chronologického pořadí pro LSTM (od nejstaršího po nejnovější)
        rows = rows[::-1]

        # Odstraníme nekompletní řádky (None v některé ze 6 charakteristik)
        valid_rows = [r for r in rows if all(v is not None for v in r[:6])]
        if len(valid_rows) == 0:
            raise HTTPException(status_code=400, detail="Nejsou k dispozici kompletní feature vektory pro výpočet RUL.")

        # Sestavíme tenzor: Seznam 10 listů, kde každý list má 6 float hodnot
        sequence = [[float(val) for val in row[:6]] for row in valid_rows]
        latest_meas_id = valid_rows[-1][6]  # ID posledního validního záznamu pro INSERT výsledku
        
        # PADDING: Pokud máme < 10 měření, naklonujeme nejstarší záznam na začátek
        while len(sequence) < 10:
            sequence.insert(0, sequence[0])
        
        try:
            # POSÍLÁME PŘÍMO MATICI DAT, NE CESTY!
            ml_res = requests.post(f"{ML_SERVICE_URL}/predict-rul", json={"features": sequence, "category": category})
            ml_res.raise_for_status()
            ml_data = ml_res.json() 
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Chyba komunikace s ML Service: {e}")
            
        rul_fraction = ml_data.get("rul_fraction")
        used_model = ml_data.get("used_model")
        if rul_fraction is None:
            raise HTTPException(status_code=500, detail="ML Service nevrátila hodnotu 'rul_fraction'.")
        rul_days = round(rul_fraction * 30, 1)
        
        model_query = text("SELECT id_model FROM ml_models WHERE (name LIKE '%LSTM%' OR type LIKE '%RUL%') AND is_active = true LIMIT 1")
        model_row = conn.execute(model_query).fetchone()
        
        if not model_row:
             raise HTTPException(status_code=404, detail="Aktivní model pro predikci RUL nebyl nalezen.")
        model_id = model_row[0]

        insert_query = text("""
            INSERT INTO analysis_results (id_model, id_measurement, prediction_type, prediction_value, prediction_label, timestamp)
            VALUES (:model_id, :meas_id, 'RUL Prediction', :val, :label, NOW())
        """)
        conn.execute(insert_query, {"model_id": model_id, "meas_id": latest_meas_id, "val": rul_days, "label": f"{rul_days} dní"})
        machine_status = recalculate_machine_status(conn, machine_id)
        conn.commit() 
        
        return {"rul_value": rul_days, "unit": "dní", "used_model": used_model, "machine_status": machine_status}
    
@app.get("/training-segments")
def get_training_segments(
    machine_id: Optional[int] = None, sensor_id: Optional[int] = None,
    datetime_from: Optional[str] = None, datetime_to: Optional[str] = None,
    token: str = Depends(oauth2_scheme)
):
    """Agreguje a vyhledá segmenty historických měření podle filtrů pro účely doučení modelů."""
    with engine.connect() as conn:
        query_str = """
            SELECT mac.id_machine, mac.name as machine_name, s.id_sensor, s.position as sensor_name,
                   MIN(m.timestamp) as date_from, MAX(m.timestamp) as date_to, COUNT(m.id_measurement) as measurements_count
            FROM measurements m
            JOIN sensors s ON m.id_sensor = s.id_sensor
            JOIN machines mac ON s.id_machine = mac.id_machine WHERE 1=1
        """
        params = {}
        if machine_id:
            query_str += " AND mac.id_machine = :machine_id"
            params["machine_id"] = machine_id
        if sensor_id:
            query_str += " AND s.id_sensor = :sensor_id"
            params["sensor_id"] = sensor_id
        if datetime_from:
            query_str += " AND m.timestamp >= :dt_from"
            params["dt_from"] = datetime_from.replace("T", " ") + ":00"
        if datetime_to:
            query_str += " AND m.timestamp <= :dt_to"
            params["dt_to"] = datetime_to.replace("T", " ") + ":59"
            
        query_str += " GROUP BY mac.id_machine, mac.name, s.id_sensor, s.position ORDER BY MAX(m.timestamp) DESC"
        result = conn.execute(text(query_str), params).fetchall()
        
        segments = []
        for row in result:
            display_sensor = row.sensor_name if row.sensor_name else f"Senzor #{row.id_sensor}"
            segments.append({
                "id": f"{row.id_machine}_{row.id_sensor}", "machine": row.machine_name, "sensor": display_sensor,
                "dateFrom": str(row.date_from)[:16], "dateTo": str(row.date_to)[:16], "measurementsCount": row.measurements_count
            })
        return segments
    
@app.get("/machines/{machine_id}/latest-ai")
def get_latest_ai_results(machine_id: int, token: str = Depends(oauth2_scheme)):
    """Načte poslední známé vyhodnocení anomálií, typu poruchy a RUL pro dashboard stroje."""
    with engine.connect() as conn:
        query_anomaly = text("""
            SELECT ar.prediction_value, ar.prediction_label, ar.timestamp FROM analysis_results ar
            JOIN measurements m ON ar.id_measurement = m.id_measurement
            JOIN sensors s ON m.id_sensor = s.id_sensor WHERE s.id_machine = :mid AND ar.prediction_type = 'Anomaly Detection'
            ORDER BY ar.timestamp DESC LIMIT 1
        """)
        anomaly = conn.execute(query_anomaly, {"mid": machine_id}).fetchone()

        query_fault = text("""
            SELECT ar.prediction_label, ar.confidence, ar.timestamp FROM analysis_results ar
            JOIN measurements m ON ar.id_measurement = m.id_measurement
            JOIN sensors s ON m.id_sensor = s.id_sensor WHERE s.id_machine = :mid AND ar.prediction_type = 'Fault Classification'
            ORDER BY ar.timestamp DESC LIMIT 1
        """)
        fault = conn.execute(query_fault, {"mid": machine_id}).fetchone()

        query_rul = text("""
            SELECT ar.prediction_value, ar.timestamp FROM analysis_results ar
            JOIN measurements m ON ar.id_measurement = m.id_measurement
            JOIN sensors s ON m.id_sensor = s.id_sensor WHERE s.id_machine = :mid AND ar.prediction_type = 'RUL Prediction'
            ORDER BY ar.timestamp DESC LIMIT 1
        """)
        rul = conn.execute(query_rul, {"mid": machine_id}).fetchone()

        def format_ts(ts):
            return ts.strftime('%d.%m.%Y %H:%M') if ts else None

        return {
            "anomaly": {"value": anomaly[0] if anomaly else None, "label": anomaly[1] if anomaly else None, "timestamp": format_ts(anomaly[2]) if anomaly else None},
            "fault": {"label": fault[0] if fault else None, "confidence": fault[1] if fault else None, "timestamp": format_ts(fault[2]) if fault else None},
            "rul": {"value": rul[0] if rul else None, "timestamp": format_ts(rul[1]) if rul else None}
        }

@app.post("/models/{model_id}/fine-tune")
def start_model_finetuning(model_id: int, payload: FineTuneStartRequest, token: str = Depends(oauth2_scheme)):
    """
    Iniciuje proces asynchronního doučení (Fine-Tuning) vybrané architektury modelu
    na označených datech z operátorského rozhraní Reactu.
    """
    print(f"\n🚀 START FINE-TUNING Z BASE MODELU ID {model_id}")
    with engine.connect() as conn:
        query_model = text("SELECT name, version, type, description FROM ml_models WHERE id_model = :mid")
        model_row = conn.execute(query_model, {"mid": model_id}).fetchone()
        if not model_row:
            raise HTTPException(status_code=404, detail="Zdrojový model nebyl nalezen.")
        
        model_name, current_version, model_type, description = model_row
        try:
            new_version = str(round(float(current_version) + 0.1, 1))
        except ValueError:
            new_version = f"{current_version}.1"
            
        folder_name = "1DCNN" if "CNN" in model_name else model_name
        save_path = f"models/{folder_name}/v{new_version}/{model_type.lower()}_model.pth"

        insert_query = text("""
            INSERT INTO ml_models (name, version, type, description, is_active, training_status, path_to_model) 
            VALUES (:name, :ver, :type, :desc, False, 'training', :path) RETURNING id_model
        """)
        new_model_id = conn.execute(insert_query, {
            "name": model_name, "ver": new_version, "type": model_type,
            "desc": f"{description} (Fine-tuned z v{current_version})", "path": save_path
        }).scalar()

        file_paths = []      
        measurements_data_cnn = [] 
        measurements_data_rul = [] 
        
        for seg in payload.segments:
            # --- NOVÁ ČÁST: Rozšíření časového okna o toleranci ---
            try:
                # Převedeme string z Reactu (odstraníme případné 'Z' z ISO formátu)
                d_from_obj = datetime.fromisoformat(seg.dateFrom.replace('Z', ''))
                d_to_obj = datetime.fromisoformat(seg.dateTo.replace('Z', ''))
                
                # Zvětšíme interval o 1 minutu na obě strany (tzv. padding okna)
                d_from_obj -= timedelta(minutes=1)
                d_to_obj += timedelta(minutes=1)
                
                # Zformátujeme zpět pro SQL dotaz
                sql_d_from = d_from_obj.strftime("%Y-%m-%d %H:%M:%S")
                sql_d_to = d_to_obj.strftime("%Y-%m-%d %H:%M:%S")
            except Exception as e:
                print(f"[DEBUG] Upozornění - nepodařilo se zparsovat datum, použije se originál: {e}")
                sql_d_from = seg.dateFrom
                sql_d_to = seg.dateTo
            # -------------------------------------------------------

            print(f"\n[DEBUG] 🔎 Hledám data pro senzor ID {seg.id_sensor} v rozšířeném okně od '{sql_d_from}' do '{sql_d_to}'")
            
            data_query = text("""
                SELECT raw_data_path, timestamp FROM measurements 
                WHERE id_sensor = :sensor_id 
                  AND timestamp >= CAST(:d_from AS timestamp) 
                  AND timestamp <= CAST(:d_to AS timestamp)
                ORDER BY timestamp ASC
            """)
            
            # Použijeme naše nové rozšířené proměnné sql_d_from a sql_d_to
            rows = conn.execute(data_query, {
                "sensor_id": seg.id_sensor, 
                "d_from": sql_d_from, 
                "d_to": sql_d_to
            }).fetchall()
            
            print(f"[DEBUG] 📊 Nalezeno řádků v tabulce measurements: {len(rows)}")
            
            valid_paths = 0
            for row in rows:
                raw_path = row[0]
                timestamp_val = row[1]
                
                if raw_path: 
                    valid_paths += 1
                    file_paths.append(raw_path)
                    
                    if "CNN" in model_name:
                        measurements_data_cnn.append({"path": raw_path, "label": int(seg.label) if seg.label else 0})
                        
                    if "LSTM" in model_name:
                        measurements_data_rul.append({"path": raw_path, "date": str(timestamp_val)})
            
            print(f"[DEBUG] 📁 Z toho má fyzickou cestu k CSV (raw_data_path): {valid_paths}")
        
        conn.commit()

        if not file_paths:
            raise HTTPException(status_code=400, detail="V zadaných úsecích nebyla nalezena žádná surová data (CSV).")

        webhook_url = f"{BACKEND_URL}/webhook/training-done/{new_model_id}"
        
        try:
            if "GAN" in model_name:
                res = requests.post(f"{ML_SERVICE_URL}/trigger-finetuning", json={
                    "file_paths": file_paths, 
                    "webhook_url": webhook_url, 
                    "save_path": save_path
                })
            elif "CNN" in model_name:
                res = requests.post(f"{ML_SERVICE_URL}/trigger-finetuning-1dcnn", json={
                    "measurements": measurements_data_cnn, 
                    "webhook_url": webhook_url, 
                    "save_path": save_path
                })
            elif "LSTM" in model_name:
                if not payload.lifecycle_info:
                    raise HTTPException(status_code=400, detail="Pro RUL model chybí parametry životního cyklu.")
                    
                category = "O"
                if "OR" in model_name.upper(): category = "OR"
                elif "IR" in model_name.upper(): category = "IR"
                
                res = requests.post(f"{ML_SERVICE_URL}/trigger-finetuning-rul", json={
                    "category": category, 
                    "measurements": measurements_data_rul, 
                    "lifecycle_info": payload.lifecycle_info, 
                    "webhook_url": webhook_url, 
                    "save_path": save_path
                })
            res.raise_for_status() 
        except requests.exceptions.RequestException as e:
            with engine.connect() as fail_conn:
                fail_conn.execute(text("UPDATE ml_models SET training_status = 'failed' WHERE id_model = :mid"), {"mid": new_model_id})
                fail_conn.commit()
            raise HTTPException(status_code=503, detail=f"Nepodařilo se spojit s ML Servisou: {e}")

    return {"status": "accepted", "message": f"Trénink modelu verze v{new_version} byl spuštěn.", "new_model_id": new_model_id}

@app.post("/webhook/training-done/{model_id}")
def training_webhook(model_id: int, payload: WebhookPayload):
    """
    Interní asynchronní webhook volaný ML mikroslužbou po dokončení/selhání tréninku modelu.
    """
    with engine.connect() as conn:
        status_str = 'ready' if payload.status == "success" else 'failed'
        update_query = text("UPDATE ml_models SET training_status = :status WHERE id_model = :mid")
        conn.execute(update_query, {"status": status_str, "mid": model_id})
        conn.commit()
    return {"status": "acknowledged"}

@app.post("/models/sync-active")
def sync_active_models():
    """
    Interní synchronizační endpoint volaný ML službou při startu ke zjištění aktivních vah.
    """
    active_paths = {}
    with engine.connect() as conn:
        conn.execute(text("UPDATE ml_models SET is_active = False"))
        query = text("""
            SELECT DISTINCT ON (name) id_model, name, path_to_model 
            FROM ml_models WHERE training_status = 'ready' ORDER BY name, id_model DESC
        """)
        latest_models = conn.execute(query).fetchall()
        for row in latest_models:
            m_id, m_name, m_path = row
            conn.execute(text("UPDATE ml_models SET is_active = True WHERE id_model = :mid"), {"mid": m_id})
            m_dir = os.path.dirname(m_path) if m_path and m_path.endswith('.pth') else m_path

            if "GAN" in m_name: active_paths["AE_ANOWGAN"] = m_dir
            elif "CNN" in m_name: active_paths["1D_CNN"] = m_path 
            elif "LSTM" in m_name: active_paths["Bi-LSTM"] = m_dir
        conn.commit()
    return active_paths

@app.put("/models/{model_id}/activate")
def activate_model_version(model_id: int, token: str = Depends(oauth2_scheme)):
    """
    Aktivuje vybranou verzi modelu v DB, hromadně deaktivuje předchozí verze
    se stejným logickým názvem a nařídí běžící ML mikroslužbě okamžitý reload vah do RAM.
    """
    with engine.connect() as conn:
        res = conn.execute(text("SELECT name FROM ml_models WHERE id_model = :mid"), {"mid": model_id}).fetchone()
        if not res: raise HTTPException(status_code=404, detail="Model nenalezen.")
        model_name = res[0]

        conn.execute(text("UPDATE ml_models SET is_active = False WHERE name = :name"), {"name": model_name})
        conn.execute(text("UPDATE ml_models SET is_active = True WHERE id_model = :mid"), {"mid": model_id})
        conn.commit()

    try:
        reload_res = requests.post(f"{ML_SERVICE_URL}/reload", timeout=10)
        reload_res.raise_for_status()
    except Exception as e:
        return {
            "status": "partial_success", 
            "message": "Model aktivován v DB, ale ML servisa neodpovídá. Změna se projeví po jejím restartu."
        }
    return {"status": "success", "message": "Model byl úspěšně nasazen do produkce."}


def ftp_fetch_file_with_fallback(host: str, user: str, pwd: str, remote_path: str, local_filepath: str):
    """
    Stáhne soubor přes FTP s fallbackem režimů (FTPES + plain FTP).
    Mazání vzdáleného souboru je best-effort a nesmí shodit import.
    """
    safe_user = (user or "").strip() or "anonymous"
    safe_pwd = pwd or ("anonymous@" if safe_user == "anonymous" else "")

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    ctx.set_ciphers('ALL:@SECLEVEL=0')

    errors = []

    def try_ftpes_with_prot():
        ftp = FTP_TLS(context=ctx, timeout=30.0)
        ftp.connect(host, 21, timeout=30.0)
        ftp.auth()
        ftp.login(safe_user, safe_pwd)
        ftp.prot_p()
        ftp.set_pasv(True)
        with open(local_filepath, 'wb') as f:
            ftp.retrbinary(f"RETR {remote_path}", f.write)
        try:
            ftp.delete(remote_path)
        except Exception:
            pass
        ftp.quit()

    def try_ftpes_no_prot():
        ftp = FTP_TLS(context=ctx, timeout=30.0)
        ftp.connect(host, 21, timeout=30.0)
        ftp.auth()
        ftp.login(safe_user, safe_pwd)
        ftp.set_pasv(True)
        with open(local_filepath, 'wb') as f:
            ftp.retrbinary(f"RETR {remote_path}", f.write)
        try:
            ftp.delete(remote_path)
        except Exception:
            pass
        ftp.quit()

    def try_plain_ftp():
        ftp = FTP(timeout=30.0)
        ftp.connect(host, 21, timeout=30.0)
        ftp.login(safe_user, safe_pwd)
        ftp.set_pasv(True)
        with open(local_filepath, 'wb') as f:
            ftp.retrbinary(f"RETR {remote_path}", f.write)
        try:
            ftp.delete(remote_path)
        except Exception:
            pass
        ftp.quit()

    for mode_name, mode_fn in [
        ("FTPES(AUTH+PROT)", try_ftpes_with_prot),
        ("FTPES(AUTH)", try_ftpes_no_prot),
        ("FTP", try_plain_ftp),
    ]:
        try:
            mode_fn()
            return {"mode": mode_name}
        except Exception as e:
            errors.append(f"{mode_name}: {str(e)}")

    raise Exception(" | ".join(errors))


def get_trace_buffer_mapping() -> dict:
    """
    Parse TRACE_BUFFER_CHANNEL_MAP from env into {channel: buffer_number}.
    Fallback: {1:66, 2:67, 3:70, 4:71}
    """
    fallback = {1: 66, 2: 67, 3: 70, 4: 71}
    mapping_raw = (TRACE_BUFFER_CHANNEL_MAP or "").strip()
    if not mapping_raw:
        return fallback

    parsed = {}
    try:
        for pair in mapping_raw.split(","):
            item = pair.strip()
            if not item:
                continue
            ch, buf = item.split(":")
            parsed[int(ch.strip())] = int(buf.strip())
    except Exception:
        return fallback

    return parsed or fallback


async def resolve_trace_nodes(client: Client):
    """
    Najde správný namespace index pro gTrace uzly v OPC UA serveru.
    Některé PLC projekty nepoužívají ns=6, proto zkoušíme více indexů.
    """
    node_path_candidates = {
        "workid": [
            "::AsGlobalPV:gTrace.BufferUpload.WorkID",
            "::AsGlobalPV:gTrace.WorkID",
        ],
        "buflen": [
            "::AsGlobalPV:gTrace.BufferUpload.BufferLength",
            "::AsGlobalPV:gTrace.BufferLength",
        ],
        "bufnum": [
            "::AsGlobalPV:gTrace.BufferNumber",
            "::AsGlobalPV:gTrace.BufferUpload.BufferNumber",
        ],
        "start": [
            "::AsGlobalPV:gTrace.BufferUpload.Start",
            "::AsGlobalPV:gTrace.Start",
        ],
        "done": [
            "::AsGlobalPV:gTrace.BufferStatus.Done",
            "::AsGlobalPV:gTrace.Done",
        ],
        "csv": [
            "::AsGlobalPV:gTrace.BufferStatus.CSVFileName",
            "::AsGlobalPV:gTrace.CSVFileName",
        ],
        "reset": [
            "::AsGlobalPV:gTrace.BufferUpload.Reset",
            "::AsGlobalPV:gTrace.Reset",
        ],
    }

    # Priorita namespace: detekce přes NamespaceArray (B&R PV), pak fallback kandidáti.
    namespace_candidates = []
    try:
        ns_array = await client.get_namespace_array()
        for idx, uri in enumerate(ns_array):
            u = (uri or "").lower()
            if "b&r/pv" in u or "b&r\\pv" in u or "b&r" in u and "pv" in u:
                namespace_candidates.append(idx)
    except Exception:
        pass

    for ns in [6, 5, 4, 3, 2, 7, 8, 1]:
        if ns not in namespace_candidates:
            namespace_candidates.append(ns)

    last_error = None

    for ns in namespace_candidates:
        try:
            resolved = {}
            for key, path_options in node_path_candidates.items():
                node_found = None
                node_error = None
                for path in path_options:
                    try:
                        candidate = client.get_node(f"ns={ns};s={path}")
                        await candidate.read_node_class()
                        node_found = candidate
                        break
                    except Exception as e:
                        node_error = e

                if node_found is None:
                    raise Exception(f"Nenalezen uzel '{key}' v ns={ns}. Poslední chyba: {node_error}")

                resolved[key] = node_found

            return resolved
        except Exception as e:
            last_error = e

    raise Exception(
        f"Nepodařilo se najít gTrace uzly v žádném namespace kandidátu: {namespace_candidates}. "
        f"Poslední chyba: {last_error}"
    )


async def collect_raw_data_for_machine_once(machine_id: int):
    """
    Provede jednorázový ruční sběr z PLC pro zvolený stroj.
    Vrací přehled vytvořených měření a případných chyb po kanálech.
    """
    with engine.connect() as conn:
        machine = conn.execute(text("""
            SELECT id_machine, opc_ua_url, ftp_host, ftp_user, ftp_password, ftp_dir
            FROM machines
            WHERE id_machine = :mid
        """), {"mid": machine_id}).fetchone()

    if not machine:
        raise HTTPException(status_code=404, detail="Stroj nebyl nalezen.")

    mach_id, plc_opc_url, plc_ftp_host, plc_ftp_user, plc_ftp_pass, plc_remote_dir = machine
    plc_remote_dir = plc_remote_dir or "C:/BufferData"

    if not plc_opc_url or not plc_ftp_host:
        raise HTTPException(status_code=400, detail="Stroj nemá nastavené OPC UA/FTP připojení.")

    work_id_prefix = f"manual_mach{mach_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    buffer_mapping = get_trace_buffer_mapping()
    created_measurements = []
    errors = []

    try:
        async with Client(url=plc_opc_url) as client:
            trace_nodes = await resolve_trace_nodes(client)
            node_workid = trace_nodes["workid"]
            node_buflen = trace_nodes["buflen"]
            node_bufnum = trace_nodes["bufnum"]
            node_start = trace_nodes["start"]
            node_done = trace_nodes["done"]
            node_csv = trace_nodes["csv"]
            node_reset = trace_nodes["reset"]

            await node_buflen.write_value(ua.DataValue(ua.Variant(TRACE_BUFFER_LENGTH, ua.VariantType.UInt32)))

            for channel, buffer_number in buffer_mapping.items():
                current_work_id = f"{work_id_prefix}_CH{channel}"
                try:
                    await node_workid.write_value(ua.DataValue(ua.Variant(current_work_id, ua.VariantType.String)))
                    await node_bufnum.write_value(ua.DataValue(ua.Variant(buffer_number, ua.VariantType.Byte)))
                    await node_start.write_value(ua.DataValue(ua.Variant(True, ua.VariantType.Boolean)))

                    timeout = 0
                    while True:
                        if await node_done.read_value():
                            break
                        await asyncio.sleep(1)
                        timeout += 1
                        if timeout > 45:
                            raise TimeoutError(f"Timeout na PLC u kanálu {channel}")

                    csv_filename = await node_csv.read_value()

                    await node_start.write_value(ua.DataValue(ua.Variant(False, ua.VariantType.Boolean)))
                    await node_reset.write_value(ua.DataValue(ua.Variant(True, ua.VariantType.Boolean)))
                    await asyncio.sleep(0.5)
                    await node_reset.write_value(ua.DataValue(ua.Variant(False, ua.VariantType.Boolean)))

                    local_filepath = f"./data/mach{mach_id}/{csv_filename}"
                    os.makedirs(os.path.dirname(local_filepath), exist_ok=True)

                    remote_path = f"{plc_remote_dir.rstrip('/')}/{csv_filename}"
                    await asyncio.to_thread(
                        ftp_fetch_file_with_fallback,
                        plc_ftp_host,
                        plc_ftp_user,
                        plc_ftp_pass,
                        remote_path,
                        local_filepath,
                    )

                    with engine.connect() as conn:
                        query_sensor = text(f"""
                            SELECT id_sensor
                            FROM sensors
                            WHERE id_machine = {mach_id}
                            ORDER BY id_sensor ASC
                            OFFSET {channel - 1}
                            LIMIT 1
                        """)
                        sensor_id = conn.execute(query_sensor).scalar()

                        if sensor_id:
                            inserted_id = conn.execute(text("""
                                INSERT INTO measurements (id_sensor, timestamp, raw_data_path, notes)
                                VALUES (:sid, :ts, :path, :notes)
                                RETURNING id_measurement
                            """), {
                                "sid": sensor_id,
                                "ts": datetime.now(timezone.utc),
                                "path": local_filepath,
                                "notes": f"Manual collect: {work_id_prefix} | Kanál {channel}"
                            }).scalar()
                            conn.commit()

                            created_measurements.append({
                                "channel": channel,
                                "measurement_id": inserted_id,
                                "sensor_id": sensor_id,
                                "file": local_filepath
                            })
                        else:
                            errors.append(f"Kanál {channel}: nenalezen odpovídající senzor")

                except Exception as channel_error:
                    errors.append(f"Kanál {channel}: {str(channel_error)}")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Kritická chyba ručního sběru: {str(e)}")

    return {
        "machine_id": mach_id,
        "created_count": len(created_measurements),
        "measurements": created_measurements,
        "errors": errors
    }


@app.post("/machines/{machine_id}/collect-now")
async def collect_now(machine_id: int, run_ai: bool = False, role: str = Depends(get_current_user_role)):
    """
    Ručně spustí sběr dat z PLC pro jeden stroj.
    Volitelně po sběru spustí kompletní AI pipeline (anomaly, classification, RUL).
    """
    if role not in ["admin", "operator"]:
        raise HTTPException(status_code=403, detail="Nemáte oprávnění spustit ruční sběr dat.")

    collection = await collect_raw_data_for_machine_once(machine_id)

    response = {
        "status": "success",
        "collection": collection
    }

    if run_ai and collection["created_count"] > 0:
        ai = {}

        try:
            ai["anomaly"] = analyze_machine_anomaly(machine_id, "manual")
        except HTTPException as e:
            ai["anomaly_error"] = e.detail
        except Exception as e:
            ai["anomaly_error"] = str(e)

        try:
            ai["classification"] = classify_machine_fault(machine_id, "manual")
        except HTTPException as e:
            ai["classification_error"] = e.detail
        except Exception as e:
            ai["classification_error"] = str(e)

        try:
            ai["rul"] = predict_machine_rul(machine_id, "manual")
        except HTTPException as e:
            ai["rul_error"] = e.detail
        except Exception as e:
            ai["rul_error"] = str(e)

        response["ai"] = ai

    return response


# ==========================================
# --- SEKCE AUTOMATICKÝ PLÁNOVANÝ SBĚR ----
# ==========================================

async def download_and_process_raw_data():
    """
    Hlavní asynchronní Master-Slave smyčka řízení. Vyvolává stavový automat na PLC 
    pomocí OPC UA, čeká na dokončení generování CSV vyrovnávací paměti a následně 
    přes šifrované FTP (FTP Pull) stahuje signálová data do lokálního úložiště.
    """
    print(f"[{datetime.now()}] Spouštím asynchronní rutinu pro sběr dat z PLC...")
    try:
        with engine.connect() as conn:
            query = text("SELECT id_machine, opc_ua_url, ftp_host, ftp_user, ftp_password, ftp_dir FROM machines WHERE is_active_collection = TRUE")
            active_machines = conn.execute(query).fetchall()
            if not active_machines:
                print("Žádný stroj nemá povolený automatický sběr dat.")
                return
    except Exception as e:
        print(f"Chyba databáze při načítání strojů: {e}")
        return

    for machine in active_machines:
        mach_id, plc_opc_url, plc_ftp_host, plc_ftp_user, plc_ftp_pass, plc_remote_dir = machine
        plc_remote_dir = plc_remote_dir or "C:/BufferData"
        
        try:
            with engine.connect() as conn:
                query_rms = text(f"SELECT AVG(rms_raw) FROM feature_data WHERE id_machine = {mach_id} AND time >= NOW() - INTERVAL '1 hour'")
                avg_rms = conn.execute(query_rms).scalar()
                if avg_rms is None or avg_rms < 0.1:
                    print(f"Stroj {mach_id} pravděpodobně stojí (RMS < 0.1). Přeskakuji sběr.")
                    continue
        except Exception as e:
            print(f"Chyba při ověřování běhu stroje: {e}")
            continue
            
        work_id_prefix = f"mach{mach_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        buffer_mapping = get_trace_buffer_mapping()

        try:
            async with Client(url=plc_opc_url) as client:
                trace_nodes = await resolve_trace_nodes(client)
                node_workid = trace_nodes["workid"]
                node_buflen = trace_nodes["buflen"]
                node_bufnum = trace_nodes["bufnum"]
                node_start = trace_nodes["start"]
                node_done = trace_nodes["done"]
                node_csv = trace_nodes["csv"]
                node_reset = trace_nodes["reset"]

                await node_buflen.write_value(ua.DataValue(ua.Variant(TRACE_BUFFER_LENGTH, ua.VariantType.UInt32)))

                for channel, buffer_number in buffer_mapping.items():
                    current_work_id = f"{work_id_prefix}_CH{channel}"
                    await node_workid.write_value(ua.DataValue(ua.Variant(current_work_id, ua.VariantType.String)))
                    await node_bufnum.write_value(ua.DataValue(ua.Variant(buffer_number, ua.VariantType.Byte)))
                    await node_start.write_value(ua.DataValue(ua.Variant(True, ua.VariantType.Boolean)))
                    
                    timeout = 0
                    while True:
                        if await node_done.read_value():
                            break
                        await asyncio.sleep(1)
                        timeout += 1
                        if timeout > 45:
                            print(f"[{mach_id}] Timeout na PLC u kanálu {channel}!")
                            break
                    
                    csv_filename = await node_csv.read_value()
                    await node_start.write_value(ua.DataValue(ua.Variant(False, ua.VariantType.Boolean)))
                    await node_reset.write_value(ua.DataValue(ua.Variant(True, ua.VariantType.Boolean)))
                    await asyncio.sleep(0.5) 
                    await node_reset.write_value(ua.DataValue(ua.Variant(False, ua.VariantType.Boolean)))
                    
                    local_filepath = f"./data/mach{mach_id}/{csv_filename}"
                    os.makedirs(os.path.dirname(local_filepath), exist_ok=True)
                    
                    remote_path = f"{plc_remote_dir.rstrip('/')}/{csv_filename}"
                        
                    try:
                        await asyncio.to_thread(
                            ftp_fetch_file_with_fallback,
                            plc_ftp_host,
                            plc_ftp_user,
                            plc_ftp_pass,
                            remote_path,
                            local_filepath,
                        )
                        with engine.connect() as conn:
                            query_sensor = text(f"SELECT id_sensor FROM sensors WHERE id_machine = {mach_id} ORDER BY id_sensor ASC OFFSET {channel - 1} LIMIT 1")
                            sensor_id = conn.execute(query_sensor).scalar()
                            
                            if sensor_id:
                                conn.execute(text("""
                                    INSERT INTO measurements (id_sensor, timestamp, raw_data_path, notes)
                                    VALUES (:sid, :ts, :path, :notes)
                                """), {
                                    "sid": sensor_id, "ts": datetime.now(timezone.utc),
                                    "path": local_filepath, "notes": f"Batch: {work_id_prefix} | Kanál {channel}"
                                })
                                conn.commit()
                    except Exception as e:
                        print(f"[{mach_id}] Chyba FTP přenosu nebo DB u kanálu {channel}: {e}")
        except Exception as e:
            print(f"[{mach_id}] Kritická chyba OPC UA: {e}")
    print(f"[{datetime.now()}] Asynchronní sběr dat dokončen.")

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)