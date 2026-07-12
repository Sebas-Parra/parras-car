# Rollout de auditoría centralizada a todos los microservicios

## Contexto

`ms-audit` (NestJS + TypeORM + Postgres) es el microservicio centralizado de
auditoría. Consume eventos desde RabbitMQ (`audit_exchange` / routing key
`audit_event`), los valida con `CreateAuditEventDto` y los persiste en la
tabla `event_audit`.

Hoy solo `vehicles` publica eventos hacia `ms-audit`, vía
`EventPublisher` (`vehicles/src/vehicles/event-published.service.ts`).
Los demás microservicios (`tickets`, `users`, `zones`, `assignments`) no
publican nada. Adicionalmente:

- `ms-audit` ni siquiera está declarado en el `docker-compose.yml` raíz, y
  no existe ahí un servicio `rabbitmq` (solo existe en
  `ms-audit/docker-compose.yml`, aislado).
- El controller HTTP de `ms-audit` (`GET /audit`, `GET /audit/:id`,
  `POST /audit`) no tiene ningún guard de autenticación/roles.
- `CreateAuditEventDto` marca `usuario` y `rol` como `@IsOptional()` pese a
  tener comentarios `//obligatorio` / `//obligatorio-cambiar` en el código,
  señal de que se dejaron opcionales temporalmente.
- El publisher de `vehicles` (`vehicles.service.ts::emitEvent`) hoy **no
  envía `usuario` ni `rol`** — el propio comentario en el código lo admite
  ("usuario e ip se podrían obtener del contexto si se inyecta"). El
  controller de `vehicles` tampoco extrae el usuario autenticado del JWT.
- `assignments` tiene su propia auditoría de negocio local
  (`assignment_audits`, vía listeners de SQLAlchemy) para transferencias de
  vehículo. Es independiente del `ms-audit` centralizado y **se mantiene sin
  cambios**.

## Objetivo

1. Endurecer las restricciones/validaciones de `ms-audit`.
2. Arreglar el publisher de `vehicles` para que sí envíe `usuario`/`rol`
   (prerequisito de (1), para no romper el único productor que hoy funciona).
3. Replicar el patrón de publicación de eventos de auditoría en `tickets`,
   `users`, `zones` y `assignments` (este último, además de su auditoría local).
4. Dar de alta la infraestructura faltante (`rabbitmq` + `ms-audit`) en el
   `docker-compose.yml` raíz.

Todo se implementa en una sola rama: `feature/audit-rollout`.

## 1. Endurecimiento de `ms-audit`

| Gap | Cambio |
|---|---|
| Sin auth en el controller | `JwtAuthGuard` + `RolesGuard` (`admin`, `root`) en `GET /audit` y `GET /audit/:id`. `ms-audit` necesita su propio `JwtStrategy`/`JwtAuthGuard`/`RolesGuard`, calcados de `vehicles/src/auth/*` (mismo `JWT_SECRET` compartido vía env). |
| `POST /audit` público | Se elimina del controller. La única vía de ingesta válida es RabbitMQ. |
| `servicio`: regex libre `^(ms-[a-zA-Z]+)$` | Enum cerrado: `ms-vehiculos, ms-tickets, ms-users, ms-zonas, ms-assignments` (usar el nombre exacto que ya usa `vehicles`: `'ms-vehiculos'`). |
| `entidad`: regex libre `^[A-Z-]+$` | Mantener el patrón pero documentar/validar contra una lista blanca por servicio (`VEHICULO`, `TICKET`, `USUARIO`, `ZONA`, `PLACE`, `ASSIGNMENT`), sin over-engineering: un `@IsIn([...])` simple. |
| `usuario`/`rol` opcionales pese al comentario `//obligatorio` | Quitar `@IsOptional()`, agregar `@IsNotEmpty()`, cambiar a `usuario!: string` / `rol!: string` en el DTO. Reflejar lo mismo en `EventAudit` entity (`nullable: false`). |
| `datos` sin límite de tamaño | Agregar validación de tamaño máximo serializado (10 KB) vía un `@Validate` custom o chequeo manual en el consumer antes de persistir. |
| Mensajes inválidos se descartan (`nack(msg, false, false)`) | Cambiar a Dead Letter Exchange: declarar `audit_exchange.dlx` + cola `audit_queue.dlq`, bindear la queue principal con `x-dead-letter-exchange`, y usar `nack` normal (que ahora sí enruta al DLX en vez de perderse). |
| Un solo `timestamp` (el de ingesta) | Agregar campo opcional `eventTimestamp` en el DTO/entidad (fecha en que el productor generó el evento); `timestamp` sigue siendo la fecha de ingesta en `ms-audit`. |
| Sin índice para queries | Índice compuesto `(service, entity, timestamp)` en `EventAudit`. |

