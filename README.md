# Patient Waiting Time Tracker (LineLoom)

Full-stack app to track outpatient and inpatient waiting, consultation, care, and break times. It connects to your existing Hospital Information System (SQL Server, read-only) for patient and visit data, and stores queue tokens and timing only in MongoDB.
admin.apdch.edu.in
admission.apdch.edu.in
apdch.edu.in
api.apdch.edu.in
bio.apdch.edu.in
careers.apdch.edu.in
cis.apdch.edu.in
---
	PHP 7.4 [Outdated] (nf-php74)	
		PHP 7.4 [Outdated] (nf-php74)	
	apdch.com	PHP 7.4 [Outdated] (nf-php74)	
		PHP 7.4 [Outdated] (nf-php74)	
		PHP 7.4 [Outdated] (nf-php74)	
		PHP 7.4 [Outdated] (nf-php74)	
	biometric.apdch.com	PHP 7.4 [Outdated] (nf-php74)	
		PHP 7.4 [Outdated] (nf-php74)	
		PHP 7.4 [Outdated] (nf-php74)	
	
## How the system works (end-to-end workflow)

This section is the **conceptual map** of LineLoom: what happens from the moment a patient enters the flow through reporting, intelligence, and continuous improvement—not implementation detail.

### 1. Patient entry

Staff or intake touchpoints register the patient in context of the visit (outpatient or inpatient, department, reason for visit as applicable). The system ties the session to identifiers from the HIS where available so downstream steps stay consistent across hospital systems.

### 2. Timestamped data capture

Every meaningful transition is recorded with a **timestamp**: queue position, stage changes (waiting, consultation, care, breaks, completion), and other timing events your workflow defines. Captured events become the raw material for wait metrics and journey views.

### 3. Wait time calculation

From those timestamps, the platform derives **elapsed and stage-level wait times**: how long patients wait before each step, where bottlenecks appear, and how those durations compare over time and across units.

### 4. Journey mapping

Discrete events are assembled into a **patient journey**: an ordered path through stages, with durations and transitions. This makes operational reality visible—where people stall, skip steps, or repeat visits—so improvement is grounded in actual flow, not averages alone.

### 5. AI analysis

Machine learning and analytics layers consume journey and timing data (and relevant context you allow, such as load, staffing patterns, or seasonality) to detect **patterns, anomalies, and drivers** of delay—beyond what fixed dashboards alone would surface.

### 6. Insights and prediction

The AI layer produces **insights** (what is happening and why it likely matters) and **predictions** (e.g., emerging congestion, risk of SLA breach, expected wait under current conditions). These are the bridge from raw data to decisions.

### 7. Recommendations

Insights and predictions translate into **recommended actions**: operational tweaks, staffing hints, queue policy suggestions, or prioritization guidance—always subject to clinical and administrative judgment in your environment.

### 8. Dashboard and alerts

**Dashboards** summarize live and historical performance: queues, waits, throughput, and trends. **Alerts** surface exceptions or predicted problems so teams can respond before small issues become large ones.

### 9. Closed loop: act, measure, learn

Intelligence only matters if it **drives action**. When teams act on recommendations—reducing load, reallocating resources, or changing process—the system should see **updated timestamps and volumes** in the next cycle. That new data **re-trains or refreshes** models so predictions and recommendations stay aligned with real operations. The loop is: **insight → action → reduced load / updated operational data → model refresh → smarter insights**—continuous learning, not a one-off report.

---

## What this repo contains

- **Backend** — Node.js, Express, Mongoose; JWT auth; HIS reads via SQL Server; REST APIs for tokens, queue, and dashboard.
- **Frontend** — React, Vite, Axios; staff UI for login, patient list, token creation, live queue, token detail, and dashboard.
- **Docker** — MongoDB for local development (see docker-compose at the project root).
- **op_ip_patients** — Optional PHP utilities related to your HIS schema discovery; not required for the main MERN app.

**Documentation:** [Metric definitions](docs/METRICS.md) (how wait and TAT numbers are computed) and [deployment baseline](docs/DEPLOYMENT.md) (environments, secrets, operations).

---

## AI implementation status (current)

This project currently uses an **Explainable Causal Ops AI** approach (operational intelligence first), not an LLM-first system.

### What is implemented now

- **Causal attribution insight** on analytics:
  - what happened (delay shift),
  - who contributed most (department),
  - why (dominant stage driver),
  - confidence level,
  - recommended action.
