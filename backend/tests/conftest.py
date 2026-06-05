import os

import pytest
from fastapi.testclient import TestClient

from database import init_db
from main import app


@pytest.fixture
def client(tmp_path):
    os.environ["DB_PATH"] = str(tmp_path / "test.db")
    init_db()
    with TestClient(app, raise_server_exceptions=True) as test_client:
        yield test_client
