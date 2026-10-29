"""Shared fixtures: a synthetic droid_100 source and the app running against a fresh data dir."""

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from winnow.app import create_app
from winnow.core.settings import Settings
from winnow.episodes.fixtures import write_fixture_source

# Episode 3 of the fixture source has unreadable video.
CORRUPT_EPISODE = 3


@pytest.fixture(scope="session")
def droid100_root(tmp_path_factory: pytest.TempPathFactory) -> Path:
    root = tmp_path_factory.mktemp("droid_100")
    return write_fixture_source(root, episodes=4, corrupt=(CORRUPT_EPISODE,))


@pytest.fixture
def settings(tmp_path: Path, droid100_root: Path) -> Settings:
    return Settings(model_api_key=None, data_dir=tmp_path / "data", droid100_root=droid100_root)


@pytest.fixture
def api(settings: Settings) -> Iterator[TestClient]:
    with TestClient(create_app(settings)) as client:
        yield client
