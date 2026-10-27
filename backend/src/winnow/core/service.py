from winnow.core.models import Health
from winnow.core.settings import Settings


def check_health(settings: Settings) -> Health:
    return Health(status="ok", meta_api_key_configured=settings.model_api_key is not None)
