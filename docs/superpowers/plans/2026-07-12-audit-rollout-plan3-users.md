# Plan 3: users audit publisher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `users` FastAPI/SQLAlchemy microservice publish audit events to the centralized `ms-audit` service on login, logout, and every person/user CRUD mutation.

**Architecture:** Unlike the NestJS services (`vehicles`/`tickets`, which keep a persistent reconnecting RabbitMQ connection via `amqplib`), `users` gets a single small `publish_audit_event()` function using `pika`'s synchronous `BlockingConnection`: it opens a connection, publishes one message, and closes — per call, not persistent. This is simpler to reason about in a synchronous WSGI-style FastAPI request path and needs no lifespan/reconnect state machine. Failures (RabbitMQ unreachable) are caught and logged, never raised, so a `ms-audit` outage never breaks a login or a user update — the same non-blocking-failure contract `vehicles`/`tickets` already follow.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic Settings, `pika`, pytest.

## Global Constraints

- Every event's `servicio` is exactly `'ms-users'` and `entidad` is exactly `'USUARIO'` — `ms-audit`'s allow-list (`ms-audit/src/audit/dto/create-audit-event.dto.ts`'s `ENTIDADES_VALIDAS`) has no `'PERSONA'` entry, so **both** `Person` and `User` mutations use `entidad='USUARIO'`. Do not add a new entidad value — that would require changing `ms-audit`, which is out of scope for this plan.
- `accion` is one of `CREATE|UPDATE|DELETE|LOGIN|LOGOUT|SELECT` (`ms-audit`'s existing regex). This plan uses `CREATE` (self-registration), `UPDATE` (profile/role edits, reactivation), `DELETE` (deactivation — the closest fit for "no longer active" in the fixed enum, the same choice Plan 2 made for `tickets.cancel`), `LOGIN`, `LOGOUT`.
- `usuario`/`rol` are mandatory on every event `ms-audit` accepts. For every authenticated mutation, they come from the JWT-derived `current_user` dict (`current_user["username"]`, `current_user["roles"][0]`), never from request body. The one exception is self-registration (`create_person_with_user`), where no JWT exists yet — there `usuario`/`rol` are the identity just created (the new username, and `"cliente"`, since self-registration always assigns the `cliente` role).
- A `ms-audit`/RabbitMQ outage must never fail a `users` request — every publish call is wrapped so exceptions are caught and logged, not raised.

---

### Task 1: Add the RabbitMQ audit publisher to `users`

**Files:**
- Create: `users/app/services/audit_publisher.py`
- Test: `users/tests/test_audit_publisher.py`
- Modify: `users/requirements.txt`
- Modify: `users/app/core/config.py`
- Modify: `users/.env.example`

**Interfaces:**
- Produces: `publish_audit_event(accion: str, entidad_id: str, usuario: str, rol: str, datos: dict | None = None) -> None`, importable as `from app.services.audit_publisher import publish_audit_event` — Tasks 2-4 call this directly.

- [ ] **Step 1: Add `pika` to `users/requirements.txt`**

Append:

```
pika==1.3.2
```

- [ ] **Step 2: Install it**

Run: `cd users && pip install -r requirements.txt` (or into whatever virtualenv this project uses)
Expected: installs without errors.

- [ ] **Step 3: Add RabbitMQ settings to `users/app/core/config.py`**

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5433/auth_db"

    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_issuer: str = "parras-app-key"
    jwt_expire_minutes: int = 60 * 24  # 24 hours
    refresh_token_expire_days: int = 7

    rabbitmq_host: str = "localhost"
    rabbitmq_port: int = 5672
    rabbitmq_user: str = "guest"
    rabbitmq_password: str = "guest"
    rabbitmq_exchange: str = "audit_exchange"
    rabbitmq_routing_key: str = "audit_event"


settings = Settings()
```

- [ ] **Step 4: Write the failing test**

Create `users/tests/test_audit_publisher.py`:

```python
import json
from unittest.mock import MagicMock, patch

from app.services.audit_publisher import publish_audit_event


@patch("app.services.audit_publisher.pika.BlockingConnection")
def test_publishes_event_with_expected_payload(mock_blocking_connection):
    mock_channel = MagicMock()
    mock_connection = MagicMock()
    mock_connection.channel.return_value = mock_channel
    mock_blocking_connection.return_value = mock_connection

    publish_audit_event(
        accion="CREATE",
        entidad_id="user-1",
        usuario="jdoe",
        rol="cliente",
        datos={"username": "jdoe"},
    )

    mock_channel.exchange_declare.assert_called_once()
    mock_channel.basic_publish.assert_called_once()
    _, kwargs = mock_channel.basic_publish.call_args
    payload = json.loads(kwargs["body"])
    assert payload == {
        "servicio": "ms-users",
        "accion": "CREATE",
        "entidad": "USUARIO",
        "entidadId": "user-1",
        "datos": {"username": "jdoe"},
        "usuario": "jdoe",
        "rol": "cliente",
    }
    mock_connection.close.assert_called_once()


@patch(
    "app.services.audit_publisher.pika.BlockingConnection",
    side_effect=Exception("boom"),
)
def test_does_not_raise_when_rabbitmq_is_unreachable(mock_blocking_connection):
    # Must not raise — a broker outage cannot break the caller's request.
    publish_audit_event(
        accion="CREATE",
        entidad_id="user-1",
        usuario="jdoe",
        rol="cliente",
    )
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd users && JWT_SECRET=test_secret pytest tests/test_audit_publisher.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.audit_publisher'`

- [ ] **Step 6: Create `audit_publisher.py`**

`users/app/services/audit_publisher.py`:

```python
import json
import logging
from typing import Any

import pika

from app.core.config import settings

logger = logging.getLogger(__name__)


def publish_audit_event(
    accion: str,
    entidad_id: str,
    usuario: str,
    rol: str,
    datos: dict[str, Any] | None = None,
) -> None:
    event = {
        "servicio": "ms-users",
        "accion": accion,
        "entidad": "USUARIO",
        "entidadId": entidad_id,
        "datos": datos,
        "usuario": usuario,
        "rol": rol,
    }
    try:
        credentials = pika.PlainCredentials(settings.rabbitmq_user, settings.rabbitmq_password)
        connection = pika.BlockingConnection(
            pika.ConnectionParameters(
                host=settings.rabbitmq_host,
                port=settings.rabbitmq_port,
                credentials=credentials,
            )
        )
        channel = connection.channel()
        channel.exchange_declare(
            exchange=settings.rabbitmq_exchange,
            exchange_type="topic",
            durable=True,
        )
        channel.basic_publish(
            exchange=settings.rabbitmq_exchange,
            routing_key=settings.rabbitmq_routing_key,
            body=json.dumps(event, default=str).encode("utf-8"),
            properties=pika.BasicProperties(delivery_mode=2),
        )
        connection.close()
    except Exception:
        logger.exception(
            "No se pudo publicar el evento de auditoría: %s %s", accion, entidad_id
        )
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd users && JWT_SECRET=test_secret pytest tests/test_audit_publisher.py -v`
Expected: PASS (2/2)

- [ ] **Step 8: Add the RabbitMQ block to `users/.env.example`**

Append to `users/.env.example`:

```

RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
RABBITMQ_EXCHANGE=audit_exchange
RABBITMQ_ROUTING_KEY=audit_event
```

- [ ] **Step 9: Commit**

```bash
git add users/requirements.txt users/app/core/config.py users/app/services/audit_publisher.py users/tests/test_audit_publisher.py users/.env.example
git commit -m "feat(users): add RabbitMQ audit event publisher"
```

---

### Task 2: Emit LOGIN/LOGOUT audit events

**Files:**
- Modify: `users/app/services/auth_service.py`
- Test: `users/tests/test_auth_service_audit.py`

**Interfaces:**
- Consumes: `publish_audit_event` from `app.services.audit_publisher` (Task 1).

- [ ] **Step 1: Write the failing test**

Create `users/tests/test_auth_service_audit.py`. This calls `auth_service` directly against the shared `db_session` fixture from `tests/conftest.py` (which seeds an `admin` user with role `administrador` and password `Admin123!`), bypassing the HTTP/auth layer entirely so this test doesn't depend on the app's controller wiring:

```python
from unittest.mock import patch

from app.dto.auth import LoginRequest, LogoutRequest
from app.services import auth_service


@patch("app.services.auth_service.publish_audit_event")
def test_login_publishes_login_event(mock_publish, db_session):
    auth_service.login(db_session, LoginRequest(username="admin", password="Admin123!"))

    mock_publish.assert_called_once()
    kwargs = mock_publish.call_args.kwargs
    assert kwargs["accion"] == "LOGIN"
    assert kwargs["usuario"] == "admin"
    assert kwargs["rol"] == "administrador"


@patch("app.services.auth_service.publish_audit_event")
def test_logout_publishes_logout_event(mock_publish, db_session):
    response = auth_service.login(db_session, LoginRequest(username="admin", password="Admin123!"))
    mock_publish.reset_mock()

    auth_service.logout(db_session, LogoutRequest(refresh_token=response.refresh_token))

    mock_publish.assert_called_once()
    kwargs = mock_publish.call_args.kwargs
    assert kwargs["accion"] == "LOGOUT"
    assert kwargs["usuario"] == "admin"
    assert kwargs["rol"] == "administrador"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd users && JWT_SECRET=test_secret pytest tests/test_auth_service_audit.py -v`
Expected: FAIL — `auth_service.publish_audit_event` doesn't exist to patch yet (`login`/`logout` don't call it).

- [ ] **Step 3: Update `auth_service.py`**

```python
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.dto.auth import LoginRequest, LogoutRequest, RefreshRequest, TokenResponse
from app.repositories import refresh_token_repository, user_repository
from app.services.audit_publisher import publish_audit_event
from app.utils.security import create_access_token, generate_refresh_token, verify_password


def _build_response(db: Session, user) -> TokenResponse:
    roles = [r.name for r in user.roles]
    access_token = create_access_token(str(user.id_person), user.username, roles)

    rt_value = generate_refresh_token()
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    refresh_token_repository.create(db, user.id_person, rt_value, expires_at)

    return TokenResponse(
        access_token=access_token,
        refresh_token=rt_value,
        expires_in=settings.jwt_expire_minutes * 60,
        user_id=str(user.id_person),
        username=user.username,
        roles=roles,
    )


def login(db: Session, data: LoginRequest) -> TokenResponse:
    user = user_repository.get_by_username(db, data.username)
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
        )
    if not user.active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo. Contacte al administrador.",
        )

    user.last_login = datetime.now(timezone.utc)
    response = _build_response(db, user)
    db.commit()

    publish_audit_event(
        accion="LOGIN",
        entidad_id=response.user_id,
        usuario=response.username,
        rol=response.roles[0] if response.roles else "",
        datos={"username": response.username},
    )
    return response


def refresh(db: Session, data: RefreshRequest) -> TokenResponse:
    rt = refresh_token_repository.get_by_token(db, data.refresh_token)

    if not rt or rt.revoked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido o revocado.",
        )

    exp = rt.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expirado. Inicia sesión nuevamente.",
        )

    # Rotación: revocar el token usado antes de emitir uno nuevo
    refresh_token_repository.revoke(db, rt)

    user = user_repository.get_by_id(db, rt.id_user)
    if not user or not user.active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo.",
        )

    response = _build_response(db, user)
    db.commit()
    return response


def logout(db: Session, data: LogoutRequest) -> None:
    rt = refresh_token_repository.get_by_token(db, data.refresh_token)
    if rt and not rt.revoked:
        user = user_repository.get_by_id(db, rt.id_user)
        refresh_token_repository.revoke(db, rt)
        db.commit()

        if user:
            roles = [r.name for r in user.roles]
            publish_audit_event(
                accion="LOGOUT",
                entidad_id=str(user.id_person),
                usuario=user.username,
                rol=roles[0] if roles else "",
                datos={"username": user.username},
            )
```

(`refresh()` is unchanged — the plan's global constraints list only `LOGIN`/`LOGOUT`, and a token refresh isn't a login or logout event.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd users && JWT_SECRET=test_secret pytest tests/test_auth_service_audit.py -v`
Expected: PASS (2/2)

- [ ] **Step 5: Run the full users test suite**

Run: `cd users && JWT_SECRET=test_secret pytest -v`
Expected: the two new test files pass. Some pre-existing tests in `tests/test_persons.py`, `tests/test_users.py`, `tests/test_roles.py` were already failing before this plan (confirmed by running the suite before starting this work — e.g. `test_list_persons` fails with `401 == 200`, `test_create_person_with_user` fails with `500 == 201`) due to pre-existing gaps unrelated to audit logging (missing auth headers in those tests, and a `cliente` role not seeded by `conftest.py`'s fixture despite `person_service.create_person_with_user` requiring it). Do not attempt to fix those — only confirm your new tests pass and that you haven't made the pre-existing failures worse (same tests failing, same reasons).

- [ ] **Step 6: Commit**

```bash
git add users/app/services/auth_service.py users/tests/test_auth_service_audit.py
git commit -m "feat(users): publish LOGIN/LOGOUT audit events"
```

---

### Task 3: Emit audit events on person CRUD

**Files:**
- Modify: `users/app/controllers/persons.py`
- Modify: `users/app/services/person_service.py`
- Test: `users/tests/test_person_service_audit.py`

**Interfaces:**
- Consumes: `publish_audit_event` from `app.services.audit_publisher` (Task 1).
- Produces: `person_service.create_person_with_user(db, data)` (signature unchanged — no `current_user`, this is public self-registration), `person_service.update_person(db, person_id, data, current_user: dict)`, `person_service.deactivate_person(db, person_id, current_user: dict)`, `person_service.activate_person(db, person_id, current_user: dict)`.

- [ ] **Step 1: Write the failing test**

Create `users/tests/test_person_service_audit.py`. This adds a `cliente` role directly (the shared `conftest.py` fixture doesn't seed one, which is a pre-existing gap unrelated to this task — adding it locally here keeps this test self-contained rather than depending on a conftest fix):

```python
from unittest.mock import patch

from app.dto.person import PersonUpdate
from app.dto.user import UserCreate
from app.entities.role import Role
from app.services import person_service


def _ensure_cliente_role(db_session):
    role = db_session.query(Role).filter(Role.name == "cliente").first()
    if role is None:
        role = Role(name="cliente", description="Cliente")
        db_session.add(role)
        db_session.flush()
    return role


@patch("app.services.person_service.publish_audit_event")
def test_create_person_with_user_publishes_create_event(mock_publish, db_session):
    _ensure_cliente_role(db_session)

    data = UserCreate(
        cedula="1710000017",
        first_name="Pepe",
        middle_name="Mario",
        last_name="Diaz",
        email="pepe@example.com",
        phone="0991234567",
        address="Calle Falsa 123",
        nationality="Ecuatoriana",
        password="Password123",
    )

    person = person_service.create_person_with_user(db_session, data)

    mock_publish.assert_called_once()
    kwargs = mock_publish.call_args.kwargs
    assert kwargs["accion"] == "CREATE"
    assert kwargs["entidad_id"] == str(person.id)
    assert kwargs["usuario"] == person.user.username
    assert kwargs["rol"] == "cliente"


@patch("app.services.person_service.publish_audit_event")
def test_update_person_publishes_update_event(mock_publish, db_session):
    _ensure_cliente_role(db_session)
    data = UserCreate(
        cedula="1710000025",
        first_name="Update",
        middle_name="Me",
        last_name="Me",
        email="updateme@example.com",
        phone="0991234567",
        address="Calle Falsa 123",
        nationality="Ecuatoriana",
        password="Password123",
    )
    person = person_service.create_person_with_user(db_session, data)
    mock_publish.reset_mock()
    current_user = {"username": "admin", "roles": ["administrador"]}

    person_service.update_person(db_session, person.id, PersonUpdate(phone="0987654321"), current_user)

    mock_publish.assert_called_once()
    kwargs = mock_publish.call_args.kwargs
    assert kwargs["accion"] == "UPDATE"
    assert kwargs["usuario"] == "admin"
    assert kwargs["rol"] == "administrador"


@patch("app.services.person_service.publish_audit_event")
def test_deactivate_person_publishes_delete_event(mock_publish, db_session):
    _ensure_cliente_role(db_session)
    data = UserCreate(
        cedula="1710000033",
        first_name="Deact",
        middle_name="Me",
        last_name="Me",
        email="deactme@example.com",
        phone="0991234567",
        address="Calle Falsa 123",
        nationality="Ecuatoriana",
        password="Password123",
    )
    person = person_service.create_person_with_user(db_session, data)
    mock_publish.reset_mock()
    current_user = {"username": "admin", "roles": ["administrador"]}

    person_service.deactivate_person(db_session, person.id, current_user)

    mock_publish.assert_called_once()
    kwargs = mock_publish.call_args.kwargs
    assert kwargs["accion"] == "DELETE"
    assert kwargs["usuario"] == "admin"
    assert kwargs["rol"] == "administrador"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd users && JWT_SECRET=test_secret pytest tests/test_person_service_audit.py -v`
Expected: FAIL — `update_person`/`deactivate_person` don't accept a `current_user` argument yet, and none of the three functions publish anything.

- [ ] **Step 3: Update `person_service.py`**

```python
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.dto.person import PersonUpdate
from app.dto.user import UserCreate
from app.entities.person import Person
from app.entities.user import User
from app.repositories import person_repository, role_repository, user_repository
from app.services.audit_publisher import publish_audit_event
from app.utils import username as username_util
from app.utils.security import hash_password


def get_person(db: Session, person_id: UUID) -> Person:
    person = person_repository.get_by_id(db, person_id)
    if person is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Person not found")
    return person


def list_persons(db: Session, skip: int = 0, limit: int = 100) -> list[Person]:
    return person_repository.list_all(db, skip, limit)


def create_person_with_user(db: Session, data: UserCreate) -> Person:
    if person_repository.get_by_cedula(db, data.cedula):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cedula already registered")

    if person_repository.get_by_email(db, data.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"El correo '{data.email}' ya está registrado, por favor ingrese uno diferente",
        )

    # Self-registration always gets the 'cliente' role
    cliente_role = role_repository.get_by_name(db, "cliente")
    if cliente_role is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="El rol 'cliente' no está configurado en el sistema. Contacte al administrador.",
        )

    generated_username = username_util.generate_unique_username(
        data.first_name,
        data.middle_name,
        data.last_name,
        lambda u: user_repository.username_exists(db, u),
    )

    person = Person(
        cedula=data.cedula,
        first_name=data.first_name,
        middle_name=data.middle_name,
        last_name=data.last_name,
        email=data.email,
        phone=data.phone,
        address=data.address,
        nationality=data.nationality,
    )
    db.add(person)
    db.flush()

    user = User(
        id_person=person.id,
        username=generated_username,
        password_hash=hash_password(data.password),
    )
    user.roles = [cliente_role]
    db.add(user)
    db.commit()
    db.refresh(person)

    # Self-registration: no JWT actor exists yet, so usuario/rol are the
    # identity that was just created.
    publish_audit_event(
        accion="CREATE",
        entidad_id=str(person.id),
        usuario=generated_username,
        rol="cliente",
        datos={"username": generated_username, "email": person.email, "cedula": person.cedula},
    )
    return person


def update_person(db: Session, person_id: UUID, data: PersonUpdate, current_user: dict) -> Person:
    person = get_person(db, person_id)
    update_data = data.model_dump(exclude_unset=True)

    if "email" in update_data and update_data["email"] != person.email:
        if person_repository.get_by_email(db, update_data["email"]):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    for field, value in update_data.items():
        setattr(person, field, value)

    db.commit()
    db.refresh(person)

    roles = current_user.get("roles") or []
    publish_audit_event(
        accion="UPDATE",
        entidad_id=str(person.id),
        usuario=current_user.get("username", ""),
        rol=roles[0] if roles else "",
        datos=update_data,
    )
    return person


def deactivate_person(db: Session, person_id: UUID, current_user: dict) -> Person:
    person = get_person(db, person_id)
    if person.user is not None:
        person.user.active = False
    person.active = False
    db.commit()
    db.refresh(person)

    roles = current_user.get("roles") or []
    publish_audit_event(
        accion="DELETE",
        entidad_id=str(person.id),
        usuario=current_user.get("username", ""),
        rol=roles[0] if roles else "",
        datos={"active": False},
    )
    return person


def activate_person(db: Session, person_id: UUID, current_user: dict) -> Person:
    person = get_person(db, person_id)
    person.active = True
    db.commit()
    db.refresh(person)

    roles = current_user.get("roles") or []
    publish_audit_event(
        accion="UPDATE",
        entidad_id=str(person.id),
        usuario=current_user.get("username", ""),
        rol=roles[0] if roles else "",
        datos={"active": True},
    )
    return person
```

- [ ] **Step 4: Update `persons.py` to pass `current_user` through**

```python
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_admin, require_self_or_admin
from app.dto.person import PersonRead, PersonUpdate
from app.dto.user import PersonWithUserRead, UserCreate
from app.services import person_service

router = APIRouter(prefix="/persons", tags=["persons"])


# Public — self-registration, auto-assigns 'cliente' role
@router.post("", response_model=PersonWithUserRead, status_code=status.HTTP_201_CREATED)
def create_person(data: UserCreate, db: Session = Depends(get_db)):
    return person_service.create_person_with_user(db, data)


# Admin / root only
@router.get("", response_model=list[PersonRead])
def list_persons(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
):
    return person_service.list_persons(db, skip, limit)


# Own data or admin/root
@router.get("/{person_id}", response_model=PersonRead)
def get_person(
    person_id: UUID,
    db: Session = Depends(get_db),
    _: dict = Depends(require_self_or_admin),
):
    return person_service.get_person(db, person_id)


# Own data or admin/root
@router.put("/{person_id}", response_model=PersonRead)
def update_person(
    person_id: UUID,
    data: PersonUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_self_or_admin),
):
    return person_service.update_person(db, person_id, data, current_user)


