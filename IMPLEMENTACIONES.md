# Implementaciones y correcciones — Parras Car

## Servicio Users (FastAPI · Python)

### 1. `person_id` e IDs de UUID en vez de `int`
**Archivos:** `repositories/person_repository.py`, `repositories/user_repository.py`, `services/person_service.py`, `services/user_service.py`

Todos los parámetros `person_id: int`, `user_id: int` y `role_id: int` fueron cambiados a `UUID`. Se añadió `from uuid import UUID` donde hacía falta.

---

### 2. `phone` de `VARCHAR(10)` a `VARCHAR(20)`
**Archivo:** `entities/person.py`

```python
# Antes
phone = Column(String(10))

# Después
phone = Column(String(20))
```

Permite números internacionales con prefijo de país (`+593 99 123 4567`).

---

### 3. Validación de teléfono en `PersonBase`
**Archivo:** `dto/person.py`

Se movió el validador de teléfono directamente a `PersonBase` para que aplique a todas las clases que lo heredan. Acepta dígitos, espacios y los caracteres `+ - ( )`.

```python
@field_validator("phone", mode="before")
@classmethod
def validate_phone(cls, v: str | None) -> str | None:
    if v is None:
        return v
    if not _PHONE_REGEX.match(v.strip()):
        raise ValueError("El teléfono solo puede contener dígitos, espacios y los caracteres: + - ( )")
    return v.strip()
```

---

### 4. Validación de cédula ecuatoriana
**Archivos:** `dto/person.py`, `dto/user.py`

Se implementó el algoritmo oficial de validación de cédula del SRI ecuatoriano en la función `_validate_ecuadorian_cedula`:

- **Provincia válida**: los dos primeros dígitos deben ser 01–24 o 30
- **Persona natural**: el tercer dígito debe ser 0–5
- **Dígito verificador**: algoritmo de módulo 10 con coeficientes `[2,1,2,1,2,1,2,1,2]`

```python
def _validate_ecuadorian_cedula(v: str) -> str:
    province = int(v[:2])
    if not (1 <= province <= 24 or province == 30):
        raise ValueError("La cédula no corresponde a una provincia ecuatoriana válida")
    if int(v[2]) > 5:
        raise ValueError("La cédula no es válida para una persona natural")
    coefficients = [2, 1, 2, 1, 2, 1, 2, 1, 2]
    total = 0
    for i in range(9):
        val = int(v[i]) * coefficients[i]
        if val >= 10:
            val -= 9
        total += val
    if (10 - total % 10) % 10 != int(v[9]):
        raise ValueError("El dígito verificador de la cédula no es válido")
    return v
```

El validador se aplica en `UserCreate` con `mode="after"` (corre después de verificar que sean exactamente 10 dígitos). No se puso en `PersonBase` para no romper lecturas del admin cuya cédula es `0000000000`.

---

### 5. Corrección de `root_path` en FastAPI
**Archivo:** `app/main.py`

`FastAPI(root_path="/users")` hacía que Starlette eliminara el prefijo `/users` antes del routing interno, causando que `GET /users` en los tests devolviera 404. Se eliminó `root_path` y se reemplazó por `servers` que solo afecta la generación del spec de OpenAPI:

```python
# Antes
app = FastAPI(root_path="/users")

# Después
app = FastAPI(
    title="Users Service",
    version="1.0.0",
    servers=[{"url": "/users", "description": "API Gateway"}],
)
```

---

### 6. Tests: fixtures de auth eliminadas
**Archivo:** `tests/conftest.py`

Se eliminaron los fixtures `admin_token` y `admin_headers` que llamaban a `/auth/login` (endpoint vacío). Los tests ahora corren sin autenticación, consistente con la decisión de no implementar auth.

---

### 7. Tests: cédulas válidas y nuevos casos de prueba
**Archivos:** `tests/test_persons.py`, `tests/test_users.py`

Todas las cédulas de prueba inválidas fueron reemplazadas por cédulas reales de provincia 17 (Pichincha) pre-calculadas: `1710000017`, `1710000025`, `1710000033`, etc.

