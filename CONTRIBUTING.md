# Contributing to Mitsu

Thanks for considering a contribution. Mitsu is a local-first manga library and reader, and the goal is to keep it reliable, private, and pleasant to use.

## Development setup

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### Frontend

```bash
pnpm install
pnpm dev
```

Open <http://127.0.0.1:3000>. The frontend proxies `/api/v1` to the backend.

## Checks

Run these before opening a pull request:

```bash
pnpm lint
pnpm typecheck
pnpm build
cd backend && python -m pytest
```

## Pull requests

- Keep changes focused. One concern per pull request is easier to review.
- Add or update tests when behavior changes.
- Update the README or configuration docs when user-facing behavior changes.
- Do not commit generated data, thumbnails, caches, or local databases.
- Be respectful in review discussions.

## Reporting bugs

Use the bug report template and include:

- Mitsu version or commit
- Operating system
- Steps to reproduce
- Expected and actual behavior
- Relevant logs or screenshots

## Good first issues

Look for issues labeled `good first issue` or `help wanted`. Each should include reproduction steps, the relevant files, and a clear definition of done.
