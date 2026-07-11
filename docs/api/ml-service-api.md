# ML Service API Reference

Base URL:

- In Docker deployment: `http://localhost:8001`
- Intended caller: backend service

## Notes

- The ML service is currently callable directly if port 8001 is exposed.
- Most endpoints accept file paths or feature payloads.

## Endpoints

### GET /
- Description: Service liveness message.

### POST /analyze-anomaly
- Description: AE-AnoWGAN anomaly analysis from CSV path.
- Request JSON:

```json
{ "path": "/app/backend_data/mach1/file.csv" }
```

- Response JSON:

```json
{ "anomaly_score": 0.42, "is_anomaly": false }
```

### POST /classify-fault
- Description: 1D-CNN fault classification from CSV path.
- Request JSON:

```json
{ "path": "/app/backend_data/mach1/file.csv" }
```

- Response JSON:

```json
{ "fault_type": "Healthy", "confidence": 0.96 }
```

### POST /predict-rul
- Description: Bi-LSTM RUL prediction from sequence features.
- Request JSON:

```json
{
  "features": [[0.1,0.2,0.3,0.4,0.5,0.6]],
  "category": "O"
}
```

- Response JSON:

```json
{ "rul_fraction": 0.73, "used_model": "Bi-LSTM (O)" }
```

### POST /process-features
- Description: Compute vibration features from CSV and overwrite cleaned file.
- Request JSON: `{ "path": "..." }`

### POST /get-raw-data
- Description: Return downsampled raw signal.
- Request JSON: `{ "path": "...", "step": 16 }`

### POST /get-fft
- Description: Return FFT frequencies/amplitudes arrays.
- Request JSON: `{ "path": "..." }`

### POST /get-cwt
- Description: Return CWT image as base64 data URI.
- Request JSON: `{ "path": "..." }`

### POST /trigger-finetuning
- Description: Start AE-AnoWGAN fine-tuning in background.

### POST /trigger-finetuning-1dcnn
- Description: Start 1D-CNN fine-tuning in background.

### POST /trigger-finetuning-rul
- Description: Start Bi-LSTM fine-tuning in background.

### POST /reload
- Description: Reload active models from backend selection.

## Model Synchronization Behavior

On startup, ML service calls backend `POST /models/sync-active` and loads latest `training_status='ready'` model versions into memory.

## Related Docs

- [Backend API](backend-api.md)
- [ML Service Guide](../ml-service/overview.md)
- [Security Audit Report](../operations/SECURITY_AUDIT_REPORT_2026-07-11.md)
