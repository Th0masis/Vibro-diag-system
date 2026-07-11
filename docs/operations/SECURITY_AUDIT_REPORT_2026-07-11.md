# Security Audit Report

Date: 2026-07-11
Scope: Full repository review of backend, frontend, ML service, Docker, SQL, documentation, and B&R project artifacts.
Method: Source-code security review aligned to OWASP Top 10 and production hardening best practices.

## Executive Summary

Overall security score: 24/100

Overall maturity: Low. The system currently resembles a development or research deployment more than a production-hardened Internet-facing platform. The highest-risk issues are broken authorization, exposed industrial credentials, unauthenticated internal services, weak transport security, and insufficient container isolation.

Top 10 issues:

1. Unauthenticated ML service with attacker-controlled file processing
2. Plaintext PLC and FTP secrets exposed through the backend API
3. Privilege escalation via unprotected user-management endpoints
4. Hardcoded and default credentials committed to the repository
5. Unauthenticated internal model-sync and training-webhook endpoints
6. SSRF exposure and disabled TLS validation in PLC connectivity testing
7. Anonymous PLC access and missing firewall rules in controller configuration
8. Weak Docker hardening and unnecessary host port exposure
9. Login enumeration and missing brute-force protection
10. Verbose error leakage and missing reverse-proxy security headers

## Scope Reviewed

Reviewed areas included:

- Backend API routes, authentication, authorization, database access, error handling, and integrations
- Frontend authentication flow, token handling, proxy setup, and deployment config
- ML service inference, training orchestration, model loading, and file handling
- Dockerfiles and docker-compose configuration
- Database schema and initialization logic in init.sql
- Environment configuration in committed .env files and docs
- B&R PLC project artifacts, including controller networking and access/security configuration
- Dependency manifests: requirements.txt, package.json, package-lock.json

Limitations:

- Live dependency CVE scanning was not possible in the current environment because npm and pip-audit were unavailable.
- Vendored dependencies under node_modules and generated PLC temp artifacts were not audited line-by-line, but project-authored files and repo-wide secret exposure were reviewed.

## Risk Rating Legend

- Critical: Immediate compromise or privilege escalation likely
- High: Serious exposure with realistic attack paths
- Medium: Important weakness that enables or simplifies attack chains
- Low: Defense-in-depth or limited-impact weakness
- Informational: Process or hygiene issue without direct exploit path

## Detailed Findings

### 1. Unauthenticated ML service endpoints accept attacker-controlled file paths

Severity: Critical

Location:

- ml_service/main.py:324
- ml_service/main.py:335
- ml_service/main.py:348
- ml_service/main.py:378
- ml_service/main.py:442
- docker-compose.yml:63
- ml_service/main.py:105

Explanation:

The ML service exposes unauthenticated endpoints that accept a caller-supplied path and then read files directly from the server filesystem using pandas. The service is also exposed on host port 8001 and configured with fully open CORS.

Attack scenario:

An attacker reaches the ML service directly and repeatedly submits paths to large or malformed files to cause CPU and memory exhaustion. If an accessible local file is parseable enough, the service may also leak raw measurement data through API responses.

Recommendation:

- Remove host exposure for the ML service
- Require backend-to-ML authentication
- Replace raw path parameters with measurement IDs resolved server-side
- Restrict file access to a fixed allowlisted data directory

Example fix:

```python
from pathlib import Path

DATA_ROOT = Path("/app/backend_data").resolve()

def resolve_measurement_path(relative_path: str) -> Path:
    candidate = (DATA_ROOT / relative_path).resolve()
    if not str(candidate).startswith(str(DATA_ROOT)):
        raise HTTPException(status_code=400, detail="Invalid file reference")
    return candidate
```

### 2. Any authenticated user can read stored PLC and FTP credentials

Severity: Critical

Location:

- backend/main.py:770
- backend/main.py:776
- backend/main.py:789
- init.sql:33

Explanation:

The machine settings endpoint is accessible to any authenticated user and returns FTP credentials, including the password. The password is also stored in plaintext in the database schema.

Attack scenario:

A low-privilege user logs in and fetches machine settings, learns PLC hostnames and credentials, then accesses the OT environment or tampers with collected measurement data.

Recommendation:

- Restrict settings retrieval to admin and operator roles only
- Never return stored passwords through the API
- Store secrets using a proper secret-management design, not plaintext columns

Example fix:

