# MagSpot 2.0 Run Guide

This guide explains the current Docker setup, the MagSpot 2.0 frontend setup, required environment values, and how to run the project with one command.

## What this project contains

- `backend/` — Python Flask backend for API, automation, ADB, Appium, PostgreSQL, tasks, tunnels, and device control.
- `frontend/` — older Vite frontend used by the current root `Dockerfile`.
- `magSpot2.0/artifacts/device-control/` — new MagSpot 2.0 React/Vite frontend.
- `frontend/backend/` — lightweight Node/Express compatibility backend used in Replit development.
- `Dockerfile` — multi-stage Docker build for backend, frontend, ws-scrcpy, cloudflared, ADB, and runtime dependencies.
- `docker-compose.yml` — main Docker Compose file for MagSpot backend/frontend plus PostgreSQL.
- `docker-compose-appium.yaml` — optional Appium container.
- `.env.example` — root environment template used by Docker Compose.

## Current Docker behavior

The current root `Dockerfile` builds and runs:

1. Backend stage:
   - Node 20 Debian image
   - Python 3 dependencies from `backend/requirements.txt`
   - Android platform tools / ADB
   - cloudflared
   - `backend/ws-scrcpy`

2. Frontend stage:
   - Builds the old `frontend/` Vite app, not MagSpot 2.0.

3. Final runtime stage:
   - Copies backend to `/app/backend`
   - Copies built frontend to `/app/frontend/dist`
   - Installs runtime Python dependencies
   - Installs `serve`
   - Exposes backend and frontend ports

The current `docker-compose.yml` starts backend and frontend with one Compose command, but internally it runs two web servers:

```sh
python3 backend/wsgi.py & serve -s frontend/dist -l ${FRONTEND_PORT}
```

That means:

- API runs on `${BACKEND_PORT}`.
- Frontend runs on `${FRONTEND_PORT}`.
- This is one Docker command, but not one public port.

## Can the API host MagSpot 2.0 on one port?

Yes. This is possible and is the cleaner production setup.

The recommended structure is:

- Flask serves all API endpoints under `/api`.
- Flask serves MagSpot 2.0 static files for every non-API route.
- Browser uses relative API URLs like `/api/devices`, `/api/tasks`, `/api/devices/scrcpy-stream`.
- Only `${BACKEND_PORT}` is exposed publicly.
- No separate frontend port is required in production.

The important requirement is that frontend routes must not collide with backend routes. This is already mostly correct because backend routes are mounted under `/api`.

## Required host dependencies

Install these on the host machine before running the full project:

- Docker
- Docker Compose plugin
- Git
- ADB / Android platform tools
- Access to Android devices over USB or TCP/IP
- Appium if running without the Appium Docker container
- PostgreSQL is not required on the host if using the included Compose Postgres service

Useful checks:

```sh
docker --version
docker compose version
adb version
adb devices
```

## Environment setup

Create a real `.env` file from the example:

```sh
cp .env.example .env
```

Then edit `.env`.

Important values:

```env
ENV=prod
BACKEND_PORT=9786
FRONTEND_PORT=9787
WS_SCRCPY_PORT=3200

POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=magauto
POSTGRES_USER=maguser
POSTGRES_PASSWORD=magpass

ANDROID_ADB_SERVER_PORT=5038
ADB_PATH=/usr/bin/adb
ADB_VENDOR_KEYS_HOST=/home/YOUR_USER/adb_keys_backup
ADB_VENDOR_KEYS_CONTAINER=/home/appuser/.android
ANDROID_ADB_KEY_PATH=/home/appuser/.android

SUBNET_BASE=192.168.1
CONCURRENCY=200
SCAN_TIMEOUT_MS=1000

VITE_BACKEND_API_URL=http://localhost:9786/api
FRONTEND_API_BASE_URL=/api
VITE_NETWORK_BASE_IP=192.168.1
```

Secrets that must be changed before production:

```env
BACKEND_ADMIN_KEY=change-me
BACKEND_FLASK_SECRET_KEY=change-me
BACKEND_DEV_API_KEY=change-me
POSTGRES_PASSWORD=change-me
CLERK_SECRET_KEY=your-clerk-secret-if-used
VITE_CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key-if-used
```

## ADB setup

The Docker setup expects ADB keys to be available to the container.

Example host setup:

