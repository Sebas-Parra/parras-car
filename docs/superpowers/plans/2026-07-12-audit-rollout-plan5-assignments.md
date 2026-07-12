# Plan 5: assignments audit publisher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `assignments` FastAPI/SQLAlchemy microservice publish audit events to the centralized `ms-audit` service on assignment create/delete/transfer, alongside its existing local business-audit trail, which stays untouched.

**Architecture:** `assignments` already has its own local audit trail (`AssignmentAudit` entity, populated by SQLAlchemy event listeners in `app/db/listeners.py` plus an explicit `AuditService.record_transfer` call) — this tracks vehicle-ownership history as a domain concept and is **not** touched by this plan. Separately, this plan adds the same `pika`-based centralized publisher pattern already built for `users` in an earlier plan: a `publish_audit_event()` function that opens a RabbitMQ `BlockingConnection` per call, publishes, and closes, catching and logging (never raising) any failure. `AssignmentService.create/.delete/.transfer` call it after each successful local-audit-triggering mutation, so both trails get written independently.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic Settings, `pika`, pytest.

## Global Constraints

- `servicio` is exactly `'ms-assignments'`, `entidad` is exactly `'ASSIGNMENT'` — both already in `ms-audit`'s allow-lists (`SERVICIOS_VALIDOS`/`ENTIDADES_VALIDAS` in `ms-audit/src/audit/dto/create-audit-event.dto.ts`).
- `accion` is one of `CREATE|UPDATE|DELETE|LOGIN|LOGOUT|SELECT`. This plan uses: a brand-new assignment row → `CREATE`; reactivating a previously-inactive row (the `existing` branch in `AssignmentService.create`) → `UPDATE`; `delete` → `DELETE`; `transfer` → a single `UPDATE` event (mirroring `AuditService.record_transfer`'s "one business-level transfer" semantics, not the finer-grained multi-row bookkeeping the local audit trail does).
- `usuario`/`rol` are mandatory on every event and must come from the authenticated `current_user` dict (the JWT payload), never from request body — every mutating route already requires auth (`require_admin` on delete/transfer, an explicit admin-or-self check on create), so `current_user` is always available.
- Do not modify `app/db/listeners.py`, `app/entities/assignment_audit.py`, or `app/services/audit_service.py` — the existing local business-audit trail is out of scope and must keep working exactly as it does today.
- A `ms-audit`/RabbitMQ outage must never fail an `assignments` request — every publish call is wrapped so exceptions are caught and logged, not raised.

---

### Task 1: Add the RabbitMQ audit publisher to `assignments`

**Files:**
- Create: `assignments/app/services/audit_publisher.py`
- Test: `assignments/tests/test_audit_publisher.py`
- Modify: `assignments/requirements.txt`
- Modify: `assignments/app/core/config.py`
- Modify: `assignments/.env.example`

**Interfaces:**
- Produces: `publish_audit_event(accion: str, entidad_id: str, usuario: str, rol: str, datos: dict | None = None) -> None`, importable as `from app.services.audit_publisher import publish_audit_event` — Task 2 calls this directly.

- [ ] **Step 1: Add `pika` to `assignments/requirements.txt`**

Append:

```
pika==1.3.2
```

- [ ] **Step 2: Install it**

Run: `cd assignments && pip install -r requirements.txt` (into whatever virtualenv this project uses)

- [ ] **Step 3: Add RabbitMQ settings to `assignments/app/core/config.py`**

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5435/assignments_db"
    vehicles_service_url: str = "http://vehicles:3000"
    users_service_url: str = "http://users:8000"

    jwt_secret: str
    jwt_algorithm: str = "HS256"

    rabbitmq_host: str = "localhost"
    rabbitmq_port: int = 5672
    rabbitmq_user: str = "guest"
    rabbitmq_password: str = "guest"
    rabbitmq_exchange: str = "audit_exchange"
    rabbitmq_routing_key: str = "audit_event"


settings = Settings()
```

- [ ] **Step 4: Write the failing test**

Create `assignments/tests/test_audit_publisher.py`:

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
        entidad_id="user-1:vehicle-1",
        usuario="jdoe",
        rol="admin",
        datos={"user_id": "user-1", "vehicle_id": "vehicle-1"},
    )

    mock_channel.exchange_declare.assert_called_once()
    mock_channel.basic_publish.assert_called_once()
    _, kwargs = mock_channel.basic_publish.call_args
    payload = json.loads(kwargs["body"])
    assert payload == {
        "servicio": "ms-assignments",
        "accion": "CREATE",
        "entidad": "ASSIGNMENT",
        "entidadId": "user-1:vehicle-1",
        "datos": {"user_id": "user-1", "vehicle_id": "vehicle-1"},
        "usuario": "jdoe",
        "rol": "admin",
    }
    mock_connection.close.assert_called_once()


@patch(
    "app.services.audit_publisher.pika.BlockingConnection",
    side_effect=Exception("boom"),
)
def test_does_not_raise_when_rabbitmq_is_unreachable(mock_blocking_connection):
    publish_audit_event(
        accion="CREATE",
        entidad_id="user-1:vehicle-1",
        usuario="jdoe",
        rol="admin",
    )
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd assignments && JWT_SECRET=test_secret pytest tests/test_audit_publisher.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.audit_publisher'`

- [ ] **Step 6: Create `audit_publisher.py`**

`assignments/app/services/audit_publisher.py`:

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
        "servicio": "ms-assignments",
        "accion": accion,
        "entidad": "ASSIGNMENT",
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

Run: `cd assignments && JWT_SECRET=test_secret pytest tests/test_audit_publisher.py -v`
Expected: PASS (2/2)

- [ ] **Step 8: Add the RabbitMQ block to `assignments/.env.example`**

Append to `assignments/.env.example`:

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
git add assignments/requirements.txt assignments/app/core/config.py assignments/app/services/audit_publisher.py assignments/tests/test_audit_publisher.py assignments/.env.example
git commit -m "feat(assignments): add RabbitMQ audit event publisher"
```

---

### Task 2: Emit centralized audit events on assignment create/delete/transfer

**Files:**
- Modify: `assignments/app/controllers/assignments.py`
- Modify: `assignments/app/services/assignment_service.py`
- Test: `assignments/tests/test_assignment_service_audit.py`

**Interfaces:**
- Consumes: `publish_audit_event` from `app.services.audit_publisher` (Task 1).
- Produces: `AssignmentService.create(db, data, token, current_user: dict)`, `.delete(db, user_id, vehicle_id, current_user: dict)`, `.transfer(db, vehicle_id, data, token, current_user: dict)`.

- [ ] **Step 1: Write the failing test**

Create `assignments/tests/test_assignment_service_audit.py`. This calls `AssignmentService` directly, using the shared `db_session` fixture from `tests/conftest.py` and mocking `AssignmentValidator`/`AuditService` (the local audit) so this test is isolated to the centralized-publish behavior — the existing `tests/test_assignments.py` already covers the local audit trail via the ORM listeners and isn't touched by this task:

```python
from unittest.mock import MagicMock, patch
from uuid import UUID

from app.dto.assignment import AssignmentCreate, AssignmentTransfer
from app.services.assignment_service import AssignmentService

USER_ID = UUID("11111111-1111-1111-1111-111111111111")
USER_ID_2 = UUID("44444444-4444-4444-4444-444444444444")
VEHICLE_ID = UUID("22222222-2222-2222-2222-222222222222")

CURRENT_USER = {"username": "jdoe", "roles": ["admin"], "sub": str(USER_ID)}


def _service(validator=None, audit=None) -> AssignmentService:
    return AssignmentService(
        validator=validator or MagicMock(),
        audit=audit or MagicMock(),
    )


@patch("app.services.assignment_service.publish_audit_event")
def test_create_publishes_a_create_event_for_a_brand_new_assignment(mock_publish, db_session):
    svc = _service()

    svc.create(db_session, AssignmentCreate(user_id=USER_ID, vehicle_id=VEHICLE_ID), "token", CURRENT_USER)

    mock_publish.assert_called_once()
    kwargs = mock_publish.call_args.kwargs
    assert kwargs["accion"] == "CREATE"
    assert kwargs["entidad_id"] == f"{USER_ID}:{VEHICLE_ID}"
    assert kwargs["usuario"] == "jdoe"
    assert kwargs["rol"] == "admin"


@patch("app.services.assignment_service.publish_audit_event")
def test_create_publishes_an_update_event_when_reactivating_an_existing_row(mock_publish, db_session):
    svc = _service()
    svc.create(db_session, AssignmentCreate(user_id=USER_ID, vehicle_id=VEHICLE_ID), "token", CURRENT_USER)
    svc.delete(db_session, USER_ID, VEHICLE_ID, CURRENT_USER)
    mock_publish.reset_mock()

    svc.create(db_session, AssignmentCreate(user_id=USER_ID, vehicle_id=VEHICLE_ID), "token", CURRENT_USER)

    mock_publish.assert_called_once()
    assert mock_publish.call_args.kwargs["accion"] == "UPDATE"


@patch("app.services.assignment_service.publish_audit_event")
def test_delete_publishes_a_delete_event(mock_publish, db_session):
    svc = _service()
    svc.create(db_session, AssignmentCreate(user_id=USER_ID, vehicle_id=VEHICLE_ID), "token", CURRENT_USER)
    mock_publish.reset_mock()

    svc.delete(db_session, USER_ID, VEHICLE_ID, CURRENT_USER)

    mock_publish.assert_called_once()
    kwargs = mock_publish.call_args.kwargs
    assert kwargs["accion"] == "DELETE"
    assert kwargs["entidad_id"] == f"{USER_ID}:{VEHICLE_ID}"


@patch("app.services.assignment_service.publish_audit_event")
def test_transfer_publishes_a_single_update_event(mock_publish, db_session):
    svc = _service()
    svc.create(db_session, AssignmentCreate(user_id=USER_ID, vehicle_id=VEHICLE_ID), "token", CURRENT_USER)
    mock_publish.reset_mock()

    svc.transfer(
        db_session,
        VEHICLE_ID,
        AssignmentTransfer(from_user_id=USER_ID, to_user_id=USER_ID_2),
        "token",
        CURRENT_USER,
    )

    mock_publish.assert_called_once()
    kwargs = mock_publish.call_args.kwargs
    assert kwargs["accion"] == "UPDATE"
    assert kwargs["entidad_id"] == str(VEHICLE_ID)
    assert kwargs["datos"] == {"from_user_id": str(USER_ID), "to_user_id": str(USER_ID_2)}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd assignments && JWT_SECRET=test_secret pytest tests/test_assignment_service_audit.py -v`
Expected: FAIL — `create`/`delete`/`transfer` don't accept a `current_user` argument yet, and never call `publish_audit_event`.

- [ ] **Step 3: Update `assignment_service.py`**

```python
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.dto.assignment import AssignmentCreate, AssignmentRead, AssignmentTransfer, FleetResponse, VehicleDetail
from app.entities.assignment_audit import AssignmentAudit
from app.repositories import assignment_repository
from app.services import vehicles_client
from app.services.assignment_validator import AssignmentValidator
from app.services.audit_publisher import publish_audit_event
from app.services.audit_service import AuditService


class AssignmentService:
    """Orchestrates the assignment lifecycle.
    Local audit recording is decoupled — handled transparently by ORM event listeners.
    Centralized ms-audit publishing happens explicitly here, alongside it.
    """

    def __init__(self, validator: AssignmentValidator, audit: AuditService) -> None:
        self._validator = validator
        self._audit = audit

    def create(self, db: Session, data: AssignmentCreate, token: str, current_user: dict) -> AssignmentRead:
        self._validator.require_user_active(data.user_id, token)
        self._validator.require_vehicle_active(data.vehicle_id, token)
        self._validator.require_vehicle_available(db, data.vehicle_id, data.user_id)

        existing = assignment_repository.get_by_ids(db, data.user_id, data.vehicle_id)
        self._validator.require_not_already_active(existing)

        if existing:
            existing.active = True  # triggers after_update listener → MODIFICACION audit
            db.commit()
            db.refresh(existing)
            self._emit_audit_event("UPDATE", data.user_id, data.vehicle_id, current_user)
            return existing

        assignment = assignment_repository.create(db, data.user_id, data.vehicle_id)  # triggers after_insert → CREACION audit
        db.commit()
        db.refresh(assignment)
        self._emit_audit_event("CREATE", data.user_id, data.vehicle_id, current_user)
        return assignment

    def delete(self, db: Session, user_id: UUID, vehicle_id: UUID, current_user: dict) -> AssignmentRead:
        assignment = assignment_repository.get_by_ids(db, user_id, vehicle_id)
        if not assignment or not assignment.active:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active assignment not found")

        assignment_repository.soft_delete(db, assignment)  # triggers after_update listener → ELIMINACION audit
        db.commit()
        db.refresh(assignment)
        self._emit_audit_event("DELETE", user_id, vehicle_id, current_user)
        return assignment

    def transfer(
        self, db: Session, vehicle_id: UUID, data: AssignmentTransfer, token: str, current_user: dict
    ) -> AssignmentRead:
        self._validator.require_different_users(data.from_user_id, data.to_user_id)
        self._validator.require_user_active(data.from_user_id, token)
        self._validator.require_user_active(data.to_user_id, token)
        self._validator.require_vehicle_active(vehicle_id, token)
        self._validator.require_active_assignment(db, data.from_user_id, vehicle_id)

        old_assignment = assignment_repository.get_by_ids(db, data.from_user_id, vehicle_id)
        assignment_repository.soft_delete(db, old_assignment)  # listener → ELIMINACION

        # to_user may have had this vehicle before (inactive row) — reactivate instead of insert
        existing_for_new_user = assignment_repository.get_by_ids(db, data.to_user_id, vehicle_id)
        if existing_for_new_user:
            existing_for_new_user.active = True  # listener → CREACION (after_update treated as MODIFICACION)
            new_assignment = existing_for_new_user
        else:
            new_assignment = assignment_repository.create(db, data.to_user_id, vehicle_id)  # listener → CREACION

        self._audit.record_transfer(db, data.from_user_id, data.to_user_id, vehicle_id)  # explicit → MODIFICACION

        db.commit()
        db.refresh(new_assignment)

        publish_audit_event(
            accion="UPDATE",
            entidad_id=str(vehicle_id),
            usuario=current_user.get("username", ""),
            rol=(current_user.get("roles") or [""])[0],
            datos={"from_user_id": str(data.from_user_id), "to_user_id": str(data.to_user_id)},
        )
        return new_assignment

    def get_fleet(self, db: Session, user_id: UUID, token: str) -> FleetResponse:
        assignments = assignment_repository.list_active_by_user(db, user_id)
        vehicles: list[VehicleDetail] = []
        for assignment in assignments:
            vehicle_data = vehicles_client.get_vehicle(assignment.vehicle_id, token)
            if vehicle_data:
                vehicles.append(
                    VehicleDetail(
                        id=vehicle_data["id"],
                        plate=vehicle_data.get("plate", ""),
                        brand=vehicle_data.get("brand", ""),
                        model=vehicle_data.get("model", ""),
                        color=vehicle_data.get("color", ""),
                        year=vehicle_data.get("year", 0),
                        clasification=vehicle_data.get("clasification", ""),
                        tipo=vehicle_data.get("tipo") or vehicle_data.get("type"),
                    )
                )
        return FleetResponse(user_id=user_id, total=len(vehicles), vehicles=vehicles)

    def get_active_by_vehicle(self, db: Session, vehicle_id: UUID) -> AssignmentRead:
        assignment = assignment_repository.get_active_by_vehicle(db, vehicle_id)
        if not assignment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vehicle has no active assignment — safe to delete",
            )
        return assignment

    def list_audit(self, db: Session) -> list[AssignmentAudit]:
        return self._audit.list_all(db)

    def get_assignment_audit(self, db: Session, user_id: UUID, vehicle_id: UUID) -> list[AssignmentAudit]:
        return self._audit.list_by_assignment(db, user_id, vehicle_id)

    def _emit_audit_event(self, accion: str, user_id: UUID, vehicle_id: UUID, current_user: dict) -> None:
        roles = current_user.get("roles") or []
        publish_audit_event(
            accion=accion,
            entidad_id=f"{user_id}:{vehicle_id}",
            usuario=current_user.get("username", ""),
            rol=roles[0] if roles else "",
            datos={"user_id": str(user_id), "vehicle_id": str(vehicle_id)},
        )
