import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VehiclesService } from './vehicles.service';
import { Vehicle } from './entities/vehicle.entity';
import { EventPublisher } from './event-published.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';

describe('VehiclesService', () => {
  let service: VehiclesService;
  let repo: { findOne: jest.Mock; save: jest.Mock; findAndCount: jest.Mock };
  let publisher: { publish: jest.Mock };

  beforeEach(async () => {
    repo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((v) => Promise.resolve({ id: 'veh-1', ...v })),
      findAndCount: jest.fn(),
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

  describe('findAll', () => {
    it('paginates the full catalog for non-cliente users', async () => {
      repo.findAndCount.mockResolvedValue([[{ id: 'veh-1' }], 30]);

      const result = await service.findAll({ userId: 'u1', username: 'jdoe', roles: ['admin'] }, 2, 10);

      expect(repo.findAndCount).toHaveBeenCalledWith({ skip: 10, take: 10 });
      expect(result).toEqual({ data: [{ id: 'veh-1' }], total: 30, page: 2, pageSize: 10 });
    });
  });
});