```sh
mkdir -p ~/adb_keys_backup
cp ~/.android/adbkey* ~/adb_keys_backup/
```

Update `.env`:

```env
ADB_VENDOR_KEYS_HOST=/home/YOUR_USER/adb_keys_backup
ADB_VENDOR_KEYS_CONTAINER=/home/appuser/.android
ANDROID_ADB_KEY_PATH=/home/appuser/.android
```

Start or verify ADB on the host:

```sh
adb start-server
adb devices
```

For TCP/IP Android devices:

```sh
adb connect DEVICE_IP:5555
adb devices
```

## Run current Docker setup

From the project root:

```sh
docker compose --env-file .env up --build
```

Open:

```text
Frontend: http://localhost:${FRONTEND_PORT}
Backend:  http://localhost:${BACKEND_PORT}/api/health_check
```

With the example values:

```text
Frontend: http://localhost:9787
Backend:  http://localhost:9786/api/health_check
```

Stop services:

```sh
docker compose down
```

Stop and remove volumes:

```sh
docker compose down -v
```

## Run Appium container

If you want Appium in Docker:

```sh
docker compose -f docker-compose-appium.yaml up -d
```

Appium listens on:

```text
http://localhost:4723/wd/hub
```

## Run MagSpot 2.0 in development

To run the project locally, start the MagSpot Python backend and the MagSpot 2.0 frontend separately.

### 1. Start the MagSpot backend

The backend is the Python Flask app in `backend/`.

Install Python dependencies:

```sh
pip install -r backend/requirements.txt
```

Start the backend:

```sh
python3 backend/wsgi.py
```

By default it listens on `BACKEND_PORT` (e.g. `9786`). Confirm it is running:

```sh
curl http://localhost:9786/api/health_check
```

### 2. Install MagSpot 2.0 frontend dependencies

The frontend is in `magSpot2.0/artifacts/device-control/` and uses pnpm.

```sh
pnpm --dir magSpot2.0 install
```

### 3. Start the MagSpot 2.0 frontend

Point `API_PROXY_TARGET` at the backend address you started above:

```sh
PORT=5173 BASE_PATH=/ API_PROXY_TARGET=http://127.0.0.1:9786 \
pnpm --dir magSpot2.0 --filter @workspace/device-control run dev
```

Open:

```text
http://localhost:5173
```

The Vite dev server proxies every `/api` request to `http://127.0.0.1:9786`, so the frontend talks directly to the real MagSpot backend.

### Build only the MagSpot 2.0 frontend

To run a production build from inside the `magSpot2.0/` directory:

```sh
cd magSpot2.0
pnpm install
pnpm --filter @workspace/device-control run build
```

Output is written to `magSpot2.0/artifacts/device-control/dist/public/`.

## Current Replit single-command development setup

The Replit workflow currently starts everything needed for preview with one command:

```sh
cloudflared access tcp --hostname magician_device_101.bgnodes.com --url localhost:5555 >/tmp/magician_device_101_cloudflared.log 2>&1 & \
sleep 3; \
adb start-server >/dev/null 2>&1; \
adb connect localhost:5555 || true; \
(cd frontend/backend && PORT=3001 npm start) & \
(PORT=5173 BASE_PATH=/ API_PROXY_TARGET=http://127.0.0.1:3001 pnpm --dir magSpot2.0 --filter @workspace/device-control run dev) & \
node startup_scripts/preview_bridge.js
```

`startup_scripts/preview_bridge.js` listens on port `5000` and proxies:

- frontend traffic to `127.0.0.1:5173`
- `/api` HTTP traffic to `127.0.0.1:3001`
- WebSocket upgrade traffic for live H.264 screen streaming

This is one visible preview port, but still multiple internal development processes.

## Recommended production one-port setup

For production, the best setup is to let Flask host MagSpot 2.0 directly.

### 1. Build MagSpot 2.0 in Dockerfile

Replace the old frontend build stage with MagSpot 2.0:

```dockerfile
FROM node:20.20.1-bullseye AS magspot2_frontend
RUN npm install -g pnpm
WORKDIR /app/magSpot2.0
COPY magSpot2.0/package.json magSpot2.0/pnpm-lock.yaml magSpot2.0/pnpm-workspace.yaml ./
COPY magSpot2.0/catalog.json ./catalog.json
COPY magSpot2.0/artifacts ./artifacts
COPY magSpot2.0/lib ./lib
ENV PORT=5173
ENV BASE_PATH=/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @workspace/device-control run build
```

