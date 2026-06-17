import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.deps import get_db
from app.core.security import hash_password
from app.db.base import Base
from app.main import app
from app.models.person import Person
from app.models.role import Role
from app.models.user import User

SQLALCHEMY_TEST_DATABASE_URL = "sqlite://"

engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

ROLE_NAMES = ["estudiante", "profesor", "administrador", "visitante"]
ADMIN_PASSWORD = "Admin123!"


@pytest.fixture()
def db_session():
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        for name in ROLE_NAMES:
            session.add(Role(name=name, description=name.capitalize()))
        session.flush()

        admin_person = Person(
            cedula="0000000000",
            first_name="Admin",
            last_name="System",
            email="admin@example.com",
        )
        session.add(admin_person)
        session.flush()

        admin_role = session.query(Role).filter(Role.name == "administrador").one()
        admin_user = User(
            id_person=admin_person.id,
            username="admin",
            password_hash=hash_password(ADMIN_PASSWORD),
        )
        admin_user.roles.append(admin_role)
        session.add(admin_user)
        session.commit()

        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def role_ids(db_session):
    return {role.name: role.id for role in db_session.query(Role).all()}


@pytest.fixture()
def admin_token(client):
    response = client.post("/auth/login", data={"username": "admin", "password": ADMIN_PASSWORD})
    return response.json()["access_token"]


@pytest.fixture()
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}
