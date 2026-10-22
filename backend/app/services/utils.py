import hashlib
import re
from pathlib import Path

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}

MIME_BY_EXT = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".avif": "image/avif",
}


def natural_key(value: str):
    return [int(part) if part.isdigit() else part.lower() for part in re.split(r"(\d+)", value)]


def mime_for(path: Path) -> str:
    return MIME_BY_EXT.get(path.suffix.lower(), "application/octet-stream")


def human_title(path: Path) -> str:
    """Turn a filename into a readable title without losing meaningful text."""
    title = path.stem if path.is_file() else path.name
    title = title.replace("_", " ")
    title = re.sub(r"\[(?:Digital|English|Ongoing|Complete)\]", "", title, flags=re.I)
    title = re.sub(r"\s+", " ", title).strip(" -_")
    return title or path.stem


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(chunk_size), b""):
            digest.update(chunk)
    return digest.hexdigest()


def folder_fingerprint(files: list[Path], base: Path) -> str:
    digest = hashlib.sha256()
    ordered = sorted(files, key=lambda file: natural_key(file.relative_to(base).as_posix()))
    for file in ordered:
        digest.update(file.relative_to(base).as_posix().encode("utf-8"))
        digest.update(str(file.stat().st_size).encode("ascii"))
    return digest.hexdigest()
