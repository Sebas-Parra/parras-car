import os

os.environ.setdefault("JWT_SECRET", "test-secret-for-unit-tests")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.deps import get_bearer_token, get_current_user, get_db, require_admin, require_self_or_admin
from app.db import listeners  # noqa: F401 — registers audit interceptors
from app.db.base import Base
from app.entities import vehicle_assignment, assignment_audit  # noqa: F401
from app.main import app

SQLALCHEMY_TEST_DATABASE_URL = "sqlite://"

engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

USER_ID = "11111111-1111-1111-1111-111111111111"
VEHICLE_ID = "22222222-2222-2222-2222-222222222222"
VEHICLE_ID_2 = "33333333-3333-3333-3333-333333333333"


@pytest.fixture()
def db_session():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


ADMIN_USER = {"sub": USER_ID, "roles": ["admin"]}


@pytest.fixture()
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    def override_get_current_user():
        return ADMIN_USER

    def override_require_admin():
        return ADMIN_USER

    def override_require_self_or_admin():
        return ADMIN_USER

    def override_get_bearer_token():
        return "test-token"

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[require_admin] = override_require_admin
    app.dependency_overrides[require_self_or_admin] = override_require_self_or_admin
    app.dependency_overrides[get_bearer_token] = override_get_bearer_token
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
