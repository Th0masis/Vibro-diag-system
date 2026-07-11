<!-- markdownlint-disable MD032 -->

# Customer Quick Start

This guide is for operators and customer admins who need to log in, review asset health, and run core diagnostics.

## Prerequisites

- Deployment is running and reachable at `http://localhost` (or your production URL).
- You have a valid user account.

## 1. Sign In

Use your assigned account on the login screen.

![Login Screen](../images/quickstart-01-login.png)

## 2. Review Fleet Status

Open Dashboard to check fleet summary and AI status cards.

![Dashboard](../images/quickstart-02-dashboard.png)

What to check first:
- `Fault` and `Warning` counters in the status summary.
- Cards with elevated anomaly, fault-class, or low RUL values.

## 3. Open Machine Inventory

Go to Machines to locate assets and open machine details.

![Machines Page](../images/quickstart-03-machines.png)

Actions:
- Find target machine by name and status.
- Open machine detail from the action button.

## 4. Verify Sensor Mapping

Go to Sensors and confirm each installed sensor is assigned and active.

![Sensors Page](../images/quickstart-04-sensors.png)

Checks:
- Assignment to the expected machine.
- `Active` state for live data capture.

## 5. Check Model Activation

Open AI Models to verify active production model versions.

![AI Models Page](../images/quickstart-05-ai-models.png)

Checks:
- Required model families are active: anomaly, fault, RUL.
- No model is stuck in failed state.

## 6. Confirm User Access

Open Team to validate operator/admin user accounts.

![Team Page](../images/quickstart-06-team.png)

Checks:
- Correct role assignments.
- Last login activity for active operators.

## First-Day Validation Checklist

- Sign in works.
- Dashboard loads with machine cards.
- Machines and Sensors pages show expected records.
- AI Models page lists active versions.
- Team roles are correct.

## Related Documents

- [Installation Guide](installation.md)
- [Deployment Guide](deployment-guide.md)
- [Troubleshooting](../troubleshooting/troubleshooting.md)
