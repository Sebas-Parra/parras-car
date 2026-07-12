# Plan 1: ms-audit hardening + vehicles publisher fix + infra Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `ms-audit` the trustworthy, protected sink for centralized audit events, fix `vehicles` (its only current producer) so it actually sends the fields `ms-audit` will soon require, and wire both into the root `docker-compose.yml` so the whole pipeline can run end-to-end.

**Architecture:** `vehicles` publishes `AuditEvent` messages to RabbitMQ (`audit_exchange` / `audit_event`), including the acting user's `usuario`/`rol` pulled from the JWT already validated by `JwtAuthGuard`. `ms-audit` consumes from `audit_queue`, validates the payload with a hardened `CreateAuditEventDto` (mandatory `usuario`/`rol`, allow-listed `servicio`/`entidad`, size-capped `datos`), persists to `event_audit` (now with a `service+entity+timestamp` index and a producer-supplied `eventTimestamp`), and routes anything invalid to a dead-letter queue instead of silently dropping it. `ms-audit`'s HTTP surface (`GET /audit`, `GET /audit/:id`) is now protected by the same `JwtAuthGuard`/`RolesGuard` pattern used in `vehicles`; the public `POST /audit` is removed because ingestion must go through RabbitMQ only.

**Tech Stack:** NestJS 11, TypeORM, class-validator/class-transformer, amqplib, Jest, Docker Compose.

## Global Constraints

- `servicio` values must be exactly one of: `ms-vehiculos`, `ms-tickets`, `ms-users`, `ms-zonas`, `ms-assignments` (matches the string `vehicles.service.ts` already emits: `'ms-vehiculos'`).
- `usuario` and `rol` are mandatory on every audit event from this point forward — no producer may omit them.
- `ms-audit`'s query endpoints require a valid JWT and `admin` or `root` role, exactly like `vehicles`'s pattern (`JwtAuthGuard` + `RolesGuard` + `@Roles(...)`).
- `POST /audit` is removed; RabbitMQ is the only ingestion path.
- Do not touch `assignments`' local `assignment_audits` table/listeners — out of scope for this plan.
- Every new/changed file follows the existing NestJS project conventions already present in `vehicles` and `ms-audit` (same guard names, same DTO decorator style).

---

### Task 1: Fix `vehicles` to publish real `usuario`/`rol` on the one event it already emits

**Files:**
- Modify: `vehicles/src/vehicles/vehicles.controller.ts`
- Modify: `vehicles/src/vehicles/vehicles.service.ts`
- Test: `vehicles/src/vehicles/vehicles.service.spec.ts`

**Interfaces:**
- Produces: `ActingUser` interface (`{ username: string; roles: string[] }`) exported from `vehicles.service.ts`, and `VehiclesService.create(createVehicleDto: CreateVehicleDto, actingUser: ActingUser): Promise<Vehicle>`.

Only `VehiclesService.create` currently calls `emitEvent` (verified by reading the file — `update`, `remove`, `activate` don't publish anything today). This task only fixes that one existing call site; it does not add new emit calls to the other methods, since that would be new functionality beyond "stop breaking the one producer that already works."

- [ ] **Step 1: Write the failing test**

Replace the placeholder test in `vehicles/src/vehicles/vehicles.service.spec.ts` with:

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
      tipo: 'auto',
      datos: { plate: 'ABC-123' },
    } as unknown as CreateVehicleDto;

    await service.create(dto, { username: 'jdoe', roles: ['admin'] });

    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ usuario: 'jdoe', rol: 'admin' }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd vehicles && npx jest vehicles.service.spec.ts`
Expected: FAIL — `Expected 2 arguments, but got 1` (TS compile error) or `publisher.publish` called without `usuario`/`rol` in the payload, since `create` doesn't accept `actingUser` yet.

- [ ] **Step 3: Update `vehicles.service.ts`**

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
    };
    await this.eventPublisher.publish(event);
  }

  async create(createVehicleDto: CreateVehicleDto, actingUser: ActingUser): Promise<Vehicle> {
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
    await this.emitEvent('CREATE', saved, actingUser);
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

(Only `create` and `emitEvent` change; `update`/`remove`/`activate` are left exactly as they are today — they don't call `emitEvent` currently, and adding that is out of scope here.)

- [ ] **Step 4: Update `vehicles.controller.ts` to pass the JWT user through**

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
    return this.vehiclesService.create(createVehicleDto, req.user);
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

- [ ] **Step 5: Run test to verify it passes**

Run: `cd vehicles && npx jest vehicles.service.spec.ts`
Expected: PASS

- [ ] **Step 6: Run the full vehicles test suite to check for regressions**

Run: `cd vehicles && npx jest`
Expected: PASS (update `vehicles.controller.spec.ts` only if it now fails to compile because of the new constructor dependency — it shouldn't, since it only instantiates `VehiclesController`/`VehiclesService` without calling methods).

- [ ] **Step 7: Commit**

```bash
git add vehicles/src/vehicles/vehicles.controller.ts vehicles/src/vehicles/vehicles.service.ts vehicles/src/vehicles/vehicles.service.spec.ts
git commit -m "fix(vehicles): publish real usuario/rol from JWT on vehicle creation"
```

---

### Task 2: Add JWT auth scaffolding to `ms-audit`

**Files:**
- Create: `ms-audit/src/auth/jwt.strategy.ts`
- Create: `ms-audit/src/auth/jwt-auth.guard.ts`
- Create: `ms-audit/src/auth/roles.decorator.ts`
- Create: `ms-audit/src/auth/roles.guard.ts`
- Create: `ms-audit/src/auth/auth.module.ts`
- Modify: `ms-audit/package.json`
- Modify: `ms-audit/src/app.module.ts`
- Test: `ms-audit/src/auth/roles.guard.spec.ts`

**Interfaces:**
- Produces: `JwtAuthGuard`, `RolesGuard`, `Roles(...roles: string[])`, `AuthModule` (exports `JwtAuthGuard`, `RolesGuard`) — same names/shape as in `vehicles/src/auth`, so Task 3 can import them identically.

- [ ] **Step 1: Add the missing dependencies to `ms-audit/package.json`**

In the `dependencies` block, add (matching the exact versions already pinned in `vehicles/package.json`):

```json
    "@nestjs/passport": "^11.0.0",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