Se añadieron dos nuevos tests:
- `test_create_person_rejects_invalid_cedula_algorithm` — dígito verificador incorrecto
- `test_create_person_rejects_invalid_cedula_province` — provincia 99 inexistente

**Resultado: 23/23 tests pasando.**

---

## Servicio Vehicles (NestJS · TypeScript)

### 8. Soft-delete con campo `active`
**Archivos:** `entities/vehicle.entity.ts`, `vehicles.service.ts`, `vehicles.controller.ts`

Se reemplazó el hard-delete por soft-delete usando un campo `active: boolean` en la entidad:

| Endpoint | Comportamiento |
|----------|---------------|
| `GET /vehicles` | Solo devuelve vehículos con `active: true` |
| `GET /vehicles/:id` | Devuelve el vehículo sin importar si está activo o no |
| `DELETE /vehicles/:id` | Marca `active = false` (soft-delete), devuelve 204 |
| `PATCH /vehicles/:id/activate` | *(nuevo)* Reactiva un vehículo inactivo |
| `PATCH /vehicles/:id` | Devuelve 409 si el vehículo está inactivo |

---

### 9. Corrección de path de Swagger en Vehicles
**Archivo:** `src/main.ts`

```typescript
// Antes — servía el JSON en /api-docs-json (no coincidía con docker-compose)
SwaggerModule.setup('api-docs', app, document);

// Después — sirve el JSON en /api-json (coincide con la URL del swagger-ui)
SwaggerModule.setup('api', app, document);
```

---

### 10. Enums aceptan minúsculas
**Archivo:** `dto/create-vehicle.dto.ts`

Se añadió `@Transform` de `class-transformer` para convertir el valor a mayúsculas antes de la validación `@IsEnum`:

```typescript
@Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
@IsEnum(Clasification, { message: 'Clasification must be one of: ELECTRIC, HYBRID, GASOLINE, DIESEL' })
clasification!: Clasification;

@Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
@IsEnum(TypeOfMotorbike, { message: 'Type of motorbike must be one of: ENDURO, SPORT, CRUISER, SCOOTER, TOURING' })
typeOfMotorbike!: TypeOfMotorbike;
```

Ahora `"gasoline"`, `"GASOLINE"` y `"Gasoline"` son equivalentes.

---

### 11. Corrección del Update de vehículos
**Archivos:** `dto/update-vehicle.dto.ts`, `vehicles.service.ts`

**Problema:** `UpdateVehicleDto extends PartialType(CreateVehicleDto)` hacía opcionales `tipo` y `datos` a nivel raíz, pero los sub-DTOs internos (`CarDto`, `MotorcycleDto`, `PickupTruckDto`) seguían con todos los campos requeridos. Resultado: cualquier payload parcial fallaba con 400.

**Fix 1 — DTO:** Se eliminó `PartialType`, ahora hereda directamente de `CreateVehicleDto`:

```typescript
// Antes
export class UpdateVehicleDto extends PartialType(CreateVehicleDto) {}

// Después
export class UpdateVehicleDto extends CreateVehicleDto {}
```

**Fix 2 — Servicio:** Se añadió validación para evitar cambiar el tipo de vehículo (car → motocicleta, etc.):

```typescript
const TIPO_ENTITY_MAP = { car: Car, motocicleta: Motorcycle, pickupTruck: PickupTruck };

if (!(vehicle instanceof TIPO_ENTITY_MAP[updateVehicleDto.tipo])) {
    throw new ConflictException('No se puede cambiar el tipo de vehículo');
}
```

---

## Servicio Zones (Spring Boot · Java)

### 12. Enums aceptan minúsculas — JSON body
**Archivo:** `src/main/resources/application.yaml`

```yaml
spring:
  jackson:
    deserialization:
      accept-case-insensitive-enums: true
```

Jackson ahora deserializa `"vip"`, `"VIP"` y `"Vip"` al mismo valor de enum.

---

### 13. Enums aceptan minúsculas — query params
**Archivo:** `config/WebConfig.java` *(nuevo)*

