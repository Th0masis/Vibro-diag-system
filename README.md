# Vibro-diag System | Predictive Maintenance Platform

[![Docker Compose](https://img.shields.io/badge/Docker%20Compose-Ready-blue.svg)](https://docs.docker.com/compose/)
[![React 18](https://img.shields.io/badge/Frontend-React%2018-61DAFB.svg)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg)](https://fastapi.tiangolo.com)
[![PyTorch](https://img.shields.io/badge/ML-PyTorch-EE4C2C.svg)](https://pytorch.org)
[![PostgreSQL](https://img.shields.io/badge/Database-TimescaleDB-336791.svg)](https://www.timescale.com)

A comprehensive **industrial predictive maintenance platform** for real-time vibration monitoring, fault detection, and remaining useful life (RUL) prediction on rotating machinery. Built with modern ML (PyTorch), containerized microservices (Docker Compose), and a professional React dashboard.

---

## 🎯 Project Goals

- **Early fault detection** on bearings, pumps, and rotating machinery
- **Automated fault classification** using deep learning (bearing defects, misalignment, imbalance)
- **RUL prediction** to schedule maintenance before failure
- **Condition-based maintenance** over fixed-interval schedules (cost & uptime savings)

---

## 📦 System Architecture

Microservices-based, fully containerized with Docker Compose:

### Services

| Service | Tech Stack | Purpose | Port |
|---------|-----------|---------|------|
| **Frontend** | React 18 + Vite + Nginx | Dashboard, machine monitoring, diagnostics | 80 |
| **Backend** | FastAPI + SQLAlchemy | REST API, auth, DB orchestration | 8000 |
| **ML Service** | FastAPI + PyTorch | Model inference, anomaly detection, RUL prediction | 8001 |
| **Database** | PostgreSQL 15 + TimescaleDB | Time-series & relational data storage | 5432 |

---

## 🧠 Machine Learning Models

The diagnostic pipeline uses three specialized neural networks:

1. **AE-AnoWGAN** — Autoencoder + GAN for anomaly detection from raw vibration signals
2. **1D-CNN** — Fault classifier (inner race, outer race, rolling element, healthy)
3. **Bi-LSTM** — Remaining useful life (RUL) predictor (days to failure)

---

## 🚀 Quick Start

### Prerequisites
- **Docker Desktop** (or Docker + Docker Compose)
- **Git**

### Deploy with Docker Compose

```bash
# Clone repository
git clone <repo-url>
cd Vibro-diag-system

# Start all services
docker-compose up

# Wait for database initialization (~15 seconds)
# Look for: "database system is ready to accept connections"
```

### Access the System

| Service | URL |
|---------|-----|
| Frontend Dashboard | http://localhost |
| Backend Swagger API | http://localhost:8000/docs |
| ML Service API | http://localhost:8001/docs |

### Stop Services

```bash
docker-compose down          # Stop containers
docker-compose down -v       # Also remove database volume
```

---

## 🔧 Configuration

Environment variables are pre-configured in `docker-compose.yml`:

```yaml
backend:
  environment:
    SECRET_KEY: "your-secret-key"
    ALGORITHM: "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: 30
    DATABASE_URL: "postgresql://vibro_user:vibro_password@db:5432/vibro_diag"
```

### Database Credentials
- **User**: `vibro_user`
- **Password**: `vibro_password`
- **Database**: `vibro_diag`

---

## 📁 Project Structure

```
├── backend/                 # FastAPI REST API
│   ├── main.py             # Route handlers, endpoints
│   ├── auth.py             # JWT authentication
│   ├── models.py           # SQLAlchemy ORM models
│   └── requirements.txt
│
├── frontend/               # React + Vite + Nginx
│   ├── src/
│   │   ├── App.jsx        # Root component
│   │   ├── pages/         # Page components
│   │   ├── components/    # Reusable UI components
│   ├── vite.config.js
│   ├── Dockerfile         # Multi-stage build
│   └── nginx.conf         # SPA routing config
│
├── ml_service/             # PyTorch ML models
│   ├── main.py            # Model service endpoints
│   ├── models.py          # Model definitions
│   ├── train_*.py         # Training scripts
│   └── models/            # Model checkpoints
│
├── docker-compose.yml      # Service orchestration
├── init.sql                # Database schema
└── docs/                   # Documentation
    ├── DEPLOYMENT.md
    ├── MODEL_TRAINING.md
    └── DESIGN.md
```

---

## 📊 API Endpoints

### Authentication
- `POST /auth/login` — User login
- `POST /auth/logout` — Logout

### Machines
- `GET /machines` — List machines
- `GET /machines/{id}` — Get machine details
- `POST /machines/{id}/notes` — Add service notes

### Diagnostics
- `POST /machines/{id}/analyze-anomaly` — Anomaly detection
- `POST /machines/{id}/classify-fault` — Fault classification
- `POST /machines/{id}/predict-rul` — RUL prediction

Full API docs: `http://localhost:8000/docs` (Swagger UI)

---

## 🛠️ Development

### Run Backend Locally

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

export SECRET_KEY="dev-key"
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Run Frontend Locally

```bash
cd frontend
npm install
npm run dev

# Runs on http://localhost:5173
```

### Build Frontend for Production

```bash
cd frontend
npm run build
# Output: dist/ folder
```

---

## 📚 Documentation

- **[DEPLOYMENT.md](docs/DEPLOYMENT.md)** — Production deployment, SSL setup
- **[MODEL_TRAINING.md](docs/MODEL_TRAINING.md)** — Training & fine-tuning models
- **[DESIGN.md](DESIGN.md)** — UI design system, tokens, typography

---

## 🧪 Testing

### Verify Services

```bash
# Frontend
curl http://localhost

# Backend
curl http://localhost:8000/docs

# Database
docker-compose exec db psql -U vibro_user -d vibro_diag -c "SELECT 1;"
```

### View Logs

```bash
docker-compose logs -f              # All services
docker-compose logs -f backend      # Backend only
docker-compose logs backend --tail 100
```

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| Database fails to start | Ensure Docker Compose v2.0+. Check `docker-compose.yml` version. |
| Backend can't connect to DB | Verify services are on same network: `docker network ls` |
| Frontend 404 on refresh | Nginx SPA routing should be enabled. Check `nginx.conf` is copied. |
| ML Service not responding | Check logs: `docker-compose logs ml_service` |
| Clear all and restart | `docker-compose down -v && docker-compose up` |

---

## 📝 License

[Add your license here]

## 👥 Team

Developed at **VUT BRNO** (Vysoké učení technické v Brně) in collaboration with **B&R Automation**.

---

**Last Updated**: 2026-07-05  
**Status**: ✅ Production-ready with Docker Compose

