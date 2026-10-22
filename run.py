"""Start the Mitsu backend and frontend together.

Usage:
    python run.py

The backend serves the API on http://127.0.0.1:8000 and the frontend
proxies /api requests to it. Press Ctrl+C to stop both.
"""

import os
import subprocess
import sys

root = os.path.dirname(os.path.abspath(__file__))
os.chdir(root)

REQUIRED_MODULES = {
    "fastapi": "fastapi",
    "uvicorn": "uvicorn",
    "sqlalchemy": "sqlalchemy",
    "PIL": "pillow",
    "pydantic": "pydantic",
}


def check_backend_dependencies() -> list[str]:
    """Return the pip requirement names of any missing backend dependencies."""
    missing = []
    for module_name, requirement in REQUIRED_MODULES.items():
        try:
            __import__(module_name)
        except ImportError:
            missing.append(requirement)
    return missing


def check_frontend_dependencies() -> bool:
    """Return True when the frontend dependencies look installed."""
    return os.path.isdir(os.path.join(root, "node_modules"))


def report(missing: list[str], frontend_ready: bool) -> None:
    print("\nMitsu is not ready to start yet.\n", flush=True)

    if missing:
        print("Missing Python dependencies:", flush=True)
        for requirement in missing:
            print(f"  - {requirement}", flush=True)
        print("\nInstall them with:\n", flush=True)
        print("    python -m pip install -r backend/requirements.txt\n", flush=True)

    if not frontend_ready:
        print("Frontend dependencies are not installed.\n", flush=True)
        print("Install them with:\n", flush=True)
        print("    pnpm install\n", flush=True)

    sys.exit(1)


procs = []
try:
    missing = check_backend_dependencies()
    frontend_ready = check_frontend_dependencies()
    if missing or not frontend_ready:
        report(missing, frontend_ready)

    be = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
        cwd=os.path.join(root, "backend"),
    )
    procs.append(be)
    fe = subprocess.Popen(["pnpm", "dev"], cwd=root)
    procs.append(fe)
    # wait for frontend (primary)
    fe.wait()
finally:
    for p in procs:
        try:
            p.terminate()
        except Exception:
            pass
    for p in procs:
        try:
            p.wait(timeout=5)
        except Exception:
            p.kill()
