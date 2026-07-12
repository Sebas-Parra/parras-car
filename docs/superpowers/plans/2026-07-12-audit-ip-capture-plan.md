# Audit event IP capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every audit event published by `vehicles`, `tickets`, `users`, `zones`, and `assignments` carries the originating client's IP address in its `ip` field.

**Architecture:** Each service gets a small, self-contained IP-extraction helper (one copy per service, consistent with how `event-published.service.ts`/`audit_publisher.py` are already duplicated per service rather than shared): prefer the first `X-Forwarded-For` value when present, otherwise fall back to the raw connection address, and normalize Node's `::ffff:`-prefixed IPv4-mapped-IPv6 notation. The extracted IP is threaded through the same controller → service → `emitEvent`/`publish_audit_event` call chains built in the original audit rollout — except in `zones`, where (mirroring the existing `CurrentUser.get()` pattern) a new `ClientIp.get()` reads the current request directly from Spring's `RequestContextHolder`, so no controller changes are needed there.

**Tech Stack:** Same as the original rollout — NestJS/Express, FastAPI/Starlette, Spring Boot/Servlet API. No new dependencies.

## Global Constraints

- IP extraction rule, identical across all 5 services: (1) if `X-Forwarded-For` is present, take its first comma-separated value, trimmed; (2) otherwise use the raw connection/socket remote address; (3) if the result starts with `::ffff:`, strip that prefix.
- Do not validate or reformat beyond that. A genuine IPv6 address will fail `ms-audit`'s existing `@IsIP('4')` validation and be dead-lettered — this is `ms-audit`'s pre-existing Plan 1 behavior and out of scope to change here.
- No `mac` capture — not practically obtainable across a router hop, already rejected in the design spec.
- No `docker-compose.yml` changes — no new environment variables are introduced.
- `assignments`' local business-audit trail (`app/db/listeners.py`, `app/entities/assignment_audit.py`, `app/services/audit_service.py`) stays untouched, same constraint as the original Plan 5.
- Every existing test in the four already-modified NestJS/Python/Java test files (`vehicles.service.spec.ts`, `tickets.service.spec.ts`, `test_auth_service_audit.py`, `test_person_service_audit.py`, `test_user_service_audit.py`, `test_assignment_service_audit.py`, `ZoneServiceImplAuditTest.java`, `PlaceServiceImplAuditTest.java`) must keep passing — these are modified in place, not replaced.

---

### Task 1: Capture IP in `vehicles`

**Files:**
- Create: `vehicles/src/vehicles/get-client-ip.ts`
- Test: `vehicles/src/vehicles/get-client-ip.spec.ts`
- Modify: `vehicles/src/vehicles/vehicles.service.ts`
- Modify: `vehicles/src/vehicles/vehicles.controller.ts`
- Modify: `vehicles/src/vehicles/vehicles.service.spec.ts`

**Interfaces:**
- Produces: `getClientIp(req: Request): string | undefined`, exported from `get-client-ip.ts`.
- Modifies: `VehiclesService.create(createVehicleDto, actingUser, ip?: string)` — `ip` is a new, optional third parameter.

- [ ] **Step 1: Write the failing test for `getClientIp`**

Create `vehicles/src/vehicles/get-client-ip.spec.ts`:

```typescript
import { Request } from 'express';
import { getClientIp } from './get-client-ip';

function buildRequest(overrides: Partial<Request>): Request {
  return { headers: {}, ...overrides } as Request;
}

describe('getClientIp', () => {
  it('prefers the first X-Forwarded-For value over req.ip', () => {
    const req = buildRequest({
      headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
      ip: '172.18.0.7',
    });
    expect(getClientIp(req)).toBe('203.0.113.5');
  });

  it('falls back to req.ip when there is no X-Forwarded-For header', () => {
    const req = buildRequest({ headers: {}, ip: '172.18.0.7' });
    expect(getClientIp(req)).toBe('172.18.0.7');
  });

  it('strips the IPv4-mapped-IPv6 prefix', () => {
    const req = buildRequest({ headers: {}, ip: '::ffff:127.0.0.1' });
    expect(getClientIp(req)).toBe('127.0.0.1');
  });

  it('returns undefined when neither source is available', () => {
    const req = buildRequest({ headers: {}, ip: undefined });
    expect(getClientIp(req)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vehicles && npx jest get-client-ip.spec.ts`
Expected: FAIL — `Cannot find module './get-client-ip'`

- [ ] **Step 3: Create `get-client-ip.ts`**

```typescript
import { Request } from 'express';

export function getClientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const raw = forwardedValue ? forwardedValue.split(',')[0].trim() : req.ip;
  if (!raw) return undefined;
  return raw.startsWith('::ffff:') ? raw.slice('::ffff:'.length) : raw;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd vehicles && npx jest get-client-ip.spec.ts`
Expected: PASS (4/4)

- [ ] **Step 5: Write the failing test for IP threading in `VehiclesService`**

Modify `vehicles/src/vehicles/vehicles.service.spec.ts` (full file):

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VehiclesService } from './vehicles.service';
import { Vehicle } from './entities/vehicle.entity';
import { EventPublisher } from './event-published.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';

describe('VehiclesService', () => {
  let service: VehiclesService;
  let repo: { findOne: jest.Mock; save: jest.Mock };
  let publisher: { publish: jest.Mock };

  beforeEach(async () => {
    repo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((v) => Promise.resolve({ id: 'veh-1', ...v })),
    };
    publisher = { publish: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VehiclesService,
        { provide: getRepositoryToken(Vehicle), useValue: repo },
        { provide: EventPublisher, useValue: publisher },
      ],
    }).compile();

    service = module.get<VehiclesService>(VehiclesService);
  });

  it('publishes the acting user on CREATE', async () => {
    const dto = {
      tipo: 'car',
      datos: { plate: 'ABC-123' },
    } as unknown as CreateVehicleDto;

    await service.create(dto, { username: 'jdoe', roles: ['admin'] });

    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ usuario: 'jdoe', rol: 'admin' }),
    );
  });

  it('publishes the client IP on CREATE when provided', async () => {
    const dto = {
      tipo: 'car',
      datos: { plate: 'ABC-124' },
    } as unknown as CreateVehicleDto;

    await service.create(dto, { username: 'jdoe', roles: ['admin'] }, '203.0.113.5');

    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ ip: '203.0.113.5' }),
    );
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd vehicles && npx jest vehicles.service.spec.ts`
Expected: FAIL — `create` doesn't accept a third argument yet, and the published event never has an `ip` field.

- [ ] **Step 7: Update `vehicles.service.ts`**

```typescript
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { Vehicle } from './entities/vehicle.entity';
import { FactoryVehiculos } from './factory/factory-vehicle';
import { AuditEvent, EventPublisher } from './event-published.service';

const ASSIGNMENTS_URL = process.env.ASSIGNMENTS_SERVICE_URL ?? 'http://assignments:8001';