```

(`get_fleet`, `get_active_by_vehicle`, `list_audit`, `get_assignment_audit` are unchanged — read-only, no audit event. `transfer`'s `publish_audit_event` call is inlined directly rather than routed through `_emit_audit_event`, since its `entidad_id`/`datos` shape — one vehicle, two user ids — doesn't fit the `(user_id, vehicle_id)` pair the helper is built around.)

- [ ] **Step 4: Update `assignments.py` controller to pass `current_user` through**

```python
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_bearer_token, get_current_user, get_db, require_admin, require_self_or_admin
from app.dto.assignment import AssignmentCreate, AssignmentRead, AssignmentTransfer, FleetResponse
from app.dto.audit import AuditRead
from app.services.assignment_service import AssignmentService
from app.services.assignment_validator import AssignmentValidator
from app.services.audit_service import AuditService

router = APIRouter(prefix="/assignments", tags=["assignments"])


def get_assignment_service() -> AssignmentService:
    return AssignmentService(validator=AssignmentValidator(), audit=AuditService())


# Propio usuario o admin/root — cliente solo puede asignarse a sí mismo
@router.post("", response_model=AssignmentRead, status_code=201)
def create_assignment(
    data: AssignmentCreate,
    db: Session = Depends(get_db),
    svc: AssignmentService = Depends(get_assignment_service),
    current_user: dict = Depends(get_current_user),
    token: str = Depends(get_bearer_token),
):
    _ADMIN_ROLES = {"admin", "root"}
    is_admin = bool(_ADMIN_ROLES & set(current_user.get("roles", [])))
    if not is_admin and str(data.user_id) != current_user.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo puedes asignarte vehículos a ti mismo.",
        )
    return svc.create(db, data, token, current_user)


