# Model Training Guide

This project supports training and fine-tuning for three model groups:

- AE-AnoWGAN (anomaly detection)
- 1D-CNN (fault classification)
- Bi-LSTM (RUL prediction)

Training is initiated from Backend API and executed asynchronously by ML service.

## 1. Training Pipeline Overview

1. User selects data segments in UI (ML Sector) or sends API request.
2. Backend creates a new row in ml_models with training_status=training.
3. Backend calls ML service trigger endpoint:
   - /trigger-finetuning
   - /trigger-finetuning-1dcnn
   - /trigger-finetuning-rul
4. ML service runs training in background task.
5. ML service calls backend webhook /webhook/training-done/{model_id}.
6. Backend updates training_status to ready or failed.

## 2. Data Requirements

Training data is loaded from file paths stored in measurements.raw_data_path.

Accepted formats in training scripts:

- CSV (primary)
- MAT (legacy support)

CSV expectation:

- Preferred signal column name: yAxis
- If yAxis is missing, scripts use the last column

Recommended signal quality:

- No empty files
- Numeric values only in selected signal column
- Enough samples per file:
  - AE-AnoWGAN uses 1024 sample frames
  - 1D-CNN uses 4096 sample windows

## 3. Training from UI

Use ML Sector page:

1. Open segment selector (training segments are read from /training-segments).
2. Pick machine/sensor/date range.
3. Choose model/version to fine-tune.
4. Start training and monitor status in model table.

Notes:

- Backend expands selected time window by +/-1 minute to avoid missing boundary records.
- For RUL training, lifecycle_info is required.

## 4. Training by API

Authentication uses /login and Bearer token.

### 4.1 Find segments

```http
GET /training-segments?machine_id=1&sensor_id=2&datetime_from=2026-05-01T00:00&datetime_to=2026-05-02T23:59
Authorization: Bearer <token>
```

### 4.2 Start fine-tuning

```http
POST /models/{model_id}/fine-tune
Authorization: Bearer <token>
Content-Type: application/json
```

Payload for AE-AnoWGAN and 1D-CNN:

```json
{
  "segments": [
    {
      "id_machine": 1,
      "id_sensor": 2,
      "dateFrom": "2026-05-01T08:00:00",
      "dateTo": "2026-05-01T12:00:00",
      "label": 1
    }
  ]
}
```

Payload for Bi-LSTM (RUL):

```json
{
  "segments": [
    {
      "id_machine": 1,
      "id_sensor": 2,
      "dateFrom": "2026-05-01T08:00:00",
      "dateTo": "2026-05-20T18:00:00"
    }
  ],
  "lifecycle_info": {
    "installed_at": "2026-01-01T00:00:00",
    "failed_at": "2026-06-01T00:00:00"
  }
}
```

## 5. Model-Specific Behavior

### AE-AnoWGAN

- Trigger endpoint: /trigger-finetuning
- Trainer: ml_service/train_aeanowgan.py
- Loads existing v1 model weights from models/AE_ANOWGAN
- Saves updated encoder/decoder/discriminator files into target version folder

### 1D-CNN

- Trigger endpoint: /trigger-finetuning-1dcnn
- Trainer: ml_service/train_1dcnn.py
- Uses labeled windows generated from CSV/MAT signals
- Output classes:
  - 0 normal
  - 1 inner race fault
  - 2 ball fault
  - 3 outer race fault

### Bi-LSTM RUL

- Trigger endpoint: /trigger-finetuning-rul
- Trainer: ml_service/train_rul.py
- Expects lifecycle dates to compute normalized RUL labels
- Uses 10-step sequence window

## 6. Activating Trained Versions

After training_status becomes ready, activate the desired model:

```http
PUT /models/{model_id}/activate
Authorization: Bearer <token>
```

Backend updates active version in DB and requests ML model reload via /reload.

## 7. Monitoring Training Status

Read model states:

```http
GET /ml-models
Authorization: Bearer <token>
```

Status values in ml_models.training_status:

- training
- ready
- failed

## 8. Common Training Issues

### No files found in selected segment

- Verify measurements.raw_data_path is not null.
- Check selected sensor and date range.

### Training accepted but never finishes

- Check ML service logs for Python exceptions.
- Confirm webhook URL is reachable from ML container to backend container.

### New model not used in inference

- Call model activation endpoint.
- Verify /reload succeeds in backend response.
- Confirm /models/sync-active returns the expected active path.

## 9. Optional Batch Data Ingestion

Utility scripts in ml_service:

- import_batch.py for bulk registration of measurement files in backend
- split_senzor_data.py to split two-channel CSV into separate axis files

Adjust hardcoded paths and sensor IDs before using these scripts.
