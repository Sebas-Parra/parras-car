import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { Vehicle } from './entities/vehicle.entity';
import { EventPublisher } from './event-published.service';
import { ActingUser } from './vehicles.service';

describe('VehiclesController', () => {
  let controller: VehiclesController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    activate: jest.Mock;
    remove: jest.Mock;
  };

  const actingUser: ActingUser = { userId: 'u1', username: 'jdoe', roles: ['admin'] };

  beforeEach(async () => {
    const mockRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };
    const mockPublisher = {
      publish: jest.fn(),
    };
    service = {
      create: jest.fn().mockResolvedValue({ id: 'v1' }),
      findAll: jest.fn().mockResolvedValue([{ id: 'v1' }]),
      findOne: jest.fn().mockResolvedValue({ id: 'v1' }),
      update: jest.fn().mockResolvedValue({ id: 'v1', brand: 'New' }),
      activate: jest.fn().mockResolvedValue({ id: 'v1', active: true }),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VehiclesController],
      providers: [
        VehiclesService,
        { provide: getRepositoryToken(Vehicle), useValue: mockRepository },
        { provide: EventPublisher, useValue: mockPublisher },
      ],
    })
      .overrideProvider(VehiclesService)
      .useValue(service)
      .compile();

    controller = module.get<VehiclesController>(VehiclesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('create delegates to the service with the acting user and client ip', () => {
    const req = {
      user: actingUser,
      headers: {
        'x-forwarded-for': '198.51.100.1',
        authorization: 'Bearer client-token',
      },
      ip: '127.0.0.1',
    } as any;
    const dto = { tipo: 'car', datos: {} } as any;

    controller.create(dto, req);

    expect(service.create).toHaveBeenCalledWith(
      dto,
      actingUser,
      '198.51.100.1',
      'Bearer client-token',
    );
  });

  it('findAll delegates to the service with the acting user', () => {
    const req = { user: actingUser } as any;
    controller.findAll(req, 1, 20);
    expect(service.findAll).toHaveBeenCalledWith(actingUser, 1, 20);
  });

  it('findOne delegates to the service with id and acting user', () => {
    const req = { user: actingUser } as any;
    controller.findOne('v1', req);
    expect(service.findOne).toHaveBeenCalledWith('v1', actingUser);
  });

  it('update delegates to the service with id and dto', () => {
    const dto = { tipo: 'car', datos: { brand: 'New' } } as any;
    controller.update('v1', dto);
    expect(service.update).toHaveBeenCalledWith('v1', dto);
  });

  it('activate delegates to the service with id', () => {
    controller.activate('v1');
    expect(service.activate).toHaveBeenCalledWith('v1');
  });

  it('remove delegates to the service with id', () => {
    controller.remove('v1');
    expect(service.remove).toHaveBeenCalledWith('v1');
  });
});