Then copy the build into the final image:

```dockerfile
COPY --from=magspot2_frontend /app/magSpot2.0/artifacts/device-control/dist/public /app/frontend/dist
```

### 2. Serve frontend from Flask

Add static serving to `backend/app/__init__.py`:

```python
from flask import Flask, send_from_directory
import os

FRONTEND_DIST = os.environ.get("FRONTEND_DIST", "/app/frontend/dist")

def create_app():
    app = Flask(__name__, static_folder=FRONTEND_DIST, static_url_path="")

    # existing config, extensions, blueprints, db setup...

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_frontend(path):
        if path.startswith("api/"):
            return {"error": "API route not found"}, 404

        requested = os.path.join(FRONTEND_DIST, path)
        if path and os.path.exists(requested):
            return send_from_directory(FRONTEND_DIST, path)

        return send_from_directory(FRONTEND_DIST, "index.html")

    return app
```

Important: register API blueprints before the catch-all route or keep the `/api` guard.

### 3. Use one Compose port

Once Flask serves the frontend, the Compose command can become:

```yaml
command: >
  sh -c "python3 backend/wsgi.py"
```

Expose only the backend port:

```yaml
ports:
  - "${BACKEND_PORT}:${BACKEND_PORT}"
```

Then open:

```text
http://localhost:${BACKEND_PORT}
```

With example values:

```text
http://localhost:9786
```

API remains available at:

```text
http://localhost:9786/api/health_check
```

## MagSpot 2.0 live screen streaming

MagSpot 2.0 currently supports:

- primary H.264 WebSocket stream at `/api/devices/scrcpy-stream`
- browser WebCodecs rendering to canvas
- MJPEG fallback at `/api/devices/stream`
- click-to-tap and drag-to-swipe through `/api/devices/live-control`
- Sync Control for mirrored input across visible devices
- Small Screen mode for dashboard-card control

For the WebSocket stream to work through a proxy, the proxy must forward WebSocket upgrade requests.

## Health checks

Backend health endpoint:

```sh
curl http://localhost:9786/api/health_check
```

Docker Compose healthcheck currently uses:

```yaml
test: ["CMD", "curl", "-f", "http://localhost:${BACKEND_PORT}/api/health"]
```

The Dockerfile healthcheck uses:

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:${BACKEND_PORT}/api/health_check || exit 1
```

Recommendation: make Compose and Dockerfile use the same endpoint, preferably `/api/health_check`.

## Common problems

### Frontend cannot reach backend

Use relative API URLs in production:

```env
FRONTEND_API_BASE_URL=/api
```

Avoid hardcoding `localhost` in production browser code unless the browser and API are on the same host/port.

### WebSocket stream fails

Make sure the proxy supports WebSocket upgrade requests for:

```text
/api/devices/scrcpy-stream
```

### ADB devices do not appear

Check:

```sh
adb devices
adb -P 5038 devices
```

Confirm `.env` values:

```env
ANDROID_ADB_SERVER_PORT=5038
ADB_SERVER_PORT=5038
ADB_VENDOR_KEYS_HOST=/home/YOUR_USER/adb_keys_backup
```

### Docker cannot access host Docker

The main Compose file mounts:

```yaml
/var/run/docker.sock:/var/run/docker.sock
```

The container user is added to a Docker group using `DOCKER_GID`. If permissions fail, check the host Docker group id:

```sh
getent group docker
```

Then update:

```env
DOCKER_GID=YOUR_DOCKER_GROUP_ID
```

## Recommended next Docker improvement

To make MagSpot 2.0 production-ready with one public port:

1. Update `Dockerfile` to build `magSpot2.0/artifacts/device-control` instead of old `frontend/`.
2. Copy MagSpot 2.0 build output to `/app/frontend/dist`.
3. Update Flask to serve `/app/frontend/dist` for non-API routes.
4. Update `docker-compose.yml` command to only start Flask.
5. Expose only `${BACKEND_PORT}`.
6. Keep all API routes under `/api` and all frontend API calls relative to `/api`.

After those changes, the whole app can run with:

```sh
docker compose --env-file .env up --build
```

And be accessed from one URL:

```text
http://localhost:${BACKEND_PORT}
```