export interface ActingUser {
  username: string;
  roles: string[];
}

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle)
    private repositoryVehicle: Repository<Vehicle>,
    private eventPublisher: EventPublisher
  ) { }

  // Método auxiliar para publicar eventos
  private async emitEvent(
    accion: string,
    vehiculo: Vehicle,
    actingUser: ActingUser,
    ip?: string,
    datosExtra?: any,
  ) {
    const event: AuditEvent = {
      servicio: 'ms-vehiculos',
      accion,
      entidad: 'VEHICULO',
      entidadId: vehiculo.id,
      datos: { ...vehiculo, ...datosExtra },
      usuario: actingUser.username,
      rol: actingUser.roles[0],
      ip,
    };
    await this.eventPublisher.publish(event);
  }

  async create(createVehicleDto: CreateVehicleDto, actingUser: ActingUser, ip?: string): Promise<Vehicle> {
    const exist = await this.repositoryVehicle.findOne({
      where: { plate: createVehicleDto.datos.plate },
    });
    if (exist) {
      throw new ConflictException(
        `Ya existe un vehículo con la placa '${createVehicleDto.datos.plate}'`,
      );
    }
    const vehicle = FactoryVehiculos.create(createVehicleDto);
    const saved = await this.repositoryVehicle.save(vehicle);
    await this.emitEvent('CREATE', saved, actingUser, ip);
    return saved
  }

  findAll(): Promise<Vehicle[]> {
    return this.repositoryVehicle.find();
  }

  async findOne(id: string): Promise<Vehicle> {
    const vehicle = await this.repositoryVehicle.findOne({ where: { id } });
    if (!vehicle) {
      throw new NotFoundException(`Vehículo con id '${id}' no encontrado`);
    }
    return vehicle;
  }

  async update(id: string, updateVehicleDto: UpdateVehicleDto): Promise<Vehicle> {
    const vehicle = await this.findOne(id);
    if (!vehicle.active) {
      throw new ConflictException(`No se puede actualizar un vehículo inactivo`);
    }
    if (vehicle.tipo !== updateVehicleDto.tipo) {
      throw new ConflictException(`No se puede cambiar el tipo de vehículo`);
    }
    const newPlate = updateVehicleDto.datos?.plate;
    if (newPlate && newPlate !== vehicle.plate) {
      const plateConflict = await this.repositoryVehicle.findOne({
        where: { plate: newPlate },
      });
      if (plateConflict) {
        throw new ConflictException(
          `Ya existe un vehículo con la placa '${newPlate}'`,
        );
      }
    }
    Object.assign(vehicle, updateVehicleDto.datos ?? {});
    try {
      return await this.repositoryVehicle.manager.save(vehicle);
    } catch (error) {
      if (error instanceof QueryFailedError) {
        throw new ConflictException(`Error al guardar el vehículo: ${(error as QueryFailedError).message}`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const vehicle = await this.findOne(id);
    if (!vehicle.active) {
      throw new ConflictException(`El vehículo ya está inactivo`);
    }
    const res = await fetch(`${ASSIGNMENTS_URL}/assignments/by-vehicle/${id}`);
    if (res.ok) {
      throw new ConflictException(
        'No se puede eliminar el vehículo porque tiene un propietario activo asignado',
      );
    }
    vehicle.active = false;
    await this.repositoryVehicle.save(vehicle);
  }

  async activate(id: string): Promise<Vehicle> {
    const vehicle = await this.findOne(id);
    vehicle.active = true;
    return this.repositoryVehicle.save(vehicle);
  }
}
```

- [ ] **Step 8: Update `vehicles.controller.ts`**

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { getClientIp } from './get-client-ip';
import { ActingUser, VehiclesService } from './vehicles.service';

interface AuthenticatedRequest extends Request {
  user: ActingUser;
}

@Controller('vehicles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  // Cualquier usuario autenticado — registrar vehículo
  @Post()
  @Roles('admin', 'root', 'cliente', 'recaudador')
  create(
    @Body() createVehicleDto: CreateVehicleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.vehiclesService.create(createVehicleDto, req.user, getClientIp(req));
  }

  // Cualquier usuario autenticado — consultar catálogo
  @Get()
  findAll() {
    return this.vehiclesService.findAll();
  }

  // Cualquier usuario autenticado — consultar vehículo
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vehiclesService.findOne(id);
  }

  // Admin / root — actualizar datos del vehículo
  @Patch(':id')
  @Roles('admin', 'root')
  update(@Param('id') id: string, @Body() updateVehicleDto: UpdateVehicleDto) {
    return this.vehiclesService.update(id, updateVehicleDto);
  }

  // Admin / root — reactivar vehículo
  @Patch(':id/activate')
  @Roles('admin', 'root')
  activate(@Param('id') id: string) {
    return this.vehiclesService.activate(id);
  }

  // Admin / root — inactivar vehículo (soft delete)
  @Delete(':id')
  @Roles('admin', 'root')
  remove(@Param('id') id: string) {
    return this.vehiclesService.remove(id);
  }
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `cd vehicles && npx jest vehicles.service.spec.ts`
Expected: PASS (2/2)

- [ ] **Step 10: Run the full vehicles test suite**

Run: `cd vehicles && npx jest`
Expected: PASS

- [ ] **Step 11: Live verification**

Run: `docker compose up -d --build rabbitmq audit-db ms-audit vehicles-db vehicles`

Then, with a valid JWT (`<token>`, any authenticated user — see the Postman collection `parras-car-audit-rollout-test.postman_collection.json` for how to get one):

```bash
curl -s -X POST http://localhost:3000/vehicles \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <token>' \
  -H 'X-Forwarded-For: 203.0.113.5' \
  -d '{"tipo":"car","datos":{"plate":"XYZ-9999","brand":"Kia","model":"Rio","color":"Azul","year":2021,"clasification":"GASOLINE","numberOfDoors":4,"trunkCapacity":400}}'
```

Expected: `201`. Then confirm the persisted event carries the IP:

```bash
docker compose logs ms-audit --tail 20
```

Expected: no validation errors (a rejected/dead-lettered event would log `Mensaje inválido`). Query it directly for full confirmation:

```bash
curl -s http://localhost:3002/api/v1/audit -H 'Authorization: Bearer <admin_token>' | grep -o '"ip":"[^"]*"' | tail -1
```

Expected: `"ip":"203.0.113.5"`.

Run: `docker compose down`

- [ ] **Step 12: Commit**

```bash
git add vehicles/src/vehicles/get-client-ip.ts vehicles/src/vehicles/get-client-ip.spec.ts vehicles/src/vehicles/vehicles.service.ts vehicles/src/vehicles/vehicles.controller.ts vehicles/src/vehicles/vehicles.service.spec.ts
git commit -m "feat(vehicles): capture and publish the client IP on audit events"
```

---

### Task 2: Capture IP in `tickets`

**Files:**
- Create: `tickets/src/tickets/get-client-ip.ts`
- Test: `tickets/src/tickets/get-client-ip.spec.ts`
- Modify: `tickets/src/tickets/tickets.service.ts`
- Modify: `tickets/src/tickets/tickets.controller.ts`
- Modify: `tickets/src/tickets/tickets.service.spec.ts`

**Interfaces:**
- Produces: `getClientIp(req: Request): string | undefined` (identical implementation to Task 1's, duplicated per service).
- Modifies: `TicketsService.create/.pay/.cancel` — each gains a new, optional final `ip?: string` parameter.

- [ ] **Step 1: Write the failing test for `getClientIp`**

Create `tickets/src/tickets/get-client-ip.spec.ts` (identical to Task 1's, adjusted import path — same file, no service-specific logic):

```typescript
import { Request } from 'express';
import { getClientIp } from './get-client-ip';

function buildRequest(overrides: Partial<Request>): Request {
  return { headers: {}, ...overrides } as Request;
}

describe('getClientIp', () => {
  it('prefers the first X-Forwarded-For value over req.ip', () => {
    const req = buildRequest({
      headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
      ip: '172.18.0.7',
    });
    expect(getClientIp(req)).toBe('203.0.113.5');
  });

  it('falls back to req.ip when there is no X-Forwarded-For header', () => {
    const req = buildRequest({ headers: {}, ip: '172.18.0.7' });
    expect(getClientIp(req)).toBe('172.18.0.7');
  });

  it('strips the IPv4-mapped-IPv6 prefix', () => {
    const req = buildRequest({ headers: {}, ip: '::ffff:127.0.0.1' });
    expect(getClientIp(req)).toBe('127.0.0.1');
  });

  it('returns undefined when neither source is available', () => {
    const req = buildRequest({ headers: {}, ip: undefined });
    expect(getClientIp(req)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tickets && npx jest get-client-ip.spec.ts`
Expected: FAIL — `Cannot find module './get-client-ip'`

- [ ] **Step 3: Create `get-client-ip.ts`**

```typescript
import { Request } from 'express';

export function getClientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const raw = forwardedValue ? forwardedValue.split(',')[0].trim() : req.ip;
  if (!raw) return undefined;
  return raw.startsWith('::ffff:') ? raw.slice('::ffff:'.length) : raw;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tickets && npx jest get-client-ip.spec.ts`
Expected: PASS (4/4)

- [ ] **Step 5: Write the failing test for IP threading in `TicketsService`**

Modify `tickets/src/tickets/tickets.service.spec.ts` — add three new `it(...)` blocks (one per mutating method) inside the existing `describe('TicketsService', ...)` block, right after the three existing tests, keeping everything else in the file unchanged:

```typescript
  it('publishes the client IP on CREATE when provided', async () => {
    const dto: CreateTicketDto = { idEspacio: 'place-1', placa: 'ABC-123' };

    await service.create(dto, 'empleado-1', 'Bearer token', actingUser, '203.0.113.5');

    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ ip: '203.0.113.5' }),
    );
  });

  it('publishes the client IP on UPDATE (pay) when provided', async () => {
    const activeTicket: Ticket = {
      id: 'tick-1',
      codigo: 'TCK-A1-1',
      idEspacio: 'place-1',
      codigoEspacio: 'A1',
      placa: 'ABC-123',
      idVehiculo: 'veh-1',
      tipoVehiculo: 'car',
      tipoEspacio: 'CAR',
      tipoZona: 'REGULAR',
      tarifaHora: 1,
      idUsuario: 'user-1',
      idEmpleadoIngreso: 'empleado-1',
      fechaHoraIngreso: new Date(Date.now() - 60_000),
      estado: EstadoTicket.ACTIVO,
      valorRecaudado: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Ticket;
    repo.findOne.mockResolvedValue(activeTicket);

    await service.pay('tick-1', 'empleado-1', 'Bearer token', actingUser, '203.0.113.5');

    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ ip: '203.0.113.5' }),
    );
  });

  it('publishes the client IP on DELETE (cancel) when provided', async () => {
    const activeTicket: Ticket = {
      id: 'tick-1',
      codigo: 'TCK-A1-1',
      idEspacio: 'place-1',
      codigoEspacio: 'A1',
      placa: 'ABC-123',
      idVehiculo: 'veh-1',
      tipoVehiculo: 'car',
      tipoEspacio: 'CAR',
      tipoZona: 'REGULAR',
      tarifaHora: 1,
      idUsuario: 'user-1',
      idEmpleadoIngreso: 'empleado-1',
      fechaHoraIngreso: new Date(),
      estado: EstadoTicket.ACTIVO,
      valorRecaudado: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Ticket;
    repo.findOne.mockResolvedValue(activeTicket);

    await service.cancel('tick-1', 'empleado-1', 'Bearer token', actingUser, '203.0.113.5');

    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ ip: '203.0.113.5' }),
    );
  });
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd tickets && npx jest tickets.service.spec.ts`
Expected: FAIL — `create`/`pay`/`cancel` don't accept a fifth argument yet.

- [ ] **Step 7: Update `tickets.service.ts`**

Apply this diff to `tickets/src/tickets/tickets.service.ts` (only `emitEvent`'s signature, and the three public methods' signatures + their `emitEvent`/`this.emitEvent` call sites change; every other line — the rate-computation constants, `computeRate`, `calcularValor`, `generateUniqueCode`, and all business-logic branches — stays exactly as-is):

```typescript
  private async emitEvent(
    accion: string,
    ticket: Ticket,
    actingUser: ActingUser,
    ip?: string,
    datosExtra?: any,
  ) {
    const event: AuditEvent = {
      servicio: 'ms-tickets',
      accion,
      entidad: 'TICKET',
      entidadId: ticket.id,
      datos: { ...ticket, ...datosExtra },
      usuario: actingUser.username,
      rol: actingUser.roles[0],
      ip,
    };
    await this.eventPublisher.publish(event);
  }

  async create(
    dto: CreateTicketDto,
    idEmpleado: string,
    authHeader: string,
    actingUser: ActingUser,
    ip?: string,
  ): Promise<Ticket> {
    // ... unchanged validation/creation logic (see current file) ...
    await this.emitEvent('CREATE', saved, actingUser, ip);
    return saved;
  }

  async pay(
    id: string,
    idEmpleado: string,
    authHeader: string,
    actingUser: ActingUser,
    ip?: string,
  ): Promise<Ticket> {
    // ... unchanged pay logic ...
    await this.emitEvent('UPDATE', saved, actingUser, ip);
    return saved;
  }

  async cancel(
    id: string,
    idEmpleado: string,
    authHeader: string,
    actingUser: ActingUser,
    ip?: string,
  ): Promise<Ticket> {
    // ... unchanged cancel logic ...
    await this.emitEvent('DELETE', saved, actingUser, ip);
    return saved;
  }
