# Phase 1 Buffer Collection Ops Note

## Purpose

This note provides practical runtime configuration for Phase 1 buffer collection:

- multi-buffer acquisition mapping
- duplicate-channel guard behavior
- queue visibility endpoint

## Environment variable template

Set TRACE_BUFFER_PLAN_JSON in backend environment.

Optional duplicate-channel behavior switch:

- DUPLICATE_CHANNEL_POLICY=warn (default, development friendly)
- DUPLICATE_CHANNEL_POLICY=block (strict production gate)

Example for 4 channels and 4 buffer types:

{
  "raw": {"1": 66, "2": 67, "3": 70, "4": 71},
  "envelope": {"1": 72, "2": 73, "3": 74, "4": 75},
  "fft_raw": {"1": 76, "2": 77, "3": 78, "4": 79},
  "fft_envelope": {"1": 80, "2": 81, "3": 82, "4": 83}
}

Use real CM4810 buffer numbers from your PLC project.

If TRACE_BUFFER_PLAN_JSON is not set, backend falls back to legacy raw-only mapping from TRACE_BUFFER_CHANNEL_MAP.

## What happens during collection

1. Backend creates one job per channel and buffer type in buffer_download_jobs.
2. Job status transitions through queued, plc_done, downloaded, persisted, failed.
3. For raw files, backend computes SHA-256 and checks for duplicate payloads across channels within the same batch.
4. If duplicates are found, backend writes a warning service note and marks AI chain as blocked for manual run_ai flow.

In `warn` mode, duplicates are still reported but AI chain is not blocked.

## Useful endpoints

1. GET /machines/{machine_id}/buffer-jobs/recent?limit=30

- Returns latest buffer job rows for UI queue/status panel.

1. GET /collection/health

- Scheduler run summary and last error state.

1. GET /machines/{machine_id}/alert-policy

1. PUT /machines/{machine_id}/alert-policy

- Mode thresholds, consecutive anomaly rule, and cooldown.

## Quick verification checklist

1. Confirm rows are being inserted into buffer_download_jobs during collect-now.
2. Confirm raw files from each channel have distinct file_hash values.
3. Confirm duplicate-channel scenario produces a WARNING service note.
4. Confirm UI can render recent buffer jobs from the recent endpoint.
