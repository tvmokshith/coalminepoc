# Astrikos — Coal Mining Intelligence Platform

Enterprise-grade coal mining intelligence platform with real-time monitoring, 3D digital twin, AI advisory, and multi-mine operations management across India.

## Architecture

```
coalminepoc/
├── backend/                  # FastAPI (Python)
│   ├── app/
│   │   ├── main.py           # App entry point
│   │   ├── config.py         # Configuration
│   │   ├── auth.py           # JWT auth + RBAC
│   │   ├── models.py         # Pydantic schemas
│   │   ├── state.py          # In-memory data store (5 mines, 105 equipment)
│   │   ├── data_engine.py    # Synthetic data engine (3s interval)
│   │   ├── ai_engine.py      # AI advisory generation
│   │   ├── ws_manager.py     # WebSocket manager
│   │   └── routes/           # API route modules
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                 # Next.js 14 (App Router)
│   ├── src/
│   │   ├── app/              # Pages (dashboard, mines, digital-twin, advisory, subsystems, kpi)
│   │   ├── components/       # Layout (Sidebar, TopBar, DashboardLayout)
│   │   ├── hooks/            # useWebSocket
│   │   ├── services/         # API client (Axios)
│   │   ├── store/            # Zustand auth store
│   │   └── types/            # TypeScript interfaces
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## Quick Start

### Backend

```bash
cd backend
pip install -r requirements.txt
python -m app.main
```

Backend runs at **http://localhost:8000**. API docs at **/docs**.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at **http://localhost:3000**.

### Docker

```bash
docker-compose up --build
```

## Test Accounts

| Role           | Email                          | Password   | Access          |
|----------------|--------------------------------|------------|-----------------|
| CEO            | ceo@astrikos.com               | password   | All mines       |
| Ops Head       | opshead@astrikos.com           | password   | All mines       |
| Mine Manager   | manager_mine1@astrikos.com     | password   | Gevra only      |
| Mine Manager   | manager_mine2@astrikos.com     | password   | Kusmunda only   |
| Field Engineer | engineer1@astrikos.com         | password   | Gevra only      |
| Field Engineer | engineer2@astrikos.com         | password   | Kusmunda only   |

## Mines

| Mine                       | Location        | Capacity   |
|----------------------------|-----------------|------------|
| Gevra Open Cast Mine       | Chhattisgarh    | 55 MTPA    |
| Kusmunda Open Cast Mine    | Chhattisgarh    | 52 MTPA    |
| Jayant Open Cast Mine      | Madhya Pradesh  | 30 MTPA    |
| Nigahi Open Cast Mine      | Madhya Pradesh  | 20 MTPA    |
| Rajmahal Open Cast Mine    | Jharkhand       | 22 MTPA    |

## KPIs (10 metrics with Green / Amber / Red thresholds)

Production Rate (TPH), Equipment Utilization (%), Downtime (%), Stripping Ratio, Dispatch Efficiency (%), Wagon Availability (%), Cost Per Tonne (INR), CO₂ Emissions (TPD), Attendance (%), Safety Score.

## Subsystems

- **Mining Operations** — Production, equipment utilization, operational scenarios
- **Logistics** — Dispatch, wagon availability, stockpile, turnaround time
- **HR & Workforce** — Attendance, productivity, fatigue risk, training
- **Finance** — Cost per tonne, revenue, EBITDA, cost breakdown
- **ESG** — CO₂ emissions, water usage, dust levels, compliance score
- **EHS / Safety** — Safety score, incident rate, near misses, hazard alerts

## Key Features

- **Real-time streaming** — WebSocket pushes KPI updates, alerts, and advisories every 3 seconds
- **3D Digital Twin** — React Three Fiber scene with open-pit terrain, excavators, dump trucks, conveyors, stockpiles
- **AI Advisory** — Root cause analysis with confidence scores, impact assessment, and actionable recommendations
- **RBAC** — Backend-enforced role access (CEO sees all, mine managers see their mine only)
- **Dark theme** — Professional coal-mining themed UI with status-coded KPI tiles

## API Endpoints

| Method | Path                          | Description              |
|--------|-------------------------------|--------------------------|
| POST   | /api/auth/login               | JWT login                |
| GET    | /api/auth/me                  | Current user info        |
| GET    | /api/mines                    | List mines (RBAC)        |
| GET    | /api/mines/{id}               | Mine detail              |
| GET    | /api/kpi/definitions          | KPI definitions          |
| GET    | /api/kpi/current              | Current KPI values       |
| GET    | /api/kpi/history/{mine}/{kpi} | KPI history + forecast   |
| GET    | /api/kpi/aggregated           | Aggregated across mines  |
| GET    | /api/equipment/{mine}         | Equipment list           |
| GET    | /api/advisories               | AI advisories            |
| POST   | /api/advisories/{id}/ack      | Acknowledge advisory     |
| POST   | /api/advisories/{id}/resolve  | Resolve advisory         |
| GET    | /api/subsystems/logistics     | Logistics data           |
| GET    | /api/subsystems/hr            | HR data                  |
| GET    | /api/subsystems/finance       | Finance data             |
| GET    | /api/subsystems/esg           | ESG data                 |
| GET    | /api/subsystems/ehs           | EHS data                 |
| WS     | /ws/{token}                   | Real-time WebSocket      |

## Tech Stack

- **Backend:** FastAPI, Pydantic, python-jose (JWT), passlib (bcrypt), uvicorn, numpy
- **Frontend:** Next.js 14, React 18, TypeScript, Tailwind CSS, Recharts, Zustand, Axios, Lucide React
- **3D:** React Three Fiber, Three.js, @react-three/drei
- **Real-time:** WebSocket (native)
- **Deployment:** Docker, docker-compose
