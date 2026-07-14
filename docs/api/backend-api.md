<!-- markdownlint-disable MD022 MD032 -->

# Backend API Reference

Base URL:

- In Docker deployment: `http://localhost:8000`
- Frontend access path: `/api`

Auth:

- Most endpoints require `Authorization: Bearer <token>`.
- Login uses OAuth2 password form (`application/x-www-form-urlencoded`).

## Authentication

### POST /login

- Description: Authenticate user and issue JWT.
- Auth required: No
- Request body: form fields `username`, `password`
- Success response:

```json
{
  "access_token": "<jwt>",
  "token_type": "bearer",
  "role": "admin"
}
```

- Error codes: `401`

### POST /auth/refresh

- Description: Refresh existing valid JWT.
- Auth required: Yes
- Success response: same shape as `/login`
- Error codes: `401`

## Users

### GET /users
- Description: List users.
- Auth required: Yes

### POST /users
- Description: Create user.
- Auth required: Yes
- Request JSON example:

```json
{
  "username": "operator1",
  "password": "change-me",
  "email": "operator1@example.com",
  "role": "operator"
}
```

### PUT /users/{user_id}
- Description: Update user email/role/password.
- Auth required: Yes

### DELETE /users/{user_id}
- Description: Delete user.
- Auth required: Yes (`admin` expected by implementation)

## Sensors

### GET /sensors
- Description: List all sensors.
- Auth required: Yes

### POST /sensors
- Description: Register sensor.
- Auth required: Yes (`admin` expected)
- Request JSON fields now include:
  - `module_path` for CM4810 module routing
  - `channel_no` for strict channel binding on the machine

### PUT /sensors/{sensor_id}
- Description: Update sensor configuration and assignment.
- Auth required: Yes (`admin` expected)

### DELETE /sensors/{sensor_id}
- Description: Delete sensor.
- Auth required: Yes (`admin` expected)

### GET /sensors/available
- Description: List unassigned sensors.
- Auth required: Yes

## Machines

### GET /machines
- Description: List machines with latest note metadata.
- Auth required: Yes

### POST /machines
- Description: Create machine.
- Auth required: Yes (`admin` expected)

### GET /machines/{machine_id}
- Description: Get machine detail, sensors, and last note.
- Auth required: Yes

### GET /machines/{machine_id}/measurements
- Description: Read machine measurement summary rows.
- Auth required: Yes

### GET /machines/{machine_id}/history
- Description: Combined recent history from `feature_data` and `measurements`.
- Auth required: Yes

### POST /machines/{machine_id}/simulate
- Description: Insert synthetic measurement/feature data for testing.
- Auth required: Yes

## Machine Settings and Connectivity

### GET /machines/{machine_id}/settings
- Description: Get OPC UA + FTP machine settings.
- Auth required: Yes

### PUT /machines/{machine_id}/settings
- Description: Update OPC UA + FTP machine settings and collection toggle.
- Auth required: Yes (`admin` or `operator` expected)

### GET /machines/{machine_id}/alert-policy
- Description: Get machine operating mode + anomaly threshold policy.
- Auth required: Yes

### PUT /machines/{machine_id}/alert-policy
- Description: Update operating mode thresholds, consecutive anomaly limit, and cooldown.
- Auth required: Yes (`admin` or `operator` expected)

### POST /machines/{machine_id}/test-connection?type=opc|ftp
- Description: Connectivity test for OPC UA or FTP.
- Auth required: Yes (`admin` or `operator` expected)

Request body examples:

OPC:

```json
{ "url": "opc.tcp://192.168.1.10:4840" }
```

FTP:

```json
{
  "host": "192.168.1.10",
  "username": "anonymous",
  "password": "",
  "directory": "/C:/BufferData/"
}
```

## Service Notes

### GET /machines/{machine_id}/notes
- Description: List machine service notes.
- Auth required: Yes

### POST /machines/{machine_id}/notes
- Description: Add service note.
- Auth required: Yes
- Request JSON:

```json
{ "content": "Bearing replaced", "severity": "WARNING" }
```

### DELETE /machines/{machine_id}/notes/{note_id}
- Description: Delete service note.
- Auth required: Yes

## Measurements and Visual Data

### POST /measurements
- Description: Register measurement record (raw data path).
- Auth required: Yes (`admin` or `operator` expected)

### POST /measurements/{id_measurement}/process
- Description: Ask ML service to extract features and persist into `measurements`.
- Auth required: Yes (`admin` or `operator` expected)

### GET /measurements/{id_measurement}/features
- Description: Return full `measurements` row.
- Auth required: No explicit dependency in code

### GET /measurements/{id_measurement}/raw
- Description: Return downsampled raw signal via ML service.
- Auth required: No explicit dependency in code

### GET /measurements/{id_measurement}/fft
- Description: Return FFT plot data via ML service.
- Auth required: No explicit dependency in code

### GET /measurements/{id_measurement}/cwt
- Description: Return CWT image (base64 data URI) via ML service.
- Auth required: No explicit dependency in code

## AI Inference and Model Management

### POST /machines/{machine_id}/analyze-anomaly
- Description: Run anomaly detection on latest machine measurement.
- Auth required: Yes

### POST /machines/{machine_id}/classify-fault
- Description: Run fault classification on latest machine measurement.
- Auth required: Yes

### POST /machines/{machine_id}/predict-rul
- Description: Run RUL prediction from latest feature windows.
- Auth required: Yes

### GET /machines/{machine_id}/latest-ai
- Description: Get latest anomaly/fault/RUL outputs.
- Auth required: Yes

### GET /ml-models
- Description: List model catalog and status.
- Auth required: Yes (`admin` or `operator` expected)

### POST /models/{model_id}/fine-tune
- Description: Start asynchronous fine-tuning from selected segments.
- Auth required: Yes

### PUT /models/{model_id}/activate
- Description: Activate selected model version and request ML reload.
- Auth required: Yes

### GET /training-segments
- Description: Query segment candidates for model training.
- Auth required: Yes
- Query params:
  - `machine_id` (optional)
  - `sensor_id` (optional)
  - `datetime_from` (optional)
  - `datetime_to` (optional)

### POST /models/sync-active
- Description: Internal endpoint used by ML service at startup.
- Auth required: No

### POST /webhook/training-done/{model_id}
- Description: Internal callback used by ML service to complete training status.
- Auth required: No

## Data Collection

### POST /machines/{machine_id}/collect-now?run_ai=true|false
- Description: Trigger immediate PLC collection for machine; optionally run AI chain.
- Auth required: Yes (`admin` or `operator` expected)
- Notes:
  - Manual collection now supports configurable multi-buffer plan through `TRACE_BUFFER_PLAN_JSON`.
  - Duplicate raw payload across channels triggers guard (`duplicate_channel_groups`) and blocks optional AI chain.

### GET /machines/{machine_id}/buffer-jobs/recent?limit=30
- Description: Read recent buffer download jobs for queue/state visualization.
- Auth required: Yes
- Query params:
  - `limit` (optional, default 30, max 200)

## Generic and Legacy

### GET /
- Description: backend liveness message.
- Auth required: No

### GET /history
- Description: Legacy global history endpoint.
- Auth required: Yes

## Error Handling

Common response shape from FastAPI exceptions:

```json
{ "detail": "Error message" }
```

Common HTTP status codes:

- `400` validation or input error
- `401` authentication/token error
- `403` authorization/role error
- `404` entity not found
- `500` internal error

## Related Docs

- [ML Service API](ml-service-api.md)
- [Configuration Reference](../deployment/configuration-reference.md)
- [Troubleshooting](../troubleshooting/troubleshooting.md)
