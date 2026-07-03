# VibroDiag Deployment Guide

This document describes how to deploy the full VibroDiag stack:

- Frontend (React + Nginx)
- Backend API (FastAPI)
- ML service (FastAPI + PyTorch)
- Database (TimescaleDB/PostgreSQL)

## 1. Architecture and Ports

Recommended default ports:

- Frontend: 80 (container) or 5173 (dev server)
- Backend API: 8000
- ML service: 8001
- TimescaleDB: 5432

Runtime flow:

1. Frontend calls Backend using VITE_API_URL.
2. Backend calls ML service using ML_SERVICE_URL.
3. Backend writes and reads data from TimescaleDB.
4. ML service calls Backend on startup to sync active model paths.

## 2. Prerequisites

- Docker Desktop (recommended) or local Python + Node runtime
- Python 3.11 for backend and ML service (if running without Docker)
- Node.js 22 (matches frontend Dockerfile)
- Access to CSV measurement files used by backend and ML service

## 3. Environment Variables

### Backend required variables

Backend reads:

- SECRET_KEY
- ALGORITHM
- ACCESS_TOKEN_EXPIRE_MINUTES
- DATABASE_URL (default: postgresql://admin:secret@localhost:5432/vibro_diag)
- ML_SERVICE_URL (default: http://localhost:8001)
- BACKEND_URL (default: http://localhost:8000)

Create backend/.env:

```env
SECRET_KEY=replace_with_long_random_value
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=120
DATABASE_URL=postgresql://admin:secret@db:5432/vibro_diag
ML_SERVICE_URL=http://ml_service:8001
BACKEND_URL=http://backend:8000
```

### ML service variables

ML service reads:

- BACKEND_URL (default: http://localhost:8000)

Create ml_service/.env:

```env
BACKEND_URL=http://backend:8000
```

### Frontend variables

Already present:

- frontend/.env.development
- frontend/.env.production

Set VITE_API_URL to your backend address.

## 4. Database Deployment and Initialization

Use a TimescaleDB image, because init.sql executes CREATE EXTENSION timescaledb.

```powershell
docker network create vibro-net

docker run -d --name vibro-db --network vibro-net \
  -e POSTGRES_USER=admin \
  -e POSTGRES_PASSWORD=secret \
  -e POSTGRES_DB=vibro_diag \
  -p 5432:5432 \
  timescale/timescaledb:2.17.2-pg16
```

Initialize schema:

```powershell
docker cp init.sql vibro-db:/init.sql
docker exec -it vibro-db psql -U admin -d vibro_diag -f /init.sql
```

## 5. Deploy with Docker (Recommended)

From repository root:

### 5.1 Build images

```powershell
docker build -t vibro-backend ./backend
docker build -t vibro-ml ./ml_service
docker build -t vibro-frontend ./frontend
```

### 5.2 Run ML service

Mount local models so trained weights persist.

```powershell
docker run -d --name vibro-ml --network vibro-net \
  --env-file ml_service/.env \
  -v ${PWD}/ml_service/models:/app/models \
  -v ${PWD}/backend/data:/app/data \
  -p 8001:8001 \
  vibro-ml
```

### 5.3 Run backend

Mount backend data because scheduled data collection writes CSV files there.

```powershell
docker run -d --name vibro-backend --network vibro-net \
  --env-file backend/.env \
  -v ${PWD}/backend/data:/app/data \
  -p 8000:8000 \
  vibro-backend
```

### 5.4 Run frontend

```powershell
docker run -d --name vibro-frontend --network vibro-net \
  -p 8080:80 \
  vibro-frontend
```

Open:

- Frontend: http://localhost:8080
- Backend health: http://localhost:8000/
- ML health: http://localhost:8001/

## 6. Local Development (Without Docker)

### 6.1 Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 6.2 ML service

```powershell
cd ml_service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

### 6.3 Frontend

```powershell
cd frontend
npm install
npm run dev
```

## 7. First Login and Basic Validation

init.sql inserts an admin user:

- username: admin
- email: admin@vut.cz

Login through the frontend, then validate:

1. Dashboard loads.
2. Machines and Sensors pages return data.
3. ML Sector can load models from backend.

## 8. Production Checklist

- Replace default credentials and JWT secret.
- Restrict CORS in backend and ML service.
- Use HTTPS reverse proxy in front of backend/frontend.
- Store FTP credentials via secret manager, not plain DB text.
- Backup volumes for:
  - db data
  - backend/data
  - ml_service/models

## 9. Troubleshooting

### Backend starts but login fails

- Verify backend/.env values for SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES.
- Confirm users table exists and contains admin user.

### Backend cannot reach ML service

- Check ML_SERVICE_URL.
- Verify both containers share the same Docker network.

### ML service cannot load models at startup

- It calls BACKEND_URL/models/sync-active.
- Ensure backend is reachable from ml_service and DB has ml_models rows.

### Database errors about timescaledb extension

- Ensure you are using a TimescaleDB image, not plain postgres.
