#!/usr/bin/env python3
"""Build a distributable Mitsu archive.

Creates ``dist/mitsu-<version>.zip`` with the source tree, install scripts,
Docker files and docs, plus a ``.sha256`` checksum next to it. Local state
(``data/``), dependencies, build output and caches are never included.

Usage:
    python scripts/package.py
    python scripts/package.py --expect v1.1.0    # verify the tag matches
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Directories skipped anywhere in the tree.
EXCLUDED_DIRS = {
    ".git",
    ".next",
    "node_modules",
    "__pycache__",
    ".pytest_cache",
    ".venv",
    "venv",
    "dist",
    "data",
    "out",
    "build",
    # Rust desktop build output and the packaged Python sidecar binary.
    "target",
    "binaries",
    ".cargo",
    ".pandacode",
}

# Files skipped anywhere in the tree. Patterns are matched by name.
EXCLUDED_NAMES = {
    ".DS_Store",
    "Thumbs.db",
    "next-env.d.ts",
}

EXCLUDED_SUFFIXES = (".pyc", ".pyo", ".log", ".tsbuildinfo")


def read_version() -> str:
    package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    version = str(package.get("version", "")).strip()
    if not version:
        raise SystemExit("package.json has no version")
    return version


def include_file(path: Path) -> bool:
    if path.name in EXCLUDED_NAMES:
        return False
    if path.name.endswith(EXCLUDED_SUFFIXES):
        return False
    # Keep the documented template, skip real environment files.
    if path.name.startswith(".env") and path.name != ".env.example":
        return False
    return True


def collect_files() -> list[Path]:
    files: list[Path] = []
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        relative = path.relative_to(ROOT)
        if any(part in EXCLUDED_DIRS for part in relative.parts[:-1]):
            continue
        if not include_file(path):
            continue
        files.append(relative)
    return sorted(files, key=lambda item: item.as_posix())


def build_archive(version: str, output_dir: Path) -> tuple[Path, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    archive = output_dir / f"mitsu-{version}.zip"
    checksum = output_dir / f"mitsu-{version}.zip.sha256"

    files = collect_files()
    if not files:
        raise SystemExit("nothing to package")

    prefix = f"mitsu-{version}"
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as bundle:
        for relative in files:
            bundle.write(ROOT / relative, f"{prefix}/{relative.as_posix()}")

    digest = hashlib.sha256()
    with archive.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    checksum.write_text(f"{digest.hexdigest()}  {archive.name}\n", encoding="utf-8")

    size_mb = archive.stat().st_size / (1024 * 1024)
    print(f"  files    {len(files)}")
    print(f"  archive  {archive} ({size_mb:.1f} MB)")
    print(f"  sha256   {digest.hexdigest()}")
    return archive, checksum


def main() -> None:
    parser = argparse.ArgumentParser(description="Package Mitsu for distribution.")
    parser.add_argument(
        "--output",
        default="dist",
        help="output directory, relative to the repo root (default: dist)",
    )
    parser.add_argument(
        "--expect",
        help="fail unless this version matches package.json (accepts a v prefix)",
    )
    args = parser.parse_args()

    version = read_version()
    if args.expect and args.expect.lstrip("v") != version:
        raise SystemExit(
            f"version mismatch: package.json says {version}, tag says {args.expect}"
        )

    print(f"\n  mitsu {version}\n")
    output_dir = (ROOT / args.output).resolve()
    build_archive(version, output_dir)
    print("\n  Done. Extract the zip, then follow README.md to install.\n")


if __name__ == "__main__":
    sys.exit(main())
