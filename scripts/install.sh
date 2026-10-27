#!/usr/bin/env bash
# Install Mitsu's Python and frontend dependencies on macOS or Linux.
# Pass --build to also create the production build used by
# `python run.py --prod`.
set -eu

cd "$(dirname "$0")/.."

say() { printf '\033[1;35m  mitsu installer\033[0m\n\n'; }
hint() { printf '\n\033[1;33m%s\033[0m\n\n' "$1"; exit 1; }

command -v python3 >/dev/null 2>&1 || hint "Python 3.11 or newer is required. Install it with your package manager or from https://www.python.org/downloads/."
command -v node >/dev/null 2>&1 || hint "Node.js 20 or newer is required. Install it from https://nodejs.org/."

say

# ---- Python ----
if [ ! -d .venv ]; then
  printf '  creating .venv ...\n'
  python3 -m venv .venv
fi
. .venv/bin/activate
python -m pip install --upgrade pip --quiet
printf '  installing backend requirements ...\n'
python -m pip install -r backend/requirements.txt --quiet

# ---- Frontend ----
if ! command -v pnpm >/dev/null 2>&1; then
  printf '  enabling pnpm via corepack ...\n'
  if command -v corepack >/dev/null 2>&1; then
    corepack enable
    corepack prepare pnpm@9.12.3 --activate
  else
    npm install -g pnpm@9.12.3
  fi
fi

printf '  installing frontend packages ...\n'
pnpm install

if [ "${1:-}" = "--build" ]; then
  printf '  building the production frontend ...\n'
  pnpm build
fi

printf '\n\033[1;32m  Ready. Start Mitsu with:\033[0m\n'
if [ "${1:-}" = "--build" ]; then
  printf '    .venv/bin/python run.py --prod\n'
else
  printf '    .venv/bin/python run.py\n'
fi
printf '\n'
