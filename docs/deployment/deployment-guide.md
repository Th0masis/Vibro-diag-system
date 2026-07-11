# Deployment Guide (Customers and Admins)

## Supported Deployment Model

- Single-host Docker Compose deployment
- Linux or Windows host with Docker

## Minimum Recommended Host Resources

- CPU: 4 vCPU
- Memory: 8 GB RAM
- Storage: 50 GB SSD (more if long-term history and model training are enabled)

## Required Software

- Docker Engine 24+ or Docker Desktop 4+
- Docker Compose v2 (`docker compose`)

## Network and Ports

Default exposed ports:

- 80: Frontend
- 8000: Backend API
- 8001: ML Service API
- 5432: PostgreSQL/TimescaleDB

Production recommendation:
- Expose only 80/443 externally.
- Restrict 8000/8001/5432 to internal network.

## Deployment Steps

1. Prepare host and install Docker.
2. Clone repository and review [Configuration Reference](configuration-reference.md).
3. Set production secrets in compose or external secret store.
4. Start stack:

```bash
docker compose up -d --build
```

5. Validate services:

```bash
docker compose ps
docker compose logs --tail 200 backend
```

## Persistent Storage

- Database data: Docker volume `vibro-db-data`
- Raw signal files: host mount `./backend/data` (shared into ML service as `/app/backend_data`)
- Model files: host mount `./ml_service/models`

Back up all three data locations.

## Backup Procedure

### Database backup

```bash
docker compose exec db pg_dump -U vibro_user vibro_diag > vibro_diag_YYYYMMDD.sql
```

### File backups

- `backend/data/`
- `ml_service/models/`
- `docker-compose.yml` and custom config overrides

## Restore Procedure

1. Stop stack:

```bash
docker compose down
```

2. Restore database dump:

```bash
docker compose up -d db
cat vibro_diag_YYYYMMDD.sql | docker compose exec -T db psql -U vibro_user -d vibro_diag
```

3. Restore `backend/data` and `ml_service/models` from backup.
4. Start all services:

```bash
docker compose up -d
```

## Upgrade Procedure

1. Create database and file backups.
2. Pull new code revision.
3. Rebuild images:

```bash
docker compose build
```

4. Restart services:

```bash
docker compose up -d
```

5. Validate endpoints and logs.

## Security Recommendations

- Replace default credentials and JWT secret before production.
- Put TLS termination in front of frontend (reverse proxy or ingress).
- Restrict internal service ports with firewall rules.
- Rotate DB and PLC/FTP credentials regularly.
- Review [Security Audit Report](../operations/SECURITY_AUDIT_REPORT_2026-07-11.md) before go-live.

## Cross References

- [Installation Guide](installation.md)
- [Configuration Reference](configuration-reference.md)
- [Operations Guide](../operations/operations-guide.md)
- [Troubleshooting](../troubleshooting/troubleshooting.md)