```

In `devDependencies`, add:

```json
    "@types/passport-jwt": "^4.0.1",
```

- [ ] **Step 2: Install dependencies**

Run: `cd ms-audit && pnpm install`
Expected: lockfile updates, no errors.

- [ ] **Step 3: Write the failing test for `RolesGuard`**

Create `ms-audit/src/auth/roles.guard.spec.ts`:

```typescript
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from './roles.decorator';

function buildContext(user: { roles: string[] } | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows access when no roles are required', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(buildContext({ roles: ['cliente'] }))).toBe(true);
  });

  it('allows access when the user has one of the required roles', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['admin', 'root']) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(buildContext({ roles: ['admin'] }))).toBe(true);
  });

  it('denies access when the user has none of the required roles', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['admin', 'root']) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(buildContext({ roles: ['cliente'] }))).toBe(false);
  });
});
```

Note: `ROLES_KEY` is imported only to keep the test file honest about what it depends on; it isn't called directly.

- [ ] **Step 4: Run test to verify it fails**

Run: `cd ms-audit && npx jest roles.guard.spec.ts`
Expected: FAIL — `Cannot find module './roles.guard'`

- [ ] **Step 5: Create the auth files**

`ms-audit/src/auth/roles.decorator.ts`:

```typescript
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

`ms-audit/src/auth/roles.guard.ts`:

```typescript
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const { user } = context.switchToHttp().getRequest();
    return required.some((role) => (user?.roles as string[])?.includes(role));
  }
}
```

`ms-audit/src/auth/jwt.strategy.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

interface JwtPayload {
  sub: string;
  username: string;
  roles: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  validate(payload: JwtPayload) {
    return { userId: payload.sub, username: payload.username, roles: payload.roles };
  }
}
```