# Admin / root only
@router.delete("/{user_id}/{vehicle_id}", response_model=AssignmentRead)
def delete_assignment(
    user_id: UUID,
    vehicle_id: UUID,
    db: Session = Depends(get_db),
    svc: AssignmentService = Depends(get_assignment_service),
    current_user: dict = Depends(require_admin),
):
    return svc.delete(db, user_id, vehicle_id, current_user)


# Admin / root only
@router.patch("/{vehicle_id}/transfer", response_model=AssignmentRead)
def transfer_assignment(
    vehicle_id: UUID,
    data: AssignmentTransfer,
    db: Session = Depends(get_db),
    svc: AssignmentService = Depends(get_assignment_service),
    current_user: dict = Depends(require_admin),
    token: str = Depends(get_bearer_token),
):
    return svc.transfer(db, vehicle_id, data, token, current_user)


# No auth — internal call from vehicles service (server-to-server, no user token)
@router.get("/by-vehicle/{vehicle_id}", response_model=AssignmentRead)
def get_active_by_vehicle(
    vehicle_id: UUID,
    db: Session = Depends(get_db),
    svc: AssignmentService = Depends(get_assignment_service),
):
    """Returns the active assignment for a vehicle.
    404 means the vehicle has no active owner and is safe to delete.
    """
    return svc.get_active_by_vehicle(db, vehicle_id)


