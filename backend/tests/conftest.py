"""Shared fixtures: a synthetic droid_100 source and the app running against a fresh data dir."""

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from winnow.app import create_app
from winnow.core.settings import Settings
from winnow.episodes.fixtures import write_fixture_source
from winnow.episodes.fixtures_droid101 import write_droid101_fixture

# Episode 3 of the fixture source has unreadable video; in Episode 4 the gripper never closes.
CORRUPT_EPISODE = 3
OPEN_GRIPPER_EPISODE = 4


@pytest.fixture(scope="session")
def droid100_root(tmp_path_factory: pytest.TempPathFactory) -> Path:
    root = tmp_path_factory.mktemp("droid_100")
    return write_fixture_source(
        root, episodes=5, corrupt=(CORRUPT_EPISODE,), open_gripper=(OPEN_GRIPPER_EPISODE,)
    )


@pytest.fixture(scope="session")
def droid101_root(tmp_path_factory: pytest.TempPathFactory) -> Path:
    return write_droid101_fixture(tmp_path_factory.mktemp("droid_1.0.1"))


@pytest.fixture
def settings(tmp_path: Path, droid100_root: Path, droid101_root: Path) -> Settings:
    return Settings(
        model_api_key=None,
        data_dir=tmp_path / "data",
        droid100_root=droid100_root,
        droid101_root=droid101_root,
    )


@pytest.fixture
def api(settings: Settings) -> Iterator[TestClient]:
    with TestClient(create_app(settings)) as client:
        yield client