Fuera de alcance (se documenta como nota, no se implementa ahora): políticas
de retención/particionado de la tabla `event_audit`, rate limiting por
servicio productor (ya existe `THROTTLE_TTL`/`THROTTLE_LIMIT` en el `.env`
de `ms-audit` sin usar — se deja pendiente de otra iteración).

## 2. Fix previo en `vehicles` (prerequisito)

- `vehicles.controller.ts`: extraer el usuario autenticado (`@Req() req`,
  ya disponible vía `JwtAuthGuard`/`JwtStrategy` → `req.user = { userId,
  username, roles }`) y pasarlo a los métodos del service que emiten
  eventos (`create`, `update`, `remove`, `activate`).
- `vehicles.service.ts::emitEvent`: aceptar `usuario`/`rol` como parámetros
  y agregarlos al `AuditEvent` (`rol` = `roles.join(',')` o el primer rol).
- Solo después de este fix se activa la obligatoriedad de `usuario`/`rol`
  en `ms-audit` (para no dejar roto el único productor existente).

## 3. Publishers nuevos por microservicio

Mismo contrato de evento (`AuditEvent`: `servicio, accion, entidad,
entidadId?, datos?, usuario, rol, ip?`) en todos.

- **`tickets`** (NestJS): copiar `EventPublisher` de `vehicles` casi
  literal (mismo `amqplib`, mismo manejo de reconexión). Instrumentar
  create/update/cancelación de tickets en `tickets.service.ts`, extrayendo
  usuario/rol del JWT igual que en `vehicles`.
- **`users`** (FastAPI): publisher en Python con `pika` (agregar a
  `requirements.txt`), inicializado en `app/main.py` (lifespan) y llamado
  desde `user_service.py`/`auth_service.py` tras cada operación CRUD y en
  login/logout (`accion`: `CREATE|UPDATE|DELETE|LOGIN|LOGOUT`).
- **`zones`** (Spring Boot): agregar `spring-boot-starter-amqp` al
  `pom.xml`, un `RabbitConfig` (exchange/routing key desde
  `application.yaml`) y publicar desde `ZoneServiceImpl`/`PlaceServiceImpl`
  tras create/update.
- **`assignments`** (FastAPI): agregar `pika`, publisher análogo al de
  `users`, invocado desde `assignment_service.py` en create/transfer,
  **sin tocar** `db/listeners.py` ni `assignment_audit.py` (auditoría local
  de negocio se mantiene intacta y en paralelo).

Todos los publishers deben:
- Tomar `usuario`/`rol` del contexto autenticado de la request (nunca de
  input de body).
- Fallar de forma no bloqueante: si RabbitMQ no está disponible, se loguea
  el error y la operación de negocio continúa (mismo comportamiento que
  `vehicles` hoy).

## 4. Infraestructura

- Agregar servicio `rabbitmq` (imagen `rabbitmq:3-management`) al
  `docker-compose.yml` raíz.
- Agregar servicio `ms-audit` al `docker-compose.yml` raíz, con su propia
  `audit-db` (ya existe en el compose) y las envs `RABBITMQ_*`/`JWT_SECRET`.
- Agregar envs `RABBITMQ_HOST/PORT/USER/PASSWORD/EXCHANGE/ROUTING_KEY` a
  los bloques de `tickets`, `users`, `zones`, `assignments` en el compose
  raíz (ya están previstas en `.env.example`, solo falta cablearlas).

## 5. Testing

- `ms-audit`: tests de DTO (usuario/rol obligatorios, enum de servicio,
  límite de tamaño de `datos`), test de que `GET /audit` rechaza sin
  JWT/rol admin, test de que `POST /audit` ya no existe (404).
- `vehicles`: test de que `emitEvent` incluye `usuario`/`rol` reales.
- Cada publisher nuevo (`tickets`, `users`, `zones`, `assignments`): test
  unitario con mock del canal AMQP, verificando que se llama con el
  payload correcto tras cada operación CRUD relevante.

## Fuera de alcance

- Retención/particionado de `event_audit`.
- Rate limiting real (el throttle de `ms-audit` queda para otra iteración).
- Dashboard o UI de consulta de auditoría (solo se protege el endpoint
  existente).
