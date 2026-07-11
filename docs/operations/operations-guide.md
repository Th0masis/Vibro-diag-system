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

## Security Operations

- Rotate secrets regularly
- Restrict access to backend, ML, and DB ports
- Periodically review and re-run security audit controls

See [Security Audit Report](SECURITY_AUDIT_REPORT_2026-07-11.md).

## Related Docs

- [Deployment Guide](../deployment/deployment-guide.md)
- [Configuration Reference](../deployment/configuration-reference.md)
- [Troubleshooting](../troubleshooting/troubleshooting.md)
