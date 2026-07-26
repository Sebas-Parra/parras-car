import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from './audit.service';
import { EventAudit } from './entities/event-audit.entity';
import { CreateAuditEventDto } from './dto/create-audit-event.dto';

describe('AuditService', () => {
  let service: AuditService;
  let repo: { create: jest.Mock; save: jest.Mock; find: jest.Mock; findOne: jest.Mock };

  beforeEach(async () => {
    repo = {
      create: jest.fn((x) => x),
      save: jest.fn((x) => Promise.resolve({ id: 'evt-1', ...x })),
      find: jest.fn(),
      findOne: jest.fn(),
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
      ip: '203.0.113.5',
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
      ip: '203.0.113.5',
    };
    const before = Date.now();

    await service.create(dto);

    const arg = repo.create.mock.calls[0][0];
    expect(arg.eventTimestamp.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('findAll returns events ordered by timestamp descending', async () => {
    const events = [{ id: 'evt-1' }, { id: 'evt-2' }];
    repo.find.mockResolvedValue(events);

    await expect(service.findAll()).resolves.toEqual(events);
    expect(repo.find).toHaveBeenCalledWith({ order: { timestamp: 'DESC' } });
  });

  it('findOne returns the event matching the given id', async () => {
    const event = { id: 'evt-1' };
    repo.findOne.mockResolvedValue(event);

    await expect(service.findOne('evt-1')).resolves.toEqual(event);
    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'evt-1' } });
  });

  it('findOne returns null when no event matches', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(service.findOne('missing')).resolves.toBeNull();
  });
});