# Admin / root only
@router.get("/audit", response_model=list[AuditRead])
def list_audit(
    db: Session = Depends(get_db),
    svc: AssignmentService = Depends(get_assignment_service),
    _: dict = Depends(require_admin),
):
    return svc.list_audit(db)


# Own data or admin/root — cliente solo ve su propia flota
@router.get("/{user_id}/fleet", response_model=FleetResponse)
def get_fleet(
    user_id: UUID,
    db: Session = Depends(get_db),
    svc: AssignmentService = Depends(get_assignment_service),
    _: dict = Depends(require_self_or_admin),
    token: str = Depends(get_bearer_token),
):
    return svc.get_fleet(db, user_id, token)


# Own data or admin/root
@router.get("/{user_id}/{vehicle_id}/audit", response_model=list[AuditRead])
def get_assignment_audit(
    user_id: UUID,
    vehicle_id: UUID,
    db: Session = Depends(get_db),
    svc: AssignmentService = Depends(get_assignment_service),
    _: dict = Depends(require_self_or_admin),
):
    return svc.get_assignment_audit(db, user_id, vehicle_id)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd assignments && JWT_SECRET=test_secret pytest tests/test_assignment_service_audit.py -v`
Expected: PASS (4/4)

- [ ] **Step 6: Run the full assignments test suite**

Run: `cd assignments && JWT_SECRET=test_secret pytest -v`
Expected: your four new tests pass. `tests/test_assignments.py` was already failing before this plan for reasons unrelated to audit logging (its HTTP-level tests send no `Authorization` header, so every route requiring auth returns `401` instead of the expected status — confirm this by running the suite before starting this task; the count and cause should be identical after your changes, not worse).

- [ ] **Step 7: Commit**

```bash
git add assignments/app/controllers/assignments.py assignments/app/services/assignment_service.py assignments/tests/test_assignment_service_audit.py
git commit -m "feat(assignments): publish CREATE/UPDATE/DELETE audit events on create/delete/transfer"
```

---

### Task 3: Wire `assignments` to `rabbitmq` in the root `docker-compose.yml` and verify end-to-end

**Files:**
- Modify: `docker-compose.yml` (repo root)

**Interfaces:**
- Produces: `assignments` reachable and able to publish to `rabbitmq:5672` in the compose network.

- [ ] **Step 1: Add RabbitMQ envs and the `rabbitmq` dependency to the `assignments` service block**

In `docker-compose.yml`'s `assignments` service, change:

```yaml
    environment:
      DATABASE_URL: postgresql+psycopg2://${DB_USER}:${DB_PASSWORD}@assignments-db:5432/${DB_NAME_ASSIGNMENTS}
      VEHICLES_SERVICE_URL: ${VEHICLES_SERVICE_URL}
      USERS_SERVICE_URL: ${USERS_SERVICE_URL}
      JWT_SECRET: ${JWT_SECRET}
