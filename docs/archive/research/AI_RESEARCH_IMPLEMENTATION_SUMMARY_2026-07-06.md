# AI Research Implementation Summary and Priority Roadmap

Date: 2026-07-06

## Scope reviewed

Reviewed AI research artifacts from external folder and cross-checked against code in:
- backend
- ml_service
- frontend
- init.sql
- existing docs

This report separates:
1. Already implemented in the current app
2. Missing or only partially implemented
3. Priority roadmap by expected business value for this app

## 1) What is already implemented (verified in code)

### A. Core platform and data flow
- Dockerized multi-service architecture is running (frontend, backend, ml_service, db).
- TimescaleDB schema exists for measurements, feature_data, analysis_results, service_notes.
- Periodic collection job exists (APScheduler in backend) and performs:
  - OPC UA trigger calls to PLC
  - FTP pull of generated CSV
  - Measurement record insert into DB
- Machine connectivity settings are implemented in UI + backend:
  - OPC UA endpoint config
  - FTP config
  - connection tests
  - enable or disable automatic collection

### B. ML inference in production
- Endpoints implemented and wired:
  - anomaly detection (AE_ANOWGAN)
  - fault classification (1D_CNN)
  - RUL prediction (Bi-LSTM)
- Results are written to analysis_results and displayed in dashboard and machine diagnostics.
- ML model loading and reload from backend active model state is implemented.

### C. MLOps basics and model lifecycle
- Model catalog endpoint and UI implemented.
- Fine-tuning flow implemented from UI to backend to ML service (async background training + webhook completion).
- Model version activation to production implemented.
- Training docs and basic training analysis workflow already exist.

### D. Supporting app functions
- Training segment search and selection is implemented.
- Maintenance notes (service notes) are implemented.
- Historical data and graph endpoints (raw, FFT, CWT, features) are implemented.

## 2) Missing or partially implemented (gap to research vision)

### Highest impact missing items
1. Full CM4810 multi-buffer strategy is not implemented.
- Research expects 4 buffers per sensor: raw, envelope, FFT raw, FFT envelope.
- Current runtime downloads only one raw buffer per channel in periodic collection.
- This limits quality for classification and diagnostics depth.

2. Commissioning and baseline workflow is missing.
- No dedicated commissioning_sessions table in schema.
- No baseline approval loop by technician.
- No machine profile baseline snapshot and lifecycle handling from research concept.

3. Human-in-the-loop validation loop is missing.
- No explicit feedback workflow for:
  - anomaly validation
  - fault label correction
  - RUL correction after maintenance
- Current service_notes are generic and not integrated into model feedback learning.

4. Alert threshold and operating mode logic from research is missing.
- No dedicated alert_thresholds or operating_modes data model in DB.
- No startup, overload, maintenance mode specific threshold behavior.
- No anti-spam logic based on consecutive anomalies.

5. CoTrace trigger governance is missing.
- No configured auto-trigger policy based on anomaly, RMS, kurtosis and cooldown.
- No managed CoTrace history and policy in app layer.

### Medium impact missing items
6. Profile system is only partial.
- Basic machine and sensor entities exist.
- Rich profile content from research (frequency map, machine-specific metadata, profile versioning) is not implemented.

7. Buffer download job tracking model is missing.
- Research proposes work_id job queue tables and statuses.
- Current approach has work_id-like naming but no robust job table and no full audit trail per buffer type.

8. RUL scheduling strategy is basic.
- RUL prediction exists, but update policy is manual/on-demand.
- No adaptive scheduler or event-driven update orchestration from research.

### Important technical risk
9. RUL fine-tuning script has a data structure mismatch risk.
- train_rul expects dict-like features (.get), while extract_14_features currently returns a list.
- This can break RUL training pipeline reliability.

## 3) Priority roadmap (ordered by app benefit)

Scoring logic: Benefit first, then implementation effort and risk.

## Phase 0 (Immediate, 1-2 weeks) - Stabilize and unlock ROI

### P0.1 Fix RUL training reliability bug
Benefit: Very high (prevents failed re-training)
Effort: Low
Actions:
- Align extract_14_features output with train_rul expectation (dict or vectorized mapping).
- Add regression test for trigger-finetuning-rul path.

### P0.2 Add model quality gate before activation
Benefit: High
Effort: Low-Medium
Actions:
- Require minimal validation checks before /activate.
- Persist evaluation metadata for each trained version.

### P0.3 Add download pipeline observability
Benefit: High
Effort: Low
Actions:
- Log structured status for each periodic collection cycle.
- Expose simple health endpoint and last successful collection timestamp.

## Phase 1 (High value, 2-6 weeks) - Improve diagnostic quality

