import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditService } from './audit.service';
import { EventAudit } from './entities/event-audit.entity';
import { CreateAuditEventDto } from './dto/create-audit-event.dto';

describe('AuditService', () => {
  let service: AuditService;
  let repo: { create: jest.Mock; save: jest.Mock; findAndCount: jest.Mock };

  beforeEach(async () => {
    repo = {
      create: jest.fn((x) => x),
      save: jest.fn((x) => Promise.resolve({ id: 'evt-1', ...x })),
      findAndCount: jest.fn(),
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

  describe('findAll', () => {
    it('paginates using skip/take derived from page and pageSize', async () => {
      repo.findAndCount.mockResolvedValue([[{ id: 'evt-1' }], 45]);

      const result = await service.findAll(3, 10);

      expect(repo.findAndCount).toHaveBeenCalledWith({
        order: { timestamp: 'DESC' },
        skip: 20,
        take: 10,
      });
      expect(result).toEqual({ data: [{ id: 'evt-1' }], total: 45, page: 3, pageSize: 10 });
    });
  });
});
