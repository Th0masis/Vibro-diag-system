import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import main as backend_main  # noqa: E402


class _DummyReloadResponse:
    def raise_for_status(self):
        return None


@pytest.fixture
def client_and_engine(tmp_path, monkeypatch):
    db_path = tmp_path / "activation_gate_test.sqlite"
    test_engine = create_engine(f"sqlite:///{db_path}")

    with test_engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE ml_models (
                id_model INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT,
                training_status TEXT,
                accuracy REAL,
                is_active BOOLEAN
            )
        """))

        conn.execute(text("""
            INSERT INTO ml_models (id_model, name, type, training_status, accuracy, is_active)
            VALUES
                (101, 'CNN_NOT_READY', 'Fault Classification CNN', 'training', 0.95, 0),
                (102, 'CNN_NO_SCORE', 'Fault Classification CNN', 'ready', NULL, 0),
                (103, 'CNN_LOW_SCORE', 'Fault Classification CNN', 'ready', 0.40, 0),
                (104, 'CNN_PASS', 'Fault Classification CNN', 'ready', 0.90, 0),
                (105, 'CNN_PASS', 'Fault Classification CNN', 'ready', 0.80, 1)
        """))

    monkeypatch.setattr(backend_main, "engine", test_engine)
    monkeypatch.setattr(backend_main.requests, "post", lambda *args, **kwargs: _DummyReloadResponse())

    client = TestClient(backend_main.app)
    return client, test_engine


def _auth_headers():
    return {"Authorization": "Bearer test-token"}


def test_activate_rejects_not_ready_model(client_and_engine):
    client, _ = client_and_engine

    res = client.put("/models/101/activate", headers=_auth_headers())

    assert res.status_code == 409
    assert "training_status" in res.json()["detail"]


def test_activate_rejects_ready_model_without_score(client_and_engine):
    client, _ = client_and_engine

    res = client.put("/models/102/activate", headers=_auth_headers())

    assert res.status_code == 409
    assert "evaluation_score" in res.json()["detail"]


def test_activate_rejects_ready_model_with_low_score(client_and_engine):
    client, _ = client_and_engine

    res = client.put("/models/103/activate", headers=_auth_headers())

    assert res.status_code == 409
    assert "quality gate" in res.json()["detail"]


def test_activate_passes_and_switches_active_version(client_and_engine):
    client, engine = client_and_engine

    res = client.put("/models/104/activate", headers=_auth_headers())

    assert res.status_code == 200
    payload = res.json()
    assert payload["status"] == "success"

    with engine.connect() as conn:
        active_rows = conn.execute(text("SELECT id_model, is_active FROM ml_models WHERE name = 'CNN_PASS' ORDER BY id_model")).fetchall()

    assert len(active_rows) == 2
    assert active_rows[0][0] == 104 and bool(active_rows[0][1]) is True
    assert active_rows[1][0] == 105 and bool(active_rows[1][1]) is False