# Admin / root only
@router.patch("/{person_id}/deactivate", response_model=PersonRead)
def deactivate_person(
    person_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    return person_service.deactivate_person(db, person_id, current_user)


# Admin / root only
@router.patch("/{person_id}/activate", response_model=PersonRead)
def activate_person(
    person_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    return person_service.activate_person(db, person_id, current_user)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd users && JWT_SECRET=test_secret pytest tests/test_person_service_audit.py -v`
Expected: PASS (3/3)

- [ ] **Step 6: Run the full users test suite**

Run: `cd users && JWT_SECRET=test_secret pytest -v`
Expected: your three new tests pass; the same pre-existing failures from Task 2's Step 5 remain (not made worse).

- [ ] **Step 7: Commit**

```bash
git add users/app/controllers/persons.py users/app/services/person_service.py users/tests/test_person_service_audit.py
git commit -m "feat(users): publish CREATE/UPDATE/DELETE audit events on person CRUD"
```

---

### Task 4: Emit audit events on user CRUD (profile, activation, roles)

**Files:**
- Modify: `users/app/controllers/users.py`
- Modify: `users/app/services/user_service.py`
- Test: `users/tests/test_user_service_audit.py`

**Interfaces:**
- Consumes: `publish_audit_event` from `app.services.audit_publisher` (Task 1).
- Produces: `user_service.update_user(db, user_id, data, current_user)`, `.deactivate_user(db, user_id, current_user)`, `.activate_user(db, user_id, current_user)`, `.assign_role(db, user_id, role_id, current_user)`, `.remove_role(db, user_id, role_id, current_user)`. `get_user`/`list_users` are unchanged (read-only, no audit event).

- [ ] **Step 1: Write the failing test**

Create `users/tests/test_user_service_audit.py`:

```python
from unittest.mock import patch

from app.dto.user import UserUpdate
from app.entities.role import Role
from app.services import user_service


CURRENT_USER = {"username": "admin", "roles": ["administrador"]}


def _get_admin_user(db_session):
    from app.entities.user import User

    return db_session.query(User).filter(User.username == "admin").one()


@patch("app.services.user_service.publish_audit_event")
def test_update_user_publishes_update_event(mock_publish, db_session):
    admin_user = _get_admin_user(db_session)

    user_service.update_user(db_session, admin_user.id_person, UserUpdate(username="admin2"), CURRENT_USER)

    mock_publish.assert_called_once()
    kwargs = mock_publish.call_args.kwargs
    assert kwargs["accion"] == "UPDATE"
    assert kwargs["usuario"] == "admin"
    assert kwargs["rol"] == "administrador"


@patch("app.services.user_service.publish_audit_event")
def test_deactivate_user_publishes_delete_event(mock_publish, db_session):
    admin_user = _get_admin_user(db_session)

    user_service.deactivate_user(db_session, admin_user.id_person, CURRENT_USER)

    mock_publish.assert_called_once()
    assert mock_publish.call_args.kwargs["accion"] == "DELETE"


@patch("app.services.user_service.publish_audit_event")
def test_assign_role_publishes_update_event(mock_publish, db_session):
    admin_user = _get_admin_user(db_session)
    visitante_role = db_session.query(Role).filter(Role.name == "visitante").one()

    user_service.assign_role(db_session, admin_user.id_person, visitante_role.id, CURRENT_USER)

    mock_publish.assert_called_once()
    assert mock_publish.call_args.kwargs["accion"] == "UPDATE"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd users && JWT_SECRET=test_secret pytest tests/test_user_service_audit.py -v`
Expected: FAIL — the service functions don't accept `current_user` yet, and never publish.

- [ ] **Step 3: Update `user_service.py`**

```python
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.dto.user import UserUpdate
from app.entities.user import User
from app.repositories import role_repository, user_repository
from app.services.audit_publisher import publish_audit_event


def get_user(db: Session, user_id: UUID) -> User:
    user = user_repository.get_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def list_users(db: Session, skip: int = 0, limit: int = 100) -> list[User]:
    return user_repository.list_all(db, skip, limit)


def _actor_role(current_user: dict) -> str:
    roles = current_user.get("roles") or []
    return roles[0] if roles else ""


def update_user(db: Session, user_id: UUID, data: UserUpdate, current_user: dict) -> User:
    user = get_user(db, user_id)
    update_data = data.model_dump(exclude_unset=True)

    if "username" in update_data and update_data["username"] != user.username:
        if user_repository.get_by_username(db, update_data["username"]):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already registered")

    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)

    publish_audit_event(
        accion="UPDATE",
        entidad_id=str(user.id_person),
        usuario=current_user.get("username", ""),
        rol=_actor_role(current_user),
        datos=update_data,
    )
    return user


def deactivate_user(db: Session, user_id: UUID, current_user: dict) -> User:
    user = get_user(db, user_id)
    user.active = False
    db.commit()
    db.refresh(user)

    publish_audit_event(
        accion="DELETE",
        entidad_id=str(user.id_person),
        usuario=current_user.get("username", ""),
        rol=_actor_role(current_user),
        datos={"active": False},
    )
    return user


def activate_user(db: Session, user_id: UUID, current_user: dict) -> User:
    user = get_user(db, user_id)
    if not user.person.active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot activate user while associated person is inactive",
        )
    user.active = True
    db.commit()
    db.refresh(user)

    publish_audit_event(
        accion="UPDATE",
        entidad_id=str(user.id_person),
        usuario=current_user.get("username", ""),
        rol=_actor_role(current_user),
        datos={"active": True},
    )
    return user


