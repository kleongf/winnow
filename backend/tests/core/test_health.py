from fastapi.testclient import TestClient
from pydantic import SecretStr

from winnow.app import create_app
from winnow.core.settings import Settings, get_settings


def client_with(settings: Settings) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_settings] = lambda: settings
    return TestClient(app)


def test_health_reports_missing_key():
    response = client_with(Settings(model_api_key=None)).get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "meta_api_key_configured": False}


def test_health_reports_configured_key():
    response = client_with(Settings(model_api_key=SecretStr("test"))).get("/api/health")

    assert response.json()["meta_api_key_configured"] is True
