"""Start the Mitsu backend and frontend together.

Usage:
    python run.py                # development: uvicorn + next dev
    python run.py --prod         # production: uvicorn + next start (run `pnpm build` first)
    python run.py --no-browser   # do not open the browser

The backend serves the API on http://127.0.0.1:8000 and the frontend proxies
/api requests to it. Press Ctrl+C to stop both.
"""

import argparse
import os
import shutil
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser

root = os.path.dirname(os.path.abspath(__file__))
os.chdir(root)

FRONTEND_URL = "http://127.0.0.1:3000"

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


def frontend_built() -> bool:
    return os.path.exists(os.path.join(root, ".next", "BUILD_ID"))


def report(missing: list[str], frontend_ready: bool, production: bool) -> None:
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

    if production and frontend_ready and not frontend_built():
        print("The production frontend has not been built yet.\n", flush=True)
        print("Build it with:\n", flush=True)
        print("    pnpm build\n", flush=True)

    sys.exit(1)


def find_pnpm() -> str | None:
    for name in ("pnpm.cmd", "pnpm"):
        found = shutil.which(name)
        if found:
            return found
    return None


def open_browser_when_ready(url: str, timeout: float = 120.0) -> None:
    """Poll until the frontend answers, then open the default browser once."""

    def wait() -> None:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            try:
                with urllib.request.urlopen(url, timeout=2):
                    webbrowser.open(url)
                    return
            except Exception:
                time.sleep(0.75)

    threading.Thread(target=wait, name="mitsu-browser", daemon=True).start()


def stop(process: subprocess.Popen) -> None:
    if process.poll() is not None:
        return
    try:
        if os.name == "nt":
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(process.pid)],
                capture_output=True,
                check=False,
            )
        else:
            process.terminate()
    except Exception:
        pass


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the Mitsu backend and frontend.")
    parser.add_argument(
        "--prod",
        action="store_true",
        help="serve the production build with `next start` (run `pnpm build` first)",
    )
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="do not open the browser automatically",
    )
    args = parser.parse_args()

    missing = check_backend_dependencies()
    frontend_ready = check_frontend_dependencies()
    if missing or not frontend_ready or (args.prod and not frontend_built()):
        report(missing, frontend_ready, args.prod)

    pnpm = find_pnpm()
    frontend_host = os.getenv("MITSU_FRONTEND_HOST", "127.0.0.1")
    next_entry = os.path.join(root, "node_modules", "next", "dist", "bin", "next")
    if args.prod and os.path.exists(next_entry):
        # Launch Next directly: production needs no package manager, which keeps
        # the container image small and avoids a corepack download at runtime.
        frontend_cmd = ["node", next_entry, "start", "--hostname", frontend_host]
    else:
        if not pnpm:
            print(
                "\npnpm was not found on PATH. Install it with `npm install -g pnpm`.\n",
                flush=True,
            )
            sys.exit(1)
        frontend_cmd = [
            pnpm,
            "start" if args.prod else "dev",
            "--hostname",
            frontend_host,
        ]
    print(
        f"\n  mitsu · {'production' if args.prod else 'development'}\n"
        f"  app        {FRONTEND_URL}\n"
        f"  api        http://127.0.0.1:8000/api/v1\n"
        f"  press Ctrl+C to stop\n",
        flush=True,
    )

    procs: list[subprocess.Popen] = []
    try:
        backend = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "uvicorn",
                "app.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                "8000",
            ],
            cwd=os.path.join(root, "backend"),
        )
        procs.append(backend)
        frontend = subprocess.Popen(frontend_cmd, cwd=root)
        procs.append(frontend)

        if not args.no_browser:
            open_browser_when_ready(FRONTEND_URL)

        # If the frontend exits, stop everything; if the backend dies, stop too.
        while True:
            for process in procs:
                code = process.poll()
                if code is not None:
                    return
            time.sleep(0.5)
    except KeyboardInterrupt:
        pass
    finally:
        for process in procs:
            stop(process)
        for process in procs:
            try:
                process.wait(timeout=5)
            except Exception:
                try:
                    process.kill()
                except Exception:
                    pass


if __name__ == "__main__":
    main()
