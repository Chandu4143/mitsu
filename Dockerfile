# Dockerfile for Mitsu.
# Produces a single image that serves the FastAPI backend (:8000) and the
# production Next.js frontend (:3000) via the repo's `python run.py --prod`
# orchestrator.
#
# Build:  docker build -t mitsu .
# Run:    docker run -p 3000:3000 -v ./data:/app/data mitsu
#
# The SQLite DB, covers and imported galleries live under /app/data, so a host
# volume keeps your collection across container upgrades.

# ---- Backend dependencies (also primes pip for the runtime stage) ----
FROM python:3.12-slim AS backend
WORKDIR /app
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir --retries 5 --timeout 60 -r backend/requirements.txt
COPY backend/ ./backend/
COPY run.py ./

# ---- Frontend: install deps and build (validates the app compiles) ----
# bookworm base on purpose: matches python:3.12-slim's glibc so the
# node_modules we copy into the runtime stage are ABI-compatible.
FROM node:20-bookworm-slim AS frontend
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate \
 && pnpm install --frozen-lockfile --fetch-retries=5 --fetch-retry-maxtimeout=120000
COPY . .
RUN pnpm run build

# ---- Runtime: Python (backend) + Node (frontend dev server) ----
FROM python:3.12-slim
WORKDIR /app

# Python packages from the backend stage.
COPY --from=backend /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY backend/ ./backend/
COPY run.py ./

# Node.js 20 runtime only. `run.py --prod` launches Next through
# `node node_modules/next/dist/bin/next`, so no package manager is needed here.
COPY --from=node:20-bookworm-slim /usr/local/bin/node /usr/local/bin/node

# Frontend: source, configs and node_modules from the build stage.
COPY --from=frontend /app/node_modules ./node_modules
COPY --from=frontend /app/.next ./.next
COPY package.json pnpm-lock.yaml next.config.ts tsconfig.json postcss.config.mjs eslint.config.mjs ./
COPY app ./app
COPY lib ./lib
COPY components ./components
COPY public ./public

# Writable data dir for the SQLite DB + library (mount a host volume here).
RUN mkdir -p /app/data

ENV MITSU_DATA_DIR=/app/data \
    MITSU_LIBRARY_ROOT=/app/data/library \
    MITSU_FRONTEND_HOST=0.0.0.0 \
    NODE_ENV=production

EXPOSE 3000 8000

# run.py gates on Python deps and starts both servers in production mode.
CMD ["python", "run.py", "--prod", "--no-browser"]
