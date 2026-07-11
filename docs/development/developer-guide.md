# Developer Guide

## Repository Structure

- `frontend/`: React application, built and served by Nginx
- `backend/`: FastAPI API and PLC data collection orchestration
- `ml_service/`: FastAPI ML inference and training service
- `init.sql`: database schema bootstrap
- `docker-compose.yml`: local and single-host orchestration
- `Project/`: B&R Automation Studio project artifacts
- `docs/`: project documentation

## Build and Run

Primary workflow:

```bash
docker compose up --build
```

Development entry points:
- Backend: `uvicorn main:app --reload`
- ML service: `uvicorn main:app --reload`
- Frontend: `npm run dev`

## Coding and Contribution Conventions

- Keep service boundaries explicit (frontend <-> backend <-> ml_service).
- Treat backend as system orchestrator and single source for persistence.
- Prefer explicit SQL queries with parameterized statements.
- Keep API contract changes documented in [Backend API](../api/backend-api.md).
- Keep database changes documented in [Database Schema](../database/schema.md).

## Adding New Features

1. Define API contract and update docs first.
2. Implement backend endpoints.
3. Add frontend integration.
4. Add/adjust ML service endpoints if needed.
5. Update `docker-compose.yml` and config docs for new variables.
6. Run smoke tests through Swagger and UI.

## Testing and Validation

Current repository does not provide a consolidated automated test suite.

Recommended manual checks:
- Login and token refresh flow
- Machine list/detail rendering
- Sensor CRUD
- Manual collect + AI pipeline
- Model activation and reload flow

## Database Changes and Migrations

Current state:
- Initial schema is managed by `init.sql`.
- No versioned migration framework is present.

For production evolution:
- Introduce migration tooling and migration review process.

## Debugging Tips

- Tail backend logs: `docker compose logs -f backend`
- Tail ML logs: `docker compose logs -f ml_service`
- Check DB quickly: `docker compose exec db psql -U vibro_user -d vibro_diag`

## Release Notes and Versioning

Current repository does not include a formal release pipeline or changelog automation.

Recommended:
- Tag releases in git
- Keep deployment changes in dedicated release notes
- Validate database compatibility before rollout

## Related Docs

- [Installation Guide](../deployment/installation.md)
- [Configuration Reference](../deployment/configuration-reference.md)
- [Troubleshooting](../troubleshooting/troubleshooting.md)