Para los `@RequestParam` de tipo enum (ej. `?status=available`), Spring usa su propio sistema de conversión (no Jackson). Se creó un `WebMvcConfigurer` con un `ConverterFactory` personalizado:

```java
@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void addFormatters(FormatterRegistry registry) {
        registry.addConverterFactory(new CaseInsensitiveEnumConverterFactory());
    }

    private static final class CaseInsensitiveEnumConverterFactory
            implements ConverterFactory<String, Enum<?>> {
        @Override
        public <T extends Enum<?>> Converter<String, T> getConverter(Class<T> targetType) {
            return source -> (T) Enum.valueOf((Class<Enum>) targetType, source.trim().toUpperCase());
        }
    }
}
```

---

### 14. Endpoint DELETE para zonas
**Archivos:** `service/ZoneService.java`, `service/impl/ZoneServiceImpl.java`, `controller/ZoneController.java`

Se añadió `DELETE /api/v1/zones/{idZone}`. La lógica de negocio:

- Si la zona tiene lugares con status `OCCUPIED` → **409 Conflict**
- Si no → elimina la zona y en cascada todos sus lugares (`CascadeType.ALL + orphanRemoval = true`)

```java
@DeleteMapping("/{idZone}")
public ResponseEntity<Void> deleteZone(@PathVariable UUID idZone) {
    zoneService.deleteZone(idZone);
    return ResponseEntity.noContent().build();
}
```

---

### 15. `PATCH /places/{id}/status` usa `@RequestBody`
**Archivos:** `controller/PlaceController.java`, `dtos/UpdatePlaceStatusDto.java` *(nuevo)*

**Problema:** El endpoint usaba `@RequestParam StatusOfPlace status`. Al fallar la conversión del enum, Spring lanzaba `MethodArgumentTypeMismatchException` que `GlobalExceptionHandler` no capturaba, devolviendo un error genérico sin formato JSON.

**Fix:** Se creó `UpdatePlaceStatusDto` y el endpoint ahora usa `@Valid @RequestBody`:

```java
// Antes
@PatchMapping("/{id}/status")
public ResponseEntity<PlaceResponseDto> changeStatus(@PathVariable UUID id,
        @RequestParam StatusOfPlace status) { ... }

// Después
@PatchMapping("/{id}/status")
public ResponseEntity<PlaceResponseDto> changeStatus(@PathVariable UUID id,
        @Valid @RequestBody UpdatePlaceStatusDto body) {
    return ResponseEntity.ok(placeService.changeStatus(body.getStatus(), id));
}
```

---

### 16. Mejor manejo de errores en `GlobalExceptionHandler`
**Archivo:** `exception/GlobalExceptionHandler.java`

Se añadieron dos handlers que antes no existían:

**`HttpMessageNotReadableException`** — enum inválido en JSON body:
```
POST /zones con {"type": "INVALIDO"}
→ 400: "Valor 'INVALIDO' no válido. Valores aceptados: VIP, REGULAR, INTERNAL, EXTERNAL, PREFERENTIAL"
```

**`MethodArgumentTypeMismatchException`** — enum inválido en query param:
```
GET /places?status=INVALIDO
→ 400: "Parámetro 'status': valor 'INVALIDO' no válido. Valores aceptados: OCCUPIED, AVAILABLE, MAINTENANCE, RESERVED"
```

---

## Resumen de endpoints nuevos o modificados

| Servicio | Método | Endpoint | Estado |
|----------|--------|----------|--------|
| Users | POST | `/users/persons` | Ahora valida cédula ecuatoriana |
| Users | — | todos | `person_id` y `user_id` son UUID |
| Vehicles | DELETE | `/vehicles/vehicles/:id` | Cambiado a soft-delete |
| Vehicles | PATCH | `/vehicles/vehicles/:id/activate` | **Nuevo** |
| Vehicles | PATCH | `/vehicles/vehicles/:id` | Ahora valida tipo de vehículo |
| Zones | DELETE | `/zones/api/v1/zones/:id` | **Nuevo** |
| Zones | PATCH | `/zones/api/v1/places/:id/status` | Cambiado de `@RequestParam` a `@RequestBody` |
