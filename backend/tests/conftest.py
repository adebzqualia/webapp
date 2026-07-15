from __future__ import annotations

import os
import shutil
import tempfile
from pathlib import Path

import pytest

TEST_ROOT = Path(tempfile.mkdtemp(prefix="pops-backend-tests-"))
os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = f"sqlite:///{(TEST_ROOT / 'test.db').as_posix()}"
os.environ["STORAGE_ROOT"] = str(TEST_ROOT / "storage")
os.environ["DEFAULT_ORGANIZATION"] = "test-org"
os.environ["DEFAULT_USER"] = "test-user"
os.environ["ANALYSIS_AUTO_RUN"] = "false"

from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.services.runtime import (  # noqa: E402
    get_security_validator,
    get_storage,
    get_table_detector,
    get_workbook_reader,
)


@pytest.fixture(autouse=True)
def clean_database_and_storage():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    storage_dir = TEST_ROOT / "storage"
    if storage_dir.exists():
        shutil.rmtree(storage_dir)
    get_storage.cache_clear()
    get_security_validator.cache_clear()
    get_workbook_reader.cache_clear()
    get_table_detector.cache_clear()
    yield


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def pytest_sessionfinish(session, exitstatus):
    shutil.rmtree(TEST_ROOT, ignore_errors=True)
