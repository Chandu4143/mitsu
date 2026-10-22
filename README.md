# Mitsu

A Peach-inspired, local-first manga library and reader (React + Next.js frontend, Python + FastAPI backend, SQLite).

## Getting started

Prerequisites: Node.js (pnpm), Python 3.12+.

### Run everything

```bash
# one command (starts backend on :8000 and frontend on :3000)
./pandacode-run.sh
# or
python run.py
```

Then open http://localhost:3000.

### Run separately

Backend:
```bash
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Frontend:
```bash
pnpm dev
```

### Importing a manga

Open http://localhost:3000/imports and paste the absolute path to a CBZ/ZIP or folder, then click Import. The gallery appears on Home and in Library.

### Data

Database and thumbnails live under `data/` (configurable via `MITSU_DATA_DIR`). Source files are never moved or deleted.
