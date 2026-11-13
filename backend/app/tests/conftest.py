import os
from pathlib import Path

import pytest

TEST_DB = Path(__file__).resolve().parent / "test_portsync.db"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB.as_posix()}"
os.environ["SIM_ENABLED"] = "false"
os.environ["LLM_API_KEY"] = ""

from fastapi.testclient import TestClient  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.core.database import engine  # noqa: E402
from app.main import app  # noqa: E402

settings.sim_enabled = False


@pytest.fixture(scope="session")
def client():
    if TEST_DB.exists():
        TEST_DB.unlink()
    with TestClient(app) as test_client:
        login = test_client.post(
            "/api/auth/login",
            json={"email": "priya.menon@portsync.demo", "password": settings.demo_password},
        )
        assert login.status_code == 200, login.text
        test_client.headers.update({"X-CSRF-Token": login.json()["csrf_token"]})
        yield test_client
    engine.dispose()
    if TEST_DB.exists():
        TEST_DB.unlink()


@pytest.fixture()
def api(client):
    response = client.post("/api/system/reset-demo", json={"confirm": "RESET"})
    assert response.status_code == 200
    return client
