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