- **Department contribution ranking** using stage-level deltas (waiting/consulting/treatment).
- **Rule-based alerting** from department thresholds (`alert_rules`) for:
  - queue depth,
  - waiting threshold,
  - lab stuck duration.
- **Real-time recommendation path**:
  - if active alerts exist, recommendations come from alert events,
  - if no active alerts exist, recommendations are generated from live queue pressure and current consult slowdown (not generic fallback text).
- **Operational action logging + intelligence endpoints** for closed-loop learning.

### What is optional

- **LLM integration is optional** and intended only for natural-language summarization. Core decision logic remains deterministic in backend services for reliability and auditability.

### Main AI-related endpoints

- `GET /journey/department-funnel` (includes AI insight payload + attribution data)
- `GET /alerts/recommendations` (alert-based or real-time recommendations)
- `GET /intelligence/summary`
- `GET /intelligence/forecast`
- `POST /intelligence/actions`
- `POST /intelligence/model-refresh`
- `GET /intelligence/model-version`

---

## Prerequisites

- Node.js (current LTS is fine).
- Docker Desktop or another Docker engine, if you run MongoDB via Compose.
- Network access to your SQL Server instance for HIS reads (credentials in backend environment).
- A MongoDB instance (local via Docker or your own URI).

---

## First-time setup workflow

1. **Clone the repository** and open the project root in your terminal.

2. **Start MongoDB**  
   From the project root, start the Compose service for MongoDB in detached mode, then confirm the container is running with your usual Docker commands.

3. **Backend environment**  
   Copy the backend environment example file to `.env` in the backend folder. Fill in MongoDB connection string, JWT secret, SQL Server host, database name, and read-only SQL credentials. Install backend dependencies, then start the API in development mode (watch mode restarts on file changes).

4. **Frontend environment**  
   Copy the frontend environment example to `.env` in the frontend folder. Point the API base URL at your running backend. Install frontend dependencies, then start the Vite dev server.

5. **Verify**  
   Open the frontend URL shown in the terminal (typically a localhost port). Confirm the backend health or a simple authenticated route responds. Register or log in as your seed or first user depending on your setup.

6. **Optional database seed**  
   If your project includes a seed script, run it from the backend folder only when you intend to reset or populate demo data.

---

## Day-to-day development workflow

1. Start Docker (if MongoDB runs in Compose), then bring MongoDB up if it is stopped.

2. Start the backend dev server in one terminal.

3. Start the frontend dev server in another terminal.

4. Work on features; the backend watcher reloads on save, and Vite hot-reloads the UI.

5. Before committing, run a production build of the frontend if your team expects it, and smoke-test critical flows (login, patient list, create token, advance token stages, dashboard).

---

## Stopping and cleanup

- Stop the frontend and backend with your terminal interrupt key when you are done.

- Stop MongoDB with Compose down, or leave it running if you prefer persistent data between sessions.

---

## Data and security rules

- **HIS (SQL Server)** is used **read-only**. Do not grant write permissions to the SQL account used by this app.

- **Application data** (users, tokens, time segments, department settings) lives in **MongoDB** only.

- HIS identifiers such as patient and visit IDs are referenced in MongoDB documents; they are not duplicated as the system of record.

---

## API surface (for orientation)

Authentication (register, login), HIS patient listing, token lifecycle (create, start waiting, consult, care, billing, lab, treatment, completion as implemented), live queue, token detail, **token journey** (`GET /tokens/:id/journey`), **department funnel** (`GET /journey/department-funnel`), dashboard summary, **alerts** (`GET /alerts`, `GET /alerts/recommendations`, `POST /alerts/:id/acknowledge`), and **intelligence** (`GET /intelligence/summary`, `GET /intelligence/forecast`, `POST /intelligence/actions`, `POST /intelligence/model-refresh`, `GET /intelligence/model-version`). Department admin APIs accept optional **alert_rules** thresholds. Exact payloads live in the route and controller files; add OpenAPI if you need a formal contract.

---

## Troubleshooting workflow

- If the API cannot connect to SQL Server, verify firewall, server name, port, encryption settings, and that the account can run the same read queries your HIS views use.

- If MongoDB connection fails, confirm the URI, that the container is healthy, and that nothing else is bound to the same port.

- If the frontend shows network errors, confirm the API base URL in the frontend environment matches where the backend listens and that CORS is acceptable for that origin.

---

## Related design assets

Static HTML and design notes under `stich ai` are reference mockups for UI direction; the production UI is the React app under `frontend`.
