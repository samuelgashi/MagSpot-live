# ============================================================
#                 BACKEND (MagAuto + ws-scrcpy)
# ============================================================
# FROM node:20-bullseye AS backend
FROM node:20.20.1-bullseye AS backend

# ----------------------------
# Environment
# ----------------------------

ARG ADB_PORT=5040
ARG BACKEND_PORT=9789

ENV ADB_PORT=${ADB_PORT}
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV NODE_GYP_FORCE_PYTHON=python3



# ----------------------------
# System dependencies
# ----------------------------
RUN apt-get update && apt-get install -y \
    wget unzip curl git \
    build-essential g++ make \
    python3 python3-dev python3-pip \
    libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev \
    libasound2 libxrandr2 libxkbcommon-dev libxfixes3 \
    libxcomposite1 libxdamage1 libatk-bridge2.0-0 libcups2 \
    netcat-openbsd ipcalc \
    docker.io \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g npm@10.8.2

# ----------------------------
# Android Platform Tools (ADB)
# ----------------------------
RUN wget -q https://dl.google.com/android/repository/platform-tools-latest-linux.zip \
        -O /tmp/platform-tools.zip \
    && unzip /tmp/platform-tools.zip -d /opt \
    && rm /tmp/platform-tools.zip

ENV PATH="/opt/platform-tools:$PATH"

