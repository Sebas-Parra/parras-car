import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let configService: { getOrThrow: jest.Mock };
  const originalFetch = global.fetch;

  beforeEach(() => {
    configService = { getOrThrow: jest.fn().mockReturnValue('super-secret') };
    strategy = new JwtStrategy(configService as unknown as ConfigService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('reads JWT_SECRET from config on construction', () => {
    expect(configService.getOrThrow).toHaveBeenCalledWith('JWT_SECRET');
  });

  it('validate returns userId, username, roles and permissions fetched from the users service', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.endsWith('/roles')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ roles: ['admin'] }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ permissions: ['ver_auditoria'] }) });
    }) as unknown as typeof fetch;

    const result = await strategy.validate({ sub: 'user-1', username: 'jdoe' });

    expect(result).toEqual({
      userId: 'user-1',
      username: 'jdoe',
      roles: ['admin'],
      permissions: ['ver_auditoria'],
    });
  });

  it('validate defaults roles and permissions to an empty array when the response has none', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({}),
    }) as unknown as typeof fetch;

    const result = await strategy.validate({ sub: 'user-1', username: 'jdoe' });

    expect(result.roles).toEqual([]);
    expect(result.permissions).toEqual([]);
  });

  it('validate returns empty roles/permissions when the users service responds with an error status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
    }) as unknown as typeof fetch;

    const result = await strategy.validate({ sub: 'user-1', username: 'jdoe' });

    expect(result).toEqual({ userId: 'user-1', username: 'jdoe', roles: [], permissions: [] });
  });

  it('validate returns empty roles/permissions when the fetch call throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    const result = await strategy.validate({ sub: 'user-1', username: 'jdoe' });

    expect(result).toEqual({ userId: 'user-1', username: 'jdoe', roles: [], permissions: [] });
  });
});