def assign_role(db: Session, user_id: UUID, role_id: UUID, current_user: dict) -> User:
    user = get_user(db, user_id)
    role = role_repository.get_by_id(db, role_id)
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    if role in user.roles:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Role already assigned")
    user.roles.append(role)
    db.commit()
    db.refresh(user)

    publish_audit_event(
        accion="UPDATE",
        entidad_id=str(user.id_person),
        usuario=current_user.get("username", ""),
        rol=_actor_role(current_user),
        datos={"role_added": role.name},
    )
    return user


def remove_role(db: Session, user_id: UUID, role_id: UUID, current_user: dict) -> User:
    user = get_user(db, user_id)
    role = role_repository.get_by_id(db, role_id)
    if role is None or role not in user.roles:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not assigned to user")
    user.roles.remove(role)
    db.commit()
    db.refresh(user)

    publish_audit_event(
        accion="UPDATE",
        entidad_id=str(user.id_person),
        usuario=current_user.get("username", ""),
        rol=_actor_role(current_user),
        datos={"role_removed": role.name},
    )
    return user
```

- [ ] **Step 4: Update `users.py` to pass `current_user` through**

```python
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_admin, require_self_or_admin
from app.dto.role import RoleAssign
from app.dto.user import UserDetailRead, UserRead, UserUpdate
from app.services import user_service

