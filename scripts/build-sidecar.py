#!/usr/bin/env python3
"""Build the FastAPI backend into the Tauri sidecar binary.

Tauri expects the sidecar at ``src-tauri/binaries/mitsu-backend-<target-triple>.exe``.
Run this before ``tauri build`` (``pnpm desktop:build`` does it for you).

Usage:
    python scripts/build-sidecar.py
    python scripts/build-sidecar.py --target x86_64-pc-windows-msvc
"""

from __future__ import annotations

import argparse
import platform
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
BINARIES = ROOT / "src-tauri" / "binaries"
BUILD = ROOT / "build" / "pyinstaller"

HIDDEN_IMPORTS = [
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.loops.asyncio",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.http.h11_impl",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "uvicorn.lifespan.off",
    "app.main",
]


def host_triple() -> str:
    try:
        output = subprocess.run(
            ["rustc", "-vV"], capture_output=True, text=True, check=True
        ).stdout
    except (OSError, subprocess.CalledProcessError) as error:
        raise SystemExit(f"Could not run rustc to detect the target triple: {error}")

    match = re.search(r"^host:\s*(\S+)$", output, re.MULTILINE)
    if not match:
        raise SystemExit("Could not read the host triple from `rustc -vV`.")
    return match.group(1)


def ensure_pyinstaller() -> None:
    result = subprocess.run(
        [sys.executable, "-m", "PyInstaller", "--version"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise SystemExit(
            "PyInstaller is not installed. Run: "
            f"{sys.executable} -m pip install pyinstaller"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--target",
        help="Rust target triple for the output filename (defaults to the host triple).",
    )
    args = parser.parse_args()

    ensure_pyinstaller()
    triple = args.target or host_triple()

    BUILD.mkdir(parents=True, exist_ok=True)
    BINARIES.mkdir(parents=True, exist_ok=True)

    command = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--noconfirm",
        "--clean",
        "--onefile",
        "--name",
        "mitsu-backend",
        "--distpath",
        str(BUILD / "dist"),
        "--workpath",
        str(BUILD / "work"),
        "--specpath",
        str(BUILD),
        "--exclude-module",
        "tkinter",
    ]
    for module in HIDDEN_IMPORTS:
        command.extend(["--hidden-import", module])
    command.append(str(BACKEND / "mitsu_backend.py"))

    print(f"[sidecar] building for {triple} ...")
    subprocess.run(command, cwd=BACKEND, check=True)

    suffix = ".exe" if platform.system() == "Windows" else ""
    produced = BUILD / "dist" / f"mitsu-backend{suffix}"
    if not produced.is_file():
        raise SystemExit(f"PyInstaller did not produce {produced}")

    destination = BINARIES / f"mitsu-backend-{triple}{suffix}"
    shutil.copy2(produced, destination)
    print(f"[sidecar] wrote {destination.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
