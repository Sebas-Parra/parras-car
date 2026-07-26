import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { VehiclesService } from './vehicles.service';
import { Vehicle } from './entities/vehicle.entity';
import { EventPublisher } from './event-published.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

describe('VehiclesService', () => {
  let service: VehiclesService;
  let repo: {
    findOne: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    manager: { save: jest.Mock };
  };
  let publisher: { publish: jest.Mock };
  let fetchMock: jest.Mock;

  beforeEach(async () => {
    repo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((v) => Promise.resolve({ id: 'veh-1', ...v })),
      find: jest.fn().mockResolvedValue([]),
      manager: { save: jest.fn((v) => Promise.resolve(v)) },
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

    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('create', () => {
    it('publishes the acting user on CREATE', async () => {
      const dto = {
        tipo: 'car',
        datos: { plate: 'ABC-123' },
      } as unknown as CreateVehicleDto;

      await service.create(dto, { userId: 'u1', username: 'jdoe', roles: ['admin'] });

      expect(publisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ usuario: 'jdoe', rol: 'admin' }),
      );
    });

    it('publishes the client IP on CREATE when provided', async () => {
      const dto = {
        tipo: 'car',
        datos: { plate: 'ABC-124' },
      } as unknown as CreateVehicleDto;

      await service.create(
        dto,
        { userId: 'u1', username: 'jdoe', roles: ['admin'] },
        '203.0.113.5',
      );

      expect(publisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ ip: '203.0.113.5' }),
      );
    });

    it('throws ConflictException when plate already exists', async () => {
      repo.findOne.mockResolvedValueOnce({ id: 'existing', plate: 'ABC-123' });
      const dto = {
        tipo: 'car',
        datos: { plate: 'ABC-123' },
      } as unknown as CreateVehicleDto;

      await expect(
        service.create(dto, { userId: 'u1', username: 'jdoe', roles: ['admin'] }),
      ).rejects.toThrow(ConflictException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('auto-assigns the vehicle when acting user has role cliente', async () => {
      fetchMock.mockResolvedValue({ ok: true, statusText: 'OK' });
      const dto = {
        tipo: 'car',
        datos: { plate: 'ABC-125' },
      } as unknown as CreateVehicleDto;

      await service.create(dto, { userId: 'u1', username: 'cliente1', roles: ['cliente'] });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/assignments'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('logs an error when auto-assign fetch responds not ok', async () => {
      fetchMock.mockResolvedValue({ ok: false, statusText: 'Bad Request' });
      const dto = {
        tipo: 'car',
        datos: { plate: 'ABC-126' },
      } as unknown as CreateVehicleDto;

      await expect(
        service.create(dto, { userId: 'u1', username: 'cliente1', roles: ['cliente'] }),
      ).resolves.toBeDefined();
    });

    it('swallows errors thrown while auto-assigning', async () => {
      fetchMock.mockRejectedValue(new Error('network down'));
      const dto = {
        tipo: 'car',
        datos: { plate: 'ABC-127' },
      } as unknown as CreateVehicleDto;

      await expect(
        service.create(dto, { userId: 'u1', username: 'cliente1', roles: ['cliente'] }),
      ).resolves.toBeDefined();
    });
  });

  describe('findAll', () => {
    it('returns all vehicles for non-cliente users', async () => {
      repo.find.mockResolvedValueOnce([{ id: 'v1' }]);
      const result = await service.findAll({ userId: 'u1', username: 'admin1', roles: ['admin'] });
      expect(result).toEqual([{ id: 'v1' }]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns all vehicles when no acting user is provided', async () => {
      repo.find.mockResolvedValueOnce([{ id: 'v1' }]);
      const result = await service.findAll();
      expect(result).toEqual([{ id: 'v1' }]);
    });

    it('returns empty list for cliente with no assigned vehicles', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ vehicle_ids: [] }),
      });
      const result = await service.findAll({ userId: 'u1', username: 'cliente1', roles: ['cliente'] });
      expect(result).toEqual([]);
    });

    it('returns vehicles matching assigned ids for cliente', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ vehicle_ids: ['v1', 'v2'] }),
      });
      repo.find.mockResolvedValueOnce([{ id: 'v1' }, { id: 'v2' }]);
      const result = await service.findAll({ userId: 'u1', username: 'cliente1', roles: ['cliente'] });
      expect(result).toEqual([{ id: 'v1' }, { id: 'v2' }]);
    });

    it('throws ServiceUnavailableException when fleet fetch is not ok', async () => {
      fetchMock.mockResolvedValue({ ok: false, statusText: 'Bad Gateway' });
      await expect(
        service.findAll({ userId: 'u1', username: 'cliente1', roles: ['cliente'] }),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('throws ServiceUnavailableException when fetch throws', async () => {
      fetchMock.mockRejectedValue(new Error('network down'));
      await expect(
        service.findAll({ userId: 'u1', username: 'cliente1', roles: ['cliente'] }),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when vehicle does not exist', async () => {
      repo.findOne.mockResolvedValueOnce(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns the vehicle for non-cliente actors', async () => {
      repo.findOne.mockResolvedValueOnce({ id: 'v1' });
      const result = await service.findOne('v1', {
        userId: 'u1',
        username: 'admin1',
        roles: ['admin'],
      });
      expect(result).toEqual({ id: 'v1' });
    });

    it('returns the vehicle for cliente when they own it', async () => {
      repo.findOne.mockResolvedValueOnce({ id: 'v1' });
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ vehicle_ids: ['v1'] }),
      });
      const result = await service.findOne('v1', {
        userId: 'u1',
        username: 'cliente1',
        roles: ['cliente'],
      });
      expect(result).toEqual({ id: 'v1' });
    });

    it('throws NotFoundException for cliente when they do not own it', async () => {
      repo.findOne.mockResolvedValueOnce({ id: 'v1' });
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ vehicle_ids: ['other'] }),
      });
      await expect(
        service.findOne('v1', { userId: 'u1', username: 'cliente1', roles: ['cliente'] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ServiceUnavailableException when fleet fetch not ok', async () => {
      repo.findOne.mockResolvedValueOnce({ id: 'v1' });
      fetchMock.mockResolvedValue({ ok: false, statusText: 'Bad Gateway' });
      await expect(
        service.findOne('v1', { userId: 'u1', username: 'cliente1', roles: ['cliente'] }),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('throws ServiceUnavailableException when fetch throws unexpectedly', async () => {
      repo.findOne.mockResolvedValueOnce({ id: 'v1' });
      fetchMock.mockRejectedValue(new Error('boom'));
      await expect(
        service.findOne('v1', { userId: 'u1', username: 'cliente1', roles: ['cliente'] }),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('update', () => {
    it('throws ConflictException when vehicle is inactive', async () => {
      repo.findOne.mockResolvedValueOnce({ id: 'v1', active: false, tipo: 'car' });
      const dto = { tipo: 'car', datos: {} } as unknown as UpdateVehicleDto;
      await expect(service.update('v1', dto)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when trying to change vehicle type', async () => {
      repo.findOne.mockResolvedValueOnce({ id: 'v1', active: true, tipo: 'car' });
      const dto = { tipo: 'motocicleta', datos: {} } as unknown as UpdateVehicleDto;
      await expect(service.update('v1', dto)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when new plate already exists', async () => {
      repo.findOne
        .mockResolvedValueOnce({ id: 'v1', active: true, tipo: 'car', plate: 'ABC-123' })
        .mockResolvedValueOnce({ id: 'v2', plate: 'ABC-999' });
      const dto = {
        tipo: 'car',
        datos: { plate: 'ABC-999' },
      } as unknown as UpdateVehicleDto;
      await expect(service.update('v1', dto)).rejects.toThrow(ConflictException);
    });

    it('updates and saves the vehicle', async () => {
      repo.findOne.mockResolvedValueOnce({
        id: 'v1',
        active: true,
        tipo: 'car',
        plate: 'ABC-123',
        brand: 'Old',
      });
      const dto = {
        tipo: 'car',
        datos: { brand: 'New' },
      } as unknown as UpdateVehicleDto;

      const result = await service.update('v1', dto);
      expect(repo.manager.save).toHaveBeenCalledWith(
        expect.objectContaining({ brand: 'New' }),
      );
      expect(result).toEqual(expect.objectContaining({ brand: 'New' }));
    });

    it('allows updating without changing the plate', async () => {
      repo.findOne.mockResolvedValueOnce({
        id: 'v1',
        active: true,
        tipo: 'car',
        plate: 'ABC-123',
      });
      const dto = { tipo: 'car', datos: {} } as unknown as UpdateVehicleDto;
      await service.update('v1', dto);
      expect(repo.findOne).toHaveBeenCalledTimes(1);
    });

    it('rethrows a ConflictException when save fails with QueryFailedError', async () => {
      repo.findOne.mockResolvedValueOnce({
        id: 'v1',
        active: true,
        tipo: 'car',
        plate: 'ABC-123',
      });
      const queryError = new QueryFailedError('query', [], new Error('duplicate'));
      repo.manager.save.mockRejectedValueOnce(queryError);
      const dto = { tipo: 'car', datos: {} } as unknown as UpdateVehicleDto;
      await expect(service.update('v1', dto)).rejects.toThrow(ConflictException);
    });

    it('rethrows unknown errors from save', async () => {
      repo.findOne.mockResolvedValueOnce({
        id: 'v1',
        active: true,
        tipo: 'car',
        plate: 'ABC-123',
      });
      const genericError = new Error('unexpected');
      repo.manager.save.mockRejectedValueOnce(genericError);
      const dto = { tipo: 'car', datos: {} } as unknown as UpdateVehicleDto;
      await expect(service.update('v1', dto)).rejects.toThrow('unexpected');
    });
  });

  describe('remove', () => {
    it('throws ConflictException when vehicle already inactive', async () => {
      repo.findOne.mockResolvedValueOnce({ id: 'v1', active: false });
      await expect(service.remove('v1')).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when vehicle has an active owner assigned', async () => {
      repo.findOne.mockResolvedValueOnce({ id: 'v1', active: true });
      fetchMock.mockResolvedValue({ ok: true });
      await expect(service.remove('v1')).rejects.toThrow(ConflictException);
    });

    it('soft-deletes the vehicle when it has no owner assigned', async () => {
      const vehicle = { id: 'v1', active: true };
      repo.findOne.mockResolvedValueOnce(vehicle);
      fetchMock.mockResolvedValue({ ok: false });
      await service.remove('v1');
      expect(vehicle.active).toBe(false);
      expect(repo.save).toHaveBeenCalledWith(vehicle);
    });
  });

  describe('activate', () => {
    it('activates the vehicle', async () => {
      const vehicle = { id: 'v1', active: false };
      repo.findOne.mockResolvedValueOnce(vehicle);
      const result = await service.activate('v1');
      expect(vehicle.active).toBe(true);
      expect(result).toEqual(expect.objectContaining({ active: true }));
    });
  });
});
