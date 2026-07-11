# Installation Guide (Developers)

## Prerequisites

- Git
- Docker Desktop 4.x+ (or Docker Engine + Compose plugin)
- At least 8 GB RAM recommended for local ML workloads

Optional for local non-container debugging:
- Python 3.11
- Node.js 22

## Clone and Start

```bash
git clone <repository-url>
cd Vibro-diag-system
docker compose up --build
```

The first startup initializes the database using `init.sql`.

## Verify Installation

- Frontend: http://localhost
- Backend Swagger: http://localhost:8000/docs
- ML Service Swagger: http://localhost:8001/docs

Health checks:

```bash
docker compose ps
docker compose logs -f backend
docker compose exec db psql -U vibro_user -d vibro_diag -c "SELECT now();"
```

## Local Development (without Docker)

### Backend

```bash
cd backend
python -m venv .venv
# Windows
.\.venv\Scripts\activate
pip install -r requirements.txt
set SECRET_KEY=dev-secret
set ALGORITHM=HS256
set ACCESS_TOKEN_EXPIRE_MINUTES=30
set DATABASE_URL=postgresql://vibro_user:vibro_password@localhost:5432/vibro_diag
set ML_SERVICE_URL=http://localhost:8001
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### ML Service

```bash
cd ml_service
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
set BACKEND_URL=http://localhost:8000
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

To point frontend dev server to backend, use:

```bash
set VITE_API_URL=http://localhost:8000
npm run dev
```

## Common Installation Issues

- Database not ready yet: wait until db health check passes.
- Backend exits on startup: verify `SECRET_KEY`, `ALGORITHM`, and `ACCESS_TOKEN_EXPIRE_MINUTES` are set.
- Frontend cannot authenticate: confirm `axios` base URL and backend port reachability.

See [Troubleshooting](../troubleshooting/troubleshooting.md).