### P1.1 Implement full 4-buffer CM4810 acquisition
Benefit: Very high (better fault detection/classification confidence)
Effort: Medium-High
Actions:
- Extend PLC/API flow to download raw + envelope + FFT raw + FFT envelope per sensor.
- Store metadata and paths for each buffer artifact.
- Update processing pipeline to use richer features.

### P1.2 Introduce robust buffer job tracking
Benefit: High
Effort: Medium
Actions:
- Create buffer_download_jobs and related audit tables.
- Add retry, timeout, and status transitions.
- Surface queue/job state in UI.

### P1.3 Add threshold policy and operating modes
Benefit: High (fewer false alarms, better trust)
Effort: Medium
Actions:
- Add DB model for thresholds and mode presets.
- Runtime policy for startup/overload/maintenance modes.
- Consecutive anomaly and cooldown rules.

## Phase 2 (Strategic, 6-10 weeks) - Human-centered intelligence

### P2.1 Commissioning baseline workflow
Benefit: Very high (foundation for adaptive quality)
Effort: Medium
Actions:
- Add commissioning session model and state machine.
- Baseline data capture and technician approval step.
- Enable anomaly detection only after approved baseline.

### P2.2 Human-in-the-loop feedback loop
Benefit: Very high (long-term model quality)
Effort: Medium-High
Actions:
- Add UI and API for validation actions:
  - confirm/reject anomaly
  - correct fault label
  - record actual RUL after maintenance
- Feed validated labels into training dataset generation.

### P2.3 Structured maintenance log linked to ML outcomes
Benefit: High
Effort: Medium
Actions:
- Expand service notes into maintenance event model.
- Link events to RUL prediction history and post-maintenance reset actions.

## Phase 3 (Optimization, 10+ weeks) - Scale and automation

### P3.1 Adaptive and event-driven RUL update scheduler
Benefit: Medium-High
Effort: Medium
Actions:
- Update frequency based on anomaly severity, trend acceleration, criticality.
- Trigger immediate recompute after fault and maintenance events.

### P3.2 Profile versioning and richer machine templates
Benefit: Medium
Effort: Medium
Actions:
- Add profile versioning and machine-type templates.
- Include characteristic frequencies and machine-specific limits.

### P3.3 Drift monitoring and active learning dashboard
Benefit: Medium
Effort: Medium-High
Actions:
- Track score distribution drift and confidence decay.
- Trigger retraining recommendations with evidence.

## 4) Recommended execution order (top 5 by benefit)

1. Fix RUL training reliability bug (P0.1)
2. Full 4-buffer CM4810 acquisition (P1.1)
3. Commissioning baseline workflow (P2.1)
4. Human-in-the-loop feedback loop (P2.2)
5. Threshold policy plus operating modes (P1.3)

## 5) Expected app impact after top 5

- Higher detection reliability and fewer false positives.
- Better interpretability and user trust through validated workflows.
- Faster and safer maintenance decisions from better RUL confidence.
- Stronger data quality for future model improvement.

## 6) Addendum (2026-07-10): AS card acquisition readiness for multi-machine setups

### What is already prepared in the Automation Studio project
- PLC side exposes a dynamic OPC command interface for buffer jobs:
  - WorkID
  - ModulePath
  - BufferNumber
  - BufferLength
  - Start and Reset triggers
- GetBuffer logic reads these command values at runtime and executes download plus CSV export pipeline.
- SaveData logic writes CSV with dynamic file name derived from WorkID and reports completion via BufferStatus.

### Current functional limits on PLC side
- Processing is sequential (single active job at a time) because one global gTrace structure and one CM4810 function block instance are used.
- Global SensorData is fixed to four channels (ARRAY[1..4]); this is suitable for one 4-channel logical set but not enough for explicit multi-card identity by itself.

### Backend integration gap (critical for multi-machine and shared-card scenarios)
- Backend currently does not write ModulePath to PLC before each job.
- Backend currently pairs channel to sensor by sensor order (OFFSET based mapping) and global TRACE_BUFFER_CHANNEL_MAP, not by explicit persisted module/card/channel binding.
- Because of this, AS is ready for dynamic routing, but end-to-end routing is still only partially implemented.

### Implication for requested deployment scenarios
- Two machines with two sensors each: possible but not robustly explicit without structured channel binding.
- One machine with grouped front and back sensors: possible today using sensor position labels, but grouping is text-based (not a first-class data model).
- Two machines sharing one CM4810/card pool: feasible only after explicit binding and ModulePath write is implemented in backend.

### Recommended next implementation steps
1. Add explicit sensor hardware binding model in DB (machine_id, sensor_id, module_path, card_id, channel_no, mount_group, mount_point).
2. Update collection pipeline to resolve sensor by explicit binding instead of OFFSET ordering.
3. Write ModulePath per collection job via OPC UA before Start trigger.
4. Extend UI forms to maintain module/card/channel and mount_group fields.
5. Keep existing position field as free text, but use mount_group enum for analytics-ready grouping.