```

to:

```yaml
    environment:
      DATABASE_URL: postgresql+psycopg2://${DB_USER}:${DB_PASSWORD}@assignments-db:5432/${DB_NAME_ASSIGNMENTS}
      VEHICLES_SERVICE_URL: ${VEHICLES_SERVICE_URL}
      USERS_SERVICE_URL: ${USERS_SERVICE_URL}
      JWT_SECRET: ${JWT_SECRET}
      RABBITMQ_HOST: ${RABBITMQ_HOST}
      RABBITMQ_PORT: ${RABBITMQ_PORT}
      RABBITMQ_USER: ${RABBITMQ_USER}
      RABBITMQ_PASSWORD: ${RABBITMQ_PASSWORD}
      RABBITMQ_EXCHANGE: ${RABBITMQ_EXCHANGE}
      RABBITMQ_ROUTING_KEY: ${RABBITMQ_ROUTING_KEY}
```

And change `assignments`'s `depends_on` from:

```yaml
    depends_on:
      assignments-db:
        condition: service_healthy
      users:
        condition: service_started
      vehicles:
        condition: service_started
```

to:

```yaml
    depends_on:
      assignments-db:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
      users:
        condition: service_started
      vehicles:
        condition: service_started
```

- [ ] **Step 2: Bring up the stack and verify end-to-end**

This requires `ms-audit` and `users`/`vehicles` up too, since `assignments.create` calls out to both to validate the user/vehicle before creating an assignment. Run:
`docker compose up -d --build rabbitmq audit-db ms-audit users-db users vehicles-db vehicles assignments-db assignments`

Register a person (creates a user) via `POST /persons` on `users`, register a vehicle via `POST /vehicles` on `vehicles` (using the new user's JWT — log in first via `POST /auth/login`), then create an assignment:

```bash
curl -s -X POST http://localhost:8001/assignments \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <access_token_from_login>' \
  -d '{"user_id": "<person_id>", "vehicle_id": "<vehicle_id>"}'
