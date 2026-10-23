import os
import tempfile

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("MITSU_DATA_DIR", tempfile.mkdtemp())

from app.main import app
from app.services.importer import _is_unsafe_name


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_galleries_empty(client):
    response = client.get("/api/v1/galleries")
    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["total"] == 0


def test_settings_shape(client):
    response = client.get("/api/v1/settings")
    assert response.status_code == 200
    body = response.json()
    assert "preferences" in body
    assert "paths" in body
    assert "stats" in body


def test_collection_lifecycle(client):
    created = client.post("/api/v1/collections", json={"name": "Test collection"})
    assert created.status_code == 201
    collection_id = created.json()["id"]

    fetched = client.get(f"/api/v1/collections/{collection_id}")
    assert fetched.status_code == 200
    assert fetched.json()["name"] == "Test collection"

    deleted = client.delete(f"/api/v1/collections/{collection_id}")
    assert deleted.status_code in (200, 204)


def test_unsafe_archive_names():
    assert _is_unsafe_name("../secret.txt")
    assert _is_unsafe_name("nested/../../secret.txt")
    assert _is_unsafe_name("/absolute/path.png")
    assert _is_unsafe_name("__MACOSX/._file")
    assert not _is_unsafe_name("folder/page-001.jpg")
