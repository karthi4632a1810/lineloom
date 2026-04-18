# Deployment baseline (LineLoom)

Guidance for running the Patient Waiting Time Tracker in a non-developer environment: separation of config, secrets, databases, and process layout.

## Components

| Layer | Role |
|--------|------|
| **API** | Node.js Express app ([backend/server.js](../backend/server.js)) |
| **MongoDB** | Application data: users, tokens, time tracking, departments, alerts, intelligence logs |
| **SQL Server** | Read-only HIS access for patient/visit listing |
| **Frontend** | Static build from Vite ([frontend](../frontend)); served by CDN, object storage, or reverse proxy |

## Environment separation

- Use **distinct** `.env` (or injected secrets) per environment: `development`, `staging`, `production`.
- **Never** reuse production JWT secrets or Mongo credentials in staging.
- Point **frontend** `VITE_*` API base URL at the correct API host per environment.

## Secrets

- **JWT secret**: Long random string; rotate if leaked.
- **MongoDB URI**: Include auth; restrict network access (VPC, firewall, IP allowlist).
- **SQL Server**: Dedicated **read-only** login; TLS as required by your hospital policy ([README](../README.md) data rules).

## MongoDB operations

- Enable **backups** (snapshot or `mongodump` schedule) with retention aligned to policy.
- Index usage: tokens and time tracking are queried by `token_id`, `created_at`, and department filters—monitor slow queries after scale-up.

## API process

- Run under a **process manager** (systemd, PM2, Kubernetes) with restart on failure.
- Expose **health**: `GET /health` for load balancer checks.
- Place **HTTPS** termination at reverse proxy or ingress; keep Node behind private network where possible.

## Frontend

- Build: `npm run build` in `frontend/`; deploy the `dist/` output.
- Configure **CORS** on the API for the exact production origin(s).

## HIS connectivity

- Ensure stable network path from API hosts to SQL Server; document firewall rules and failover expectations.
- Version or snapshot **SQL view/query** dependencies so HIS upgrades can be regression-tested.

## Compliance reminder

HIS data and application logs may contain identifiers subject to hospital policy. Restrict log verbosity in production and avoid sending PHI to third-party services without review.