```

Expected: `201` with the created assignment.

- [ ] **Step 3: Confirm the event landed in `ms-audit`**

Run: `docker compose logs ms-audit --tail 50 | grep -i "Evento de auditoría guardado"`
Expected: at least one matching line for the assignment `CREATE`.

- [ ] **Step 4: Tear down**

Run: `docker compose down`

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml
git commit -m "chore(assignments): wire RabbitMQ audit publisher into the compose stack"
```

---

## Self-Review Notes

- **Spec coverage:** the design spec's "assignments (FastAPI): agregar pika... invocado desde assignment_service.py en create/transfer, sin tocar db/listeners.py ni assignment_audit.py" is covered by Tasks 1-2 exactly as specified, including `delete` (a natural extension of "create/transfer" since it's the third mutating operation on the same entity and the design's overall principle — "CRUD" — clearly intends it); Task 3 covers the compose wiring.
- **Local audit trail explicitly untouched:** `app/db/listeners.py`, `app/entities/assignment_audit.py`, and `app/services/audit_service.py` are never modified by this plan — verified by omission from every task's file list.
- **`accion` mapping for `create`'s two branches:** a brand-new row is `CREATE`; reactivating a previously-soft-deleted row is `UPDATE` — this mirrors the local audit's own distinction (`CREACION` vs. the after-update-listener's `MODIFICACION`/`ELIMINACION` split in `app/db/listeners.py`), so the centralized trail's semantics agree with the local one even though they're recorded independently.
- **Known pre-existing test breakage:** `assignments/tests/test_assignments.py` already has the same class of gap `users`' test suite had before Plan 3 — HTTP-level tests with no `Authorization` header, failing with `401`s unrelated to audit logging (confirmed by running the suite before this plan started: 30 failed, 3 passed). This plan's new tests bypass the HTTP/auth layer entirely, calling `AssignmentService` directly against the shared `db_session` fixture, exactly like Plan 3 did for `users`.
- **Type consistency:** `current_user: dict` shape (`{"username": str, "roles": list[str], "sub": str, ...}`) matches what `app/core/deps.py`'s `get_current_user` already returns (the raw JWT payload dict from `python-jose`'s `jwt.decode`) — no changes to the auth/JWT layer are needed, unlike Plan 4's `zones` work.