`ms-audit/src/auth/jwt-auth.guard.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

`ms-audit/src/auth/auth.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [PassportModule],
  providers: [JwtStrategy, JwtAuthGuard, RolesGuard],
  exports: [JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd ms-audit && npx jest roles.guard.spec.ts`
Expected: PASS

- [ ] **Step 7: Wire `AuthModule` into `app.module.ts`**

In `ms-audit/src/app.module.ts`, add the import and module entry:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuditModule } from './audit/audit.module';
import { EventAudit } from './audit/entities/event-audit.entity';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST'),
        port: +config.get('DB_PORT'),
        username: config.get('DB_USER'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_NAME'),
        entities: [EventAudit],
        synchronize: true,
        logging: false,
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: +config.get('THROTTLE_TTL'),
            limit: +config.get('THROTTLE_LIMIT'),
          },
        ],
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    AuditModule,
  ],
})
export class AppModule { }
```

- [ ] **Step 8: Add `JWT_SECRET` to `ms-audit/.env`**

Append to `ms-audit/.env`:

```
JWT_SECRET=cambia_esto_por_un_secreto_seguro
```

(Use the same value as `vehicles/.env`'s `JWT_SECRET` so tokens issued by `users` validate across services — check `vehicles/.env` and copy its exact value instead of the placeholder above.)

- [ ] **Step 9: Run the full ms-audit test suite**

Run: `cd ms-audit && npx jest`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add ms-audit/src/auth ms-audit/src/app.module.ts ms-audit/package.json ms-audit/pnpm-lock.yaml ms-audit/.env
git commit -m "feat(ms-audit): add JWT auth scaffolding mirrored from vehicles"
```

---

### Task 3: Protect `ms-audit`'s HTTP endpoints and remove the public `POST /audit`

**Files:**
- Modify: `ms-audit/src/audit/audit.controller.ts`
- Modify: `ms-audit/src/audit/audit.service.ts`
- Test: `ms-audit/src/audit/audit.controller.spec.ts`

**Interfaces:**
- Consumes: `JwtAuthGuard`, `RolesGuard`, `Roles` from `../auth/jwt-auth.guard`, `../auth/roles.guard`, `../auth/roles.decorator` (Task 2).
- Produces: `AuditController` now only exposes `GET /audit` and `GET /audit/:id`, both requiring `admin` or `root`.

- [ ] **Step 1: Write the failing test**

Create `ms-audit/src/audit/audit.controller.spec.ts`:

```typescript
import { Reflector } from '@nestjs/core';
import { AuditController } from './audit.controller';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';

describe('AuditController', () => {
  it('applies JwtAuthGuard and RolesGuard at the controller level', () => {
    const guards = Reflect.getMetadata('__guards__', AuditController);
    expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
  });

  it('requires admin or root for findAll', () => {
    const roles = new Reflector().get(ROLES_KEY, AuditController.prototype.findAll);
    expect(roles).toEqual(['admin', 'root']);
  });

  it('requires admin or root for findOne', () => {
    const roles = new Reflector().get(ROLES_KEY, AuditController.prototype.findOne);
    expect(roles).toEqual(['admin', 'root']);
  });

  it('no longer exposes a create/POST handler', () => {
    expect((AuditController.prototype as any).create).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ms-audit && npx jest audit.controller.spec.ts`
Expected: FAIL — guards metadata is `undefined`, `create` still exists.

- [ ] **Step 3: Update `audit.controller.ts`**

```typescript
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) { }

  @Get()
  @Roles('admin', 'root')
  findAll() {
    return this.auditService.findAll();
  }

  @Get(':id')
  @Roles('admin', 'root')
  findOne(@Param('id') id: string) {
    return this.auditService.findOne(id);
  }
}
```

- [ ] **Step 4: Remove the now-unused `create` from `AuditService`'s public surface — keep it, but only the consumer calls it**

No change needed to `audit.service.ts` in this task: `AuditService.create` stays, since `AuditConsumer` (Task 6) still calls it after consuming from RabbitMQ. Only the HTTP route is removed.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd ms-audit && npx jest audit.controller.spec.ts`
Expected: PASS

- [ ] **Step 6: Run the full ms-audit test suite**

Run: `cd ms-audit && npx jest`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add ms-audit/src/audit/audit.controller.ts ms-audit/src/audit/audit.controller.spec.ts
git commit -m "feat(ms-audit): protect audit query endpoints with JWT+roles, drop public POST"
```

---

### Task 4: Harden `CreateAuditEventDto` — mandatory usuario/rol, allow-listed servicio/entidad, size-capped datos

**Files:**
- Create: `ms-audit/src/audit/validators/max-json-size.validator.ts`
- Modify: `ms-audit/src/audit/dto/create-audit-event.dto.ts`
- Test: `ms-audit/src/audit/dto/create-audit-event.dto.spec.ts`

**Interfaces:**
- Produces: `MaxJsonSize(maxBytes: number)` decorator, exported from `max-json-size.validator.ts`.
- Produces: `CreateAuditEventDto` with `usuario!: string` and `rol!: string` (no longer optional) — Task 5 and the consumer rely on these always being present.

- [ ] **Step 1: Write the failing test**

Create `ms-audit/src/audit/dto/create-audit-event.dto.spec.ts`:

```typescript
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAuditEventDto } from './create-audit-event.dto';

async function validateDto(raw: Record<string, unknown>) {
  const dto = plainToInstance(CreateAuditEventDto, raw);
  return validate(dto);
}

const validPayload = {
  servicio: 'ms-vehiculos',
  accion: 'CREATE',
  entidad: 'VEHICULO',
  usuario: 'jdoe',
  rol: 'admin',
};

describe('CreateAuditEventDto', () => {
  it('accepts a fully valid payload', async () => {
    const errors = await validateDto(validPayload);
    expect(errors).toHaveLength(0);
  });

  it('rejects a servicio outside the known allowlist', async () => {
    const errors = await validateDto({ ...validPayload, servicio: 'ms-hackerman' });
    expect(errors.some((e) => e.property === 'servicio')).toBe(true);
  });

  it('rejects an entidad outside the known allowlist', async () => {
    const errors = await validateDto({ ...validPayload, entidad: 'COSA-RARA' });
    expect(errors.some((e) => e.property === 'entidad')).toBe(true);
  });

  it('rejects a payload missing usuario', async () => {
    const { usuario, ...rest } = validPayload;
    const errors = await validateDto(rest);
    expect(errors.some((e) => e.property === 'usuario')).toBe(true);
  });

  it('rejects a payload missing rol', async () => {
    const { rol, ...rest } = validPayload;
    const errors = await validateDto(rest);
    expect(errors.some((e) => e.property === 'rol')).toBe(true);
  });

  it('rejects datos larger than 10KB serialized', async () => {
    const errors = await validateDto({
      ...validPayload,
      datos: { blob: 'x'.repeat(11 * 1024) },
    });
    expect(errors.some((e) => e.property === 'datos')).toBe(true);
  });

  it('accepts datos within the 10KB limit', async () => {
    const errors = await validateDto({
      ...validPayload,
      datos: { plate: 'ABC-123' },
    });
    expect(errors).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ms-audit && npx jest create-audit-event.dto.spec.ts`
Expected: FAIL — missing-usuario/rol cases pass validation today (they're optional), and the allowlist/size cases have no such constraint yet.

- [ ] **Step 3: Create the size validator**

`ms-audit/src/audit/validators/max-json-size.validator.ts`:

```typescript
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function MaxJsonSize(maxBytes: number, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'maxJsonSize',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [maxBytes],
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (value === undefined || value === null) return true;
          const [max] = args.constraints as [number];
          return Buffer.byteLength(JSON.stringify(value), 'utf8') <= max;
        },
        defaultMessage(args: ValidationArguments) {
          const [max] = args.constraints as [number];
          return `El campo ${args.property} no puede superar ${max} bytes serializado.`;
        },
      },
    });
  };
}
```

- [ ] **Step 4: Update `create-audit-event.dto.ts`**

```typescript
import {
    IsIn,
    IsIP,
    IsISO8601,
    IsMACAddress,
    IsNotEmpty,
    IsObject,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
    MinLength,
} from 'class-validator';
import { MaxJsonSize } from '../validators/max-json-size.validator';

const SERVICIOS_VALIDOS = [
    'ms-vehiculos',
    'ms-tickets',
    'ms-users',
    'ms-zonas',
    'ms-assignments',
] as const;

const ENTIDADES_VALIDAS = [
    'VEHICULO',
    'TICKET',
    'USUARIO',
    'ZONA',
    'PLACE',
    'ASSIGNMENT',
] as const;

export class CreateAuditEventDto {
    @IsString()
    @IsNotEmpty()
    @IsIn(SERVICIOS_VALIDOS, {
        message: `El servicio debe ser uno de: ${SERVICIOS_VALIDOS.join(', ')}.`,
    })
    servicio!: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(5)
    @MaxLength(10)
    @Matches(/^(CREATE|UPDATE|DELETE|LOGIN|LOGOUT|SELECT)$/, {
        message:
            'La acción debe ser una de las siguientes: CREATE, UPDATE, DELETE, LOGIN, LOGOUT, SELECT.',
    })
    accion!: string; //CREATE - UPDATE - DELETE - LOGIN - LOGOUT - SELECT

    @IsString()
    @IsNotEmpty()
    @IsIn(ENTIDADES_VALIDAS, {
        message: `La entidad debe ser una de: ${ENTIDADES_VALIDAS.join(', ')}.`,
    })
    entidad!: string;

    @IsObject()
    @IsOptional()
    @MaxJsonSize(10 * 1024, {
        message: 'El campo datos no puede superar 10KB una vez serializado.',
    })
    datos?: Record<string, any>;

    @IsString()
    @IsNotEmpty()
    @MinLength(5)
    @MaxLength(25)
    @Matches(/^[a-zA-Z0-9._-]+$/, {
        message:
            'El nombre de usuario solo puede contener letras, números, puntos, guiones bajos y guiones medios.',
    })
    usuario!: string;

    @IsString()
    @IsNotEmpty()
    rol!: string;

    @IsOptional()
    @IsIP('4', { message: 'La dirección IP debe ser una dirección IPv4 válida.' })
    ip?: string;

    @IsOptional()
    @IsMACAddress({
        message: 'La dirección MAC debe ser una dirección MAC válida.',
    })
    mac?: string;

    @IsOptional()
    @IsISO8601({}, { message: 'eventTimestamp debe ser una fecha ISO8601 válida.' })
    eventTimestamp?: string;
}
```

(`eventTimestamp` is added here as an optional field, per the spec's "add `event_timestamp`" requirement; Task 5 consumes it.)

- [ ] **Step 5: Run test to verify it passes**

Run: `cd ms-audit && npx jest create-audit-event.dto.spec.ts`
Expected: PASS

- [ ] **Step 6: Run the full ms-audit test suite**

Run: `cd ms-audit && npx jest`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add ms-audit/src/audit/dto/create-audit-event.dto.ts ms-audit/src/audit/dto/create-audit-event.dto.spec.ts ms-audit/src/audit/validators
git commit -m "feat(ms-audit): make usuario/rol mandatory, allow-list servicio/entidad, cap datos size"
```

---

### Task 5: Persist `eventTimestamp`, enforce `NOT NULL` on username/rol, add query index

**Files:**
- Modify: `ms-audit/src/audit/entities/event-audit.entity.ts`
- Modify: `ms-audit/src/audit/audit.service.ts`
- Test: `ms-audit/src/audit/audit.service.spec.ts`

**Interfaces:**
- Consumes: `CreateAuditEventDto.eventTimestamp?: string` (Task 4).
- Produces: `AuditService.create(dto: CreateAuditEventDto): Promise<EventAudit>` now always sets `EventAudit.eventTimestamp`.

- [ ] **Step 1: Write the failing test**

Create `ms-audit/src/audit/audit.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from './audit.service';
import { EventAudit } from './entities/event-audit.entity';
import { CreateAuditEventDto } from './dto/create-audit-event.dto';

describe('AuditService', () => {
  let service: AuditService;
  let repo: { create: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    repo = {
      create: jest.fn((x) => x),
      save: jest.fn((x) => Promise.resolve({ id: 'evt-1', ...x })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: getRepositoryToken(EventAudit), useValue: repo },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  it('uses the producer-supplied eventTimestamp when present', async () => {
    const dto: CreateAuditEventDto = {
      servicio: 'ms-vehiculos',
      accion: 'CREATE',
      entidad: 'VEHICULO',
      usuario: 'jdoe',
      rol: 'admin',
      eventTimestamp: '2026-01-01T00:00:00.000Z',
    };

    await service.create(dto);

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ eventTimestamp: new Date('2026-01-01T00:00:00.000Z') }),
    );
  });

  it('defaults eventTimestamp to now when the producer omits it', async () => {
    const dto: CreateAuditEventDto = {
      servicio: 'ms-vehiculos',
      accion: 'CREATE',
      entidad: 'VEHICULO',
      usuario: 'jdoe',
      rol: 'admin',
    };
    const before = Date.now();

    await service.create(dto);

    const arg = repo.create.mock.calls[0][0];
    expect(arg.eventTimestamp.getTime()).toBeGreaterThanOrEqual(before);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ms-audit && npx jest audit.service.spec.ts`
Expected: FAIL — `repo.create` isn't called with an `eventTimestamp` key at all yet.

- [ ] **Step 3: Update `event-audit.entity.ts`**

```typescript
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'event_audit' })
@Index(['service', 'entity', 'timestamp'])
export class EventAudit {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ type: 'varchar', length: 20 })
    service!: string

    @Column({ type: 'varchar', length: 15 }) //CRUD
    action!: string

    @Column({ type: 'varchar', length: 30 })
    entity!: string

    @Column({ type: 'jsonb', nullable: true })
    datos?: any

    @Column({ type: 'varchar', length: 25, nullable: false })
    username!: string

    @Column({ type: 'varchar', length: 15, nullable: false })
    rol!: string

    @Column({ type: 'varchar', length: 15, nullable: true })
    ip?: string

    @Column({ type: 'varchar', length: 17, nullable: true })
    mac?: string

    @Column()
    timestamp!: Date

    @Column({ type: 'timestamptz', nullable: true })
    eventTimestamp?: Date
}
```

- [ ] **Step 4: Update `audit.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateAuditEventDto } from './dto/create-audit-event.dto';
import { Repository } from 'typeorm';
import { EventAudit } from './entities/event-audit.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(EventAudit)
    private auditRepo: Repository<EventAudit>,
  ) { }

  async create(dto: CreateAuditEventDto): Promise<EventAudit> {
    const newEvent = this.auditRepo.create({
      service: dto.servicio,
      action: dto.accion,
      entity: dto.entidad,
      datos: dto.datos,
      username: dto.usuario,
      rol: dto.rol,
      ip: dto.ip,
      mac: dto.mac,
      timestamp: new Date(),
      eventTimestamp: dto.eventTimestamp ? new Date(dto.eventTimestamp) : new Date(),
    });

    return this.auditRepo.save(newEvent);
  }

  async findAll(): Promise<EventAudit[]> {
    return this.auditRepo.find({ order: { timestamp: 'DESC' } });
  }

  async findOne(id: string): Promise<EventAudit | null> {
    return this.auditRepo.findOne({ where: { id } });
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd ms-audit && npx jest audit.service.spec.ts`
Expected: PASS

- [ ] **Step 6: Run the full ms-audit test suite**

Run: `cd ms-audit && npx jest`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add ms-audit/src/audit/entities/event-audit.entity.ts ms-audit/src/audit/audit.service.ts ms-audit/src/audit/audit.service.spec.ts
git commit -m "feat(ms-audit): persist producer eventTimestamp, enforce NOT NULL on username/rol, add query index"
```

---

### Task 6: Route invalid/rejected messages to a dead-letter queue

**Files:**
- Modify: `ms-audit/src/audit/audit.consumer.ts`
- Test: `ms-audit/src/audit/audit.consumer.spec.ts`

**Interfaces:**
- No new exports; behavior-only change to `AuditConsumer`'s RabbitMQ topology setup.

- [ ] **Step 1: Write the failing test**

Create `ms-audit/src/audit/audit.consumer.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { AuditConsumer } from './audit.consumer';
import { AuditService } from './audit.service';

jest.mock('amqplib');

describe('AuditConsumer', () => {
  let consumer: AuditConsumer;
  let channel: {
    assertExchange: jest.Mock;
    assertQueue: jest.Mock;
    bindQueue: jest.Mock;
    consume: jest.Mock;
    ack: jest.Mock;
    nack: jest.Mock;
  };

  const configValues: Record<string, string> = {
    RABBITMQ_HOST: 'localhost',
    RABBITMQ_PORT: '5672',
    RABBITMQ_USER: 'guest',
    RABBITMQ_PASSWORD: 'guest',
    RABBITMQ_QUEUE: 'audit_queue',
    RABBITMQ_EXCHANGE: 'audit_exchange',
    RABBITMQ_ROUTING_KEY: 'audit_event',
  };

  beforeEach(async () => {
    channel = {
      assertExchange: jest.fn(),
      assertQueue: jest.fn(),
      bindQueue: jest.fn(),
      consume: jest.fn(),
      ack: jest.fn(),
      nack: jest.fn(),
    };
    const connection = {
      createChannel: jest.fn().mockResolvedValue(channel),
      on: jest.fn(),
    };
    (amqp.connect as jest.Mock).mockResolvedValue(connection);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditConsumer,
        { provide: ConfigService, useValue: { get: (key: string) => configValues[key] } },
        { provide: AuditService, useValue: { create: jest.fn() } },
      ],
    }).compile();

    consumer = module.get<AuditConsumer>(AuditConsumer);
  });

  it('declares a dead-letter exchange and binds a DLQ to it', async () => {
    await consumer.onModuleInit();

    expect(channel.assertExchange).toHaveBeenCalledWith('audit_exchange.dlx', 'fanout', { durable: true });
    expect(channel.assertQueue).toHaveBeenCalledWith('audit_queue.dlq', { durable: true });
    expect(channel.bindQueue).toHaveBeenCalledWith('audit_queue.dlq', 'audit_exchange.dlx', '');
  });

  it('configures the main queue to dead-letter into the DLX', async () => {
    await consumer.onModuleInit();

    expect(channel.assertQueue).toHaveBeenCalledWith('audit_queue', {
      durable: true,
      arguments: { 'x-dead-letter-exchange': 'audit_exchange.dlx' },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ms-audit && npx jest audit.consumer.spec.ts`
Expected: FAIL — today `assertQueue` is called with `{ durable: true }` only, no DLX exchange/queue is declared at all.

- [ ] **Step 3: Update `audit.consumer.ts`**

```typescript
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from './audit.service';
import * as amqp from 'amqplib';
import { plainToClass } from 'class-transformer';
import { CreateAuditEventDto } from './dto/create-audit-event.dto';
import { validate, ValidationError } from 'class-validator';

@Injectable()
export class AuditConsumer implements OnModuleInit {
    private readonly logger = new Logger(AuditConsumer.name);
    private connection: any;
    private channel: any;

    constructor(
        private configService: ConfigService,
        private auditService: AuditService,
    ) { }

    async onModuleInit() {
        await this.connect();
        await this.consume();
    }

    private async connect() {
        const host = this.configService.get('RABBITMQ_HOST');
        const port = this.configService.get('RABBITMQ_PORT');
        const user = this.configService.get('RABBITMQ_USER');
        const pass = this.configService.get('RABBITMQ_PASSWORD');
        const url = `amqp://${user}:${pass}@${host}:${port}`;

        try {
            this.connection = await amqp.connect(url);
            this.channel = await this.connection.createChannel();
            this.logger.log(`Connected to RabbitMQ at ${url}`);
        } catch (error) {
            this.logger.error(`Failed to connect to RabbitMQ at ${error}`);
            setTimeout(() => this.connect(), 5000); // Retry after 5 seconds
        }
    }

    private async consume() {
        const queue = this.configService.get('RABBITMQ_QUEUE');
        const exchange = this.configService.get('RABBITMQ_EXCHANGE');
        const routingKey = this.configService.get('RABBITMQ_ROUTING_KEY');
        const dlxExchange = `${exchange}.dlx`;
        const dlq = `${queue}.dlq`;

        try {
            await this.channel.assertExchange(dlxExchange, 'fanout', { durable: true });
            await this.channel.assertQueue(dlq, { durable: true });
            await this.channel.bindQueue(dlq, dlxExchange, '');

            await this.channel.assertExchange(exchange, 'topic', { durable: true });
            await this.channel.assertQueue(queue, {
                durable: true,
                arguments: { 'x-dead-letter-exchange': dlxExchange },
            });
            await this.channel.bindQueue(queue, exchange, routingKey);

            this.channel.consume(
                queue,
                async (msg) => {
                    if (msg) {
                        const content = msg.content.toString();
                        this.logger.debug(`Mensaje recibido: ${content}`);
                        try {
                            const raw = JSON.parse(content);
                            const dto = plainToClass(CreateAuditEventDto, raw);
                            const errors = await validate(dto);

                            // Verificar que errors sea un arreglo y tenga elementos
                            if (Array.isArray(errors) && errors.length > 0) {
                                const errorMessages = errors.map((e: ValidationError) =>
                                    Object.values(e.constraints || {}).join(', '),
                                );
                                this.logger.warn(`DTO inválido: ${errorMessages.join('; ')}`);
                                // Rechazar el mensaje; con la DLX configurada, RabbitMQ lo enruta al DLQ en vez de perderlo
                                this.channel.nack(msg, false, false);
                                return;
                            }

                            // Guardar el evento de auditoría
                            await this.auditService.create(dto);
                            this.logger.debug('Evento de auditoría guardado exitosamente');
                            this.channel.ack(msg);
                        } catch (err) {
                            const errorMessage =
                                err instanceof Error ? err.message : 'Error desconocido';
                            this.logger.error(`Error procesando mensaje: ${errorMessage}`);
                            // Rechazar el mensaje; con la DLX configurada, RabbitMQ lo enruta al DLQ en vez de perderlo
                            this.channel.nack(msg, false, false);
                        }
                    }
                },
                { noAck: false },
            );
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : 'Error desconocido';
            this.logger.error(`Error configurando consumidor: ${errorMessage}`);
        }
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ms-audit && npx jest audit.consumer.spec.ts`
Expected: PASS

- [ ] **Step 5: Run the full ms-audit test suite**

Run: `cd ms-audit && npx jest`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add ms-audit/src/audit/audit.consumer.ts ms-audit/src/audit/audit.consumer.spec.ts
git commit -m "feat(ms-audit): route rejected messages to a dead-letter queue instead of dropping them"
```

---

### Task 7: Add a Dockerfile for `ms-audit`

**Files:**
- Create: `ms-audit/Dockerfile`

**Interfaces:**
- Produces: a buildable image exposing port `3002`, consumed by Task 8's `docker-compose.yml` entry.

- [ ] **Step 1: Create `ms-audit/Dockerfile`**

```dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

ENV CI=true

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --ignore-scripts

COPY . .
RUN node_modules/.bin/nest build

FROM node:22-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3002

CMD ["node", "dist/main"]
```

- [ ] **Step 2: Build the image standalone to verify it compiles**

Run: `cd ms-audit && docker build -t ms-audit-test .`
Expected: image builds successfully (exit code 0).

- [ ] **Step 3: Commit**

```bash
git add ms-audit/Dockerfile
git commit -m "chore(ms-audit): add Dockerfile"
```

---

### Task 8: Wire `rabbitmq` and `ms-audit` into the root `docker-compose.yml`

**Files:**
- Modify: `docker-compose.yml` (repo root)
- Modify: `.env` (repo root)
- Modify: `.env.example` (repo root)

**Interfaces:**
- Produces: a `rabbitmq` service reachable at hostname `rabbitmq:5672` from every other service on `parras_network`, and an `ms-audit` service reachable at `ms-audit:3002`.

- [ ] **Step 1: Update `RABBITMQ_HOST` and add `RABBITMQ_QUEUE` in `.env` and `.env.example`**

In both `.env` and `.env.example`, change:

```
RABBITMQ_HOST=host.docker.internal
```

to:

```
RABBITMQ_HOST=rabbitmq
```

and add, right after `RABBITMQ_ROUTING_KEY=audit_event`:

```
RABBITMQ_QUEUE=audit_queue
```

- [ ] **Step 2: Add the `rabbitmq` service to `docker-compose.yml`**

Insert this block right after the `audit-db` service definition (before the `# ─── Microservices ──` comment):

```yaml
  rabbitmq:
    image: rabbitmq:3-management
    container_name: parras-rabbitmq
    restart: unless-stopped
    environment:
      RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER}
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD}
    ports:
      - '5672:5672'
      - '15672:15672'
    healthcheck:
      test: ['CMD', 'rabbitmq-diagnostics', 'check_port_connectivity']
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - parras_network
```

- [ ] **Step 3: Make `vehicles` depend on `rabbitmq` being healthy**

In the `vehicles` service block, change:

```yaml
    depends_on:
      vehicles-db:
        condition: service_healthy
```

to:

```yaml
    depends_on:
      vehicles-db:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
```

- [ ] **Step 4: Add the `ms-audit` service to `docker-compose.yml`**

Insert this block right after the `tickets` service definition (before the `# ─── API Gateway ──` comment):

```yaml
  ms-audit:
    build:
      context: ./ms-audit
      dockerfile: Dockerfile
    container_name: parras-ms-audit
    restart: unless-stopped
    environment:
      DB_HOST: audit-db
      DB_PORT: 5432
      DB_USER: ${DB_USER}
      DB_PASSWORD: ${DB_PASSWORD}
      DB_NAME: ${DB_NAME_AUDIT}
      PORT: 3002
      JWT_SECRET: ${JWT_SECRET}
      RABBITMQ_HOST: ${RABBITMQ_HOST}
      RABBITMQ_PORT: ${RABBITMQ_PORT}
      RABBITMQ_USER: ${RABBITMQ_USER}
      RABBITMQ_PASSWORD: ${RABBITMQ_PASSWORD}
      RABBITMQ_QUEUE: ${RABBITMQ_QUEUE}
      RABBITMQ_EXCHANGE: ${RABBITMQ_EXCHANGE}
      RABBITMQ_ROUTING_KEY: ${RABBITMQ_ROUTING_KEY}
      THROTTLE_TTL: 60
      THROTTLE_LIMIT: 10
    ports:
      - '3002:3002'
    depends_on:
      audit-db:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
    networks:
      - parras_network
```

- [ ] **Step 5: Start the stack and verify the pipeline end-to-end**

Run: `docker compose up -d --build rabbitmq audit-db ms-audit vehicles-db vehicles`
Expected: all five containers report `Up` (`docker compose ps`).

- [ ] **Step 6: Verify RabbitMQ topology was declared**

Run: `docker compose logs ms-audit --tail 50`
Expected: log line `Connected to RabbitMQ at amqp://guest:guest@rabbitmq:5672`, no connection errors.

- [ ] **Step 7: Verify the DTO/guard changes work against a real running instance**

Run: `curl -i http://localhost:3002/api/v1/audit`
Expected: `401 Unauthorized` (no JWT sent) — confirms `JwtAuthGuard` is active.

Run: `curl -i -X POST http://localhost:3002/api/v1/audit -H 'Content-Type: application/json' -d '{}'`
Expected: `404 Not Found` — confirms the public `POST /audit` route no longer exists.

- [ ] **Step 8: Tear down**

Run: `docker compose down`

- [ ] **Step 9: Commit**

```bash
git add docker-compose.yml .env .env.example
git commit -m "chore: wire rabbitmq and ms-audit into the root docker-compose stack"
```

---

## Self-Review Notes

- **Spec coverage:** all 9 rows of the "Endurecimiento de ms-audit" table in the design spec map to Task 2–6; the "Fix previo en vehicles" section maps to Task 1; "Infraestructura" maps to Tasks 7–8. Retention/partitioning and real rate limiting are explicitly out of scope per the spec and are not tasked here.
- **Deviation from the spec worth flagging:** the spec assumed `vehicles.service.ts`'s `update`/`remove`/`activate` already emit audit events and just need `usuario`/`rol` added. Re-reading the actual code during planning showed only `create` emits anything today. Task 1 fixes only the existing call site — extending audit coverage to `update`/`remove`/`activate` is new functionality, not a fix, and is left for a future task if wanted.
- **Type consistency:** `ActingUser` (Task 1) matches the shape `JwtStrategy.validate` already returns (`{ userId, username, roles }`) minus `userId`, which isn't needed for the audit event. `CreateAuditEventDto.eventTimestamp` (Task 4) is consumed by `AuditService.create` (Task 5) with matching optionality.
