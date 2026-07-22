# Plan 2: tickets audit publisher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `tickets` publish audit events to the centralized `ms-audit` service for ticket creation, payment, and cancellation, using the same RabbitMQ publisher pattern already proven in `vehicles`.

**Architecture:** `tickets` gets its own `EventPublisher` (a verbatim copy of `vehicles`'s, connecting to the same `audit_exchange`/`audit_event` topic already declared by `ms-audit`). `TicketsService` calls it after each successful state change (`create` → `CREATE`, `pay` → `UPDATE`, `cancel` → `DELETE`), carrying `usuario`/`rol` pulled from the JWT the controller already validates. The root `docker-compose.yml`'s `tickets` service gains the `RABBITMQ_*` envs and a dependency on `rabbitmq` being healthy, mirroring `vehicles`'s and `ms-audit`'s entries from Plan 1.

**Tech Stack:** NestJS 11, TypeORM, class-validator, amqplib, Jest, Docker Compose.

## Global Constraints

- `servicio` for every event from `tickets` must be exactly `'ms-tickets'` — the only value in `ms-audit`'s allow-list for this service (`ms-audit/src/audit/dto/create-audit-event.dto.ts`'s `SERVICIOS_VALIDOS`).
- `entidad` must be exactly `'TICKET'` — already present in `ms-audit`'s `ENTIDADES_VALIDAS` allow-list.
- `usuario` and `rol` are mandatory on every event `ms-audit` will accept (Plan 1 already made them required) — never omit them, and always source them from `req.user` (the authenticated JWT payload), never from request body input.
- `accion` must be one of `CREATE|UPDATE|DELETE|LOGIN|LOGOUT|SELECT` (`ms-audit`'s existing regex) — this plan uses `CREATE` (ticket issued), `UPDATE` (ticket paid), `DELETE` (ticket cancelled).
- Follow the exact `AuditEvent`/`EventPublisher` shape and RabbitMQ reconnect behavior already implemented in `vehicles/src/vehicles/event-published.service.ts` — do not redesign it.

---

### Task 1: Add the RabbitMQ event publisher to `tickets`

**Files:**
- Create: `tickets/src/tickets/event-published.service.ts`
- Modify: `tickets/package.json`
- Modify: `tickets/src/tickets/tickets.module.ts`
- Modify: `tickets/.env.example`

**Interfaces:**
- Produces: `AuditEvent` interface (`{ servicio, accion, entidad, entidadId?, datos?, usuario?, rol?, ip? }`) and `EventPublisher` class with `publish(event: AuditEvent): Promise<void>`, exported from `event-published.service.ts` — Task 2 imports both.

- [ ] **Step 1: Add the `amqplib` dependency to `tickets/package.json`**

In the `dependencies` block, add (matching the exact versions already pinned in `vehicles/package.json`):

```json
    "@types/amqplib": "^0.10.8",
    "amqplib": "^2.0.1",
```

- [ ] **Step 2: Install the dependency**

Run: `cd tickets && pnpm install`
Expected: lockfile updates, no errors.

- [ ] **Step 3: Create `event-published.service.ts`**

`tickets/src/tickets/event-published.service.ts`:

```typescript
import {
    Injectable,
    Logger,
    OnModuleInit,
    OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

export interface AuditEvent {
    servicio: string;
    accion: string;
    entidad: string;
    entidadId?: string;
    datos?: any;
    usuario?: string;
    rol?: string;
    ip?: string;
}

@Injectable()
export class EventPublisher implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(EventPublisher.name);
    private connection: any = null; // any para evitar conflictos de tipos
    private channel: any = null;
    private exchange: string;
    private routingKey: string;
    private isConnected = false;
    private connectionPromise: Promise<void> | null = null;
    private reconnectTimeout: NodeJS.Timeout | null = null;

    constructor(private configService: ConfigService) {
        this.exchange =
            this.configService.get('RABBITMQ_EXCHANGE') ?? 'audit_exchange';
        this.routingKey =
            this.configService.get('RABBITMQ_ROUTING_KEY') ?? 'audit.event';
    }

    async onModuleInit() {
        await this.connect();
    }

    private async connect(): Promise<void> {
        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        this.connectionPromise = this.doConnect();
        try {
            await this.connectionPromise;
        } finally {
            this.connectionPromise = null;
        }
    }

    private async doConnect(): Promise<void> {
        const host = this.configService.get('RABBITMQ_HOST');
        const port = this.configService.get('RABBITMQ_PORT');
        const user = this.configService.get('RABBITMQ_USER');
        const pass = this.configService.get('RABBITMQ_PASSWORD');
        const url = `amqp://${user}:${pass}@${host}:${port}`;

        try {
            this.connection = await amqp.connect(url);
            this.channel = await this.connection.createChannel();
            await this.channel.assertExchange(this.exchange, 'topic', {
                durable: true,
            });
            this.isConnected = true;
            this.logger.log('✅ Conectado a RabbitMQ para publicación de eventos');

            // Manejar cierre inesperado
            this.connection.on('close', () => {
                this.logger.warn(
                    '⚠️ Conexión a RabbitMQ cerrada, intentando reconectar...',
                );
                this.isConnected = false;
                this.channel = null;
                this.connection = null;
                this.scheduleReconnect();
            });

            this.connection.on('error', (err: any) => {
                this.logger.error(`❌ Error en conexión RabbitMQ: ${err.message}`);
                this.isConnected = false;
                this.channel = null;
                this.connection = null;
                this.scheduleReconnect();
            });
        } catch (error) {
            this.isConnected = false;
            const errorMessage =
                error instanceof Error ? error.message : 'Error desconocido';
            this.logger.error(`❌ Error conectando a RabbitMQ: ${errorMessage}`);
            this.scheduleReconnect();
        }
    }

    private scheduleReconnect() {
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(() => {
            this.logger.log('Intentando reconectar a RabbitMQ...');
            this.connect();
        }, 5000);
    }

    async publish(event: AuditEvent): Promise<void> {
        // Si no está conectado, intenta conectar (espera hasta 5s)
        if (!this.isConnected || !this.channel) {
            this.logger.warn('⏳ Canal no establecido, intentando conectar...');
            await this.connect();

            if (!this.isConnected || !this.channel) {
                this.logger.error(
                    '❌ No se pudo establecer conexión con RabbitMQ, evento no publicado',
                );
                return;
            }
        }

        try {
            const message = Buffer.from(JSON.stringify(event));
            this.channel.publish(this.exchange, this.routingKey, message, {
                persistent: true,
            });
            this.logger.debug(
                `📤 Evento publicado: ${event.accion} en ${event.servicio}`,
            );
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : 'Error desconocido';
            this.logger.error(`❌ Error publicando evento: ${errorMessage}`);
            this.isConnected = false;
            this.channel = null;
        }
    }

    async onModuleDestroy() {
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        try {
            if (this.channel) await this.channel.close();
            if (this.connection) await this.connection.close();
        } catch (error) {
            // Ignoramos errores al cerrar
        }
        this.logger.log('Conexión a RabbitMQ cerrada');
    }
}
```

(This is byte-for-byte the same class as `vehicles/src/vehicles/event-published.service.ts`, except the `AuditEvent` interface here already includes `rol?: string` from the start — `vehicles`'s copy was missing it and had to be patched after the fact in Plan 1.)

- [ ] **Step 4: Wire `EventPublisher` into `tickets.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AssignmentsClient } from './clients/assignments.client';
import { VehiclesClient } from './clients/vehicles.client';
import { ZonesClient } from './clients/zones.client';
import { EventPublisher } from './event-published.service';
import { Ticket } from './entities/ticket.entity';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket]), AuthModule],
  controllers: [TicketsController],
  providers: [
    TicketsService,
    ZonesClient,
    VehiclesClient,
    AssignmentsClient,
    EventPublisher,
  ],
  exports: [TicketsService],
})
export class TicketsModule {}
```

- [ ] **Step 5: Add RabbitMQ config to `tickets/.env.example`**

Append to `tickets/.env.example`:

```