router = APIRouter(prefix="/users", tags=["users"])


# Admin / root only
@router.get("", response_model=list[UserRead])
def list_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
):
    return user_service.list_users(db, skip, limit)


# Own data or admin/root
@router.get("/{user_id}", response_model=UserDetailRead)
def get_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    _: dict = Depends(require_self_or_admin),
):
    return user_service.get_user(db, user_id)


# Own data or admin/root
@router.put("/{user_id}", response_model=UserRead)
def update_user(
    user_id: UUID,
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_self_or_admin),
):
    return user_service.update_user(db, user_id, data, current_user)


# Admin / root only
@router.patch("/{user_id}/deactivate", response_model=UserRead)
def deactivate_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    return user_service.deactivate_user(db, user_id, current_user)


# Admin / root only
@router.patch("/{user_id}/activate", response_model=UserRead)
def activate_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    return user_service.activate_user(db, user_id, current_user)


# Admin / root only
@router.post("/{user_id}/roles", response_model=UserRead)
def assign_role(
    user_id: UUID,
    data: RoleAssign,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    return user_service.assign_role(db, user_id, data.role_id, current_user)


# Admin / root only
@router.delete("/{user_id}/roles/{role_id}", response_model=UserRead)
def remove_role(
    user_id: UUID,
    role_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    return user_service.remove_role(db, user_id, role_id, current_user)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd users && JWT_SECRET=test_secret pytest tests/test_user_service_audit.py -v`
Expected: PASS (3/3)

- [ ] **Step 6: Run the full users test suite**

Run: `cd users && JWT_SECRET=test_secret pytest -v`
Expected: your new tests across Tasks 2-4 pass; the pre-existing failures identified in Task 2's Step 5 remain unchanged (not introduced or worsened by this task).

- [ ] **Step 7: Commit**

```bash
git add users/app/controllers/users.py users/app/services/user_service.py users/tests/test_user_service_audit.py
git commit -m "feat(users): publish UPDATE/DELETE audit events on user CRUD and role changes"
```

---

### Task 5: Wire `users` to `rabbitmq` in the root `docker-compose.yml` and verify end-to-end

**Files:**
- Modify: `docker-compose.yml` (repo root)

**Interfaces:**
- Produces: `users` reachable and able to publish to `rabbitmq:5672` in the compose network.

- [ ] **Step 1: Add RabbitMQ envs and the `rabbitmq` dependency to the `users` service block**

In `docker-compose.yml`'s `users` service, change:

```yaml
    environment:
      DATABASE_URL: postgresql+psycopg2://${DB_USER}:${DB_PASSWORD}@users-db:5432/${DB_NAME_USERS}
      JWT_SECRET: ${JWT_SECRET}
```

to:

```yaml
    environment:
      DATABASE_URL: postgresql+psycopg2://${DB_USER}:${DB_PASSWORD}@users-db:5432/${DB_NAME_USERS}
      JWT_SECRET: ${JWT_SECRET}
      RABBITMQ_HOST: ${RABBITMQ_HOST}
      RABBITMQ_PORT: ${RABBITMQ_PORT}
      RABBITMQ_USER: ${RABBITMQ_USER}
      RABBITMQ_PASSWORD: ${RABBITMQ_PASSWORD}
      RABBITMQ_EXCHANGE: ${RABBITMQ_EXCHANGE}
      RABBITMQ_ROUTING_KEY: ${RABBITMQ_ROUTING_KEY}
```

And change `users`'s `depends_on` from:

```yaml
    depends_on:
      users-db:
        condition: service_healthy
```

to:

```yaml
    depends_on:
      users-db:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
```

- [ ] **Step 2: Bring up the stack and verify end-to-end**

Run: `docker compose up -d --build rabbitmq users-db users`
Expected: all three containers report `Up`/`Up (healthy)` via `docker compose ps`.

- [ ] **Step 3: Trigger a real login and confirm the audit event round-trips through `ms-audit`**

This requires `ms-audit` and its dependencies up too (from Plan 1). Run:
`docker compose up -d --build rabbitmq audit-db ms-audit users-db users`

Register a user (public endpoint, no auth needed) and log in:

```bash
curl -s -X POST http://localhost:8000/persons -H 'Content-Type: application/json' -d '{
  "cedula": "1710000017", "first_name": "Pepe", "middle_name": "Mario", "last_name": "Diaz",
  "email": "pepe@example.com", "phone": "0991234567", "address": "Calle Falsa 123",
  "nationality": "Ecuatoriana", "password": "Password123"
}'
```

Expected: `201` with the created person/user (note the generated `username` in the response, e.g. `pmdiaz`).

```bash
curl -s -X POST http://localhost:8000/auth/login -H 'Content-Type: application/json' -d '{
  "username": "pmdiaz", "password": "Password123"
}'
```

Expected: `200` with an access/refresh token pair.

- [ ] **Step 4: Confirm the events landed in `ms-audit` via its logs**

Run: `docker compose logs ms-audit --tail 50 | grep -i "Evento de auditoría guardado"`
Expected: at least two matching lines (one for the `CREATE` from registration, one for the `LOGIN`).

- [ ] **Step 5: Tear down**

Run: `docker compose down`

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml
git commit -m "chore(users): wire RabbitMQ audit publisher into the compose stack"
```

