"""`GET /health` — liveness only.

Deliberately shallow: this service has no database and no readiness concept
beyond "the process is up" (AI-SIDEBAR-PLAN.md §0). The v1 API it depends on is
checked at tool-call time, where a failure can actually be reported to the user,
not at boot.
"""

from datetime import datetime

from fastapi.testclient import TestClient

from app.main import VERSION, app

client = TestClient(app)


def test_health_returns_ok() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["version"] == VERSION


def test_health_timestamp_is_a_real_datetime() -> None:
    """The field is typed `datetime`, so a broken serialization would surface here
    rather than as an unparseable string in a client."""
    body = client.get("/health").json()

    assert isinstance(datetime.fromisoformat(body["timestamp"]), datetime)


def test_health_reports_a_commit() -> None:
    """`"unknown"` locally (nothing sets GIT_COMMIT in dev); a real hash in a deploy."""
    assert client.get("/health").json()["commit"]
