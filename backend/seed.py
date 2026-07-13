import random, math, os
from datetime import datetime, timezone, timedelta
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

# Konfigurace DB (stejná jako v main.py)
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://admin:secret@localhost:5432/vibro_diag")

def simulate_machine_data(machine_id: int):
    """
    Vygeneruje jedno měření pro všechny aktivní senzory daného stroje.
    Tuto funkci budeme volat z API.
    """
    engine = create_engine(DATABASE_URL)
    print(f"Generuji data pro stroj ID {machine_id}...")
    
    with engine.connect() as conn:
        # 1. Zjistíme aktivní senzory na stroji
        sensors_query = text("SELECT id_sensor FROM sensors WHERE id_machine = :mid AND status = 'active'")
        sensors = conn.execute(sensors_query, {"mid": machine_id}).fetchall()
        
        if not sensors:
            return {"status": "error", "message": "Stroj nemá žádné aktivní senzory."}

        timestamp = datetime.now(timezone.utc)
        created_count = 0

        # Simulace stavu stroje (25% šance na poruchu pro pestrost dat)
        is_faulty = random.choice([True, False, False, False]) 

        for sensor in sensors:
            sensor_id = sensor[0]

            # 2. Generování hodnot (Fyzikální model)
            if is_faulty:
                base_rms = random.uniform(4.5, 9.0)  # Porucha
                peak_raw = base_rms * 1.414 + random.uniform(1.0, 5.0)
                iso_val = base_rms * 0.9
                severity = "CRITICAL"
            else:
                base_rms = random.uniform(0.5, 2.8)  # OK stav
                peak_raw = base_rms * 1.414 + random.uniform(0.1, 0.5)
                iso_val = base_rms * 0.8
                severity = "OK"

            # 3. Vložení do tabulky MEASUREMENTS (Hlavička měření)
            # Simulujeme cestu k souboru
            raw_path = f"/data/raw/{machine_id}_{sensor_id}_{int(timestamp.timestamp())}.wav"
            
            insert_meas = text("""
                INSERT INTO measurements (id_sensor, timestamp, raw_data_path)
                VALUES (:sid, :ts, :path) RETURNING id_measurement
            """)
            res = conn.execute(insert_meas, {
                "sid": sensor_id,
                "ts": timestamp,
                "path": raw_path
            })
            measurement_id = res.scalar()

            # 4. Vložení do tabulky FEATURE_DATA (Vypočítané parametry)
            insert_feat = text("""
                INSERT INTO feature_data (
                    id_measurement, id_machine, time,
                    rms_raw, peak_raw, kurtosis_raw, rms_acl_env,
                    dif_kt_raw, skewness_raw, act_speed
                ) VALUES (
                    :mid, :mach_id, :ts,
                    :rms, :peak, :kurt, :rms_env,
                    :dif, :skew, :speed
                )
            """)
            
            conn.execute(insert_feat, {
                "mid": measurement_id,
                "mach_id": machine_id,
                "ts": timestamp,
                "rms": round(base_rms, 3),
                "peak": round(peak_raw, 3),
                "kurt": round(random.uniform(2.5, 5.0) if is_faulty else random.uniform(2.8, 3.2), 2),
                "rms_env": round(base_rms * 0.8, 3),
                "dif": round(base_rms * 0.15, 3),
                "skew": round(random.uniform(0.1, 0.8), 3),
                "speed": round(1480 + random.uniform(-20, 20), 2)
            })
            
            created_count += 1
            print(f" -> Senzor {sensor_id}: RMS={base_rms:.2f} ({severity})")

        conn.commit()
        return {"status": "success", "message": f"Vygenerováno {created_count} záznamů.", "fault": is_faulty}

def generate_rul_curve(length, fault_start_ratio=0.6):
    """
    Vygeneruje seznam RMS hodnot s exponenciálním růstem na konci.
    """
    data = []
    base_level = random.uniform(0.45, 0.55)
    
    for t in range(length):
        noise = random.uniform(-0.02, 0.02)
        degradation = 0
        
        # Od určitého bodu začne hodnota růst
        if t > length * fault_start_ratio:
            rel_t = t - (length * fault_start_ratio)
            # Parametry nastaveny tak, aby to ke konci stoupalo k hodnotám 5-8 mm/s
            degradation = 0.05 * math.exp(0.12 * rel_t)
            
        value = base_level + degradation + noise
        data.append(max(0, value)) # RMS nemůže být záporné
    return data

