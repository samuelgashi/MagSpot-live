# Project Overview

## Stack
- Frontend: React, TypeScript, Vite, Tailwind CSS, shadcn-ui in `frontend/`
- Lightweight development API: Express and Socket.IO in `frontend/backend/`
- Full automation backend: Flask/PostgreSQL/Appium/ADB in `backend/`, originally designed for Docker and local device automation

## Replit Setup
- The Replit preview runs through `startup_scripts/preview_bridge.js` on port 5000. It proxies frontend traffic to Vite on `localhost:5173`, proxies `/api` HTTP requests to the lightweight Express API on `localhost:3001`, and forwards WebSocket upgrades so live streaming works in preview.
- In development, Vite also proxies `/api` requests to the lightweight Express API on `localhost:3001`.
- The full Python/Docker automation backend is preserved but is not used for the Replit preview because it requires Docker, PostgreSQL, ADB/Appium device access, and host-level setup.
- A separate copy of the `samuelgashi/magSpot-2.0` repository is stored in `magSpot2.0/` for future comparison and merge work. It should remain separate from the current MagSpot code until an explicit merge task is requested.
- `magSpot2.0/artifacts/device-control` now includes an adapter layer that maps its generated React API client and direct device action calls onto the existing MagSpot `/api` backend endpoints without requiring a Python backend rewrite first. The MagSpot 2.0 sidebar also includes a live Resources panel polling `/api/system/resources`.
- The lightweight Node API in `frontend/backend/server.js` now exposes compatibility endpoints needed by MagSpot 2.0 during the transition: `/api/health_check`, `/api/healthz`, `/api/system/resources`, and in-memory group CRUD/group-device assignment endpoints.
- MagSpot 2.0 device selection now supports full-card click/drag selection and Group Management chip click/drag selection. ADB command execution posts selected MagSpot 2.0 devices to `/api/devices/command`, records command tasks, and surfaces results in the ADB modal.
- MagSpot 2.0 now has dark/cyan Tasks and Settings panels. The lightweight backend provides compatibility endpoints for tasks, API keys, tunnel status/actions, and disconnect-all-device operations used by those panels.
- MagSpot 2.0 device cards and focused device windows now use `/api/devices/stream` for shared per-device MJPEG fallback screen feeds. Focused windows support mouse control through `/api/devices/live-control`: click sends Android tap, drag sends Android swipe.
- MagSpot 2.0 Small Screen enables dashboard-card live view and mouse control. Sync Control mirrors dashboard/focused tap and swipe commands across all currently visible devices.
- The primary live-view path is now scrcpy-style H.264 over WebSocket at `/api/devices/scrcpy-stream`, using Android `screenrecord --output-format=h264` and browser WebCodecs canvas rendering. The older MJPEG polling stream stays active underneath as fallback. The former WebRTC experiment was removed, including its packages.

## Commands
- Frontend dev server: `cd frontend && npm run dev`
- Lightweight API server: `cd frontend/backend && npm start`
- Combined Replit workflow command: starts the ADB tunnel, `frontend/backend` on port 3001, MagSpot 2.0 Vite on port 5173, and `startup_scripts/preview_bridge.js` on port 5000.