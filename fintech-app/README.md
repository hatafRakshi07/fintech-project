# FinTech Application

This repository contains a **single unified project** with a clear folder layout:

```
fintech-app/
├─ backend/                # Express API, Socket.io, MongoDB/MinIO integration
│  ├─ src/
│  │  ├─ app.ts
│  │  ├─ db/
│  │  ├─ middleware/
│  │  ├─ models/
│  │  ├─ realtime/
│  │  ├─ controllers/
│  │  └─ routes/
│  ├─ Dockerfile           # Build the API container
│  └─ package.json
├─ frontend/               # Separate UI panels for each role
│  ├─ admin/
│  │  ├─ index.html
│  │  ├─ style.css
│  │  └─ app.js
│  ├─ agent/
│  │  ├─ index.html
│  │  ├─ style.css
│  │  └─ app.js
│  ├─ collector/
│  │  ├─ index.html
│  │  ├─ style.css
│  │  └─ app.js
│  └─ customer/
│     ├─ index.html
│     ├─ style.css
│     └─ app.js
├─ deployment/
│  └─ docker-compose.yml   # Spins up MongoDB, MinIO, and the API service
└─ README.md
```

Each panel can be **served independently** (e.g., via a simple static file server or any web server) and communicates with the shared backend through the same REST/Socket.io endpoints.

---
## How to Run
1. **Start the backend stack**
   ```bash
   cd fintech-app/deployment
   docker compose up -d
   ```
2. **Serve a UI panel** – for example, the Agent panel:
   ```bash
   cd fintech-app/frontend/agent
   npx -y http-server . -p 8080   # any static server will work
   ```
   Open `http://localhost:8080` in a browser.
3. **Switch to other panels** by serving the corresponding folder (`admin`, `collector`, `customer`).

---
## Panels Overview
- **Admin** – broadcast messages, configure notification schedules.
- **Agent** – view assigned customers, send custom messages, see due‑amount alerts.
- **Collector** – placeholder for collection‑related UI (can be expanded later).
- **Customer** – placeholder for customer‑facing UI (e.g., view KYC status, payments).

---
## Next Steps
- Populate the placeholder panels (collector & customer) with their specific features.
- Add authentication UI and routing as needed.
- Write integration tests for the API and UI interactions.
