from functools import lru_cache
from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=REPO_ROOT / ".env", extra="ignore")

    model_api_key: SecretStr | None = None
    data_dir: Path = REPO_ROOT / "data"


@lru_cache
def get_settings() -> Settings:
    return Settings()
