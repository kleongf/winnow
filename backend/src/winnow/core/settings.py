from functools import lru_cache
from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=REPO_ROOT / ".env", extra="ignore")

    model_api_key: SecretStr | None = None
    meta_base_url: str = "https://api.meta.ai/v1"
    meta_budget_usd: float = 5.0  # hard stop on total recorded Meta API spend
    data_dir: Path = REPO_ROOT / "data"

    @property
    def db_path(self) -> Path:
        return self.data_dir / "winnow.db"


@lru_cache
def get_settings() -> Settings:
    return Settings()
