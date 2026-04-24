# Project Overview

## Stack
- **Primary Frontend (active):** MagSpot 2.0 — React, TypeScript, Vite, Tailwind CSS, pnpm monorepo in `frontend/`
  - Main app: `frontend/artifacts/device-control/`
  - API server artifact: `frontend/artifacts/api-server/`
  - Mockup sandbox: `frontend/artifacts/mockup-sandbox/`
  - Shared libs: `frontend/lib/`
- **Legacy Frontend (archived):** Old React/TypeScript app in `frontend_old/` — kept for reference only, not served
- **Lightweight development API:** Express + Socket.IO in `frontend_old/backend/` — still used as the Node.js proxy layer on port 3001 in dev
- **Full automation backend:** Flask/PostgreSQL/Appium/ADB in `backend/` — designed for Docker/production deployment

## Replit Setup
- The Replit preview runs through `startup_scripts/preview_bridge.js` on port 5000. It proxies frontend traffic to Vite on `localhost:5173`, proxies `/api` HTTP requests to the lightweight Express API on `localhost:3001`, and forwards WebSocket upgrades so live streaming works in preview.
- In development, Vite also proxies `/api` requests to the lightweight Express API on `localhost:3001`.
- The full Python/Docker automation backend is preserved but is not used for the Replit preview (requires Docker, PostgreSQL, ADB/Appium, host setup).
- `frontend/artifacts/device-control` includes an adapter layer mapping the React API client onto existing MagSpot `/api` backend endpoints. The sidebar includes a live Resources panel polling `/api/system/resources`.
- The lightweight Node API in `frontend_old/backend/server.js` exposes compatibility endpoints: `/api/health_check`, `/api/healthz`, `/api/system/resources`, and in-memory group CRUD/device assignment endpoints.
- Device selection supports full-card click/drag and Group Management chip click/drag. ADB commands post to `/api/devices/command`.
- **Auth:** Custom session JWT (HS256, FLASK_SECRET_KEY). Login: `POST /api/auth/login`. Password change: `POST /api/auth/change_password`. `ADMIN_PASSWORD` env var seeds the single admin at startup.
- **Login page:** Shows on first load; routes to Dashboard after auth. Token stored in `localStorage.sessionToken`, sent as `Authorization: Bearer`.
- The primary live-view path is scrcpy-style H.264 over WebSocket at `/api/devices/scrcpy-stream`. MJPEG polling fallback stays active at `/api/devices/stream`.

## Commands
- Frontend dev server: `pnpm --dir frontend --filter @workspace/device-control run dev`
- Lightweight API server: `cd frontend_old/backend && npm start`
- Combined Replit workflow: starts ADB tunnel, `frontend_old/backend` on port 3001, device-control Vite on port 5173, and `startup_scripts/preview_bridge.js` on port 5000.

## Docker Build
- Frontend stage uses pnpm monorepo build: installs with `pnpm install --frozen-lockfile`, builds with `pnpm --filter @workspace/device-control run build`
- Built dist is copied from `artifacts/device-control/dist` → `/app/frontend/dist` in the final stage
- docker-compose serves the built app with: `serve -s frontend/dist -l ${FRONTEND_PORT}`