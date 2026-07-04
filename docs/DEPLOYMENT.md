# Deployment Guide

## Quick Start (Recommended)

### Docker Compose (All-in-One)

```bash
cd Vibro-diag-system
docker-compose up
```

**That's it!** All services start automatically:
- Frontend: `http://localhost`
- Backend: `http://localhost:8000/docs`
- ML Service: `http://localhost:8001/docs`
- Database: PostgreSQL on `:5432`

### Services

| Service | Port | Status |
|---------|------|--------|
| Nginx (Frontend) | 80 | ✅ Ready |
| FastAPI (Backend) | 8000 | ✅ Ready |
| FastAPI (ML Service) | 8001 | ✅ Ready |
| PostgreSQL 15 + TimescaleDB | 5432 | ✅ Ready |

---

## Environment Configuration

### Docker Compose (Automatic)

All variables are pre-configured in `docker-compose.yml`:

```yaml
db:
  environment:
    POSTGRES_USER: vibro_user
    POSTGRES_PASSWORD: vibro_password
    POSTGRES_DB: vibro_diag

backend:
  environment:
    DATABASE_URL: postgresql://vibro_user:vibro_password@db:5432/vibro_diag
    SECRET_KEY: your-secret-key-change-in-production
    ALGORITHM: HS256
    ACCESS_TOKEN_EXPIRE_MINUTES: 30
    PYTHONUNBUFFERED: 1
```

**For Production**: Change `SECRET_KEY` to a secure random value.

### Customization

Edit `docker-compose.yml` to:
- Change ports (e.g., `80:8000` for frontend on port 8000)
- Change database credentials
- Add environment variables
- Mount custom volumes

---

## Database

### Automatic Initialization

`init.sql` runs automatically on first `docker-compose up`:
- Creates all tables (users, machines, sensors, measurements)
- Creates TimescaleDB hypertables for time-series compression
- Creates required PostgreSQL types (status_type, severity_type)
- Inserts sample data

### Manual Database Access

```bash
# Connect to PostgreSQL
docker-compose exec db psql -U vibro_user -d vibro_diag

# Run SQL query
docker-compose exec db psql -U vibro_user -d vibro_diag -c "SELECT COUNT(*) FROM measurements;"

# Backup database
docker-compose exec db pg_dump -U vibro_user vibro_diag > backup.sql

# Restore database
cat backup.sql | docker-compose exec -T db psql -U vibro_user -d vibro_diag
```

---

## Production Deployment

### 1. SSL/HTTPS Setup

Update `frontend/nginx.conf`:

```nginx
server {
    listen 443 ssl http2;
    ssl_certificate /etc/nginx/certs/certificate.crt;
    ssl_certificate_key /etc/nginx/certs/private.key;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Add certificates to docker-compose:

```yaml
volumes:
  - ./certs:/etc/nginx/certs
```

### 2. Secure Backend

Update `docker-compose.yml`:

```yaml
backend:
  environment:
    SECRET_KEY: $(openssl rand -hex 32)  # Generate secure key
    DATABASE_URL: postgresql://vibro_user:secure_password@db:5432/vibro_diag
```

### 3. Database Persistence

Ensure volume is persisted:

```yaml
volumes:
  vibro-db-data:
    driver: local
```

Data survives container restarts.

### 4. Resource Limits

Constrain services to prevent resource exhaustion:

```yaml
backend:
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 2G
      reservations:
        cpus: '1'
        memory: 1G
```

### 5. Health Checks

All services include health checks:

```yaml
db:
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U vibro_user"]
    interval: 10s
    timeout: 5s
    retries: 5
```

---

## Scaling

### Run Multiple Backend Instances

Use `docker-compose.override.yml`:

```yaml
version: '3.8'
services:
  backend:
    deploy:
      replicas: 3
  
  backend-lb:
    image: nginx:latest
    ports:
      - "8000:80"
    volumes:
      - ./nginx-lb.conf:/etc/nginx/nginx.conf
```

### Load Balancer Config

`nginx-lb.conf`:

```nginx
upstream backend {
    server backend:8000;
    server backend:8000;
    server backend:8000;
}

server {
    listen 80;
    location / {
        proxy_pass http://backend;
    }
}
```

---

## Monitoring

### Logs

```bash
docker-compose logs -f              # All services
docker-compose logs -f backend      # Backend only
docker-compose logs backend --tail 50
```

### Container Status

```bash
docker-compose ps
docker-compose stats
```

### Database Metrics

```bash
docker-compose exec db psql -U vibro_user -d vibro_diag -c "
  SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) 
  FROM pg_tables 
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
```

---

## Troubleshooting

### Container Won't Start

```bash
docker-compose logs backend  # Check error logs
docker-compose down -v       # Remove and restart fresh
docker-compose up
```

### Database Connection Error

```bash
# Verify database is running
docker-compose ps

# Test connection
docker-compose exec backend python -c \
  "import psycopg2; psycopg2.connect('postgresql://vibro_user:vibro_password@db:5432/vibro_diag')"
```

### Frontend Not Serving React Routes

Verify `nginx.conf` has SPA fallback:

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

Rebuild frontend image:

```bash
docker-compose up --build frontend
```

### Out of Memory

Increase Docker Desktop allocation:
- Docker Desktop Settings → Resources → Memory (e.g., 4GB)

Or limit containers in `docker-compose.yml`.

---

## Maintenance

### Backup

```bash
# Database backup
docker-compose exec db pg_dump -U vibro_user vibro_diag > backup-$(date +%Y%m%d).sql

# Full backup (including models)
tar -czf backup-$(date +%Y%m%d).tar.gz \
  docker-compose.yml \
  backend/ \
  frontend/ \
  ml_service/ \
  backup-*.sql
```

### Updates

```bash
# Pull latest code
git pull

# Rebuild images
docker-compose build

# Restart services
docker-compose up -d
```

### Clean Up

```bash
# Remove stopped containers
docker container prune

# Remove unused images
docker image prune

# Remove unused volumes
docker volume prune
```

---

## Kubernetes Deployment (Advanced)

Generate Kubernetes manifests from docker-compose:

```bash
kompose convert -f docker-compose.yml -o k8s/
kubectl apply -f k8s/
```

See [k8s/README.md](../k8s/README.md) for full Kubernetes setup.

---

**Last Updated**: 2026-07-05  
**Docker Compose Version**: 3.8+

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
