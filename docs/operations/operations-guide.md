# Operations Guide

## Runtime Monitoring

Basic runtime checks:

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f ml_service
docker compose logs -f db
```

Health and reachability checks:

- Frontend: `GET http://localhost/`
- Backend docs: `GET http://localhost:8000/docs`
- ML docs: `GET http://localhost:8001/docs`

## Logging

- All services log to container stdout/stderr.
- Use `docker compose logs` for centralized local diagnostics.
- Consider log forwarding for production environments.

## Backups

Required backup scope:

1. Database dump (`vibro_diag`)
2. Raw data files under `backend/data/`
3. Model artifacts under `ml_service/models/`
4. Deployment configuration (`docker-compose.yml`, overrides)

Reference commands in [Deployment Guide](../deployment/deployment-guide.md).

## Restore

Restore order:

1. Restore DB service and import SQL dump.
2. Restore file stores (`backend/data`, `ml_service/models`).
3. Start full stack and verify service health.

## Performance and Capacity Notes

- ML training may significantly increase CPU and memory use.
- Data growth depends on collection interval and number of sensors.
- Timeseries tables currently have no retention policy; monitor storage usage.

## Updating Containers

```bash
docker compose pull
docker compose build
docker compose up -d
```

After update:
- Verify API availability
- Verify model sync and inference
- Verify DB connectivity and recent writes

## Health Checks

Current compose includes health check for database only.

Recommendation:
- Add explicit healthchecks for backend and ML service in compose for improved orchestration behavior.

## Scaling Considerations

Current architecture is single-host and stateful.

For scaling planning:
- Separate DB host or managed Timescale service
- Restrict and internalize ML and DB ports
- Add reverse proxy ingress and TLS
- Add centralized logging and metrics

## Phase 1 Buffer Collection

This section consolidates the former Phase 1 buffer operations note.

Runtime focus:

- multi-buffer acquisition mapping
- duplicate-channel guard behavior
- buffer job queue visibility

### Environment Variables

Set `TRACE_BUFFER_PLAN_JSON` in backend environment.

Optional duplicate-channel behavior switch:

- `DUPLICATE_CHANNEL_POLICY=warn` (default, development friendly)
- `DUPLICATE_CHANNEL_POLICY=block` (strict production gate)

Example for 4 channels and 4 buffer types:

```json
{
	"raw": {"1": 66, "2": 67, "3": 70, "4": 71},
	"envelope": {"1": 72, "2": 73, "3": 74, "4": 75},
	"fft_raw": {"1": 76, "2": 77, "3": 78, "4": 79},
	"fft_envelope": {"1": 80, "2": 81, "3": 82, "4": 83}
}
```

Use real CM4810 buffer numbers from your PLC project.

If `TRACE_BUFFER_PLAN_JSON` is not set, backend falls back to legacy raw-only mapping from `TRACE_BUFFER_CHANNEL_MAP`.

### What Happens During Collection

1. Backend creates one job per channel and buffer type in `buffer_download_jobs`.
2. Job status transitions through `queued`, `plc_done`, `downloaded`, `persisted`, `failed`.
3. For raw files, backend computes SHA-256 and checks for duplicate payloads across channels within the same batch.
4. If duplicates are found, backend writes a warning service note and marks AI chain as blocked for manual `run_ai` flow.

In `warn` mode, duplicates are still reported but AI chain is not blocked.

### Useful Endpoints

1. `GET /machines/{machine_id}/buffer-jobs/recent?limit=30`

- Returns latest buffer job rows for UI queue/status panel.

1. `GET /collection/health`

- Scheduler run summary and last error state.

1. `GET /machines/{machine_id}/alert-policy`

1. `PUT /machines/{machine_id}/alert-policy`

- Mode thresholds, consecutive anomaly rule, and cooldown.

### Quick Verification Checklist

1. Confirm rows are being inserted into `buffer_download_jobs` during `collect-now`.
2. Confirm raw files from each channel have distinct `file_hash` values.
3. Confirm duplicate-channel scenario produces a `WARNING` service note.
4. Confirm UI can render recent buffer jobs from the recent endpoint.

## Security Operations

- Rotate secrets regularly
- Restrict access to backend, ML, and DB ports
- Periodically review and re-run security audit controls

See [Security Audit Report](SECURITY_AUDIT_REPORT_2026-07-11.md).

## Related Docs

- [Deployment Guide](../deployment/deployment-guide.md)
- [Configuration Reference](../deployment/configuration-reference.md)
- [Troubleshooting](../troubleshooting/troubleshooting.md)
