# API Testing Guide — Parras Car Microservices

## Base URLs

| Entry point | URL |
|---|---|
| **API Gateway (Kong)** | `http://localhost:9000` |
| **Swagger UI** | `http://localhost:9000/docs` |
| **Kong Admin** | `http://localhost:9001` |

> All requests go through Kong. Kong strips the service prefix before forwarding.

---

## Routing

| Gateway prefix | Forwards to | Internal path |
|---|---|---|
| `/users/*` | FastAPI `:8000` | path without `/users` |
| `/vehicles/*` | NestJS `:3000` | path without `/vehicles` |
| `/zones/*` | Spring Boot `:8080` | path without `/zones` |
| `/docs` | Swagger UI | unchanged |

---

## End-to-End Testing Flow

Run in this order to exercise every service with real data:

```
Step 1  — Create a role
Step 2  — Create a person (auto-creates user + assigns roles)
Step 3  — List persons / get person by ID
Step 4  — Update person
Step 5  — Get user / assign additional role / remove role
Step 6  — Deactivate and reactivate person
Step 7  — Create a zone
Step 8  — Update zone / toggle zone status
Step 9  — Create a place inside that zone
Step 10 — Filter places (by status, by zone)
Step 11 — Update place status
Step 12 — Register a vehicle (car)
Step 13 — Register a vehicle (motorcycle)
Step 14 — Register a vehicle (pickup truck)
Step 15 — Update vehicle / delete vehicle
```

---

## 1. Users Service (FastAPI)

### 1.1 Roles

| # | Method | URL | Description | Status |
|---|---|---|---|---|
| 1 | `POST` | `/users/roles` | Create role | 201 |
| 2 | `GET` | `/users/roles` | List all roles | 200 |
| 3 | `GET` | `/users/roles/{role_id}` | Get role by ID | 200 |
| 4 | `PUT` | `/users/roles/{role_id}` | Update role | 200 |
| 5 | `DELETE` | `/users/roles/{role_id}` | Delete role | 204 |

**POST `/users/roles`**
```json
{
  "name": "ADMIN",
  "description": "Administrator role"
}
```

> `name`: 2–50 chars, letters/spaces/underscores only. `description` is optional (max 255 chars).

**PUT `/users/roles/{role_id}`**
```json
{
  "name": "SUPERVISOR",
  "description": "Supervisor role"
}
```

---

### 1.2 Persons

| # | Method | URL | Description | Status |
|---|---|---|---|---|
| 6 | `POST` | `/users/persons` | Create person + user | 201 |
| 7 | `GET` | `/users/persons` | List persons | 200 |
| 8 | `GET` | `/users/persons/{person_id}` | Get person by ID | 200 |
| 9 | `PUT` | `/users/persons/{person_id}` | Update person | 200 |
| 10 | `PATCH` | `/users/persons/{person_id}/deactivate` | Deactivate | 200 |
| 11 | `PATCH` | `/users/persons/{person_id}/activate` | Activate | 200 |

**POST `/users/persons`** — creates person + user atomically
```json
{
  "cedula": "1234567890",
  "first_name": "Juan",
  "middle_name": "Carlos",
  "last_name": "Paredes",
  "email": "juan.paredes@test.com",
  "phone": "0991234567",
  "address": "Av. Amazonas 123, Quito",
  "nationality": "Ecuatoriana",
  "password": "secret123",
  "role_ids": ["<uuid-from-step-1>"]
}
```

> - `cedula`: exactly 10 digits  
> - `first_name`, `middle_name`, `last_name`: required, 2–50 chars, letters only (no numbers/special chars)  
> - `phone`: digits, spaces, `+`, `-`, `(`, `)` allowed  
> - `password`: min 8 chars  
> - `role_ids`: list of UUIDs, at least one required  
> - Username is auto-generated from initials: `first_name[0] + middle_name[0] + last_name`

**PUT `/users/persons/{person_id}`** — all fields optional
```json
{
  "first_name": "Juan",
  "middle_name": "Carlos",
  "last_name": "Paredes Mora",
  "email": "nuevo@test.com",
  "phone": "0999999999",
  "address": "Calle nueva 456",
  "nationality": "Ecuatoriana"
}
```

