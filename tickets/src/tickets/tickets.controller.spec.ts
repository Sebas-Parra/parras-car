import { Test, TestingModule } from '@nestjs/testing';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

describe('TicketsController', () => {
  let controller: TicketsController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    pay: jest.Mock;
    cancel: jest.Mock;
  };

  const buildRequest = (overrides: any = {}) =>
    ({
      user: { userId: 'emp-1', username: 'jdoe', roles: ['recaudador'] },
      headers: { authorization: 'Bearer token' },
      ip: '10.0.0.1',
      ...overrides,
    }) as any;

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue({ id: 'tick-1' }),
      findAll: jest.fn().mockResolvedValue([{ id: 'tick-1' }]),
      findOne: jest.fn().mockResolvedValue({ id: 'tick-1' }),
      pay: jest.fn().mockResolvedValue({ id: 'tick-1', estado: 'PAGADO' }),
      cancel: jest.fn().mockResolvedValue({ id: 'tick-1', estado: 'ANULADO' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [{ provide: TicketsService, useValue: service }],
    }).compile();

    controller = module.get<TicketsController>(TicketsController);
  });

  it('creates a ticket using the acting user, auth header and client ip from the request', async () => {
    const dto = { idEspacio: 'place-1', placa: 'ABC-123' } as any;
    const req = buildRequest({
      headers: { authorization: 'Bearer token', 'x-forwarded-for': '203.0.113.5' },
    });

    const result = await controller.create(dto, req);

    expect(service.create).toHaveBeenCalledWith(
      dto,
      'emp-1',
      'Bearer token',
      { username: 'jdoe', roles: ['recaudador'] },
      '203.0.113.5',
    );
    expect(result).toEqual({ id: 'tick-1' });
  });

  it('falls back to an empty auth header when no Authorization header is present', async () => {
    const dto = { idEspacio: 'place-1', placa: 'ABC-123' } as any;
    const req = buildRequest({ headers: {} });

    await controller.create(dto, req);

    expect(service.create).toHaveBeenCalledWith(
      dto,
      'emp-1',
      '',
      { username: 'jdoe', roles: ['recaudador'] },
      '10.0.0.1',
    );
  });

  it('lists all tickets, filtering by the requester', async () => {
    const req = buildRequest();
    const result = await controller.findAll(1, 20, req);
    expect(service.findAll).toHaveBeenCalledWith(1, 20, undefined, { userId: 'emp-1', roles: ['recaudador'] }, undefined);
    expect(result).toEqual([{ id: 'tick-1' }]);
  });

  it('finds a single ticket by id, scoped to the requester', async () => {
    const req = buildRequest();
    const result = await controller.findOne('tick-1', req);
    expect(service.findOne).toHaveBeenCalledWith('tick-1', { userId: 'emp-1', roles: ['recaudador'] });
    expect(result).toEqual({ id: 'tick-1' });
  });

  it('pays a ticket using the acting user, auth header and client ip', async () => {
    const req = buildRequest();
    const result = await controller.pay('tick-1', req);

    expect(service.pay).toHaveBeenCalledWith(
      'tick-1',
      'emp-1',
      'Bearer token',
      { username: 'jdoe', roles: ['recaudador'] },
      '10.0.0.1',
    );
    expect(result).toEqual({ id: 'tick-1', estado: 'PAGADO' });
  });

  it('cancels a ticket using the acting user, auth header and client ip', async () => {
    const req = buildRequest();
    const result = await controller.cancel('tick-1', req);

    expect(service.cancel).toHaveBeenCalledWith(
      'tick-1',
      'emp-1',
      'Bearer token',
      { username: 'jdoe', roles: ['recaudador'] },
      '10.0.0.1',
    );
    expect(result).toEqual({ id: 'tick-1', estado: 'ANULADO' });
  });
});
