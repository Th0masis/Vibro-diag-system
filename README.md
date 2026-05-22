# Vibrodiagnostický systém pro prediktivní údržbu 🏭⚙️

[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![React](https://img.shields.io/badge/Frontend-React-61DAFB.svg)](https://reactjs.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg)](https://fastapi.tiangolo.com/)
[![PyTorch](https://img.shields.io/badge/ML-PyTorch-EE4C2C.svg)](https://pytorch.org/)

Tento repozitář obsahuje kompletní zdrojové kódy pro **end-to-end vibrodiagnostický systém** vyvinutý v rámci diplomové práce na **Vysokém učení technickém v Brně (VUT)**. 

Cílem projektu je sběr, zpracování a analýza vibračních dat z průmyslových strojů (rotačních uzlů a ložisek) pomocí hlubokého učení (Deep Learning) za účelem včasné detekce poruch, jejich klasifikace a odhadu zbytkové životnosti (RUL). Systém je primárně navržen pro integraci s průmyslovým hardwarem značky **B&R** a nasazení na aplikačních počítačích (APC) přímo v průmyslovém provozu (Edge computing).

---

## 🏗️ Architektura systému

Systém je navržen jako modulární mikroslužbová architektura plně kontejnerizovaná pomocí nástroje Docker. Skládá se z následujících hlavních částí:

1. **Frontend (`/frontend`)**
   - Interaktivní uživatelské rozhraní postavené na knihovně **React**.
   - Poskytuje operátorský dashboard (`MachineCard`) pro vizualizaci technického stavu strojů, správu senzorů a zobrazení trendů degradace a spektrální analýzy.
2. **Backend (`/backend`)**
   - Rychlé a asynchronní REST API napsané v Pythonu pomocí **FastAPI**.
   - Zajišťuje autentizaci uživatelů, komunikaci s databází a orchestraci sběru dat z PLC. Podporuje dva módy sběru: kontinuální streamování (IIoT Connector / MQTT) a asynchronní stahování RAW dat (FTP PULL).
3. **Machine Learning Service (`/ml_service`)**
   - Dedikovaná výpočetní služba pro inferenci a MLOps postavená na **PyTorch** a FastAPI.
   - Obsahuje moduly pro předzpracování signálu (např. FFT) a obsluhuje nasazené modely. Zahrnuje také logiku pro průběžné dotrénovávání (fine-tuning) na provozních datech.
4. **Databáze (TimescaleDB / PostgreSQL)**
   - Relační databáze s rozšířením pro efektivní ukládání a dotazování obrovského množství časových řad generovaných vibračními senzory.

---

## 🧠 Implementované ML modely

Diagnostická pipeline využívá kaskádu tří specializovaných architektur neuronových sítí:

* **AE-AnoWGAN:** Generativní model sloužící jako detektor anomálií ze surových časových řad. Odhaluje počáteční odchylky od nominálního stavu stroje.
* **1D-CNN:** Konvoluční neuronová síť pracující s FFT transformací signálu. Zajišťuje vysoce přesnou klasifikaci typu diagnostikované závady (Vnitřní kroužek, Vnější kroužek, Valivý element).
* **Bi-LSTM:** Rekurentní síť pro analýzu trendů a komplexní úlohu predikce zbytkové užitečné životnosti ložiska (RUL – Remaining Useful Life).

