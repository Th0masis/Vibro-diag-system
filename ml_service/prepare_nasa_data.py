import os
import pandas as pd
import numpy as np

# Cesta k rozbaleným datům (uprav, pokud se jmenuje jinak)
DATA_DIR = "./data/2nd_test"
OUTPUT_FILE = "./data/nasa_rms_history.csv"

def calculate_rms(signal):
    return np.sqrt(np.mean(signal**2))

def process_nasa_data():
    print(f"Zpracovávám soubory v {DATA_DIR}...")
    
    # Seznam všech souborů seřazený podle času (názvu)
    files = sorted([f for f in os.listdir(DATA_DIR) if os.path.isfile(os.path.join(DATA_DIR, f))])
    
    results = []
    
    # Dataset 2nd_test má 4 sloupce (4 ložiska). Ložisko 1 selhalo.
    # Data jsou oddělena tabulátorem.
    
    total = len(files)
    for i, filename in enumerate(files):
        file_path = os.path.join(DATA_DIR, filename)
        
        try:
            # Načtení RAW dat (bez hlavičky, oddělovač tabulátor)
            df = pd.read_csv(file_path, sep='\t', header=None)
            
            # Vezmeme data z Ložiska 1 (sloupec 0)
            bearing_1_signal = df[0].values
            
            # Vypočítáme features
            rms = calculate_rms(bearing_1_signal)
            
            # Přidáme do seznamu
            results.append({
                "filename": filename,
                "rms": rms
            })
            
            if i % 100 == 0:
                print(f"Zpracováno {i}/{total} souborů...")
                
        except Exception as e:
            print(f"Chyba u souboru {filename}: {e}")

    # Uložení do CSV
    final_df = pd.DataFrame(results)
    final_df.to_csv(OUTPUT_FILE, index=False)
    print(f"✅ Hotovo! Data uložena do {OUTPUT_FILE}")
    print(final_df.head())

if __name__ == "__main__":
    if not os.path.exists(DATA_DIR):
        print(f"❌ Chyba: Složka {DATA_DIR} neexistuje. Stáhni NASA dataset.")
    else:
        process_nasa_data()