```

The full file, with only those signatures/call-sites changed and everything else identical to what's on disk today:

```typescript
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssignmentsClient } from './clients/assignments.client';
import { VehiclesClient } from './clients/vehicles.client';
import { ZonesClient } from './clients/zones.client';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { EstadoTicket } from './entities/enum/estado-ticket.enum';
import { Ticket } from './entities/ticket.entity';
import { AuditEvent, EventPublisher } from './event-published.service';

const PLACE_BASE_RATES: Record<string, number> = {
  CAR: Number(process.env.PLACE_RATE_CAR ?? 1.0),
  BIKE: Number(process.env.PLACE_RATE_BIKE ?? 0.5),
  BUS: Number(process.env.PLACE_RATE_BUS ?? 2.0),
};

const ZONE_MULTIPLIERS: Record<string, number> = {
  REGULAR: Number(process.env.ZONE_MULT_REGULAR ?? 1),
  VIP: Number(process.env.ZONE_MULT_VIP ?? 5),
  INTERNAL: Number(process.env.ZONE_MULT_INTERNAL ?? 3),
  EXTERNAL: Number(process.env.ZONE_MULT_EXTERNAL ?? 2),
  PREFERENTIAL: Number(process.env.ZONE_MULT_PREFERENTIAL ?? 0.5),
};

const DEFAULT_RATE = Number(process.env.TICKET_PRICE ?? 1.0);
const HOUR_MS = 60 * 60 * 1000;

const PLACE_VEHICLE_COMPAT: Record<string, string[]> = {
  CAR: ['car', 'pickupTruck'],
  BIKE: ['motocicleta'],
  BUS: [],
};

function computeRate(tipoEspacio?: string, tipoZona?: string): number {
  const base =
    (tipoEspacio && PLACE_BASE_RATES[tipoEspacio]) || DEFAULT_RATE;
  const mult = (tipoZona && ZONE_MULTIPLIERS[tipoZona]) || 1;
  return Math.round(base * mult * 100) / 100;
}

export interface ActingUser {
  username: string;
  roles: string[];
}

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    private readonly zonesClient: ZonesClient,
    private readonly vehiclesClient: VehiclesClient,
    private readonly assignmentsClient: AssignmentsClient,
    private readonly eventPublisher: EventPublisher,
  ) {}

  private async emitEvent(
    accion: string,
    ticket: Ticket,
    actingUser: ActingUser,
    ip?: string,
    datosExtra?: any,
  ) {
    const event: AuditEvent = {
      servicio: 'ms-tickets',
      accion,
      entidad: 'TICKET',
      entidadId: ticket.id,
      datos: { ...ticket, ...datosExtra },
      usuario: actingUser.username,
      rol: actingUser.roles[0],
      ip,
    };
    await this.eventPublisher.publish(event);
  }

  async create(
    dto: CreateTicketDto,
    idEmpleado: string,
    authHeader: string,
    actingUser: ActingUser,
    ip?: string,
  ): Promise<Ticket> {
    const vehicle = await this.vehiclesClient.findByPlate(dto.placa, authHeader);
    if (!vehicle) {
      throw new NotFoundException(
        `No existe un vehículo con la placa '${dto.placa}'`,
      );
    }
    if (!vehicle.active) {
      throw new ConflictException(
        `El vehículo con placa '${dto.placa}' está inactivo`,
      );
    }

    const activeTicket = await this.ticketRepository.findOne({
      where: { placa: dto.placa, estado: EstadoTicket.ACTIVO },
    });
    if (activeTicket) {
      throw new ConflictException(
        `El vehículo con placa '${dto.placa}' ya tiene un ticket activo (${activeTicket.codigo})`,
      );
    }

    const assignment = await this.assignmentsClient.findActiveByVehicle(
      vehicle.id,
    );
    if (!assignment) {
      throw new ConflictException(
        `El vehículo con placa '${dto.placa}' no tiene un propietario asignado`,
      );
    }

    const place = await this.zonesClient.findPlaceById(dto.idEspacio, authHeader);
    if (!place) {
      throw new NotFoundException(`Espacio '${dto.idEspacio}' no encontrado`);
    }
    if (!place.active || place.status !== 'AVAILABLE') {
      throw new ConflictException(
        `El espacio '${place.code}' no está disponible (estado: ${place.status})`,
      );
    }

    const allowedTipos = PLACE_VEHICLE_COMPAT[place.type] ?? [];
    if (!vehicle.tipo || !allowedTipos.includes(vehicle.tipo)) {
      throw new ConflictException(
        `El espacio '${place.code}' es de tipo ${place.type} y no admite ` +
          `vehículos de tipo '${vehicle.tipo ?? 'desconocido'}'`,
      );
    }

    const zone = await this.zonesClient.findZoneById(place.idZone, authHeader);
    const tarifaHora = computeRate(place.type, zone?.type);

    const fechaHoraIngreso = new Date();
    const codigo = await this.generateUniqueCode(place.code, fechaHoraIngreso);

    const ticket = this.ticketRepository.create({
      codigo,
      idEspacio: place.id,
      codigoEspacio: place.code,
      placa: dto.placa,
      idVehiculo: vehicle.id,
      tipoVehiculo: vehicle.tipo,
      tipoEspacio: place.type,
      tipoZona: zone?.type,
      tarifaHora,
      idUsuario: assignment.user_id,
      idEmpleadoIngreso: idEmpleado,
      fechaHoraIngreso,
      estado: EstadoTicket.ACTIVO,
      valorRecaudado: 0,
    });
    const saved = await this.ticketRepository.save(ticket);

    try {
      await this.zonesClient.setStatus(place.id, 'OCCUPIED', authHeader);
    } catch (error) {
      await this.ticketRepository.delete(saved.id);
      throw error;
    }

    await this.emitEvent('CREATE', saved, actingUser, ip);
    return saved;
  }

  findAll(): Promise<Ticket[]> {
    return this.ticketRepository.find();
  }

  async findOne(id: string): Promise<Ticket> {
    const ticket = await this.ticketRepository.findOne({ where: { id } });
    if (!ticket) {
      throw new NotFoundException(`Ticket con id '${id}' no encontrado`);
    }
    return ticket;
  }

  async pay(
    id: string,
    idEmpleado: string,
    authHeader: string,
    actingUser: ActingUser,
    ip?: string,
  ): Promise<Ticket> {
    const ticket = await this.findOne(id);
    if (ticket.estado !== EstadoTicket.ACTIVO) {
      throw new ConflictException(
        `El ticket '${ticket.codigo}' no está activo (estado: ${ticket.estado})`,
      );
    }
    const fechaHoraSalida = new Date();
    ticket.estado = EstadoTicket.PAGADO;
    ticket.fechaHoraSalida = fechaHoraSalida;
    ticket.valorRecaudado = this.calcularValor(ticket, fechaHoraSalida);
    ticket.idEmpleadoPago = idEmpleado;
    const saved = await this.ticketRepository.save(ticket);
    await this.zonesClient.setStatus(ticket.idEspacio, 'AVAILABLE', authHeader);
    await this.emitEvent('UPDATE', saved, actingUser, ip);
    return saved;
  }

  async cancel(
    id: string,
    idEmpleado: string,
    authHeader: string,
    actingUser: ActingUser,
    ip?: string,
  ): Promise<Ticket> {
    const ticket = await this.findOne(id);
    if (ticket.estado !== EstadoTicket.ACTIVO) {
      throw new ConflictException(
        `El ticket '${ticket.codigo}' no está activo (estado: ${ticket.estado})`,
      );
    }
    ticket.estado = EstadoTicket.ANULADO;
    ticket.fechaHoraSalida = new Date();
    ticket.idEmpleadoPago = idEmpleado;
    const saved = await this.ticketRepository.save(ticket);
    await this.zonesClient.setStatus(ticket.idEspacio, 'AVAILABLE', authHeader);
    await this.emitEvent('DELETE', saved, actingUser, ip);
    return saved;
  }

  private calcularValor(ticket: Ticket, salida: Date): number {
    const tarifa =
      Number(ticket.tarifaHora) ||
      computeRate(ticket.tipoEspacio, ticket.tipoZona);
    const elapsedMs = salida.getTime() - ticket.fechaHoraIngreso.getTime();
    const horas = Math.max(1, Math.ceil(elapsedMs / HOUR_MS));
    return Math.round(tarifa * horas * 100) / 100;
  }

  private async generateUniqueCode(
    placeCode: string,
    date: Date,
  ): Promise<string> {
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;

    let codigo = `TCK-${placeCode}-${stamp}`;
    let suffix = 1;
    while (await this.ticketRepository.findOne({ where: { codigo } })) {
      codigo = `TCK-${placeCode}-${stamp}-${suffix++}`;
    }
    return codigo;
  }
}
```

- [ ] **Step 8: Update `tickets.controller.ts`**

```typescript
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { getClientIp } from './get-client-ip';
import { ActingUser, TicketsService } from './tickets.service';