```python
@app.get("/machines/{machine_id}/settings")
def get_machine_settings(machine_id: int, role: str = Depends(get_current_user_role)):
    if role not in ["admin", "operator"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    ...
    return {
        "is_active_collection": bool(result[0]),
        "opc_ua": {"url": result[1] or ""},
        "ftp": {
            "host": result[2] or "",
            "username": result[3] or "",
            "password_configured": bool(result[4]),
            "directory": result[5] or ""
        }
    }
```

### 3. User-management APIs allow privilege escalation

Severity: Critical

Location:

- backend/main.py:347
- backend/main.py:368
- backend/main.py:394

Explanation:

Listing users, creating users, and updating users require only a valid bearer token. They do not enforce the admin role.

Attack scenario:

Any authenticated user creates a new admin account or changes a user role to admin, then takes over the system.

Recommendation:

- Enforce admin-only authorization on all user-management routes
- Validate allowed field updates server-side
- Reject role changes from non-admin actors

Example fix:

```python
def require_admin(role: str = Depends(get_current_user_role)):
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return role

@app.post("/users")
def create_user(user_data: UserCreate, _: str = Depends(require_admin)):
    ...
```

### 4. Hardcoded and default credentials are committed in multiple places

Severity: High

Location:

- docker-compose.yml:10
- docker-compose.yml:35
- docker-compose.yml:36
- ml_service/import_batch.py:14
- ml_service/import_batch.py:15
- Project/Physical/Config1/Hardware.hw:54
- Project/Physical/Config1/Hardware.hw:55
- init.sql:206

Explanation:

The repository contains database credentials, a JWT secret placeholder used in runtime config, hardcoded admin credentials in an import script, and embedded PLC FTP credentials in controller project artifacts.

Attack scenario:

Anyone with repository access, a leaked image, or copied deployment files can replay the same credentials against application and industrial components.

Recommendation:

- Rotate all exposed credentials immediately
- Remove secrets from source control
- Inject secrets only at deploy time
- Treat current values as compromised

### 5. Internal model-management routes are unauthenticated

Severity: High

Location:

- backend/main.py:1679
- backend/main.py:1691
- ml_service/main.py:442
- ml_service/main.py:63
- ml_service/main.py:74
- ml_service/main.py:84

Explanation:

The backend accepts unauthenticated training status callbacks and model sync requests. The ML service also loads model artifacts via torch.load, which relies on pickle semantics and should be treated as code execution on untrusted content.

Attack scenario:

An attacker triggers model state transitions, marks untrusted artifacts as ready, or abuses the model-loading trust chain to load malicious serialized content.

Recommendation:

- Require authenticated service-to-service requests for webhook and sync endpoints
- Restrict model files to trusted signed artifacts in an allowlisted directory
- Avoid unsafe deserialization patterns where possible

### 6. Connection testing and file collection enable SSRF and disable TLS validation

Severity: High

Location:

- backend/main.py:822
- backend/main.py:832
- backend/main.py:860
- backend/main.py:861
- backend/main.py:896
- backend/main.py:1750
- backend/main.py:1751
- backend/main.py:1786

Explanation:

The backend can be instructed to connect to arbitrary OPC UA and FTP endpoints. TLS hostname verification and certificate validation are disabled, weak cipher compatibility is allowed, and plain FTP is used as a fallback.

Attack scenario:

A compromised operator account uses the endpoint to scan internal networks or intercept credentials through a man-in-the-middle path.

Recommendation:

- Allowlist approved destination hosts per machine
- Enforce verified TLS only
- Remove plain FTP fallback from production code

### 7. PLC project permits anonymous access and lacks firewall rules

Severity: High

Location:

- Project/Physical/Config1/X20CP3586/AccessAndSecurity/UserRoleSystem/User.user:4
- Project/Physical/Config1/X20CP3586/AccessAndSecurity/UserRoleSystem/User.user:7
- Project/Physical/Config1/X20CP3586/AccessAndSecurity/Firewall/Rules.firewallRules:1

Explanation:

The controller configuration includes an Anonymous user mapped to Everyone, while the firewall rules configuration is effectively empty.

Attack scenario:

A network-adjacent attacker reaches PLC services and interacts under overly broad anonymous access.

Recommendation:

- Remove anonymous access
- Create named least-privilege service accounts
- Apply explicit controller firewall rules for required ports and trusted source addresses only

### 8. Docker hardening is weak and unnecessary services are exposed

