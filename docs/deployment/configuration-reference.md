<!-- markdownlint-disable MD060 -->

# Configuration Reference

This reference is derived from `docker-compose.yml`, `backend/main.py`, `backend/auth.py`, `ml_service/main.py`, and frontend bootstrap.

## Backend Environment Variables

| Variable | Required | Default | Description | Security Notes |
|---|---|---|---|---|
| `DATABASE_URL` | Yes | `postgresql://admin:secret@localhost:5432/vibro_diag` | SQLAlchemy connection string for backend DB access. | Must not use default in production. |
| `SECRET_KEY` | Yes | none | JWT signing key. | Critical secret. Rotate and store securely. |
| `ALGORITHM` | Yes | none | JWT signing algorithm (typically `HS256`). | Must match token issuer/validator. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Yes | none | JWT expiration in minutes. | Shorter values reduce token theft impact. |
| `ML_SERVICE_URL` | No | `http://localhost:8001` | URL used by backend to call ML endpoints. | Restrict network path; internal only preferred. |
| `BACKEND_URL` | No | `http://localhost:8000` | Used for internal webhook URL composition. | Internal routing only. |
| `TRACE_BUFFER_CHANNEL_MAP` | No | `1:67,2:71,3:75,4:79` | Mapping of logical channel to PLC trace buffer number for raw acceleration. | Verify against PLC configuration. |
| `TRACE_BUFFER_PLAN_JSON` | No | none | JSON map for multi-buffer collection plan (`raw`, `envelope`, `fft_raw`, `fft_envelope`) per channel. | Validate against PLC CM4810 buffer numbers before enabling in production. |
| `TRACE_BUFFER_LENGTH` | No | `4097` | PLC trace buffer length used during collection. | Keep aligned with PLC and model input assumptions. |
| `DUPLICATE_CHANNEL_POLICY` | No | `warn` | Duplicate raw payload guard policy: `warn` or `block` for automatic AI chain. | Use `block` in production to avoid contaminated AI/RUL runs. |
| `DEFAULT_MODULE_PATH` | No | `IF3.ST1.IF1.ST2` | Fallback PLC module path when sensor-specific `module_path` is missing. | Prefer explicit per-sensor `module_path` in DB. |
| `PYTHONUNBUFFERED` | No | `1` (in compose) | Disables output buffering for container logs. | Operational only. |

## ML Service Environment Variables

| Variable | Required | Default | Description | Security Notes |
|---|---|---|---|---|
| `BACKEND_URL` | No | `http://localhost:8000` | Backend URL for model sync and training webhook flow. | Keep internal and authenticated where possible. |
| `PYTHONUNBUFFERED` | No | `1` | Log output behavior. | Operational only. |

## Database Container Variables

| Variable | Required | Default (compose) | Description |
|---|---|---|---|
| `POSTGRES_USER` | Yes | `vibro_user` | Database superuser for this deployment. |
| `POSTGRES_PASSWORD` | Yes | `vibro_password` | Database password. |
| `POSTGRES_DB` | Yes | `vibro_diag` | Initial database name. |
| `TZ` | No | `UTC` | Database timezone setting. |

## Frontend Runtime Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_API_URL` | No | `/api` | Frontend API base URL. In containerized deployment, Nginx proxies `/api` to backend. |

## Nginx Frontend Behavior

- `location /`: SPA fallback to `/index.html`
- `location /api/`: proxy to `http://backend:8000/`
- Static assets under `/assets/` are cached aggressively

## Required Volumes and Mounts

- `vibro-db-data` -> `/var/lib/postgresql/data`
- `./init.sql` -> `/docker-entrypoint-initdb.d/01-init.sql`
- `./backend/data` -> backend `/app/data` and ML service `/app/backend_data`
- `./ml_service/models` -> ML service `/app/models`
- `./ml_service/data` -> ML service `/app/data`

## Configuration Validation Checklist

- Backend starts without missing env errors.
- Login and token refresh work.
- Backend can call ML service via configured URL.
- Database health check passes.
- PLC settings per machine are valid (OPC UA URL, FTP host, credentials, directory).
- If using multi-buffer collection, `TRACE_BUFFER_PLAN_JSON` matches real PLC buffers.
- Duplicate-channel guard policy is explicitly set for target environment (`warn`/`block`).

See also:

- [Deployment Guide](deployment-guide.md)
- [Troubleshooting](../troubleshooting/troubleshooting.md)