interface AuthenticatedRequest extends Request {
  user: { userId: string; username: string; roles: string[] };
}

function actingUserOf(req: AuthenticatedRequest): ActingUser {
  return { username: req.user.username, roles: req.user.roles };
}

@Controller('tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  // Empleado (recaudador) o admin/root — emitir ticket de ingreso
  @Post()
  @Roles('recaudador', 'admin', 'root')
  create(
    @Body() createTicketDto: CreateTicketDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.ticketsService.create(
      createTicketDto,
      req.user.userId,
      req.headers.authorization ?? '',
      actingUserOf(req),
      getClientIp(req),
    );
  }

  // Cualquier usuario autenticado — consultar tickets
  @Get()
  findAll() {
    return this.ticketsService.findAll();
  }

  // Cualquier usuario autenticado — consultar ticket
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ticketsService.findOne(id);
  }

  // Empleado (recaudador) o admin/root — registrar pago y liberar espacio
  @Patch(':id/pay')
  @Roles('recaudador', 'admin', 'root')
  pay(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.ticketsService.pay(
      id,
      req.user.userId,
      req.headers.authorization ?? '',
      actingUserOf(req),
      getClientIp(req),
    );
  }

  // Empleado (recaudador) o admin/root — anular ticket y liberar espacio
  @Patch(':id/cancel')
  @Roles('recaudador', 'admin', 'root')
  cancel(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.ticketsService.cancel(
      id,
      req.user.userId,
      req.headers.authorization ?? '',
      actingUserOf(req),
      getClientIp(req),
    );
  }
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `cd tickets && npx jest tickets.service.spec.ts`
Expected: PASS (6/6)

- [ ] **Step 10: Run the full tickets test suite**

Run: `cd tickets && npx jest`
Expected: PASS

- [ ] **Step 11: Live verification**

Run: `docker compose up -d --build rabbitmq audit-db ms-audit zones-db zones vehicles-db vehicles assignments-db assignments tickets-db tickets` (tickets' dependency chain requires zones/vehicles/assignments up too, per its existing `depends_on`).

Using a `recaudador`/`admin`/`root` JWT, an existing `idEspacio`, and an assigned vehicle's plate (see the Postman collection for how to set these up):

```bash
curl -s -X POST http://localhost:3001/tickets \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <token>' \
  -H 'X-Forwarded-For: 203.0.113.5' \
  -d '{"idEspacio":"<place_id>","placa":"<plate>"}'
```

Expected: `201`. Confirm via `ms-audit`:

```bash
curl -s http://localhost:3002/api/v1/audit -H 'Authorization: Bearer <admin_token>' | grep -o '"ip":"[^"]*"' | tail -1
```

Expected: `"ip":"203.0.113.5"`.

Run: `docker compose down`

- [ ] **Step 12: Commit**

```bash
git add tickets/src/tickets/get-client-ip.ts tickets/src/tickets/get-client-ip.spec.ts tickets/src/tickets/tickets.service.ts tickets/src/tickets/tickets.controller.ts tickets/src/tickets/tickets.service.spec.ts
git commit -m "feat(tickets): capture and publish the client IP on audit events"
```

---

### Task 3: Capture IP in `users` — auth (login/logout)

**Files:**
- Create: `users/app/utils/client_ip.py`
- Test: `users/tests/test_client_ip.py`
- Modify: `users/app/services/audit_publisher.py`
- Modify: `users/app/controllers/auth.py`
- Modify: `users/app/services/auth_service.py`
- Modify: `users/tests/test_auth_service_audit.py`

**Interfaces:**
- Produces: `get_client_ip(request: Request) -> str | None`, importable as `from app.utils.client_ip import get_client_ip` — Task 4 reuses this.
- Modifies: `publish_audit_event(..., ip: str | None = None)`; `auth_service.login(db, data, ip=None)`, `.logout(db, data, ip=None)`.

- [ ] **Step 1: Write the failing test for `get_client_ip`**

Create `users/tests/test_client_ip.py`. This constructs a real Starlette `Request` from a minimal ASGI scope, so no test client/app boot is needed:

```python
from starlette.requests import Request

from app.utils.client_ip import get_client_ip


def _make_request(headers: list[tuple[bytes, bytes]], client: tuple[str, int] | None) -> Request:
    scope = {"type": "http", "headers": headers, "client": client}
    return Request(scope)


def test_prefers_the_first_x_forwarded_for_value_over_the_socket_address():
    request = _make_request(
        headers=[(b"x-forwarded-for", b"203.0.113.5, 10.0.0.1")],
        client=("172.18.0.7", 12345),
    )
    assert get_client_ip(request) == "203.0.113.5"


def test_falls_back_to_the_socket_address_when_no_forwarded_header_is_present():
    request = _make_request(headers=[], client=("172.18.0.7", 12345))
    assert get_client_ip(request) == "172.18.0.7"


def test_strips_the_ipv4_mapped_ipv6_prefix():
    request = _make_request(headers=[], client=("::ffff:127.0.0.1", 12345))
    assert get_client_ip(request) == "127.0.0.1"


def test_returns_none_when_there_is_no_client_and_no_forwarded_header():
    request = _make_request(headers=[], client=None)
    assert get_client_ip(request) is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd users && JWT_SECRET=test_secret pytest tests/test_client_ip.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.utils.client_ip'`

- [ ] **Step 3: Create `client_ip.py`**

```python
from starlette.requests import Request


def get_client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        raw = forwarded.split(",")[0].strip()
    else:
        raw = request.client.host if request.client else None
    if raw and raw.startswith("::ffff:"):
        raw = raw[len("::ffff:") :]
    return raw
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd users && JWT_SECRET=test_secret pytest tests/test_client_ip.py -v`
Expected: PASS (4/4)

- [ ] **Step 5: Write the failing test for IP threading in `auth_service`**

Modify `users/tests/test_auth_service_audit.py` (full file):

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
def test_login_publishes_the_client_ip_when_provided(mock_publish, db_session):
    auth_service.login(
        db_session, LoginRequest(username="admin", password="Admin123!"), ip="203.0.113.5"
    )

    mock_publish.assert_called_once()
    assert mock_publish.call_args.kwargs["ip"] == "203.0.113.5"


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


@patch("app.services.auth_service.publish_audit_event")
def test_logout_publishes_the_client_ip_when_provided(mock_publish, db_session):
    response = auth_service.login(db_session, LoginRequest(username="admin", password="Admin123!"))
    mock_publish.reset_mock()

    auth_service.logout(
        db_session, LogoutRequest(refresh_token=response.refresh_token), ip="203.0.113.5"
    )

    mock_publish.assert_called_once()
    assert mock_publish.call_args.kwargs["ip"] == "203.0.113.5"
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd users && JWT_SECRET=test_secret pytest tests/test_auth_service_audit.py -v`
Expected: FAIL — `login()`/`logout()` don't accept an `ip` keyword argument yet.

- [ ] **Step 7: Update `publish_audit_event` in `audit_publisher.py`**

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
    ip: str | None = None,
) -> None:
    event = {
        "servicio": "ms-users",
        "accion": accion,
        "entidad": "USUARIO",
        "entidadId": entidad_id,
        "datos": datos,
        "usuario": usuario,
        "rol": rol,
        "ip": ip,
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

- [ ] **Step 8: Update `auth_service.py`**

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


def login(db: Session, data: LoginRequest, ip: str | None = None) -> TokenResponse:
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
        ip=ip,
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


def logout(db: Session, data: LogoutRequest, ip: str | None = None) -> None:
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
                ip=ip,
            )
```

(`refresh()` is unchanged — it doesn't emit an audit event, same as before this plan.)

- [ ] **Step 9: Update `auth.py` controller**

```python
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.core.deps import get_db
from app.dto.auth import LoginRequest, LogoutRequest, RefreshRequest, TokenResponse
from app.services import auth_service
from app.utils.client_ip import get_client_ip

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    return auth_service.login(db, data, ip=get_client_ip(request))


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(data: RefreshRequest, db: Session = Depends(get_db)):
    return auth_service.refresh(db, data)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(data: LogoutRequest, request: Request, db: Session = Depends(get_db)):
    auth_service.logout(db, data, ip=get_client_ip(request))
```

- [ ] **Step 10: Run test to verify it passes**

Run: `cd users && JWT_SECRET=test_secret pytest tests/test_auth_service_audit.py -v`
Expected: PASS (4/4)

- [ ] **Step 11: Run the full users test suite**

Run: `cd users && JWT_SECRET=test_secret pytest -v`
Expected: your new/modified tests pass; the same pre-existing 14 failures documented in the original rollout (missing auth headers in `test_persons.py`/`test_users.py`/`test_roles.py`) remain, unchanged in count and cause.

- [ ] **Step 12: Commit**

```bash
git add users/app/utils/client_ip.py users/tests/test_client_ip.py users/app/services/audit_publisher.py users/app/controllers/auth.py users/app/services/auth_service.py users/tests/test_auth_service_audit.py
git commit -m "feat(users): capture and publish the client IP on login/logout audit events"
```

---

### Task 4: Capture IP in `users` — persons and users CRUD

**Files:**
- Modify: `users/app/controllers/persons.py`
- Modify: `users/app/services/person_service.py`
- Modify: `users/app/controllers/users.py`
- Modify: `users/app/services/user_service.py`
- Modify: `users/tests/test_person_service_audit.py`
- Modify: `users/tests/test_user_service_audit.py`

**Interfaces:**
- Consumes: `get_client_ip` from `app.utils.client_ip` (Task 3).
- Modifies: `person_service.create_person_with_user(db, data, ip=None)`, `.update_person(..., ip=None)`, `.deactivate_person(..., ip=None)`, `.activate_person(..., ip=None)`; `user_service.update_user(..., ip=None)`, `.deactivate_user(..., ip=None)`, `.activate_user(..., ip=None)`, `.assign_role(..., ip=None)`, `.remove_role(..., ip=None)`.

- [ ] **Step 1: Write the failing tests**

Modify `users/tests/test_person_service_audit.py` (full file — three new `ip`-focused tests appended, existing tests unchanged):

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
def test_create_person_with_user_publishes_the_client_ip_when_provided(mock_publish, db_session):
    _ensure_cliente_role(db_session)
    data = UserCreate(
        cedula="1710000041",
        first_name="Ip",
        middle_name="Test",
        last_name="Register",
        email="ipregister@example.com",
        phone="0991234567",
        address="Calle Falsa 123",
        nationality="Ecuatoriana",
        password="Password123",
    )

    person_service.create_person_with_user(db_session, data, ip="203.0.113.5")

    mock_publish.assert_called_once()
    assert mock_publish.call_args.kwargs["ip"] == "203.0.113.5"


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
def test_update_person_publishes_the_client_ip_when_provided(mock_publish, db_session):
    _ensure_cliente_role(db_session)
    data = UserCreate(
        cedula="1710000058",
        first_name="Update",
        middle_name="Ip",
        last_name="Test",
        email="updateip@example.com",
        phone="0991234567",
        address="Calle Falsa 123",
        nationality="Ecuatoriana",
        password="Password123",
    )
    person = person_service.create_person_with_user(db_session, data)
    mock_publish.reset_mock()
    current_user = {"username": "admin", "roles": ["administrador"]}

    person_service.update_person(
        db_session, person.id, PersonUpdate(phone="0987654321"), current_user, ip="203.0.113.5"
    )

    mock_publish.assert_called_once()
    assert mock_publish.call_args.kwargs["ip"] == "203.0.113.5"


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

Modify `users/tests/test_user_service_audit.py` (full file — one new `ip`-focused test appended):

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
def test_update_user_publishes_the_client_ip_when_provided(mock_publish, db_session):
    admin_user = _get_admin_user(db_session)

    user_service.update_user(
        db_session, admin_user.id_person, UserUpdate(username="admin3"), CURRENT_USER, ip="203.0.113.5"
    )

    mock_publish.assert_called_once()
    assert mock_publish.call_args.kwargs["ip"] == "203.0.113.5"


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

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd users && JWT_SECRET=test_secret pytest tests/test_person_service_audit.py tests/test_user_service_audit.py -v`
Expected: FAIL — none of the six functions accept an `ip` keyword argument yet.

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


def create_person_with_user(db: Session, data: UserCreate, ip: str | None = None) -> Person:
    if person_repository.get_by_cedula(db, data.cedula):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Cedula already registered")

    if person_repository.get_by_email(db, data.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"El correo '{data.email}' ya está registrado, por favor ingrese uno diferente",
        )

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

    publish_audit_event(
        accion="CREATE",
        entidad_id=str(person.id),
        usuario=generated_username,
        rol="cliente",
        datos={"username": generated_username, "email": person.email, "cedula": person.cedula},
        ip=ip,
    )
    return person


def update_person(
    db: Session, person_id: UUID, data: PersonUpdate, current_user: dict, ip: str | None = None
) -> Person:
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
        ip=ip,
    )
    return person


def deactivate_person(db: Session, person_id: UUID, current_user: dict, ip: str | None = None) -> Person:
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
        ip=ip,
    )
    return person


def activate_person(db: Session, person_id: UUID, current_user: dict, ip: str | None = None) -> Person:
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
        ip=ip,
    )
    return person
```

- [ ] **Step 4: Update `persons.py` controller**

```python
from uuid import UUID

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_admin, require_self_or_admin
from app.dto.person import PersonRead, PersonUpdate
from app.dto.user import PersonWithUserRead, UserCreate
from app.services import person_service
from app.utils.client_ip import get_client_ip

router = APIRouter(prefix="/persons", tags=["persons"])


# Public — self-registration, auto-assigns 'cliente' role
@router.post("", response_model=PersonWithUserRead, status_code=status.HTTP_201_CREATED)
def create_person(data: UserCreate, request: Request, db: Session = Depends(get_db)):
    return person_service.create_person_with_user(db, data, ip=get_client_ip(request))


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
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_self_or_admin),
):
    return person_service.update_person(db, person_id, data, current_user, ip=get_client_ip(request))


# Admin / root only
@router.patch("/{person_id}/deactivate", response_model=PersonRead)
def deactivate_person(
    person_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    return person_service.deactivate_person(db, person_id, current_user, ip=get_client_ip(request))


# Admin / root only
@router.patch("/{person_id}/activate", response_model=PersonRead)
def activate_person(
    person_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    return person_service.activate_person(db, person_id, current_user, ip=get_client_ip(request))
```

- [ ] **Step 5: Update `user_service.py`**

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


def update_user(
    db: Session, user_id: UUID, data: UserUpdate, current_user: dict, ip: str | None = None
) -> User:
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
        ip=ip,
    )
    return user


def deactivate_user(db: Session, user_id: UUID, current_user: dict, ip: str | None = None) -> User:
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
        ip=ip,
    )
    return user


