import { ConflictException, NotFoundException } from '@nestjs/common';
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
import { SseService } from 'src/sse/sse.services';

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
  let sseService: { emitEvent: jest.Mock };

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
    sseService = { emitEvent: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: getRepositoryToken(Ticket), useValue: repo },
        { provide: EventPublisher, useValue: publisher },
        { provide: ZonesClient, useValue: zonesClient },
        { provide: VehiclesClient, useValue: vehiclesClient },
        { provide: AssignmentsClient, useValue: assignmentsClient },
        { provide: SseService, useValue: sseService },
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

  it('throws NotFoundException when the vehicle does not exist', async () => {
    vehiclesClient.findByPlate.mockResolvedValue(null);
    const dto: CreateTicketDto = { idEspacio: 'place-1', placa: 'ABC-123' };

    await expect(
      service.create(dto, 'empleado-1', 'Bearer token', actingUser),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws ConflictException when the vehicle is inactive', async () => {
    vehiclesClient.findByPlate.mockResolvedValue({ ...vehicle, active: false });
    const dto: CreateTicketDto = { idEspacio: 'place-1', placa: 'ABC-123' };

    await expect(
      service.create(dto, 'empleado-1', 'Bearer token', actingUser),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws ConflictException when the plate already has an active ticket', async () => {
    repo.findOne.mockResolvedValue({ id: 'existing', codigo: 'TCK-A1-1' });
    const dto: CreateTicketDto = { idEspacio: 'place-1', placa: 'ABC-123' };

    await expect(
      service.create(dto, 'empleado-1', 'Bearer token', actingUser),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws ConflictException when the vehicle has no active assignment', async () => {
    assignmentsClient.findActiveByVehicle.mockResolvedValue(null);
    const dto: CreateTicketDto = { idEspacio: 'place-1', placa: 'ABC-123' };

    await expect(
      service.create(dto, 'empleado-1', 'Bearer token', actingUser),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws NotFoundException when the place does not exist', async () => {
    zonesClient.findPlaceById.mockResolvedValue(null);
    const dto: CreateTicketDto = { idEspacio: 'place-1', placa: 'ABC-123' };

    await expect(
      service.create(dto, 'empleado-1', 'Bearer token', actingUser),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws ConflictException when the place is not available', async () => {
    zonesClient.findPlaceById.mockResolvedValue({
      ...place,
      status: 'OCCUPIED',
    });
    const dto: CreateTicketDto = { idEspacio: 'place-1', placa: 'ABC-123' };

    await expect(
      service.create(dto, 'empleado-1', 'Bearer token', actingUser),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws ConflictException when the vehicle type is not compatible with the place type', async () => {
    vehiclesClient.findByPlate.mockResolvedValue({
      ...vehicle,
      tipo: 'motocicleta',
    });
    const dto: CreateTicketDto = { idEspacio: 'place-1', placa: 'ABC-123' };

    await expect(
      service.create(dto, 'empleado-1', 'Bearer token', actingUser),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('deletes the created ticket and rethrows when setStatus fails after creation', async () => {
    const failure = new Error('zones unavailable');
    zonesClient.setStatus.mockRejectedValue(failure);
    const dto: CreateTicketDto = { idEspacio: 'place-1', placa: 'ABC-123' };

    await expect(
      service.create(dto, 'empleado-1', 'Bearer token', actingUser),
    ).rejects.toThrow(failure);

    expect(repo.delete).toHaveBeenCalledWith('tick-1');
    expect(publisher.publish).not.toHaveBeenCalled();
  });

  it('throws NotFoundException from findOne when the ticket does not exist', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns all tickets', async () => {
    const find = jest.fn().mockResolvedValue([{ id: 'tick-1' }]);
    (service as any).ticketRepository.find = find;

    const result = await service.findAll();

    expect(find).toHaveBeenCalled();
    expect(result).toEqual([{ id: 'tick-1' }]);
  });

  it('throws ConflictException when paying a ticket that is not active', async () => {
    repo.findOne.mockResolvedValue({
      id: 'tick-1',
      codigo: 'TCK-A1-1',
      estado: EstadoTicket.PAGADO,
    });

    await expect(
      service.pay('tick-1', 'empleado-1', 'Bearer token', actingUser),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws ConflictException when cancelling a ticket that is not active', async () => {
    repo.findOne.mockResolvedValue({
      id: 'tick-1',
      codigo: 'TCK-A1-1',
      estado: EstadoTicket.ANULADO,
    });

    await expect(
      service.cancel('tick-1', 'empleado-1', 'Bearer token', actingUser),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('appends a numeric suffix when the generated ticket code already exists', async () => {
    repo.findOne
      .mockResolvedValueOnce(null) // no active ticket for the plate
      .mockResolvedValueOnce({ codigo: 'duplicate' }) // first generated code taken
      .mockResolvedValueOnce(null); // suffixed code is free
    const dto: CreateTicketDto = { idEspacio: 'place-1', placa: 'ABC-123' };

    const saved = await service.create(
      dto,
      'empleado-1',
      'Bearer token',
      actingUser,
    );

    expect(saved.codigo).toMatch(/-1$/);
  });
});