Severity: High

Location:

- docker-compose.yml:6
- docker-compose.yml:16
- docker-compose.yml:41
- docker-compose.yml:50
- docker-compose.yml:63
- docker-compose.yml:73
- docker-compose.yml:83
- backend/Dockerfile:1
- ml_service/Dockerfile:1
- frontend/Dockerfile:2
- frontend/Dockerfile:10

Explanation:

Database, backend, and ML ports are all published to the host. Backend and ML services run with reload enabled. The DB image uses a floating latest-style tag. None of the runtime images drop root privileges with a USER directive.

Attack scenario:

A single service compromise has wider blast radius than necessary, and development-mode features remain enabled in environments that resemble production deployments.

Recommendation:

- Publish only the frontend to the host
- Keep DB and ML internal to the Docker network
- Remove reload mode from production
- Run containers as non-root
- Pin images more strictly
- Add restart policies, resource limits, and read-only filesystems where possible

### 9. Login flow leaks account validity and lacks brute-force protection

Severity: Medium

Location:

- backend/main.py:299
- backend/main.py:309
- backend/main.py:312

Explanation:

The login endpoint returns different errors for unknown usernames versus wrong passwords. No visible rate limiting or lockout controls are present.

Attack scenario:

An attacker enumerates valid usernames and performs targeted password spraying or brute-force attempts.

Recommendation:

- Return a single generic authentication failure message
- Add rate limiting and lockout protections
- Alert on repeated failures

### 10. Raw exception details are returned to clients

Severity: Medium

Location:

- backend/main.py:508
- backend/main.py:839
- backend/main.py:913
- backend/main.py:1030
- backend/main.py:1227
- backend/main.py:1242
- ml_service/main.py:235
- ml_service/main.py:282
- ml_service/main.py:322
- ml_service/main.py:333
- ml_service/main.py:346
- ml_service/main.py:376
- ml_service/main.py:412
- ml_service/main.py:450

Explanation:

Multiple handlers expose raw exception content back to the client. This leaks internal details about file paths, integration failures, and service behavior.

Attack scenario:

An attacker uses error messages to map internal services and refine exploit attempts.

Recommendation:

- Return generic client-facing errors
- Log detailed exceptions server-side only
- Standardize structured error handling

### 11. Reverse proxy lacks standard security headers

Severity: Medium

Location:

- frontend/nginx.conf:2
- frontend/nginx.conf:14
- frontend/nginx.conf:26

Explanation:

The Nginx configuration proxies API traffic but does not set a Content Security Policy, HSTS, X-Frame-Options, X-Content-Type-Options, or Referrer-Policy.

Attack scenario:

Browser-side defenses are weaker than they should be for a public deployment, increasing exposure to cross-origin and content-type confusion issues.

Recommendation:

- Add a restrictive CSP
- Add HSTS when HTTPS is in use
- Add frame, MIME-sniffing, and referrer protections

Example fix:

```nginx
add_header X-Content-Type-Options nosniff always;
add_header X-Frame-Options DENY always;
add_header Referrer-Policy no-referrer always;
add_header Content-Security-Policy "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self';" always;
```

### 12. Token handling still includes localStorage fallback in parts of the frontend

Severity: Low

Location:

- frontend/src/components/AiStatusBanner.jsx:27
- frontend/src/components/MachineCard.jsx:21
- frontend/src/components/MachineDiagnostics.jsx:23
- frontend/src/components/MeasurementDetailModal.jsx:26
- frontend/src/components/MeasurementsHistory.jsx:30
- frontend/src/components/ModelTrainingModal.jsx:36
- frontend/src/pages/UserManagement.jsx:100
- frontend/src/components/Login.jsx:31

Explanation:

The login flow stores tokens in sessionStorage, which is better than persistent localStorage, but several components still fall back to reading localStorage tokens.

Attack scenario:

If a future feature or developer script persists tokens in localStorage, XSS impact becomes more durable and easier to exploit.

Recommendation:

- Remove localStorage fallback entirely
- Prefer secure same-site cookies for session handling if architecture allows

### 13. CI/CD security controls are not visible in-repo

Severity: Informational

Location:

- No .github workflows or equivalent CI configuration found in the repository

Explanation:

No repository-local automation was present for SAST, dependency scanning, image scanning, secret scanning, or security policy enforcement.

Recommendation:

- Add automated security checks to the build pipeline
- Include secret scanning, dependency auditing, linting, tests, SAST, and image scanning