# ----------------------------
# Cloudflared
# ----------------------------
RUN mkdir -p /usr/share/keyrings \
    && curl -fsSL https://pkg.cloudflare.com/cloudflare-public-v2.gpg \
       | tee /usr/share/keyrings/cloudflare-public-v2.gpg >/dev/null \
    && echo "deb [signed-by=/usr/share/keyrings/cloudflare-public-v2.gpg] \
       https://pkg.cloudflare.com/cloudflared any main" \
       | tee /etc/apt/sources.list.d/cloudflared.list \
    && apt-get update \
    && apt-get install -y cloudflared \
    && rm -rf /var/lib/apt/lists/*

# ----------------------------
# Working directory
# ----------------------------
WORKDIR /app

# ----------------------------
# Python dependencies (cached)
# ----------------------------
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# ----------------------------
# Backend source code
# ----------------------------
COPY backend/ .

# ----------------------------
# ws-scrcpy build
# ----------------------------
WORKDIR /app/backend/ws-scrcpy

COPY backend/ws-scrcpy/package*.json ./
COPY backend/ws-scrcpy/vendor ./vendor

RUN npm install --build-from-source \
    && npm rebuild node-pty --build-from-source

COPY backend/ws-scrcpy ./

RUN npm run dist:prod

# ----------------------------
# Make scripts executable
# ----------------------------
# RUN chmod +x scripts/*.sh

EXPOSE ${BACKEND_PORT}



# ============================================================
#                    FRONTEND (Vite / pnpm monorepo)
# ============================================================
FROM node:20.20.1-alpine AS frontend

ARG VITE_BACKEND_API_URL
ARG BACKEND_HOST
ARG FRONTEND_API_BASE_URL
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_NETWORK_BASE_IP

ENV VITE_BACKEND_API_URL=${VITE_BACKEND_API_URL}
ENV BACKEND_HOST=${BACKEND_HOST}
ENV FRONTEND_API_BASE_URL=${FRONTEND_API_BASE_URL}
ENV VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY}
ENV VITE_NETWORK_BASE_IP=${VITE_NETWORK_BASE_IP}

RUN npm install -g pnpm

WORKDIR /app

COPY frontend/pnpm-workspace.yaml frontend/pnpm-lock.yaml frontend/package.json ./
COPY frontend/lib ./lib
COPY frontend/artifacts ./artifacts

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @workspace/device-control run build



# ============================================================
#                    FINAL RUNTIME
# ============================================================
# FROM node:20-bullseye AS final
FROM node:20.20.1-bullseye AS final
RUN npm install -g npm@10.8.2

# ----------------------------
# Runtime deps only
# ----------------------------
RUN apt-get update && apt-get install -y \
    python3 python3-pip \
    adb curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ----------------------------
# Backend
# ----------------------------
COPY --from=backend /app /app/backend

# ----------------------------
# Frontend
# ----------------------------
COPY --from=frontend /app/artifacts/device-control/dist /app/frontend/dist

# ----------------------------
# Python runtime deps
# ----------------------------
COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# ----------------------------
# Static file server
# ----------------------------
RUN npm install -g serve

# ---------------------------------------------
# Copy cloudflared binary from backend stage 
# ---------------------------------------------
COPY --from=backend /usr/bin/cloudflared /usr/bin/cloudflared
COPY --from=backend /app/backend/ws-scrcpy/dist /app/backend/ws-scrcpy/dist
COPY --from=backend /app/backend/ws-scrcpy/node_modules /app/backend/ws-scrcpy/node_modules


# ----------------------------
# Docker group (match host)
# ----------------------------
ARG DOCKER_GID=983

RUN groupadd -g ${DOCKER_GID} docker

# ----------------------------
# Non-root user
# ----------------------------
ARG USER_ID 
ARG GROUP_ID

# RUN groupadd -g $GROUP_ID appgroup \ 
#     && useradd -m -u $USER_ID -g $GROUP_ID -G docker appuser \ 
#     && chown -R $USER_ID:$GROUP_ID /app

RUN useradd -m -G docker appuser \
    && chown -R appuser:docker /app

RUN mkdir -p /app/backend/uploads /app/backend/bin /app/backend/bin/database \
    && chown -R appuser:docker /app/backend/uploads /app/backend/bin

RUN mkdir -p /home/appuser/.android \
    && chown -R appuser:docker /home/appuser/.android

USER appuser


# ----------------------------
# Ports
# ----------------------------
ARG BACKEND_PORT=9786
ARG FRONTEND_PORT=9787

ARG HOST_USER
ARG POSTGRES_HOST
ARG POSTGRES_PORT
ARG POSTGRES_DB
ARG POSTGRES_USER
ARG POSTGRES_PASSWORD
ARG YT_MUSIC_PACKAGE_NAME
ARG YT_MUSIC_ACTIVITY_NAME
ARG BASE_WIDTH
ARG BASE_HEIGHT
ARG IS_OVERRIDE_RESOLUTION
ARG BUTTONS_CENTERS
ARG SCROLL_DOWN_LIMIT
ARG WS_SCRCPY_PORT
ARG SUBNET_BASE
ARG ADB_PORT
ARG ANDROID_ADB_SERVER_PORT
ARG ADB_SERVER_PORT
ARG ADB_PATH
ARG ADB_VENDOR_KEYS
ARG ADB_VENDOR_KEYS_HOST
ARG ANDROID_ADB_KEY_PATH
ARG CONCURRENCY
ARG SCAN_TIMEOUT_MS
ARG ANDROID_ADB_SERVER_ADDRESS

ARG CHROME_PACKAGE_NAME
ARG CHROME_ACTIVITY_NAME
ARG GOOGLE_CHROME_DRIVER_HOST_PATH
ARG GOOGLE_CHROME_DRIVER_CONTAINER_PATH

ENV HOST_USER=${HOST_USER}
ENV BACKEND_PORT=${BACKEND_PORT}
ENV FRONTEND_PORT=${FRONTEND_PORT}
ENV POSTGRES_HOST=${POSTGRES_HOST}
ENV POSTGRES_PORT=${POSTGRES_PORT}
ENV POSTGRES_DB=${POSTGRES_DB}
ENV POSTGRES_USER=${POSTGRES_USER}
ENV POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

ENV YT_MUSIC_PACKAGE_NAME=${YT_MUSIC_PACKAGE_NAME}
ENV YT_MUSIC_ACTIVITY_NAME=${YT_MUSIC_ACTIVITY_NAME}
ENV BASE_WIDTH=${BASE_WIDTH}
ENV BASE_HEIGHT=${BASE_HEIGHT}
ENV IS_OVERRIDE_RESOLUTION=${IS_OVERRIDE_RESOLUTION}
ENV BUTTONS_CENTERS=${BUTTONS_CENTERS}
ENV SCROLL_DOWN_LIMIT=${SCROLL_DOWN_LIMIT}
ENV WS_SCRCPY_PORT=${WS_SCRCPY_PORT}

ENV SUBNET_BASE=${SUBNET_BASE}
ENV ADB_PORT=${ADB_PORT}
ENV ADB_PATH=${ADB_PATH}
ENV ADB_VENDOR_KEYS=${ADB_VENDOR_KEYS}
ENV ADB_VENDOR_KEYS_HOST=${ADB_VENDOR_KEYS_HOST}
ENV ANDROID_ADB_KEY_PATH=${ANDROID_ADB_KEY_PATH}
ENV ANDROID_ADB_SERVER_PORT=${ANDROID_ADB_SERVER_PORT}
ENV ANDROID_ADB_SERVER_ADDRESS=${ANDROID_ADB_SERVER_ADDRESS}

# ✅ FORCE use host adb server
ENV ADB_SERVER_PORT=${ADB_SERVER_PORT}
ENV ADB_SERVER_SOCKET=tcp:127.0.0.1:${ADB_SERVER_PORT}
ENV CONCURRENCY=${CONCURRENCY}
ENV SCAN_TIMEOUT_MS=${SCAN_TIMEOUT_MS}

ENV CHROME_PACKAGE_NAME=${CHROME_PACKAGE_NAME}
ENV CHROME_ACTIVITY_NAME=${CHROME_ACTIVITY_NAME}
ENV GOOGLE_CHROME_DRIVER_HOST_PATH=${GOOGLE_CHROME_DRIVER_HOST_PATH}
ENV GOOGLE_CHROME_DRIVER_CONTAINER_PATH=${GOOGLE_CHROME_DRIVER_CONTAINER_PATH}

# CMD export ADB_SERVER_PORT=${ADB_SERVER_PORT}
# CMD export ANDROID_ADB_SERVER_PORT=${ANDROID_ADB_SERVER_PORT}

EXPOSE ${BACKEND_PORT}
EXPOSE ${FRONTEND_PORT}


# ----------------------------
# Healthcheck
# ----------------------------
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:${BACKEND_PORT}/api/health_check || exit 1

# ----------------------------
# Start backend + frontend
# ----------------------------
# CMD ["sh", "-c", "\
#   python3 backend/app.py & \
#   serve -s frontend/dist -l ${FRONTEND_PORT} \
# "]