def activate_user(db: Session, user_id: UUID, current_user: dict, ip: str | None = None) -> User:
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
        ip=ip,
    )
    return user


def assign_role(db: Session, user_id: UUID, role_id: UUID, current_user: dict, ip: str | None = None) -> User:
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
        ip=ip,
    )
    return user


def remove_role(db: Session, user_id: UUID, role_id: UUID, current_user: dict, ip: str | None = None) -> User:
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
        ip=ip,
    )
    return user
```

- [ ] **Step 6: Update `users.py` controller**

```python
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_admin, require_self_or_admin
from app.dto.role import RoleAssign
from app.dto.user import UserDetailRead, UserRead, UserUpdate
from app.services import user_service
from app.utils.client_ip import get_client_ip

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
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_self_or_admin),
):
    return user_service.update_user(db, user_id, data, current_user, ip=get_client_ip(request))


# Admin / root only
@router.patch("/{user_id}/deactivate", response_model=UserRead)
def deactivate_user(
    user_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    return user_service.deactivate_user(db, user_id, current_user, ip=get_client_ip(request))


# Admin / root only
@router.patch("/{user_id}/activate", response_model=UserRead)
def activate_user(
    user_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    return user_service.activate_user(db, user_id, current_user, ip=get_client_ip(request))


# Admin / root only
@router.post("/{user_id}/roles", response_model=UserRead)
def assign_role(
    user_id: UUID,
    data: RoleAssign,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    return user_service.assign_role(db, user_id, data.role_id, current_user, ip=get_client_ip(request))


# Admin / root only
@router.delete("/{user_id}/roles/{role_id}", response_model=UserRead)
def remove_role(
    user_id: UUID,
    role_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    return user_service.remove_role(db, user_id, role_id, current_user, ip=get_client_ip(request))
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd users && JWT_SECRET=test_secret pytest tests/test_person_service_audit.py tests/test_user_service_audit.py -v`
Expected: PASS (5/5 in `test_person_service_audit.py`, 4/4 in `test_user_service_audit.py`)

- [ ] **Step 8: Run the full users test suite**

Run: `cd users && JWT_SECRET=test_secret pytest -v`
Expected: same pre-existing 14 failures (unrelated, documented in the original rollout), everything else passes.

- [ ] **Step 9: Live verification**

Run: `docker compose up -d --build rabbitmq audit-db ms-audit users-db users`

```bash
curl -s -X POST http://localhost:8000/persons \
  -H 'Content-Type: application/json' \
  -H 'X-Forwarded-For: 203.0.113.5' \
  -d '{"cedula":"1710000082","first_name":"Ip","middle_name":"Test","last_name":"Capture","email":"iptest@example.com","phone":"0991234567","address":"Calle Falsa 123","nationality":"Ecuatoriana","password":"Password123"}'
```

Expected: `201`. Confirm via `ms-audit`:

```bash
curl -s http://localhost:3002/api/v1/audit -H 'Authorization: Bearer <admin_token>' | grep -o '"ip":"[^"]*"' | tail -1
```

Expected: `"ip":"203.0.113.5"`.

Run: `docker compose down`

- [ ] **Step 10: Commit**

```bash
git add users/app/controllers/persons.py users/app/services/person_service.py users/app/controllers/users.py users/app/services/user_service.py users/tests/test_person_service_audit.py users/tests/test_user_service_audit.py
git commit -m "feat(users): capture and publish the client IP on person/user CRUD audit events"
```

---

### Task 5: Capture IP in `zones`

**Files:**
- Create: `zones/src/main/java/ec/edu/espe/zonas/security/ClientIp.java`
- Test: `zones/src/test/java/ec/edu/espe/zonas/security/ClientIpTest.java`
- Modify: `zones/src/main/java/ec/edu/espe/zonas/audit/AuditEvent.java`
- Modify: `zones/src/main/java/ec/edu/espe/zonas/service/impl/ZoneServiceImpl.java`
- Modify: `zones/src/main/java/ec/edu/espe/zonas/service/impl/PlaceServiceImpl.java`
- Modify: `zones/src/test/java/ec/edu/espe/zonas/service/impl/ZoneServiceImplAuditTest.java`
- Modify: `zones/src/test/java/ec/edu/espe/zonas/service/impl/PlaceServiceImplAuditTest.java`

**Interfaces:**
- Produces: `ClientIp.get(): String` (static, mirrors `CurrentUser.get()`), reading the current request from Spring's `RequestContextHolder` — no controller changes needed.
- Modifies: `AuditEvent` record gains an `ip` field (8th, final field).

- [ ] **Step 1: Write the failing test for `ClientIp`**

Create `zones/src/test/java/ec/edu/espe/zonas/security/ClientIpTest.java`:

```java
package ec.edu.espe.zonas.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

class ClientIpTest {

    @AfterEach
    void tearDown() {
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void prefersTheFirstXForwardedForValueOverTheRawRemoteAddress() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Forwarded-For", "203.0.113.5, 10.0.0.1");
        request.setRemoteAddr("172.18.0.7");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));

        assertThat(ClientIp.get()).isEqualTo("203.0.113.5");
    }

    @Test
    void fallsBackToTheRawRemoteAddressWhenNoForwardedHeaderIsPresent() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("172.18.0.7");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));

        assertThat(ClientIp.get()).isEqualTo("172.18.0.7");
    }

    @Test
    void stripsTheIpv4MappedIpv6Prefix() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("::ffff:127.0.0.1");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));

        assertThat(ClientIp.get()).isEqualTo("127.0.0.1");
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd zones && mvn -q test -Dtest=ClientIpTest`
Expected: FAIL — compile error, `ClientIp` doesn't exist yet.

- [ ] **Step 3: Create `ClientIp.java`**

```java
package ec.edu.espe.zonas.security;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

