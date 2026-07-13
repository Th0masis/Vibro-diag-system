import pandas as pd
import os

# --- KONFIGURACE ---
# Cesta k původnímu souboru (upravil jsem string na 'raw string' r"", aby zpětná lomítka nedělala bordel)
INPUT_FILE = r"C:\Code\Vibro-diag-system\ml_service\data\XJTU-SY\XJTU-SY_Bearing_Datasets\35Hz12kN\Bearing1_1\1.csv"

def split_csv_file():
    print(f"Načítám soubor: {INPUT_FILE}")
    
    if not os.path.exists(INPUT_FILE):
        print("Chyba: Soubor neexistuje. Zkontroluj cestu.")
        return

    try:
        # Načtení CSV
        df = pd.read_csv(INPUT_FILE)
        
        # Kontrola, zda máme očekávané sloupce (podle dokumentace XJTU-SY)
        # Názvy sloupců v CSV bývají: 'Horizontal_vibration_signals' a 'Vertical_vibration_signals'
        print(f"Nalezené sloupce: {list(df.columns)}")
        
        # Získání adresáře, kam uložíme výsledky (stejná složka jako vstup)
        output_dir = os.path.dirname(INPUT_FILE)
        
        # --- 1. HORIZONTÁLNÍ VIBRACE ---
        # Vybereme první sloupec (index 0)
        col_h = df.columns[0] 
        df_h = df[[col_h]] # Dvojité závorky vytvoří DataFrame, ne Series
        
        output_h = os.path.join(output_dir, "1_h.csv")
        df_h.to_csv(output_h, index=False)
        print(f"Vytvořen soubor: 1_h.csv ({len(df_h)} řádků)")

        # --- 2. VERTIKÁLNÍ VIBRACE ---
        # Vybereme druhý sloupec (index 1)
        col_v = df.columns[1]
        df_v = df[[col_v]]
        
        output_v = os.path.join(output_dir, "1_v.csv")
        df_v.to_csv(output_v, index=False)
        print(f"Vytvořen soubor: 1_v.csv ({len(df_v)} řádků)")

    except Exception as e:
        print(f"Nastala chyba při zpracování: {e}")

if __name__ == "__main__":
    split_csv_file()