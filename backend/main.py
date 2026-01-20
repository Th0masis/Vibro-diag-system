from datetime import datetime, timezone
import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from auth import verify_password, create_access_token, get_password_hash
from sqlalchemy import create_engine, text
from jose import JWTError, jwt
import uvicorn

# Script FastAPI
load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")

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
if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)