public final class ClientIp {

    private ClientIp() {
    }

    public static String get() {
        ServletRequestAttributes attrs =
                (ServletRequestAttributes) RequestContextHolder.currentRequestAttributes();
        HttpServletRequest request = attrs.getRequest();
        String forwarded = request.getHeader("X-Forwarded-For");
        String raw = (forwarded != null && !forwarded.isBlank())
                ? forwarded.split(",")[0].trim()
                : request.getRemoteAddr();
        return (raw != null && raw.startsWith("::ffff:"))
                ? raw.substring("::ffff:".length())
                : raw;
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd zones && mvn -q test -Dtest=ClientIpTest`
Expected: PASS (3/3)

- [ ] **Step 5: Write the failing tests for IP threading in `ZoneServiceImpl`/`PlaceServiceImpl`**

Modify `zones/src/test/java/ec/edu/espe/zonas/service/impl/ZoneServiceImplAuditTest.java` (full file — `setUp`/`tearDown` now also manage `RequestContextHolder`, and one new IP-focused test is added):

```java
package ec.edu.espe.zonas.service.impl;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import ec.edu.espe.zonas.audit.AuditEvent;
import ec.edu.espe.zonas.audit.AuditPublisher;
import ec.edu.espe.zonas.dtos.ZoneRequestDto;
import ec.edu.espe.zonas.entidades.Zone;
import ec.edu.espe.zonas.entidades.enums.TypeOfZone;
import ec.edu.espe.zonas.repositories.PlaceRepository;
import ec.edu.espe.zonas.repositories.ZoneRepository;
import ec.edu.espe.zonas.security.AuthenticatedUser;

@ExtendWith(MockitoExtension.class)
class ZoneServiceImplAuditTest {

    @Mock
    private ZoneRepository zoneRepository;
    @Mock
    private PlaceRepository placeRepository;
    @Mock
    private AuditPublisher auditPublisher;

    private ZoneServiceImpl zoneService;

    @BeforeEach
    void setUp() {
        zoneService = new ZoneServiceImpl();
        org.springframework.test.util.ReflectionTestUtils.setField(zoneService, "zoneRepository", zoneRepository);
        org.springframework.test.util.ReflectionTestUtils.setField(zoneService, "placeRepository", placeRepository);
        org.springframework.test.util.ReflectionTestUtils.setField(zoneService, "auditPublisher", auditPublisher);

        AuthenticatedUser actor = new AuthenticatedUser("user-1", "jdoe", List.of("admin"));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(actor, null, List.of()));

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("203.0.113.5");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void createZonePublishesACreateEvent() {
        ZoneRequestDto request = new ZoneRequestDto();
        request.setName("Zona Norte");
        request.setCapacity(10);
        request.setType(TypeOfZone.REGULAR);
        when(zoneRepository.existsByNameNormalized("Zona Norte")).thenReturn(false);
        when(zoneRepository.count()).thenReturn(0L);
        when(zoneRepository.save(any(Zone.class))).thenAnswer(inv -> inv.getArgument(0));

        zoneService.createZone(request);

        ArgumentCaptor<AuditEvent> captor = ArgumentCaptor.forClass(AuditEvent.class);
        verify(auditPublisher).publish(captor.capture());
        AuditEvent event = captor.getValue();
        org.assertj.core.api.Assertions.assertThat(event.servicio()).isEqualTo("ms-zonas");
        org.assertj.core.api.Assertions.assertThat(event.accion()).isEqualTo("CREATE");
        org.assertj.core.api.Assertions.assertThat(event.entidad()).isEqualTo("ZONA");
        org.assertj.core.api.Assertions.assertThat(event.usuario()).isEqualTo("jdoe");
        org.assertj.core.api.Assertions.assertThat(event.rol()).isEqualTo("admin");
    }

    @Test
    void createZonePublishesTheClientIp() {
        ZoneRequestDto request = new ZoneRequestDto();
        request.setName("Zona Este");
        request.setCapacity(5);
        request.setType(TypeOfZone.REGULAR);
        when(zoneRepository.existsByNameNormalized("Zona Este")).thenReturn(false);
        when(zoneRepository.count()).thenReturn(0L);
        when(zoneRepository.save(any(Zone.class))).thenAnswer(inv -> inv.getArgument(0));

        zoneService.createZone(request);

        ArgumentCaptor<AuditEvent> captor = ArgumentCaptor.forClass(AuditEvent.class);
        verify(auditPublisher).publish(captor.capture());
        org.assertj.core.api.Assertions.assertThat(captor.getValue().ip()).isEqualTo("203.0.113.5");
    }

    @Test
    void deleteZonePublishesADeleteEvent() {
        UUID id = UUID.randomUUID();
        Zone zone = Zone.builder().id(id).name("Zona Sur").code("ZON-REG-01")
                .capacity(5).type(TypeOfZone.REGULAR).status(1).build();
        when(zoneRepository.findById(id)).thenReturn(Optional.of(zone));
        when(placeRepository.existsByZoneAndStatus(any(), any())).thenReturn(false);

        zoneService.deleteZone(id);

        ArgumentCaptor<AuditEvent> captor = ArgumentCaptor.forClass(AuditEvent.class);
        verify(auditPublisher).publish(captor.capture());
        AuditEvent event = captor.getValue();
        org.assertj.core.api.Assertions.assertThat(event.accion()).isEqualTo("DELETE");
        org.assertj.core.api.Assertions.assertThat(event.entidadId()).isEqualTo(id.toString());
    }
}
```

Modify `zones/src/test/java/ec/edu/espe/zonas/service/impl/PlaceServiceImplAuditTest.java` (full file — same `RequestContextHolder` setup added, plus one new IP-focused test):

```java
package ec.edu.espe.zonas.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import ec.edu.espe.zonas.audit.AuditEvent;
import ec.edu.espe.zonas.audit.AuditPublisher;
import ec.edu.espe.zonas.dtos.PlaceRequestDto;
import ec.edu.espe.zonas.entidades.Place;
import ec.edu.espe.zonas.entidades.Zone;
import ec.edu.espe.zonas.entidades.enums.StatusOfPlace;
import ec.edu.espe.zonas.entidades.enums.TypeOfPlace;
import ec.edu.espe.zonas.entidades.enums.TypeOfZone;
import ec.edu.espe.zonas.repositories.PlaceRepository;
import ec.edu.espe.zonas.repositories.ZoneRepository;
import ec.edu.espe.zonas.security.AuthenticatedUser;
import ec.edu.espe.zonas.utils.UtilsMappers;

@ExtendWith(MockitoExtension.class)
class PlaceServiceImplAuditTest {

    @Mock
    private PlaceRepository placeRepository;
    @Mock
    private ZoneRepository zoneRepository;
    @Mock
    private UtilsMappers mappers;
    @Mock
    private AuditPublisher auditPublisher;

    private PlaceServiceImpl placeService;

    @BeforeEach
    void setUp() {
        placeService = new PlaceServiceImpl(placeRepository, zoneRepository, mappers, auditPublisher);

        AuthenticatedUser actor = new AuthenticatedUser("user-1", "jdoe", List.of("admin"));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(actor, null, List.of()));

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("203.0.113.5");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void createPlacePublishesACreateEvent() {
        UUID zoneId = UUID.randomUUID();
        Zone zone = Zone.builder().id(zoneId).name("Zona Norte").code("ZON-REG-01")
                .capacity(10).type(TypeOfZone.REGULAR).status(1).build();
        when(zoneRepository.findById(zoneId)).thenReturn(Optional.of(zone));
        when(placeRepository.countByZone(zone)).thenReturn(0L);
        when(placeRepository.existsByCode(org.mockito.ArgumentMatchers.anyString())).thenReturn(false);

        PlaceRequestDto request = new PlaceRequestDto();
        request.setIdZone(zoneId);
        request.setType(TypeOfPlace.CAR);

        Place mappedPlace = new Place();
        mappedPlace.setId(UUID.randomUUID());
        when(mappers.toEntityPlace(request)).thenReturn(mappedPlace);
        when(placeRepository.save(any(Place.class))).thenAnswer(inv -> inv.getArgument(0));
        when(mappers.toPlaceResponseDto(any(Place.class))).thenReturn(null);

        placeService.createPlace(request);

        ArgumentCaptor<AuditEvent> captor = ArgumentCaptor.forClass(AuditEvent.class);
        verify(auditPublisher).publish(captor.capture());
        AuditEvent event = captor.getValue();
        assertThat(event.servicio()).isEqualTo("ms-zonas");
        assertThat(event.accion()).isEqualTo("CREATE");
        assertThat(event.entidad()).isEqualTo("PLACE");
        assertThat(event.usuario()).isEqualTo("jdoe");
        assertThat(event.rol()).isEqualTo("admin");
    }

    @Test
    void createPlacePublishesTheClientIp() {
        UUID zoneId = UUID.randomUUID();
        Zone zone = Zone.builder().id(zoneId).name("Zona Norte").code("ZON-REG-01")
                .capacity(10).type(TypeOfZone.REGULAR).status(1).build();
        when(zoneRepository.findById(zoneId)).thenReturn(Optional.of(zone));
        when(placeRepository.countByZone(zone)).thenReturn(0L);
        when(placeRepository.existsByCode(org.mockito.ArgumentMatchers.anyString())).thenReturn(false);

        PlaceRequestDto request = new PlaceRequestDto();
        request.setIdZone(zoneId);
        request.setType(TypeOfPlace.CAR);

        Place mappedPlace = new Place();
        mappedPlace.setId(UUID.randomUUID());
        when(mappers.toEntityPlace(request)).thenReturn(mappedPlace);
        when(placeRepository.save(any(Place.class))).thenAnswer(inv -> inv.getArgument(0));
        when(mappers.toPlaceResponseDto(any(Place.class))).thenReturn(null);

        placeService.createPlace(request);

        ArgumentCaptor<AuditEvent> captor = ArgumentCaptor.forClass(AuditEvent.class);
        verify(auditPublisher).publish(captor.capture());
        assertThat(captor.getValue().ip()).isEqualTo("203.0.113.5");
    }

    @Test
    void deletePlaceByIdPublishesADeleteEvent() {
        UUID id = UUID.randomUUID();
        Place place = new Place();
        place.setId(id);
        place.setCode("A1-01");
        place.setStatus(StatusOfPlace.AVAILABLE);
        when(placeRepository.findById(id)).thenReturn(Optional.of(place));

        placeService.deletePlaceById(id);

        ArgumentCaptor<AuditEvent> captor = ArgumentCaptor.forClass(AuditEvent.class);
        verify(auditPublisher).publish(captor.capture());
        assertThat(captor.getValue().accion()).isEqualTo("DELETE");
        assertThat(captor.getValue().entidadId()).isEqualTo(id.toString());
    }
}
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `cd zones && mvn -q test -Dtest='ZoneServiceImplAuditTest,PlaceServiceImplAuditTest'`
Expected: FAIL — `AuditEvent` has no `ip()` accessor yet.

- [ ] **Step 7: Update `AuditEvent.java`**

```java
package ec.edu.espe.zonas.audit;

import java.util.Map;

public record AuditEvent(
        String servicio,
        String accion,
        String entidad,
        String entidadId,
        Map<String, Object> datos,
        String usuario,
        String rol,
        String ip) {
}
```

- [ ] **Step 8: Update `ZoneServiceImpl.java`'s `emitEvent`**

Apply this change to `zones/src/main/java/ec/edu/espe/zonas/service/impl/ZoneServiceImpl.java`: add `import ec.edu.espe.zonas.security.ClientIp;` alongside the file's existing `ec.edu.espe.zonas.security.*` imports (`AuthenticatedUser`, `CurrentUser`), then update `emitEvent`'s body — every other method in the file is untouched:

```java
    private void emitEvent(String accion, Zone zone, Map<String, Object> datosExtra) {
        AuthenticatedUser actor = CurrentUser.get();
        AuditEvent event = new AuditEvent(
                "ms-zonas",
                accion,
                "ZONA",
                zone.getId() != null ? zone.getId().toString() : null,
                datosExtra,
                actor.username(),
                actor.roles().isEmpty() ? "" : actor.roles().get(0),
                ClientIp.get());
        auditPublisher.publish(event);
    }
```

- [ ] **Step 9: Update `PlaceServiceImpl.java`'s `emitEvent`**

Same change, in `zones/src/main/java/ec/edu/espe/zonas/service/impl/PlaceServiceImpl.java`. Add `import ec.edu.espe.zonas.security.ClientIp;` alongside the existing `ec.edu.espe.zonas.security.*` imports, and change `emitEvent`:

```java
    private void emitEvent(String accion, Place place, Map<String, Object> datosExtra) {
        AuthenticatedUser actor = CurrentUser.get();
        AuditEvent event = new AuditEvent(
                "ms-zonas",
                accion,
                "PLACE",
                place.getId().toString(),
                datosExtra,
                actor.username(),
                actor.roles().isEmpty() ? "" : actor.roles().get(0),
                ClientIp.get());
        auditPublisher.publish(event);
    }
```

- [ ] **Step 10: Run tests to verify they pass**

Run: `cd zones && mvn -q test -Dtest='ClientIpTest,ZoneServiceImplAuditTest,PlaceServiceImplAuditTest'`
Expected: PASS (3 + 4 + 4 = 11 tests)

- [ ] **Step 11: Run the full relevant test suite**

Run: `cd zones && mvn -q test -Dtest='AuditPublisherTest,JwtFilterTest,ClientIpTest,ZoneServiceImplAuditTest,PlaceServiceImplAuditTest'`
Expected: PASS

- [ ] **Step 12: Live verification**

Run: `docker compose up -d --build rabbitmq audit-db ms-audit zones-db zones`

```bash
curl -s -X POST http://localhost:8080/api/v1/zones \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <admin_token>' \
  -H 'X-Forwarded-For: 203.0.113.5' \
  -d '{"name":"Zona IP Test","capacity":5,"type":"REGULAR"}'
```

Expected: `201`. Confirm via `ms-audit`:

```bash
curl -s http://localhost:3002/api/v1/audit -H 'Authorization: Bearer <admin_token>' | grep -o '"ip":"[^"]*"' | tail -1
```

Expected: `"ip":"203.0.113.5"`.

Run: `docker compose down`

- [ ] **Step 13: Commit**

```bash
git add zones/src/main/java/ec/edu/espe/zonas/security/ClientIp.java zones/src/test/java/ec/edu/espe/zonas/security/ClientIpTest.java zones/src/main/java/ec/edu/espe/zonas/audit/AuditEvent.java zones/src/main/java/ec/edu/espe/zonas/service/impl/ZoneServiceImpl.java zones/src/main/java/ec/edu/espe/zonas/service/impl/PlaceServiceImpl.java zones/src/test/java/ec/edu/espe/zonas/service/impl/ZoneServiceImplAuditTest.java zones/src/test/java/ec/edu/espe/zonas/service/impl/PlaceServiceImplAuditTest.java
git commit -m "feat(zones): capture and publish the client IP on audit events"
```

---

### Task 6: Capture IP in `assignments`

**Files:**
- Create: `assignments/app/utils/client_ip.py`
- Test: `assignments/tests/test_client_ip.py`
- Modify: `assignments/app/services/audit_publisher.py`
- Modify: `assignments/app/controllers/assignments.py`
- Modify: `assignments/app/services/assignment_service.py`
- Modify: `assignments/tests/test_assignment_service_audit.py`

**Interfaces:**
- Produces: `get_client_ip(request: Request) -> str | None` (identical implementation to Task 3's `users` version, duplicated per service).
- Modifies: `AssignmentService.create/.delete/.transfer` — each gains a new, optional final `ip: str | None = None` parameter.

- [ ] **Step 1: Write the failing test for `get_client_ip`**

Create `assignments/tests/test_client_ip.py`:

```python
from starlette.requests import Request

from app.utils.client_ip import get_client_ip


def _make_request(headers: list[tuple[bytes, bytes]], client: tuple[str, int] | None) -> Request:
    scope = {"type": "http", "headers": headers, "client": client}
    return Request(scope)


def test_prefers_the_first_x_forwarded_for_value_over_the_socket_address():
    request = _make_request(
        headers=[(b"x-forwarded-for", b"203.0.113.5, 10.0.0.1")],
        client=("172.18.0.7", 12345),
    )
    assert get_client_ip(request) == "203.0.113.5"


def test_falls_back_to_the_socket_address_when_no_forwarded_header_is_present():
    request = _make_request(headers=[], client=("172.18.0.7", 12345))
    assert get_client_ip(request) == "172.18.0.7"


def test_strips_the_ipv4_mapped_ipv6_prefix():
    request = _make_request(headers=[], client=("::ffff:127.0.0.1", 12345))
    assert get_client_ip(request) == "127.0.0.1"


def test_returns_none_when_there_is_no_client_and_no_forwarded_header():
    request = _make_request(headers=[], client=None)
    assert get_client_ip(request) is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd assignments && JWT_SECRET=test_secret pytest tests/test_client_ip.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.utils.client_ip'`

- [ ] **Step 3: Create `client_ip.py`**

```python
from starlette.requests import Request


def get_client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        raw = forwarded.split(",")[0].strip()
    else:
        raw = request.client.host if request.client else None
    if raw and raw.startswith("::ffff:"):
        raw = raw[len("::ffff:") :]
    return raw
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd assignments && JWT_SECRET=test_secret pytest tests/test_client_ip.py -v`
Expected: PASS (4/4)

- [ ] **Step 5: Write the failing tests for IP threading in `AssignmentService`**

Modify `assignments/tests/test_assignment_service_audit.py` (full file — three new IP-focused tests appended, existing tests unchanged):

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
def test_create_publishes_the_client_ip_when_provided(mock_publish, db_session):
    svc = _service()

    svc.create(
        db_session, AssignmentCreate(user_id=USER_ID, vehicle_id=VEHICLE_ID), "token", CURRENT_USER, ip="203.0.113.5"
    )

    mock_publish.assert_called_once()
    assert mock_publish.call_args.kwargs["ip"] == "203.0.113.5"


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
def test_delete_publishes_the_client_ip_when_provided(mock_publish, db_session):
    svc = _service()
    svc.create(db_session, AssignmentCreate(user_id=USER_ID, vehicle_id=VEHICLE_ID), "token", CURRENT_USER)
    mock_publish.reset_mock()

    svc.delete(db_session, USER_ID, VEHICLE_ID, CURRENT_USER, ip="203.0.113.5")

    mock_publish.assert_called_once()
    assert mock_publish.call_args.kwargs["ip"] == "203.0.113.5"


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


@patch("app.services.assignment_service.publish_audit_event")
def test_transfer_publishes_the_client_ip_when_provided(mock_publish, db_session):
    svc = _service()
    svc.create(db_session, AssignmentCreate(user_id=USER_ID, vehicle_id=VEHICLE_ID), "token", CURRENT_USER)
    mock_publish.reset_mock()

    svc.transfer(
        db_session,
        VEHICLE_ID,
        AssignmentTransfer(from_user_id=USER_ID, to_user_id=USER_ID_2),
        "token",
        CURRENT_USER,
        ip="203.0.113.5",
    )

    mock_publish.assert_called_once()
    assert mock_publish.call_args.kwargs["ip"] == "203.0.113.5"
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd assignments && JWT_SECRET=test_secret pytest tests/test_assignment_service_audit.py -v`
Expected: FAIL — `create`/`delete`/`transfer` don't accept an `ip` keyword argument yet.

- [ ] **Step 7: Update `audit_publisher.py`**

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
    ip: str | None = None,
) -> None:
    event = {
        "servicio": "ms-assignments",
        "accion": accion,
        "entidad": "ASSIGNMENT",
        "entidadId": entidad_id,
        "datos": datos,
        "usuario": usuario,
        "rol": rol,
        "ip": ip,
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

- [ ] **Step 8: Update `assignment_service.py`**

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

    def create(
        self,
        db: Session,
        data: AssignmentCreate,
        token: str,
        current_user: dict,
        ip: str | None = None,
    ) -> AssignmentRead:
        self._validator.require_user_active(data.user_id, token)
        self._validator.require_vehicle_active(data.vehicle_id, token)
        self._validator.require_vehicle_available(db, data.vehicle_id, data.user_id)

        existing = assignment_repository.get_by_ids(db, data.user_id, data.vehicle_id)
        self._validator.require_not_already_active(existing)

        if existing:
            existing.active = True  # triggers after_update listener → MODIFICACION audit
            db.commit()
            db.refresh(existing)
            self._emit_audit_event("UPDATE", data.user_id, data.vehicle_id, current_user, ip)
            return existing

        assignment = assignment_repository.create(db, data.user_id, data.vehicle_id)  # triggers after_insert → CREACION audit
        db.commit()
        db.refresh(assignment)
        self._emit_audit_event("CREATE", data.user_id, data.vehicle_id, current_user, ip)
        return assignment

    def delete(
        self, db: Session, user_id: UUID, vehicle_id: UUID, current_user: dict, ip: str | None = None
    ) -> AssignmentRead:
        assignment = assignment_repository.get_by_ids(db, user_id, vehicle_id)
        if not assignment or not assignment.active:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active assignment not found")

        assignment_repository.soft_delete(db, assignment)  # triggers after_update listener → ELIMINACION audit
        db.commit()
        db.refresh(assignment)
        self._emit_audit_event("DELETE", user_id, vehicle_id, current_user, ip)
        return assignment

    def transfer(
        self,
        db: Session,
        vehicle_id: UUID,
        data: AssignmentTransfer,
        token: str,
        current_user: dict,
        ip: str | None = None,
    ) -> AssignmentRead:
        self._validator.require_different_users(data.from_user_id, data.to_user_id)
        self._validator.require_user_active(data.from_user_id, token)
        self._validator.require_user_active(data.to_user_id, token)
        self._validator.require_vehicle_active(vehicle_id, token)
        self._validator.require_active_assignment(db, data.from_user_id, vehicle_id)

        old_assignment = assignment_repository.get_by_ids(db, data.from_user_id, vehicle_id)
        assignment_repository.soft_delete(db, old_assignment)  # listener → ELIMINACION

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
            ip=ip,
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

    def _emit_audit_event(
        self, accion: str, user_id: UUID, vehicle_id: UUID, current_user: dict, ip: str | None = None
    ) -> None:
        roles = current_user.get("roles") or []
        publish_audit_event(
            accion=accion,
            entidad_id=f"{user_id}:{vehicle_id}",
            usuario=current_user.get("username", ""),
            rol=roles[0] if roles else "",
            datos={"user_id": str(user_id), "vehicle_id": str(vehicle_id)},
            ip=ip,
        )
```

- [ ] **Step 9: Update `assignments.py` controller**

```python
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.deps import get_bearer_token, get_current_user, get_db, require_admin, require_self_or_admin
from app.dto.assignment import AssignmentCreate, AssignmentRead, AssignmentTransfer, FleetResponse
from app.dto.audit import AuditRead
from app.services.assignment_service import AssignmentService
from app.services.assignment_validator import AssignmentValidator
from app.services.audit_service import AuditService
from app.utils.client_ip import get_client_ip

router = APIRouter(prefix="/assignments", tags=["assignments"])


def get_assignment_service() -> AssignmentService:
    return AssignmentService(validator=AssignmentValidator(), audit=AuditService())


# Propio usuario o admin/root — cliente solo puede asignarse a sí mismo
@router.post("", response_model=AssignmentRead, status_code=201)
def create_assignment(
    data: AssignmentCreate,
    request: Request,
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
    return svc.create(db, data, token, current_user, ip=get_client_ip(request))


# Admin / root only
@router.delete("/{user_id}/{vehicle_id}", response_model=AssignmentRead)
def delete_assignment(
    user_id: UUID,
    vehicle_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    svc: AssignmentService = Depends(get_assignment_service),
    current_user: dict = Depends(require_admin),
):
    return svc.delete(db, user_id, vehicle_id, current_user, ip=get_client_ip(request))


# Admin / root only
@router.patch("/{vehicle_id}/transfer", response_model=AssignmentRead)
def transfer_assignment(
    vehicle_id: UUID,
    data: AssignmentTransfer,
    request: Request,
    db: Session = Depends(get_db),
    svc: AssignmentService = Depends(get_assignment_service),
    current_user: dict = Depends(require_admin),
    token: str = Depends(get_bearer_token),
):
    return svc.transfer(db, vehicle_id, data, token, current_user, ip=get_client_ip(request))


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

- [ ] **Step 10: Run test to verify it passes**

Run: `cd assignments && JWT_SECRET=test_secret pytest tests/test_assignment_service_audit.py -v`
Expected: PASS (7/7)

- [ ] **Step 11: Run the full assignments test suite**

Run: `cd assignments && JWT_SECRET=test_secret pytest -v`
Expected: same pre-existing 30 failures documented in the original rollout (unrelated to this change), everything else passes.

- [ ] **Step 12: Live verification**

Run: `docker compose up -d --build rabbitmq audit-db ms-audit users-db users vehicles-db vehicles assignments-db assignments`

Using a real registered person, vehicle, and admin token (see the Postman collection):

```bash
curl -s -X POST http://localhost:8001/assignments \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <admin_token>' \
  -H 'X-Forwarded-For: 203.0.113.5' \
  -d '{"user_id":"<person_id>","vehicle_id":"<vehicle_id>"}'
```

Expected: `201`. Confirm via `ms-audit`:

```bash
curl -s http://localhost:3002/api/v1/audit -H 'Authorization: Bearer <admin_token>' | grep -o '"ip":"[^"]*"' | tail -1
```

Expected: `"ip":"203.0.113.5"`.

Run: `docker compose down`

- [ ] **Step 13: Commit**

```bash
git add assignments/app/utils/client_ip.py assignments/tests/test_client_ip.py assignments/app/services/audit_publisher.py assignments/app/controllers/assignments.py assignments/app/services/assignment_service.py assignments/tests/test_assignment_service_audit.py
git commit -m "feat(assignments): capture and publish the client IP on audit events"
```

---

## Self-Review Notes

- **Spec coverage:** the design spec's IP-extraction rule (X-Forwarded-For → raw address → `::ffff:` stripping) is implemented identically in all 6 tasks (Task 1: `vehicles`, Task 2: `tickets`, Tasks 3-4: `users`, Task 5: `zones`, Task 6: `assignments`). The "no docker-compose changes" and "no mac capture" constraints are honored by omission — no task touches `docker-compose.yml` or attempts MAC capture.
- **Placeholder scan:** none — every step shows the complete file content or a complete new file, no "TBD"/"similar to Task N" placeholders.
- **Type consistency:** `ip?: string` (TypeScript, optional) / `ip: str | None = None` (Python) / `String ip` (Java, nullable) are used consistently as the final parameter in every modified signature across all 6 tasks, matching `AuditEvent`'s/`publish_audit_event`'s already-existing `ip` field shape from the original rollout (Plan 1 for `ms-audit`'s DTO, which already validates it).
- **`assignments`' local audit trail:** confirmed untouched — Task 6's file list has no entry for `app/db/listeners.py`, `app/entities/assignment_audit.py`, or `app/services/audit_service.py`.
- **Existing tests preserved:** every modified test file keeps its original tests verbatim and only adds new ones, so no coverage regresses.
