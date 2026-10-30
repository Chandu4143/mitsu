"""Entry point for the packaged desktop backend sidecar.

PyInstaller bundles this module into ``mitsu-backend.exe``. The Tauri shell
starts it with ``MITSU_PORT`` and ``MITSU_DATA_DIR`` already set.
"""

import os

import uvicorn

from app.main import app


def main() -> None:
    host = os.getenv("MITSU_HOST", "127.0.0.1")
    port = int(os.getenv("MITSU_PORT", "8000"))
    access_log = os.getenv("MITSU_ACCESS_LOG", "0") == "1"
    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level="info",
        access_log=access_log,
    )


if __name__ == "__main__":
    main()