**GET `/users/persons`** — supports pagination
```
GET /users/persons?skip=0&limit=100
```

---

### 1.3 Users

| # | Method | URL | Description | Status |
|---|---|---|---|---|
| 12 | `GET` | `/users/users` | List users | 200 |
| 13 | `GET` | `/users/users/{user_id}` | Get user by ID | 200 |
| 14 | `PUT` | `/users/users/{user_id}` | Update username | 200 |
| 15 | `PATCH` | `/users/users/{user_id}/deactivate` | Deactivate user | 200 |
| 16 | `PATCH` | `/users/users/{user_id}/activate` | Activate user | 200 |
| 17 | `POST` | `/users/users/{user_id}/roles` | Assign role | 200 |
| 18 | `DELETE` | `/users/users/{user_id}/roles/{role_id}` | Remove role | 200 |

> `user_id` in the Users endpoints is the person's UUID (`id_person` from the person response).

**PUT `/users/users/{user_id}`**
```json
{
  "username": "nuevo_username"
}
```

**POST `/users/users/{user_id}/roles`**
```json
{
  "role_id": "<uuid>"
}
```

---

## 2. Vehicles Service (NestJS)

> Kong strips `/vehicles` → NestJS receives `/vehicles/{...}` (controller prefix is `vehicles`).  
> Effective client path: `/vehicles/vehicles/{...}`

| # | Method | URL | Description | Status |
|---|---|---|---|---|
| 19 | `POST` | `/vehicles/vehicles` | Create vehicle | 201 |
| 20 | `GET` | `/vehicles/vehicles` | List all vehicles | 200 |
| 21 | `GET` | `/vehicles/vehicles/{id}` | Get vehicle by ID | 200 |
| 22 | `PATCH` | `/vehicles/vehicles/{id}` | Partial update | 200 |
| 23 | `DELETE` | `/vehicles/vehicles/{id}` | Delete vehicle | 200 |

### Vehicle types

The `tipo` field selects the vehicle type. Each type has different required fields in `datos`.

**Car — POST `/vehicles/vehicles`**
```json
{
  "tipo": "car",
  "datos": {
    "plate": "ABC-1234",
    "brand": "Toyota",
    "model": "Corolla",
    "color": "Blanco",
    "year": 2022,
    "clasification": "GASOLINE",
    "numberOfDoors": 4,
    "trunkCapacity": 470
  }
}
```

**Motorcycle — POST `/vehicles/vehicles`**
```json
{
  "tipo": "motocicleta",
  "datos": {
    "plate": "AB-123C",
    "brand": "Honda",
    "model": "CBR600",
    "color": "Rojo",
    "year": 2021,
    "clasification": "GASOLINE",
    "typeOfMotorbike": "SPORT"
  }
}
```

**Pickup Truck — POST `/vehicles/vehicles`**
```json
{
  "tipo": "pickupTruck",
  "datos": {
    "plate": "XYZ-9999",
    "brand": "Ford",
    "model": "F-150",
    "color": "Negro",
    "year": 2023,
    "clasification": "DIESEL",
    "payloadCapacity": 1000,
    "cab": "Crew"
  }
}
```

**PATCH `/vehicles/vehicles/{id}`** — all `datos` fields are optional
```json
{
  "datos": {
    "color": "Azul",
    "year": 2024
  }
}
```

### Enum values

| Enum | Values |
|---|---|
| `clasification` | `ELECTRIC`, `HYBRID`, `GASOLINE`, `DIESEL` |
| `typeOfMotorbike` | `ENDURO`, `SPORT`, `CRUISER`, `SCOOTER`, `TOURING` |

### Validation rules

| Field | Rule |
|---|---|
| `plate` (car/truck) | Format `ABC-1234` (3 uppercase letters + 4 digits) |
| `plate` (motorcycle) | Format `AB-123C` (2 letters + 3 digits + 1 letter) |
| `brand` | 2–30 chars, letters/spaces/hyphens |
| `model` | 1–150 chars, letters/numbers/spaces/hyphens |
| `color` | 2–50 chars, letters/spaces/hyphens |
| `year` | 1885 – current year + 1 |
| `numberOfDoors` | 2–6 |
| `trunkCapacity` | 0–2000 liters |
| `payloadCapacity` | 0–50000 kg |