# ─── RabbitMQ para eventos/auditoria ──────────────────────────
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
RABBITMQ_EXCHANGE=audit_exchange
RABBITMQ_ROUTING_KEY=audit_event
```

- [ ] **Step 6: Run the full tickets test suite to check for regressions**

Run: `cd tickets && npx jest`
Expected: PASS (only `app.controller.spec.ts` exists today; it should be unaffected).

- [ ] **Step 7: Commit**

```bash
git add tickets/package.json tickets/pnpm-lock.yaml tickets/src/tickets/event-published.service.ts tickets/src/tickets/tickets.module.ts tickets/.env.example
git commit -m "feat(tickets): add RabbitMQ audit event publisher"
```

---

### Task 2: Emit audit events on ticket create/pay/cancel

**Files:**
- Modify: `tickets/src/tickets/tickets.controller.ts`
- Modify: `tickets/src/tickets/tickets.service.ts`
- Test: `tickets/src/tickets/tickets.service.spec.ts`

**Interfaces:**
- Consumes: `AuditEvent`, `EventPublisher` from `./event-published.service` (Task 1).
- Produces: `ActingUser` interface (`{ username: string; roles: string[] }`) exported from `tickets.service.ts`; `TicketsService.create(dto, idEmpleado, authHeader, actingUser)`, `.pay(id, idEmpleado, authHeader, actingUser)`, `.cancel(id, idEmpleado, authHeader, actingUser)`.

- [ ] **Step 1: Write the failing test**

Create `tickets/src/tickets/tickets.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TicketsService } from './tickets.service';
import { Ticket } from './entities/ticket.entity';
import { EstadoTicket } from './entities/enum/estado-ticket.enum';
import { EventPublisher } from './event-published.service';
import { ZonesClient } from './clients/zones.client';
import { VehiclesClient } from './clients/vehicles.client';
import { AssignmentsClient } from './clients/assignments.client';
import { CreateTicketDto } from './dto/create-ticket.dto';

