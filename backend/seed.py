import time
import random
from datetime import datetime, timezone
from sqlalchemy import create_engine, text

# Konfigurace DB (stejná jako v main.py)
DB_URL = "postgresql://admin:secret@localhost:5432/vibro_diag"
engine = create_engine(DB_URL)

def simulate_machine_data(machine_id: int):
    """
    Vygeneruje jedno měření pro všechny aktivní senzory daného stroje.
    Tuto funkci budeme volat z API.
    """
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
                    rms_raw, peak_raw, crest_factor, iso_10816,
                    kurtosis_raw, frq_bnd_1, frq_bnd_2
                ) VALUES (
                    :mid, :mach_id, :ts,
                    :rms, :peak, :crest, :iso,
                    :kurt, :fb1, :fb2
                )
            """)
            
            conn.execute(insert_feat, {
                "mid": measurement_id,
                "mach_id": machine_id,
                "ts": timestamp,
                "rms": round(base_rms, 3),
                "peak": round(peak_raw, 3),
                "crest": round(peak_raw / base_rms, 2),
                "iso": round(iso_val, 3),
                "kurt": round(random.uniform(2.5, 5.0) if is_faulty else random.uniform(2.8, 3.2), 2),
                "fb1": round(base_rms * 0.3, 3),
                "fb2": round(base_rms * 0.1, 3)
            })
            
            created_count += 1
            print(f" -> Senzor {sensor_id}: RMS={base_rms:.2f} ({severity})")

        conn.commit()
        return {"status": "success", "message": f"Vygenerováno {created_count} záznamů.", "fault": is_faulty}

# Původní funkce pro manuální spuštění skriptu (pokud chceš generovat dávkově přes konzoli)
if __name__ == "__main__":
    # Příklad: Vygeneruje data pro stroj s ID 1
    simulate_machine_data(1)