---

## 3. Zones Service (Spring Boot)

> Kong strips `/zones` → Spring Boot receives `/api/v1/zones` or `/api/v1/places`.

### 3.1 Zones

| # | Method | URL | Description | Status |
|---|---|---|---|---|
| 24 | `POST` | `/zones/api/v1/zones` | Create zone | 201 |
| 25 | `GET` | `/zones/api/v1/zones` | List all zones | 200 |
| 26 | `GET` | `/zones/api/v1/zones/{id}` | Get zone by ID | 200 |
| 27 | `PUT` | `/zones/api/v1/zones/{id}` | Update zone | 200 |
| 28 | `PUT` | `/zones/api/v1/zones/{id}/status` | Toggle zone status | 200 |

**POST `/zones/api/v1/zones`**
```json
{
  "name": "Zona Norte",
  "description": "Zona de estacionamiento norte",
  "capacity": 50,
  "type": "REGULAR"
}
```

**PUT `/zones/api/v1/zones/{id}`**
```json
{
  "name": "Zona Norte Actualizada",
  "description": "Nueva descripción",
  "capacity": 75,
  "type": "VIP"
}
```

> `PUT /zones/{id}/status` toggles the zone active/inactive — no body required.

### Zone enum values

| Enum | Values |
|---|---|
| `type` (TypeOfZone) | `VIP`, `REGULAR`, `INTERNAL`, `EXTERNAL`, `PREFERENTIAL` |

### Validation rules

| Field | Rule |
|---|---|
| `name` | 2–32 chars, letters/spaces/hyphens, no blank-only |
| `description` | max 255 chars, optional |
| `capacity` | 1–1000 |
| `type` | required |

---

### 3.2 Places

| # | Method | URL | Description | Status |
|---|---|---|---|---|
| 29 | `POST` | `/zones/api/v1/places` | Create place | 201 |
| 30 | `GET` | `/zones/api/v1/places` | List all places | 200 |
| 31 | `GET` | `/zones/api/v1/places?status=AVAILABLE` | Filter by status | 200 |
| 32 | `GET` | `/zones/api/v1/places?zone={uuid}` | Filter by zone | 200 |
| 33 | `GET` | `/zones/api/v1/places?status=AVAILABLE&zone={uuid}` | Filter by status + zone | 200 |
| 34 | `PUT` | `/zones/api/v1/places/{id}` | Update place | 200 |
| 35 | `DELETE` | `/zones/api/v1/places/{id}` | Delete place | 204 |
| 36 | `PATCH` | `/zones/api/v1/places/{id}/status?status=OCCUPIED` | Change place status | 200 |

**POST `/zones/api/v1/places`**
```json
{
  "idZone": "<uuid-from-zone>",
  "description": "Lugar A-01 cerca de entrada",
  "type": "CAR",
  "status": "AVAILABLE"
}
```

**PUT `/zones/api/v1/places/{id}`**
```json
{
  "idZone": "<uuid-from-zone>",
  "description": "Descripción actualizada",
  "type": "BIKE",
  "status": "MAINTENANCE"
}
```

**PATCH `/zones/api/v1/places/{id}/status`**
```
PATCH /zones/api/v1/places/{id}/status?status=OCCUPIED
```
> Status is sent as a query parameter, no body required.

### Place enum values

| Enum | Values |
|---|---|
| `type` (TypeOfPlace) | `CAR`, `BIKE`, `BUS` |
| `status` (StatusOfPlace) | `AVAILABLE`, `OCCUPIED`, `MAINTENANCE`, `RESERVED` |

---

## Health Checks

| Service | URL |
|---|---|
| Users | `GET /users/health` |
| Vehicles | `GET /vehicles/` |
| Zones | `GET /zones/api/v1/zones` |

---

## Swagger UI

Open `http://localhost:9000/docs`. Use the top-right dropdown to switch between services:

- **Users** — reads `/users/openapi.json`
- **Vehicles** — reads `/vehicles/api-json`
- **Zones** — reads `/zones/v3/api-docs`

> If specs fail to load, run `docker compose ps` and confirm all services are healthy.
