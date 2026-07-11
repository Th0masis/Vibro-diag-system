<!-- markdownlint-disable MD029 MD032 -->

# Operator Runbook

Date: 2026-07-11
Scope: Day-to-day operating procedures for PulseGuard runtime, diagnostics, and issue handling.

## 1. Shift Start Procedure

1. Open the dashboard URL.
2. Sign in with operator or admin account.
3. Check `Fault` and `Warning` counters.
4. Open each faulted machine card and review:
- latest anomaly score
- fault class and confidence
- RUL estimate
5. Confirm no critical services are down (`frontend`, `backend`, `ml_service`, `db`).

Reference UI pages:
- Dashboard: `http://localhost/`
- Machines: `http://localhost/machines`
- Sensors: `http://localhost/sensors`
- AI Models: `http://localhost/ml-sector`

## 2. Routine Monitoring

Every monitoring interval:

1. Dashboard:
- Check fleet trend and high-risk cards.
2. Machines:
- Open impacted machine and inspect history.
3. Sensors:
- Confirm sensors are active and assigned.
4. AI Models:
- Ensure required model versions remain active.

## 3. Manual Collection and AI Pipeline

Use this when automatic collection is delayed or after maintenance intervention.

1. Open machine detail.
2. Go to AI Analysis tab.
3. Run `Manual Collection + AI` pipeline.
4. Wait for completion and validate outputs:
- anomaly result
- fault class and confidence
- RUL estimate
5. Add a service note describing what was done and observed.

## 4. Service Notes Standard

When adding a note, include:

1. What changed (part replaced, inspection, recalibration).
2. Why action was taken (alarm, threshold breach, visual symptom).
3. Result (improved/still unstable/needs escalation).
4. Follow-up date and owner.

Severity guidance:
- `INFO`: normal maintenance update
- `WARNING`: non-critical anomaly requiring follow-up
- `CRITICAL`: active fault or near-failure risk

## 5. Alarm and Escalation Rules

Escalate to maintenance lead immediately when one or more is true:

- Machine status is `FAULT`.
- Fault class confidence is high and persistent across reruns.
- RUL estimate is at or below emergency threshold for your site policy.
- Sensor mapping is invalid and cannot be corrected quickly.

Escalation bundle should include:
- machine id and name
- screenshot of latest machine AI status
- last two service notes
- latest manual run result timestamp

## 6. Shift End Procedure

1. Ensure all critical notes are logged.
2. Confirm all unresolved faults are escalated.
3. Verify no training/deployment operation is left in unknown state.
4. Export or capture required shift evidence per site SOP.

## 7. Runtime Health Commands

Use from repository root.

```bash
docker compose ps
docker compose logs --tail 200 backend
docker compose logs --tail 200 ml_service
docker compose logs --tail 200 db
```

Quick DB check:

```bash
docker compose exec db psql -U vibro_user -d vibro_diag -c "SELECT now();"
```

## 8. Incident Playbooks

### 8.1 Login fails

1. Verify backend is running.
2. Check backend logs for auth errors.
3. Confirm user exists and role is valid.

### 8.2 No fresh AI output

1. Verify ML service availability.
2. Run manual collection + AI.
3. Check backend-to-ML connectivity and logs.

### 8.3 Sensor page shows wrong assignment

1. Confirm expected machine-sensor mapping.
2. Reassign sensor if authorized.
3. Record correction in service notes.

### 8.4 Model status unexpected

1. Open AI Models page.
2. Verify active model and training status.
3. If needed, switch to known-good active version and escalate.

## 9. Recovery and Restore (Admin)

Follow full procedure in deployment docs.

1. Restore database dump.
2. Restore `backend/data`.
3. Restore `ml_service/models`.
4. Restart stack and validate services.

## 10. References

- [Customer Quick Start](../deployment/customer-quick-start.md)
- [Operations Guide](operations-guide.md)
- [Troubleshooting](../troubleshooting/troubleshooting.md)
- [Deployment Guide](../deployment/deployment-guide.md)
