# Auth Service

Microservicio de autenticación y gestión de personas, usuarios y roles,
construido con FastAPI y PostgreSQL.

## Requisitos

- Python 3.11+
- Docker y Docker Compose

## Puesta en marcha

1. Levantar la base de datos:

   ```bash
   docker compose up -d
   ```

2. Crear el entorno virtual e instalar dependencias:

   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

3. Copiar las variables de entorno (ajustar si es necesario):

   ```bash
   cp .env.example .env
   ```

4. Ejecutar las migraciones (crea las tablas y los datos semilla: roles + usuario admin):

   ```bash
   alembic upgrade head
   ```

5. Levantar la API:

   ```bash
   uvicorn app.main:app --reload
   ```

La API queda disponible en `http://localhost:8000`. Documentación interactiva
(Swagger) en `http://localhost:8000/docs`.

## Usuario administrador por defecto

| username | password  | rol           |
|----------|-----------|---------------|
| admin    | Admin123! | administrador |

## Roles disponibles

`estudiante`, `profesor`, `administrador`, `visitante`

## Endpoints principales

- `POST /auth/login` — login (form OAuth2: `username`, `password`)
- `POST /auth/refresh` — renueva el access token a partir de un refresh token
- `GET /auth/me` — datos del usuario autenticado
- `POST /persons` *(admin)* — crea persona + usuario + roles; `first_name`, `middle_name` y `last_name` son obligatorios y el `username` se genera automáticamente
- `GET /persons`, `GET /persons/{id}`, `PUT /persons/{id}`
- `PATCH /persons/{id}/deactivate` — desactiva persona y usuario (cascada)
- `PATCH /persons/{id}/activate`
- `GET /users`, `GET /users/{id}`, `PUT /users/{id}`
- `PATCH /users/{id}/deactivate`, `PATCH /users/{id}/activate`
- `POST /users/{id}/roles`, `DELETE /users/{id}/roles/{role_id}`
- `GET /roles`

## Tests

```bash
pytest
```
