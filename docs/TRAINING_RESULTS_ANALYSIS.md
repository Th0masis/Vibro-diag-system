# Training Results Analysis Guide

This guide explains how to evaluate training output and decide whether a new model version is production-ready.

## 1. Where Results Are Stored

### Database tables

- ml_models: version metadata, status, active flag, path
- analysis_results: inference outputs from anomaly/fault/RUL endpoints
- measurements and feature_data: source data used for analysis

### Files

- Model artifacts are written to ml_service/models/... by model type and version

## 2. Minimal Validation Workflow

For each newly trained version:

1. Confirm training_status is ready in ml_models.
2. Activate model with /models/{id}/activate.
3. Run inference on recent machine data:
   - /machines/{id}/analyze-anomaly
   - /machines/{id}/classify-fault
   - /machines/{id}/predict-rul
4. Check latest dashboard aggregates from /machines/{id}/latest-ai.
5. Compare against previous active model behavior.

## 3. SQL Checks for Training Outcome

### 3.1 Latest versions and status

```sql
SELECT id_model, name, version, type, is_active, training_status, training_date, path_to_model
FROM ml_models
ORDER BY id_model DESC;
```

### 3.2 Failed trainings

```sql
SELECT id_model, name, version, training_status, training_date
FROM ml_models
WHERE training_status = 'failed'
ORDER BY training_date DESC;
```

### 3.3 Inference volume after activation

```sql
SELECT prediction_type, COUNT(*) AS cnt
FROM analysis_results
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY prediction_type;
```

## 4. Model-Specific Evaluation

### AE-AnoWGAN (anomaly detection)

Track:

- anomaly_score distribution over healthy periods
- false positives during stable machine operation

Practical checks:

1. Run anomaly endpoint repeatedly on known healthy data.
2. Build baseline median and p95 score.
3. Compare to previous version; avoid large score drift unless expected.

### 1D-CNN (fault classification)

Track:

- class confidence stability
- confusion between inner/outer/ball fault classes

Practical checks:

1. Prepare labeled validation set from known measurements.
2. Run classify-fault and collect predicted label + confidence.
3. Build confusion matrix and per-class precision/recall.

### Bi-LSTM (RUL)

Track:

- monotonic trend behavior (RUL should generally decrease with degradation)
- sensitivity to noisy windows

Practical checks:

1. Build chronological sequences from machine history.
2. Call predict-rul in rolling windows.
3. Compare predicted trend with maintenance events and fault progression.

## 5. Operational Acceptance Criteria

Recommended gate before production activation:

- training_status=ready
- no runtime errors in ML service during test inference
- metrics meet or exceed previous active version
- no extreme increase in false alarms on healthy data
- RUL outputs remain physically plausible

## 6. Collecting Evaluation Data via API

Useful endpoints:

- GET /ml-models
- GET /machines/{machine_id}/latest-ai
- GET /machines/{machine_id}/history
- GET /measurements/{id}/features
- POST /machines/{machine_id}/analyze-anomaly
- POST /machines/{machine_id}/classify-fault
- POST /machines/{machine_id}/predict-rul

## 7. Logging and Diagnostics

### Backend logs

Watch for:

- ML service request failures
- database write failures to analysis_results
- webhook status transitions

### ML service logs

Watch for:

- epoch loss trends
- data loading warnings (empty files, missing columns)
- model load/reload issues at startup

## 8. Known Caveat in Current Code

The RUL training script currently calls .get(...) on extract_14_features output, but extract_14_features returns a list. If RUL training fails with a list/dict attribute error, patch train_rul.py before relying on RUL fine-tuning in production.

## 9. Suggested Experiment Tracking Template

Store one row per training run in your internal tracker:

- timestamp
- model_id and version
- data segment definition
- training epochs and batch size
- validation metrics (overall and by class)
- pass/fail decision
- activation date
- rollback model (if needed)