---

## Self-Review Notes

- **Spec coverage:** the design spec's "users (FastAPI): publisher en Python con pika... llamado desde user_service.py/auth_service.py tras cada operación CRUD y en login/logout" is covered by Tasks 1-4; "agregar envs RABBITMQ_* al bloque de users" is covered by Task 5.
- **Entidad choice:** `ms-audit`'s allow-list has no `'PERSONA'` value, so both `Person` and `User` mutations use `entidad='USUARIO'` — documented as a deliberate constraint, not an oversight.
- **Self-registration exception:** `create_person_with_user` is the one place `usuario`/`rol` don't come from an authenticated actor (there isn't one yet) — they're the identity just created. This is called out explicitly in the Global Constraints so a reviewer doesn't flag it as a violation of "always from JWT."
- **`DELETE` for deactivation:** consistent with Plan 2's choice for `tickets.cancel` — the fixed `accion` enum has no dedicated "deactivated" value, so `DELETE` is the closest fit for "this record is no longer active."
- **Known pre-existing test breakage:** running `users`' test suite before this plan starts shows 18 pre-existing failures unrelated to audit logging (missing auth headers in `tests/test_persons.py`/`test_users.py`/`test_roles.py`, and a `cliente` role never seeded by `conftest.py`'s fixture despite being required by `create_person_with_user`). This plan's new tests bypass the HTTP/auth layer entirely (calling service functions directly against the `db_session` fixture) specifically to avoid inheriting those failures, and each task's verification step explicitly checks the pre-existing failures aren't made worse rather than trying to fix them (out of scope for this plan).
- **Type consistency:** `current_user: dict` shape (`{"username": str, "roles": list[str], ...}`) matches what `app/core/deps.py`'s `get_current_user`/`decode_token` already produce (`decode_token` returns the JWT payload dict with `username`/`roles` keys) — no changes to the auth/JWT layer are needed.
