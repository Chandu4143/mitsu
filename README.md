# Mitsu

A local-first manga library and reader, inspired by Peach. React + Next.js frontend, Python + FastAPI backend, SQLite storage. Everything runs on your machine — no accounts, no cloud, no telemetry.

## Features

- **Library** — browse your collection as a cover grid, with folders-scanned import (CBZ/ZIP, folders, or single images), duplicate detection by content hash, and reading progress tracking.
- **Reader** — page-by-page reader with progress persistence, resumable where you left off.
- **Collections** — organize galleries into manually curated collections.
- **Discover (optional)** — search nhentai.net and import galleries from it into your library. See [Discover / nhentai](#discover--nhentai-optional) below.

## Requirements

- Node.js 18+ and [pnpm](https://pnpm.io/) (`npm install -g pnpm` if you don't have it)
- Python 3.12+

## Getting started

### 1. Install dependencies

```bash
# frontend
pnpm install

# backend
python -m pip install -r backend/requirements.txt
```

Windows note: if `python` is not found, try `py -m pip install -r backend/requirements.txt` (or install Python from [python.org](https://www.python.org/downloads/) and check "Add to PATH" during setup).

### 2. Run everything

```bash
python run.py
```

This starts the backend API on `http://127.0.0.1:8000` and the frontend on `http://localhost:3000`, then opens the docs if you visit the backend directly. Press `Ctrl+C` to stop both. If anything is missing, `run.py` tells you exactly which command to run instead of failing halfway.

You can also run the two halves separately:

```bash
# backend
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# frontend (in a second terminal, from the repo root)
pnpm dev
```

Then open **http://localhost:3000**.

## Importing a manga

1. Open http://localhost:3000/imports
2. Paste the absolute path to any of these:
   - a `.cbz` / `.zip` archive
   - a folder of images
   - a single image file
3. Click Import. Import runs as a background job — you'll see live progress, and it can be cancelled from the same page.

Notes on imports:

- Your original files are **never moved or deleted** — Mitsu copies them into its own library folder and stores them relative to that library root.
- Duplicates are detected by content hash, so re-importing the same archive is safe and will surface "already in your library" instead of doubling up.
- If the archive contains a `ComicInfo.xml`, its title, writer, language and genres are parsed into the gallery metadata.

## Discover / nhentai (optional)

The Discover page lets you search nhentai.net and import galleries into your local library. It is **entirely opt-in**:

- The provider is powered by the `cloudscraper` package, listed as the last (optional) entry in `backend/requirements.txt`. If you don't install it, Discover stays disabled and everything else works normally.
- To enable it: install the requirements normally (it's included), or to *disable* it, skip/remove `cloudscraper` from your install — the API reports the provider as unavailable and the discover endpoints return a clear 503.
- Whichever install you choose, imports are fetched to *your* local machine from your own IP, one gallery at a time, with cancellation support. Rate-limit concerns are yours to manage; Mitsu does not batch or parallelize requests.

If you'd rather not have the feature at all, remove `backend/app/api/v1/providers.py`, `backend/app/services/providers.py` and the Discover page — nothing else depends on them.

## Configuration

No configuration is required. All knobs are environment variables (see `.env.example` for the full annotated list). The most useful:

| Variable | Default | Purpose |
| --- | --- | --- |
| `MITSU_DATA_DIR` | `<repo>/data` | Where the SQLite DB, thumbnails and cache live |
| `MITSU_LIBRARY_ROOT` | `<MITSU_DATA_DIR>/library` | Where imported galleries are stored |
| `MITSU_HOST` / `MITSU_PORT` | `127.0.0.1` / `8000` | Backend bind address |
| `MITSU_FRONTEND_ORIGIN` | `http://localhost:3000` | Allowed CORS origin |
| `MITSU_MAX_ARCHIVE_BYTES` | `4 GiB` | Max single CBZ/ZIP size |
| `MITSU_MAX_EXTRACTED_BYTES` | `8 GiB` | Max size once extracted |
| `MITSU_MAX_ARCHIVE_ENTRIES` | `20000` | Max files per archive |
| `MITSU_MAX_IMAGE_PIXELS` | `80 MP` | Decompression-bomb guard |

Values can be set in the shell or via a `backend/.env` file (gitignored — start from `.env.example`).

## Data location & backup

Everything (database, thumbnails, imported copies) lives under `data/` by default — a single folder, gitignored, easy to back up or move:

```
data/
  database/mitsu.db   # the SQLite database
  library/            # imported gallery files (copied from your sources)
  thumbnails/         # derived — safe to delete, regenerates lazily
  cache/              # transient
```

To back up: stop the app, copy `data/` (or just `data/database/mitsu.db` if you're happy losing derived thumbnails until re-import). To move the whole install to another disk, copy the repo + `data/` folder, or point `MITSU_LIBRARY_ROOT`/`MITSU_DATA_DIR` at new locations and re-point the database accordingly.

## Troubleshooting

- **`ModuleNotFoundError: No module named 'fastapi'` (or similar)** — you skipped the backend install. Run `python -m pip install -r backend/requirements.txt`. On Windows use `py -m pip ...` if `python` isn't on PATH.
- **Port 8000 or 3000 already in use** — stop the other process, or set `MITSU_PORT` (backend) and change the frontend port via the Next.js CLI (`pnpm dev -- -p 3001`).
- **Import fails immediately with `Path not found`** — the path you pasted isn't visible to the backend process; use an absolute path (Windows: `C:\Users\you\...\manga` not `~\...`).
- **Import fails with `Archive exceeds the configured size limit`** — your CBZ is over 4 GiB. Raise `MITSU_MAX_ARCHIVE_BYTES` in `backend/.env`.
- **A page shows as blank / image fails to load** — derive thumbnail cache may be stale; delete `data/cache/` (and `data/thumbnails/` if needed) and restart.
- **Discover shows "provider unavailable"** — `cloudscraper` isn't installed; re-run the backend install command.

## Development

- Backend code is `backend/app/` (FastAPI, SQLAlchemy). Restart the backend process after edits; there's no reload when launched via `run.py`.
- Frontend code is `app/` (Next.js App Router). Hot reload works via `pnpm dev`.

## License

MIT — see [LICENSE](LICENSE).