describe('TicketsService', () => {
  let service: TicketsService;
  let repo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let publisher: { publish: jest.Mock };
  let zonesClient: {
    findPlaceById: jest.Mock;
    findZoneById: jest.Mock;
    setStatus: jest.Mock;
  };
  let vehiclesClient: { findByPlate: jest.Mock };
  let assignmentsClient: { findActiveByVehicle: jest.Mock };

  const actingUser = { username: 'jdoe', roles: ['recaudador'] };

  const vehicle = { id: 'veh-1', active: true, tipo: 'car' };
  const place = {
    id: 'place-1',
    code: 'A1',
    active: true,
    status: 'AVAILABLE',
    type: 'CAR',
    idZone: 'zone-1',
  };
  const zone = { id: 'zone-1', type: 'REGULAR' };
  const assignment = { user_id: 'user-1', vehicle_id: 'veh-1', active: true };

  beforeEach(async () => {
    repo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((x) => x),
      save: jest.fn((x) => Promise.resolve({ id: 'tick-1', ...x })),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    publisher = { publish: jest.fn().mockResolvedValue(undefined) };
    zonesClient = {
      findPlaceById: jest.fn().mockResolvedValue(place),
      findZoneById: jest.fn().mockResolvedValue(zone),
      setStatus: jest.fn().mockResolvedValue(undefined),
    };
    vehiclesClient = { findByPlate: jest.fn().mockResolvedValue(vehicle) };
    assignmentsClient = {
      findActiveByVehicle: jest.fn().mockResolvedValue(assignment),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: getRepositoryToken(Ticket), useValue: repo },
        { provide: EventPublisher, useValue: publisher },
        { provide: ZonesClient, useValue: zonesClient },
        { provide: VehiclesClient, useValue: vehiclesClient },
        { provide: AssignmentsClient, useValue: assignmentsClient },
      ],
    }).compile();

    service = module.get<TicketsService>(TicketsService);
  });

  it('publishes a CREATE event with the acting user on ticket creation', async () => {
    const dto: CreateTicketDto = { idEspacio: 'place-1', placa: 'ABC-123' };

    await service.create(dto, 'empleado-1', 'Bearer token', actingUser);

    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        servicio: 'ms-tickets',
        accion: 'CREATE',
        entidad: 'TICKET',
        usuario: 'jdoe',
        rol: 'recaudador',
      }),
    );
  });

  it('publishes an UPDATE event with the acting user when a ticket is paid', async () => {
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

    await service.pay('tick-1', 'empleado-1', 'Bearer token', actingUser);

    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        servicio: 'ms-tickets',
        accion: 'UPDATE',
        entidad: 'TICKET',
        usuario: 'jdoe',
        rol: 'recaudador',
      }),
    );
  });

  it('publishes a DELETE event with the acting user when a ticket is cancelled', async () => {
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

    await service.cancel('tick-1', 'empleado-1', 'Bearer token', actingUser);

    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        servicio: 'ms-tickets',
        accion: 'DELETE',
        entidad: 'TICKET',
        usuario: 'jdoe',
        rol: 'recaudador',
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tickets && npx jest tickets.service.spec.ts`
Expected: FAIL — `TicketsService.create`/`.pay`/`.cancel` don't accept a fourth `actingUser` argument yet, and never call `publisher.publish`.

- [ ] **Step 3: Update `tickets.service.ts`**

Add the `ActingUser` interface, the `EventPublisher` import/injection, and an `emitEvent` helper; then call it from `create`, `pay`, and `cancel`. Apply this diff to `tickets/src/tickets/tickets.service.ts`:

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

// (PLACE_BASE_RATES, ZONE_MULTIPLIERS, DEFAULT_RATE, HOUR_MS,
//  PLACE_VEHICLE_COMPAT, computeRate stay exactly as they are today —
//  not reproduced here, do not remove them.)

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
    };
    await this.eventPublisher.publish(event);
  }

  async create(
    dto: CreateTicketDto,
    idEmpleado: string,
    authHeader: string,
    actingUser: ActingUser,
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

    // La tarifa depende solo de zones: tipo de espacio × tipo de zona.
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
      // Compensación: si zones no confirma la ocupación, no dejamos un
      // ticket "activo" sobre un espacio que sigue apareciendo disponible.
      await this.ticketRepository.delete(saved.id);
      throw error;
    }

    await this.emitEvent('CREATE', saved, actingUser);
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
    await this.emitEvent('UPDATE', saved, actingUser);
    return saved;
  }

  async cancel(
    id: string,
    idEmpleado: string,
    authHeader: string,
    actingUser: ActingUser,
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
    await this.emitEvent('DELETE', saved, actingUser);
    return saved;
  }

  // calcularValor and generateUniqueCode stay exactly as they are today —
  // not reproduced here, do not remove them.
}
```

**Important:** the code block above omits the unchanged constants (`PLACE_BASE_RATES`, `ZONE_MULTIPLIERS`, `DEFAULT_RATE`, `HOUR_MS`, `PLACE_VEHICLE_COMPAT`, `computeRate`) and the unchanged private methods (`calcularValor`, `generateUniqueCode`) only to keep this plan readable — when editing the real file, keep every one of those exactly as they exist today (see `tickets/src/tickets/tickets.service.ts`'s current content for their exact text) and only change the constructor, add `emitEvent`, and add the three `actingUser` parameters + `emitEvent` calls shown above.

- [ ] **Step 4: Update `tickets.controller.ts` to build and pass `actingUser`**

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
    );
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd tickets && npx jest tickets.service.spec.ts`
Expected: PASS

- [ ] **Step 6: Run the full tickets test suite**

Run: `cd tickets && npx jest`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add tickets/src/tickets/tickets.service.ts tickets/src/tickets/tickets.controller.ts tickets/src/tickets/tickets.service.spec.ts
git commit -m "feat(tickets): publish CREATE/UPDATE/DELETE audit events on create/pay/cancel"
```

---

### Task 3: Wire `tickets` to `rabbitmq` in the root `docker-compose.yml` and verify end-to-end

**Files:**
- Modify: `docker-compose.yml` (repo root)

**Interfaces:**
- Produces: `tickets` reachable and able to publish to `rabbitmq:5672` in the compose network, alongside `vehicles` and `ms-audit` (already wired in Plan 1).

- [ ] **Step 1: Add RabbitMQ envs and the `rabbitmq` dependency to the `tickets` service block**

In `docker-compose.yml`'s `tickets` service, change:

```yaml
    environment:
      DB_HOST: tickets-db
      DB_PORT: 5432
      DB_USUARIO: ${DB_USER}
      DB_CONTRASENA: ${DB_PASSWORD}
      DB_NOMBRE: ${DB_NAME_TICKETS}
      PORT: 3000
      JWT_SECRET: ${JWT_SECRET}
      ZONES_SERVICE_URL: ${ZONES_SERVICE_URL}
      VEHICLES_SERVICE_URL: ${VEHICLES_SERVICE_URL}
      ASSIGNMENTS_SERVICE_URL: ${ASSIGNMENTS_SERVICE_URL}
```

to:

```yaml
    environment:
      DB_HOST: tickets-db
      DB_PORT: 5432
      DB_USUARIO: ${DB_USER}
      DB_CONTRASENA: ${DB_PASSWORD}
      DB_NOMBRE: ${DB_NAME_TICKETS}
      PORT: 3000
      JWT_SECRET: ${JWT_SECRET}
      RABBITMQ_HOST: ${RABBITMQ_HOST}
      RABBITMQ_PORT: ${RABBITMQ_PORT}
      RABBITMQ_USER: ${RABBITMQ_USER}
      RABBITMQ_PASSWORD: ${RABBITMQ_PASSWORD}
      RABBITMQ_EXCHANGE: ${RABBITMQ_EXCHANGE}
      RABBITMQ_ROUTING_KEY: ${RABBITMQ_ROUTING_KEY}
      ZONES_SERVICE_URL: ${ZONES_SERVICE_URL}
      VEHICLES_SERVICE_URL: ${VEHICLES_SERVICE_URL}
      ASSIGNMENTS_SERVICE_URL: ${ASSIGNMENTS_SERVICE_URL}
```

(leave the `TICKET_PRICE`/`PLACE_RATE_*`/`ZONE_MULT_*` lines below untouched.)

And change `tickets`'s `depends_on` from:

```yaml
    depends_on:
      tickets-db:
        condition: service_healthy
      zones:
        condition: service_started
      vehicles:
        condition: service_started
      assignments:
        condition: service_started
```

to:

```yaml
    depends_on:
      tickets-db:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
      zones:
        condition: service_started
      vehicles:
        condition: service_started
      assignments:
        condition: service_started
```

- [ ] **Step 2: Bring up the stack and verify the publisher connects**

Run: `docker compose up -d --build rabbitmq tickets-db tickets`
Expected: both containers report `Up` (`docker compose ps`).

- [ ] **Step 3: Verify the RabbitMQ connection log line**

Run: `docker compose logs tickets --tail 50`
Expected: log line `✅ Conectado a RabbitMQ para publicación de eventos`, no connection errors.

- [ ] **Step 4: Tear down**

Run: `docker compose down`

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml
git commit -m "chore(tickets): wire RabbitMQ audit publisher into the compose stack"
```

---

## Self-Review Notes

- **Spec coverage:** the design spec's "tickets (NestJS): copiar el patrón de vehicles casi literal... Instrumentar create/update/cancelación" is covered by Tasks 1–2; "agregar envs RABBITMQ_* a los bloques de tickets" is covered by Task 3.
- **Deviation worth flagging:** unlike `vehicles`'s original `AuditEvent` (which was missing `rol` and had to be patched in Plan 1), this plan's Task 1 `AuditEvent` interface already includes `rol?: string` from the start, avoiding a repeat of that gap.
- **Type consistency:** `ActingUser` (Task 2) matches the shape used in Plan 1's `vehicles` fix (`{ username, roles }`); `tickets.controller.ts`'s existing `AuthenticatedRequest.user` shape (`{ userId, username, roles }`) already provides both fields, so no changes to the JWT strategy/guard layer are needed.
- **`cancel` → `DELETE` choice:** cancelling a ticket doesn't delete the row (it's a soft state transition to `ANULADO`), but `DELETE` is the closest fit in `ms-audit`'s fixed `accion` enum (`CREATE|UPDATE|DELETE|LOGIN|LOGOUT|SELECT`) for "this ticket is no longer active/valid" — consistent with `vehicles`'s existing use of soft-delete-as-`DELETE`-semantics (see `remove()` in `vehicles.service.ts`, which sets `active = false` rather than deleting the row, though it currently emits no event at all).