## OWASP Top 10 Coverage Summary

### Broken Access Control

- User-management routes lack admin-only enforcement
- Machine settings expose secrets to any authenticated user
- Internal endpoints trust network location rather than authenticated caller identity

### Cryptographic Failures

- Secrets stored in plaintext
- TLS verification disabled for FTP/TLS flows
- Weak transport fallback to plain FTP

### Injection

- Classic SQL injection risk is limited because most queries are parameterized
- Path injection risk is present in ML file-processing endpoints due to direct caller-controlled file paths
- SSRF risk exists in connection test flows

### Insecure Design

- Trust boundaries between backend and ML service are weak
- Model loading assumes trusted filesystem state without strong provenance controls

### Security Misconfiguration

- Open CORS on ML service
- Missing security headers in Nginx
- Development reload in exposed containers
- Published internal service ports
- Anonymous PLC access with no firewall rules

### Vulnerable and Outdated Components

- Live CVE validation could not be completed in the current environment
- Image pinning and dependency governance are insufficient

### Identification and Authentication Failures

- Login enumeration
- No visible brute-force controls
- Hardcoded credentials in scripts and config

### Software and Data Integrity Failures

- Unsafe trust in torch.load model artifacts
- Unauthenticated model state synchronization and webhook updates

### Security Logging and Monitoring Failures

- No visible audit logging for privilege changes or sensitive configuration access
- Internal exception detail reaches clients instead of controlled logs only

### Server-Side Request Forgery

- Backend test-connection endpoint can target arbitrary OPC UA and FTP destinations

## Dependency Review

Manifests reviewed:

- backend/requirements.txt
- ml_service/requirements.txt
- frontend/package.json
- frontend/package-lock.json

Observations:

- Dependency versions are largely pinned in Python requirements files, which is good for reproducibility
- The frontend uses npm install rather than npm ci in Docker build, which weakens deterministic builds
- Live advisory scanning was not possible in the current environment because npm was unavailable and pip-audit was not installed
- Container base images and application dependencies should still be checked in CI using automated scanners

Recommended follow-up commands in a fully provisioned environment:

```bash
npm audit --omit=dev
pip-audit -r backend/requirements.txt
pip-audit -r ml_service/requirements.txt
docker scout cves <image>
trivy fs .
```

## Positive Findings

- Passwords in the users table are hashed with bcrypt via Passlib rather than stored in plaintext
- JWT expiry is implemented and the frontend proactively refreshes tokens
- Most SQL access uses parameter binding rather than string concatenation
- The frontend uses a multi-stage Docker build
- The database service includes a health check
- Session storage is used in the main login flow rather than defaulting solely to localStorage

## Prioritized Remediation Plan

### Immediate (Critical)

1. Remove host exposure of the ML service and require authenticated backend-to-ML communication
   Effort: Medium
2. Fix authorization on user-management routes and machine settings retrieval
   Effort: Small
3. Stop returning FTP passwords from the backend and rotate all exposed credentials
   Effort: Medium
4. Disable anonymous PLC access and apply firewall restrictions on the controller
   Effort: Medium

### High Priority

1. Authenticate model webhook and sync endpoints
   Effort: Medium
2. Remove insecure TLS bypasses and plain FTP fallback from production paths
   Effort: Medium
3. Split development and production Docker configuration, remove reload, and run as non-root
   Effort: Medium
4. Add login throttling, account lockout, and audit logging for sensitive actions
   Effort: Medium

### Medium Priority

1. Replace raw dict request bodies with explicit Pydantic models and field validation
   Effort: Medium
2. Standardize generic client errors with server-side structured logging
   Effort: Small
3. Tighten CORS and add reverse-proxy security headers
   Effort: Small
4. Remove frontend localStorage token fallback and consider secure cookie-based auth
   Effort: Medium

### Nice to Have

1. Add CI/CD security gates for SAST, dependency scanning, image scanning, and secret scanning
   Effort: Medium
2. Add Compose resource limits, restart policies, and read-only filesystems
   Effort: Small
3. Improve model artifact trust and serialization safety
   Effort: Large

## Recommended Next Actions

1. Rotate all secrets currently committed in the repository
2. Fix the three critical authorization and exposure issues before any public deployment
3. Add a production-specific deployment profile with hardened Docker and reverse-proxy settings
4. Add automated security checks to the delivery pipeline
