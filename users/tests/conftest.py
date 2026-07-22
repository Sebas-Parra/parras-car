import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.deps import get_db
from app.db.base import Base
from app.entities.person import Person
from app.entities.role import Role
from app.entities.user import User
from app.main import app
from app.utils.security import create_access_token, hash_password

SQLALCHEMY_TEST_DATABASE_URL = "sqlite://"

engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

ROLE_NAMES = ["estudiante", "profesor", "administrador", "visitante", "cliente"]
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
    return {role.name: str(role.id) for role in db_session.query(Role).all()}


@pytest.fixture()
def admin_auth_headers(db_session):
    """Bearer token headers for the fixture's seeded admin/Admin123! user.

    Built directly with create_access_token (rather than via POST /auth/login)
    so these HTTP-level tests can exercise the real controller -> Depends()
    -> service wiring without depending on the auth flow itself.
    """
    admin_user = db_session.query(User).filter(User.username == "admin").one()
    roles = [role.name for role in admin_user.roles]
    token = create_access_token(
        user_id=str(admin_user.id_person),
        username=admin_user.username,
        roles=roles,
    )
    return {"Authorization": f"Bearer {token}"}


