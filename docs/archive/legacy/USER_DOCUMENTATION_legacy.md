# PulseGuard — User Documentation

**Vibration Diagnostic System for Predictive Maintenance**

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Automation Studio Project Configuration](#2-automation-studio-project-configuration)
3. [Application Pages and Tabs](#3-application-pages-and-tabs)
4. [How Data Collection Works](#4-how-data-collection-works)
5. [How ML Analytics Works](#5-how-ml-analytics-works)
6. [Detectable Fault Types](#6-detectable-fault-types)
7. [Supported Machine Types](#7-supported-machine-types)
8. [User Roles and Permissions](#8-user-roles-and-permissions)

---

## 1. System Overview

PulseGuard is an industrial predictive maintenance platform that continuously monitors mechanical vibration on rotating machinery, detects anomalies and bearing faults using AI models, and predicts remaining useful life (RUL) to schedule maintenance before failure occurs.

### Architecture

```
B&R PLC (CM4810) ──OPC UA──► Backend API ──► TimescaleDB
        │                         │
       FTP                    ML Service
    (CSV files)               (PyTorch AI)
                                  │
                             React Dashboard
```

| Service | Technology | Port |
|---------|-----------|------|
| Frontend dashboard | React 18 + Nginx | 80 |
| Backend REST API | FastAPI + Python | 8000 |
| ML inference service | FastAPI + PyTorch | 8001 |
| Database | PostgreSQL + TimescaleDB | 5432 |

---

## 2. Automation Studio Project Configuration

The B&R Automation Studio project (`Project/CoTrace_Vibro.apj`) contains the PLC-side logic that acquires raw vibration data from the CM4810 module and exports it to CSV files accessible via FTP.

### 2.1 Required Hardware

| Component | Description |
|-----------|-------------|
| **X20CM4810** | Condition Monitoring module — measures vibration, computes RMS, kurtosis, skewness, and manages trace buffers |
| **B&R PLC** (X20 series) | Host controller running Automation Runtime |
| FTP server | Built-in B&R FTP server to expose CSV files to the backend |
| OPC UA server | Built-in B&R OPC UA server for command/status interface |

### 2.2 OPC UA Interface — Command Structure

The backend controls the PLC through two OPC UA structures exposed as global variables (`gTrace`):

#### Command interface (Backend → PLC): `gTrace.BufferUpload`

| Variable | Type | Description |
|----------|------|-------------|
| `WorkID` | STRING[80] | Unique job identifier, e.g. `mach1_20260710_140000_CH1` |
| `ModulePath` | STRING[30] | X2X module path on the backplane, e.g. `IF3.ST1.IF1.ST2` |
| `BufferNumber` | USINT | Which CM4810 buffer to download (see table below) |
| `BufferLength` | UDINT | Number of samples to read (`4097`, `8193`, or `65535`) |
| `Start` | BOOL | Rising edge trigger — set `TRUE` to start a collection job |
| `Reset` | BOOL | Rising edge trigger — set `TRUE` after `Done` to return to idle |

#### Status interface (PLC → Backend): `gTrace.BufferStatus`

| Variable | Type | Description |
|----------|------|-------------|
| `CurrentWorkID` | STRING[80] | WorkID currently being processed |
| `Busy` | BOOL | `TRUE` while PLC is working |
| `Done` | BOOL | `TRUE` when CSV file is ready on FTP |
| `Error` | BOOL | `TRUE` if an error occurred |
| `ErrorID` | UINT | Error code from `vbioCM4810.status` or custom code `9000` (CSV export failure) |
| `Progress` | USINT | Job progress percentage (0–100 %) |
| `CSVFileName` | STRING[100] | Name of the generated CSV file |

### 2.3 CM4810 Buffer Channel Mapping

The CM4810 provides multiple buffer channels organized into three groups: **time-domain** (amplitude), **time-domain** (envelope), and **frequency-domain** (spectrum). The default channel-to-buffer mapping (configurable via environment variable `TRACE_BUFFER_CHANNEL_MAP`) uses frequency-domain buffers:

| Logical Channel | Buffer Number | Buffer Type | Signal Type | Values | Units |
|----------------|--------------|-------------|-------------|--------|-------|
| CH1 | 66 | **Spectrum** | Raw acceleration FFT | 4096 | [Hz] |
| CH2 | 67 | **Spectrum** | Raw acceleration FFT | 4096 | [Hz] |
| CH3 | 70 | **Spectrum** | Raw velocity FFT | 4096 | [Hz] |
| CH4 | 71 | **Spectrum** | Raw acceleration FFT | 4096 | [Hz] |

> **Current configuration:** Buffers **66, 67, 70, 71** are used in production. These are **frequency-domain (FFT spectrum)** buffers, which provide the frequency representation of the vibration signal. This choice allows the 1D-CNN fault classifier to work directly on frequency features without needing to compute FFT in the backend.

### 2.3a Complete CM4810 Buffer Reference

The CM4810 module provides 33 total buffers across three groups:

#### Time-Domain Buffers (Raw Amplitude)

Used for capturing raw time-series waveforms. Each contains 8192 samples.

| Buffer | Channel | Signal Source | Unit | Units |
|--------|---------|---------------|------|--------|
| 9 | 1 | Raw acceleration (amplitude time signal) | [mg] | [seconds] |
| 11 | 2 | Raw acceleration (amplitude time signal) | [mg] | [seconds] |
| 13 | 3 | Raw acceleration (amplitude time signal) | [mg] | [seconds] |
| 15 | 4 | Raw acceleration (amplitude time signal) | [mg] | [seconds] |

#### Envelope Buffers (Time-Domain Envelope)

Used for bearing-specific fault detection (band-pass filtered envelope). Each contains 8192 samples.

| Buffer | Channel | Signal Source | Unit | Units |
|--------|---------|---------------|------|--------|
| 25 | 1 | Envelope monitoring | [mg] | [seconds] |
| 27 | 2 | Envelope monitoring | [mg] | [seconds] |
| 29 | 3 | Envelope monitoring | [mg] | [seconds] |
| 31 | 4 | Envelope monitoring | [mg] | [seconds] |

#### Spectrum Buffers (Frequency-Domain, FFT)

**Currently in use**. Each contains 4096 frequency bins.

| Buffer | Channel | Signal Source | Unit | Units |
|--------|---------|---------------|------|--------|
| **66** | 1 | Raw velocity spectrum (FFT) | [mm/s] | [Hz] |
| **67** | 1 | Raw acceleration spectrum (FFT) | [mg] | [Hz] |
| **70** | 2 | Raw velocity spectrum (FFT) | [mm/s] | [Hz] |
| **71** | 2 | Raw acceleration spectrum (FFT) | [mg] | [Hz] |
| 74 | 3 | Raw velocity spectrum (FFT) | [mm/s] | [Hz] |
| 75 | 3 | Raw acceleration spectrum (FFT) | [mg] | [Hz] |
| 78 | 4 | Raw velocity spectrum (FFT) | [mm/s] | [Hz] |
| 79 | 4 | Raw acceleration spectrum (FFT) | [mg] | [Hz] |
| 82 | 1 | Envelope signal speed (FFT spectrum) | [mm/s] | [Hz] |
| 83 | 1 | Envelope monitoring (FFT spectrum) | [mg] | [Hz] |
| 86 | 2 | Envelope signal speed (FFT spectrum) | [mm/s] | [Hz] |
| 87 | 2 | Envelope monitoring (FFT spectrum) | [mg] | [Hz] |
| 90 | 3 | Envelope signal speed (FFT spectrum) | [mm/s] | [Hz] |
| 91 | 3 | Envelope monitoring (FFT spectrum) | [mg] | [Hz] |
| 94 | 4 | Envelope signal speed (FFT spectrum) | [mm/s] | [Hz] |
| 95 | 4 | Envelope monitoring (FFT spectrum) | [mg] | [Hz] |

**Why frequency-domain?** Buffers 66, 67, 70, 71 are used because:
- The 1D-CNN fault classifier is trained to recognize bearing faults in the **frequency domain** (FFT)
- Pre-computed FFT in the CM4810 module reduces backend computation
- 4096 frequency bins match the model's input layer design

> **Note:** The default buffer length is **4097 samples**. For spectrum buffers, this means 4096 frequency bins + 1 for the DC component. This matches the AE-AnoWGAN frame size (1024) and the 1D-CNN window size (4096). Adjust `TRACE_BUFFER_LENGTH` in `docker-compose.yml` if your CM4810 is configured differently.

### 2.4 AS Project Configuration Steps

1. **Import the project** `Project/CoTrace_Vibro.apj` into Automation Studio 4.x.
2. **Verify the module path** in `GetBuffer/Main.st`: set `fubCM4810.paramMain.pModulePath` to point to your CM4810 module's actual X2X bus path (default: `IF3.ST1.IF1.ST2`).
3. **Configure the FTP server** on the PLC to share the directory where CSV files are written (default: `C:/BufferData/`). Enable anonymous read access or set credentials matching the app settings.
4. **Enable the OPC UA server** and make sure the `gTrace` global variable node is accessible from the backend network address.
5. **Download and run** the project on the PLC.

### 2.5 Per-Machine Configuration in the App

Each machine registered in PulseGuard must have its connectivity configured on the **Settings** tab:

| Setting | Description | Example |
|---------|-------------|---------|
| **OPC UA URL** | OPC UA endpoint of the B&R PLC | `opc.tcp://192.168.1.10:4840` |
| **FTP Host** | IP address of the B&R FTP server | `192.168.1.10` |
| **FTP Username** | FTP login (or leave blank for anonymous) | `anonymous` |
| **FTP Password** | FTP password | *(leave blank if anonymous)* |
| **FTP Directory** | Path on PLC where CSV files are stored | `/C:/BufferData/` |
| **Automatic data collection** | Toggle to enable scheduled 4-hour collection | ON / OFF |

Use the **Test Connection** buttons to verify OPC UA and FTP connectivity before saving.

### 2.6 Sensor Channel Assignment

Each physical accelerometer channel on the CM4810 is registered as a **Sensor** in the app and assigned to a machine with a specific **position** label (e.g. `Drive-End X`, `Non-Drive-End Z`). The backend maps sensor positions to buffer channel numbers via `TRACE_BUFFER_CHANNEL_MAP`.

---

## 3. Application Pages and Tabs

### 3.1 Login

The entry point of the application. Users authenticate with username and password. JWT tokens are issued with a 30-minute lifetime and are automatically refreshed in the background.

---

### 3.2 Dashboard — Fleet Overview

**Navigation:** Home / Dashboard

Displays the health status of all registered machines at a glance.

**Summary bar** shows counts of:
- **OK** — machines operating normally (green)
- **WARNING** — machines with anomalies or suspected faults (amber)
- **FAULT** — machines with critical faults or very low RUL (red)
- **Total** — total registered machines

**Machine cards** show:
- Machine name, type, and location
- Current status badge (OK / WARNING / FAULT / STOPPED)
- Key vibration indicators (RMS, kurtosis, peak)
- Latest AI diagnosis result

Click any card to open the Machine Detail page.

---

### 3.3 Machines

**Navigation:** Machines

A tabular list of all registered machines with their type, location, and status.

**Actions available:**
- **+ Add machine** — opens a form to register a new machine (name, description, type, location, initial status)
- **Detail button** — opens the Machine Detail page for that machine

---

### 3.4 Machine Detail

**Navigation:** Machines → [machine name]

The central workspace for a single machine. The page shows:

- **Machine name** with live status badge
- **Machine type** and **location**
- **Technical info card** — Machine ID, installation date, sensor counts (active / available / maintenance / total), and description
- **Latest note card** — the most recent service note with author, timestamp, and severity color coding

Below these cards, six tabs provide detailed views:

#### Tab: Sensors
Lists all vibration sensors physically installed on this machine. Shows:
- Sensor serial number and description
- Channel position (e.g. Drive-End, Non-Drive-End)
- Status badge (Active / Available / Maintenance)
- Buttons to attach or detach sensors from the machine

#### Tab: Charts
Time-series charts of vibration feature data recorded for the machine:
- **RMS (raw)** — root mean square of raw acceleration
- **Peak** — maximum absolute amplitude
- **Kurtosis** — impulsiveness indicator (high values may indicate bearing defects)
- **Skewness** — signal asymmetry
- **RMS Envelope** — envelope-filtered RMS (bearing-frequency sensitive)

Charts support time range selection. Click any point to inspect the corresponding measurement.

#### Tab: AI Analysis
Manual controls for running the three ML diagnostic pipelines:

| Card | Model | What it does |
|------|-------|--------------|
| **Manual Collection + AI** | PLC FTP + full chain | Downloads fresh raw CSV files from the PLC via FTP, then automatically runs anomaly detection, fault classification, and RUL prediction in sequence |
| **Anomaly Detection** | AE-AnoWGAN · CWT | Computes an anomaly score (0–1) from the reconstruction error of the vibration signal's time-frequency representation. Score > 0.75 = anomaly |
| **Fault Classification** | 1D-CNN · FFT | Identifies the specific bearing fault type with a confidence percentage |
| **RUL Prediction** | Bi-LSTM | Estimates days remaining before expected failure |

Results are displayed inline and used to recalculate the machine's overall status.

#### Tab: History
A paginated table of all past measurements for this machine. Columns include:
- Timestamp
- Sensor
- RMS, Peak, Kurtosis values
- Path to the raw CSV file
- AI analysis results linked to that measurement

Click a row to open the full measurement detail including analysis results.

#### Tab: Notes
Service log for the machine. Technicians and operators can add notes with:
- Free-text content
- Severity level: **INFO**, **WARNING**, or **CRITICAL**

Notes are timestamped and attributed to the logged-in user. The latest note is always shown on the machine detail header card.

#### Tab: Settings
Per-machine connectivity configuration. See [Section 2.5](#25-per-machine-configuration-in-the-app) for field descriptions.

---

### 3.5 Sensors

**Navigation:** Sensors

Global inventory of all physical sensors registered in the system, regardless of which machine they are installed on.

**Columns:** Serial number, model/description, assigned machine, status.

**Actions:**
- **+ Register sensor** — adds a new sensor to the inventory (serial number, description, sampling rate, calibration date, position, initial status, optional machine assignment)
- **Detail button** — shows full sensor parameters and allows editing
- **Delete button** — removes the sensor from the inventory (with confirmation)

When a sensor is assigned to a machine it automatically becomes **Active**. When unassigned it returns to **Available**.

---

### 3.6 AI Models

**Navigation:** AI Models

Management console for the three predictive model groups.

**Left panel — Model catalog:**  
Lists all model versions with type, version number, and status badge (ACTIVE / OFF / TRAINING).

**Right panel — Model detail:**  
Shows the selected model's:
- Name, version, and type
- Accuracy metric (%)
- Training date and time
- Training status
- **Deploy to production** button — activates the selected version for live inference (replaces the current active model after confirmation)
- **Fine-tune** button — opens the training wizard to retrain the model on new labeled data

**Training wizard (Model Training Modal):**
1. Select machine and sensor
2. Select date/time range of measurements to use as training data
3. For fault classification: assign a fault label to each segment (Normal, Inner Race, Ball Fault, Outer Race)
4. For RUL: provide lifecycle dates (installation date, failure date)
5. Start training — model status changes to **TRAINING** while the ML service runs asynchronously
6. When training completes (status → **READY**), deploy the new version to production

---

### 3.7 User Management

**Navigation:** Users *(admin only)*

Manages system user accounts.

**Table columns:** Username, email, role, creation date, last login.

**Actions:**
- **+ Add user** — creates a new account (username, email, password, role)
- **Edit** — changes email, role, or password
- **Delete** — removes the account (admin only, with confirmation)

---

## 4. How Data Collection Works

### 4.1 Automatic Scheduled Collection

The backend scheduler runs **every 4 hours** (at 02:00, 06:00, 10:00, 14:00, 18:00, 22:00 UTC). For each machine that has **Automatic data collection = ON**, the following steps occur:

```
Scheduler trigger
      │
      ▼
Backend reads machine OPC UA + FTP settings from DB
      │
      ▼
Backend writes job command to PLC via OPC UA
  (WorkID, ModulePath, BufferNumber, BufferLength, Start=TRUE)
      │
      ▼
PLC (GetBuffer program) wakes up:
  1. Locks the CM4810 trace buffer
  2. Downloads buffer data (xAxis / yAxis arrays) from CM4810
  3. Exports data to CSV file on FTP server
  4. Sets BufferStatus.Done = TRUE
      │
      ▼
Backend polls OPC UA until Done=TRUE (or timeout)
      │
      ▼
Backend downloads CSV file from FTP
      │
      ▼
Backend parses CSV and computes vibration features:
  RMS, Peak, Kurtosis, Skewness, RMS Envelope, VDI3832 Kt
      │
      ▼
Backend stores measurement + features in TimescaleDB
      │
      ▼
Backend resets PLC job (Reset=TRUE)
      │
      ▼
(Optional) Backend triggers ML inference automatically
```

### 4.2 Manual On-Demand Collection

On the **AI Analysis** tab, clicking **Run AI pipeline** triggers an immediate on-demand collection and AI chain for that machine, outside the scheduled interval.

### 4.3 CSV File Format

The PLC saves files as:
```
<WorkID>.csv
```
Example: `mach1_20260710_140000_CH1.csv`

File structure:
```
index,xAxis,yAxis
0,0.000000,0.012345
1,0.000039,0.012012
...
```
- `xAxis` — time axis in seconds
- `yAxis` — acceleration in g

### 4.4 OPC UA Variable Paths

The backend reads and writes OPC UA nodes under the `gTrace` object:

| Direction | Node | Purpose |
|-----------|------|---------|
| Write | `gTrace.BufferUpload.WorkID` | Job identifier |
| Write | `gTrace.BufferUpload.ModulePath` | CM4810 bus path |
| Write | `gTrace.BufferUpload.BufferNumber` | Which buffer to read |
| Write | `gTrace.BufferUpload.BufferLength` | Sample count |
| Write | `gTrace.BufferUpload.Start` | Job trigger |
| Write | `gTrace.BufferUpload.Reset` | Job reset |
| Read | `gTrace.BufferStatus.Done` | Completion flag |
| Read | `gTrace.BufferStatus.Error` | Error flag |
| Read | `gTrace.BufferStatus.ErrorID` | Error code |
| Read | `gTrace.BufferStatus.Progress` | Progress 0–100 % |

---

## 5. How ML Analytics Works

The system uses three specialized neural networks, each targeting a different diagnostic question.

### 5.1 Anomaly Detection — AE-AnoWGAN

**Question answered:** *Is anything wrong with this machine?*

**Model:** Autoencoder (Encoder + Decoder) combined with a Wasserstein GAN Discriminator

**Input processing:**
1. First 1024 samples are taken from the raw CSV signal
2. DC offset is removed
3. Continuous Wavelet Transform (CWT) converts the 1D signal into a 2D time-frequency image (256 × 256 pixels) using the `cmor1.5-1.0` wavelet
4. Image is normalized to range [−1, +1]

**How it works:**  
The model was trained only on healthy vibration signals. When a new signal is fed in, the autoencoder tries to reconstruct it. If the reconstruction error (MSE) is large, the signal contains patterns the model never saw during healthy-state training — indicating an anomaly.

**Output:**
- **Anomaly score** (0.0 – 1.0): averaged across 3 independent encoder-decoder pairs
- **Decision threshold:** score > **0.75** → anomaly detected
- **Result label:** `Anomaly detected` or `Healthy`

**Effect on machine status:**  
An anomaly alone sets the machine to **WARNING**.

---

### 5.2 Fault Classification — 1D-CNN

**Question answered:** *What kind of bearing fault is it?*

**Model:** 1D Convolutional Neural Network trained with WGAN augmentation

**Input processing:**
1. A 4096-sample window is taken from the raw signal
2. Fast Fourier Transform (FFT) converts the time-domain signal to a frequency spectrum
3. The frequency spectrum is the input to the CNN

**Output — 4 fault classes:**

| Class | Label | Description |
|-------|-------|-------------|
| 0 | **Normal** | Healthy bearing, no fault |
| 1 | **Inner Race Fault** | Defect on the inner bearing race |
| 2 | **Ball Fault** | Defect on a rolling element (ball) |
| 3 | **Outer Race Fault** | Defect on the outer bearing race |

The model outputs a probability for each class. The class with the highest probability wins, and the **confidence** value (0–100 %) indicates certainty.

**Effect on machine status:**
- Fault class + confidence ≥ 90 % + existing anomaly → **FAULT**
- Fault class detected (any confidence) → at minimum **WARNING**

---

### 5.3 RUL Prediction — Bi-LSTM

**Question answered:** *How many days until this machine is expected to fail?*

**Model:** Bidirectional Long Short-Term Memory recurrent network

**Input:**  
A 10-step sequence of 6 extracted vibration features:  
RMS, Peak, Kurtosis, Skewness, RMS Envelope, and a degradation index (VDI3832 Kt)

**How it works:**  
The model was trained on historical data from a complete bearing lifecycle (from installation to confirmed failure). It learned how the feature pattern evolves as wear progresses. Given the current feature vector, it predicts how much of the lifecycle remains.

**Output:**
- **Estimated days to failure** (floating-point number)
- Three sub-models are trained for different fault categories: `OR` (outer race), `IR` (inner race), `O` (other). The appropriate sub-model is selected based on the fault classification result.

**Effect on machine status:**  
RUL ≤ **7 days** → machine status is set to **FAULT** regardless of anomaly score.

---

### 5.4 Overall Machine Status Logic

After any inference run, the backend recalculates and stores the machine status:

```
RUL ≤ 7 days?                    → FAULT
Anomaly detected AND              → FAULT
  fault class ≠ Normal AND
  confidence ≥ 90 %?

Anomaly detected OR               → WARNING
  fault class ≠ Normal?

Otherwise                         → OK
```

---

### 5.5 Model Lifecycle — Training and Deployment

1. **Base models** are pre-trained and stored in `ml_service/models/`
2. **Fine-tuning** retrains a model version on your own labeled measurement data via the ML Sector page
3. Training runs **asynchronously** in the background; model status shows `TRAINING`
4. When training completes, status changes to `READY`
5. The technician reviews accuracy metrics and clicks **Deploy to production**
6. The ML service reloads the new model weights; all subsequent analyses use the new version

---

## 6. Detectable Fault Types

| Fault Type | Detection Method | Typical Cause |
|------------|-----------------|---------------|
| **General anomaly / unknown fault** | AE-AnoWGAN (anomaly score) | Any deviation from healthy baseline — early-stage faults, lubrication issues, contamination |
| **Inner race bearing defect** | 1D-CNN fault classifier | Fatigue crack or spalling on the inner ring of the bearing |
| **Outer race bearing defect** | 1D-CNN fault classifier | Fatigue crack or spalling on the outer ring of the bearing (most common bearing failure) |
| **Rolling element (ball) defect** | 1D-CNN fault classifier | Pitting or flat spot on a ball or roller |
| **Accelerated wear / approaching end-of-life** | Bi-LSTM RUL predictor | Progressive degradation across all feature channels |

> **Note:** The system is specifically optimized for **rolling element bearing** diagnostics. Faults in other components (gears, shafts, seals) may be flagged as anomalies but will not receive a specific fault class label.

---

## 7. Supported Machine Types

PulseGuard is suitable for any rotating machine that can be equipped with acceleration sensors connected to a B&R CM4810 module:

| Machine Category | Examples |
|-----------------|---------|
| **Electric motors** | AC induction motors, servo drives, spindle motors |
| **Pumps** | Centrifugal pumps, gear pumps, coolant pumps |
| **Compressors** | Rotary screw compressors, centrifugal compressors |
| **Fans and blowers** | Industrial exhaust fans, HVAC blowers |
| **Gearboxes** | Reduction gearboxes, multi-stage transmissions |
| **Conveyor drives** | Belt conveyor head-end drives |
| **Machine tool spindles** | CNC milling, turning, and grinding spindles |
| **General rotating machinery** | Any shaft-and-bearing assembly with measurable vibration |

**Conditions for best results:**
- Sensors mounted rigidly on or near the bearing housing (not on sheet metal covers)
- Sampling rate ≥ 25 600 Hz (CM4810 native rate)
- Machine running at normal operating speed during measurement
- At least one full lifecycle of historical data available for RUL training

---

## 8. User Roles and Permissions

The system has three roles. All roles are enforced by the backend API — the frontend hides buttons based on role, but the API will reject unauthorized calls regardless.

| Action | `user` (Viewer) | `operator` | `admin` |
|--------|:-:|:-:|:-:|
| View Dashboard, charts, measurements, history | ✓ | ✓ | ✓ |
| Access all pages (navigation is not role-gated) | ✓ | ✓ | ✓ |
| Run AI analysis manually | ✓ | ✓ | ✓ |
| Add service notes | ✓ | ✓ | ✓ |
| Add / edit machines | — | ✓ | ✓ |
| Configure machine connectivity (OPC UA, FTP) | — | ✓ | ✓ |
| Test OPC UA / FTP connection | — | ✓ | ✓ |
| Train and deploy ML models | — | ✓ | ✓ |
| Register / edit / delete sensors | — | — | ✓ |
| Add / edit / delete user accounts | — | — | ✓ |

### Default seeded account

`init.sql` creates exactly **one** user on first startup:

| Username | Email | Role |
|----------|-------|------|
| `admin` | `admin@vut.cz` | admin |

The default password is set at database initialization time via a bcrypt hash in `init.sql`. **Change the password immediately after first deployment** using the edit function in User Management or by re-hashing and updating `init.sql` before the first `docker-compose up`.

Additional `operator` and `user` accounts must be created manually by the admin through the Users page after first login.

---

*For deployment instructions see [DEPLOYMENT.md](DEPLOYMENT.md). For model training details see [MODEL_TRAINING.md](MODEL_TRAINING.md).*
