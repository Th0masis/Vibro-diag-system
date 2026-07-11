---
marp: true
paginate: true
theme: default
---

<!-- markdownlint-disable MD032 -->

# PulseGuard Operator Runbook

Date: 2026-07-11

Use this PDF for shift operations, incident response, and escalation handoff.

---

## Shift Start

1. Sign in to dashboard.
2. Check `Fault` and `Warning` counts.
3. Open each faulted machine card.
4. Review anomaly, fault class, and RUL.
5. Confirm all core services are healthy.

---

## Routine Monitoring

- Dashboard: fleet status and high-risk cards.
- Machines: inspect detail and history.
- Sensors: verify assignments and active status.
- AI Models: verify active production models.

Escalate early on repeated fault conditions.

---

## Manual Collection + AI

Run when automatic collection is delayed or after maintenance:

1. Open machine detail.
2. Go to AI Analysis.
3. Run Manual Collection + AI.
4. Validate anomaly, fault class, and RUL outputs.
5. Record a service note.

---

## Service Note Standard

Every note should include:

1. Action performed.
2. Reason for action.
3. Result and current risk.
4. Next follow-up owner and date.

Severity:
- INFO
- WARNING
- CRITICAL

---

## Escalation Criteria

Escalate immediately if:

- Machine status is `FAULT`.
- High-confidence fault persists.
- RUL is at or below site emergency threshold.
- Sensor mapping is invalid and unresolved.

Include machine id, timestamp, and screenshot evidence.

---

## Shift End

1. Ensure all critical notes are logged.
2. Ensure unresolved faults are escalated.
3. Verify model/training states are known.
4. Attach evidence package per site SOP.

---

## Runtime Commands

```bash
docker compose ps
docker compose logs --tail 200 backend
docker compose logs --tail 200 ml_service
docker compose logs --tail 200 db
docker compose exec db psql -U vibro_user -d vibro_diag -c "SELECT now();"
```

---

## Incident Playbooks

- Login failure: check backend health and auth logs.
- No new AI output: check ML service and rerun manual pipeline.
- Sensor mismatch: correct assignment and log note.
- Model issue: switch to known-good active model and escalate.

---

## Reference Docs

- docs/deployment/customer-quick-start.md
- docs/operations/operator-runbook.md
- docs/operations/operations-guide.md
- docs/troubleshooting/troubleshooting.md