def seed_history_data(machine_id=1, days=30):
    """
    Vloží 30denní historii pro daný stroj.
    Jeden senzor bude 'nemocný', ostatní 'zdravé'.
    """
    engine = create_engine(DATABASE_URL)
    
    print(f"--- Začínám generování historie pro Stroj {machine_id} ---")

    with engine.connect() as conn:
        with conn.begin(): # Transakce
            
            # 1. Získání senzorů připojených ke stroji
            sensors_query = text("SELECT id_sensor FROM sensors WHERE id_machine = :mid ORDER BY id_sensor ASC")
            sensors = conn.execute(sensors_query, {"mid": machine_id}).fetchall()
            
            if not sensors:
                print("Chyba: Stroj nemá žádné senzory. Spusť nejprve základní seed pro vytvoření struktury.")
                return

            print(f"Nalezeno {len(sensors)} senzorů.")
            
            # Nastavení parametrů simulace
            measurements_per_day = 6 # Jedno měření každé 4 hodiny
            total_points = days * measurements_per_day
            now = datetime.now(timezone.utc)

            # 2. Procházení senzorů a generování dat
            for index, s_row in enumerate(sensors):
                sensor_id = s_row[0]
                is_faulty = (index == 0) # První senzor bude ten vadný
                
                print(f"  -> Generuji data pro Senzor ID {sensor_id} (Stav: {'PORUCHA' if is_faulty else 'ZDRAVÝ'})...")
                
                # Vyčištění starých dat pro čistý start (volitelné)
                conn.execute(text("DELETE FROM measurements WHERE id_sensor = :sid"), {"sid": sensor_id})

                # Příprava dat
                if is_faulty:
                    rms_values = generate_rul_curve(total_points, fault_start_ratio=0.5)
                else:
                    # Zdravý senzor: jen šum kolem 0.5
                    rms_values = [random.uniform(0.4, 0.6) for _ in range(total_points)]

                # Vkládání do DB
                for i, rms in enumerate(rms_values):
                    # Čas jde od minulosti (i=0) k přítomnosti
                    hours_back = (total_points - 1 - i) * (24 / measurements_per_day)
                    timestamp = now - timedelta(hours=hours_back)
                    
                    # A) Vložení do MEASUREMENTS
                    # raw_data_path dáváme NULL nebo fiktivní, protože nemáme soubory
                    ins_meas = text("""
                        INSERT INTO measurements (timestamp, id_sensor, raw_data_path) 
                        VALUES (:t, :sid, 'simulated_history') 
                        RETURNING id_measurement
                    """)
                    res = conn.execute(ins_meas, {"t": timestamp, "sid": sensor_id})
                    meas_id = res.scalar()
                    
                    # B) Vložení do FEATURE_DATA (nebo FeatureSets)
                    # Dopočítáme ostatní features
                    peak = rms * 1.41
                    
                    # Kurtosis: U vadného senzoru ke konci roste
                    kurtosis = 3.0
                    if is_faulty and i > total_points * 0.7:
                        kurtosis += (i - total_points * 0.7) * 0.1
                    else:
                        kurtosis = random.uniform(2.8, 3.2) # Zdravý kurtosis

                    ins_feat = text("""
                        INSERT INTO feature_data (
                            id_measurement, id_machine, rms_raw, peak_raw, kurtosis_raw, rms_acl_env,
                            dif_kt_raw, skewness_raw, act_speed
                        )
                        VALUES (:mid, :mach, :rms, :peak, :kurt, :env, :dif, :skew, :speed)
                    """)
                    
                    conn.execute(ins_feat, {
                        "mid": meas_id, 
                        "mach": machine_id,
                        "rms": rms, 
                        "peak": peak, 
                        "kurt": kurtosis, 
                        "env": rms * 0.7,
                        "dif": rms * 0.15,
                        "skew": random.uniform(0.1, 0.8),
                        "speed": 1480.0
                    })

    print("Hotovo. Historie byla úspěšně nahrána.")

if __name__ == "__main__":
    # Spustíme seed pro Stroj 1
    try:
        seed_history_data(machine_id=1)
    except Exception as e:
        print(f"Nastala chyba: {e}")