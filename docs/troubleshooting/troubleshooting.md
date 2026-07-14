# Troubleshooting Guide

## Docker stack does not start

Symptoms:

- Containers exit immediately
- `docker compose up` returns build/runtime error

Actions:

1. Run `docker compose ps` and identify failing service.
2. Inspect logs: `docker compose logs --tail 200 <service>`.
3. Rebuild if needed: `docker compose up --build`.
4. If DB init got corrupted in local dev, reset volume:

```bash
docker compose down -v
docker compose up --build
```

## Database connection failures

Symptoms:

- Backend cannot connect to Postgres
- Startup errors around `DATABASE_URL`

Actions:

1. Ensure db container is healthy.
2. Verify `DATABASE_URL` points to `db:5432` in container network.
3. Check credentials in compose and DB env vars.
4. Validate connection manually:

```bash
docker compose exec db psql -U vibro_user -d vibro_diag -c "SELECT 1;"
```

## Frontend cannot reach backend

Symptoms:

- Login or API calls fail
- Browser console shows 404/502 for `/api/...`

Actions:

1. Confirm frontend Nginx proxy config contains `/api/` -> backend.
2. Ensure backend is running on port 8000 in compose network.
3. For local Vite mode, set `VITE_API_URL=http://localhost:8000`.

## Backend available but ML calls fail

Symptoms:

- AI endpoints return 500
- Errors mention ML connection

Actions:

1. Check `ML_SERVICE_URL` in backend env.
2. Check ML service logs.
3. Verify model sync endpoint behavior (`/models/sync-active`).

## ML service errors during inference

Symptoms:

- `analyze-anomaly`, `classify-fault`, or `predict-rul` fails

Actions:

1. Verify raw CSV path exists in mounted folders.
2. Ensure model files exist in `ml_service/models` and are loadable.
3. Confirm input shape assumptions:
   - anomaly frame expects enough samples
   - classifier path points to valid CSV
   - RUL expects 10 x 6 feature sequence

## Environment variable issues

Symptoms:

- Backend exits at startup due to missing token settings

Actions:

1. Ensure required vars are set: `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`.
2. Confirm no malformed value types (for example integer fields).
3. Re-check [Configuration Reference](../deployment/configuration-reference.md).

## Volume permission or file access problems

Symptoms:

- CSV/model files cannot be read or written

Actions:

1. Confirm host paths exist (`backend/data`, `ml_service/models`, `ml_service/data`).
2. Confirm container user can read/write mounts.
3. Check path translation between backend and ML service (`/app/data` -> `/app/backend_data`).

## Manual collect-now fails (OPC/FTP)

Symptoms:

- `/machines/{id}/collect-now` returns connectivity errors

Actions:

1. Validate machine settings (OPC URL, FTP host/user/password/directory).
2. Use `/machines/{id}/test-connection?type=opc` and `type=ftp`.
3. Verify PLC endpoint reachability from backend container network.
4. Confirm `TRACE_BUFFER_CHANNEL_MAP` matches the PLC raw-acceleration buffer assignment, for example `1:67,2:71,3:75,4:79`.

## Upgrade failures

Symptoms:

- New image runs but behavior regressed

Actions:

1. Restore DB and file backups.
2. Roll back to previous tagged image or commit.
3. Compare changed env vars and compose settings.
4. Re-validate API and UI smoke tests.

## Where to Continue

- [Installation Guide](../deployment/installation.md)
- [Deployment Guide](../deployment/deployment-guide.md)
- [Operations Guide](../operations/operations-guide.md)
