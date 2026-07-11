# Architecture Overview

## System Summary

Vibro-diag System is a containerized predictive maintenance platform for vibration diagnostics. It consists of four services:

- Frontend: React SPA served by Nginx
- Backend: FastAPI service that manages users, machines, sensors, measurements, and orchestration
- ML Service: FastAPI inference and training service with PyTorch models
- Database: PostgreSQL 15 with TimescaleDB extension

## Container Architecture

```mermaid
flowchart LR
  User[User Browser] -->|HTTP 80| FE[Frontend Nginx + React]
  FE -->|/api| BE[Backend FastAPI :8000]
  BE -->|SQL| DB[(TimescaleDB :5432)]
  BE -->|HTTP| ML[ML Service FastAPI :8001]
  ML -->|startup sync + training webhook| BE
  BE -->|OPC UA + FTP| PLC[B&R PLC / CM4810]
```

## Request Flow

```mermaid
sequenceDiagram
  participant U as Browser
  participant FE as Frontend
  participant BE as Backend
  participant DB as TimescaleDB

  U->>FE: Open app
  FE->>BE: POST /login
  BE->>DB: Verify user + role
  DB-->>BE: User row
  BE-->>FE: JWT token
  FE->>BE: GET/POST API calls with Bearer token
  BE->>DB: Read/Write entities
  DB-->>BE: Data
  BE-->>FE: JSON response
```

## Authentication Flow

- Login endpoint: `POST /login`
- Token format: JWT bearer token
- Token refresh: `POST /auth/refresh`
- Frontend stores token in session storage and sends as `Authorization: Bearer <token>`

Notes:

- Authorization checks are role-dependent for some routes (`admin`, `operator`, `user`).
- Security hardening gaps are documented in [Security Audit Report](../operations/SECURITY_AUDIT_REPORT_2026-07-11.md).

## Data Collection and ML Flow

```mermaid
sequenceDiagram
  participant SCH as Backend Scheduler
  participant PLC as PLC OPC UA + FTP
  participant BE as Backend
  participant ML as ML Service
  participant DB as TimescaleDB

  SCH->>BE: Trigger every 4 hours (02,06,10,14,18,22 UTC)
  BE->>PLC: OPC UA trigger gTrace buffer export
  PLC-->>BE: CSV filename
  BE->>PLC: FTP download CSV
  BE->>DB: Insert measurements
  BE->>ML: process-features / analyze / classify / rul
  ML-->>BE: Inference/feature results
  BE->>DB: Update measurements + analysis_results + machine status
```

## Deployment Topology

- Default deployment is single-host Docker Compose.
- Frontend exposes port 80 to users.
- Backend exposes port 8000.
- ML Service exposes port 8001.
- Database exposes port 5432.
- Data persistence:
  - Database volume: `vibro-db-data`
  - Host-mounted raw and model folders for backend and ML services

See [Deployment Guide](../deployment/deployment-guide.md) and [Configuration Reference](../deployment/configuration-reference.md).
