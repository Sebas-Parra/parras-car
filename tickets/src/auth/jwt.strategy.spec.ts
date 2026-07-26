import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let configService: { getOrThrow: jest.Mock };
  let strategy: JwtStrategy;
  const originalFetch = global.fetch;

  beforeEach(() => {
    configService = { getOrThrow: jest.fn().mockReturnValue('secret') };
    strategy = new JwtStrategy(configService as unknown as ConfigService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns userId, username and roles fetched from the users service', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ roles: ['admin'] }),
    }) as any;

    const result = await strategy.validate({
      sub: 'user-1',
      username: 'jdoe',
    });

    expect(result).toEqual({
      userId: 'user-1',
      username: 'jdoe',
      roles: ['admin'],
    });
  });

  it('returns an empty roles array when the users service responds with a non-ok status', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
      json: jest.fn(),
    }) as any;

    const result = await strategy.validate({
      sub: 'user-1',
      username: 'jdoe',
    });

    expect(result.roles).toEqual([]);
  });

  it('returns an empty roles array when the users service payload has no roles', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({}),
    }) as any;

    const result = await strategy.validate({
      sub: 'user-1',
      username: 'jdoe',
    });

    expect(result.roles).toEqual([]);
  });

  it('returns an empty roles array when fetching roles throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));

    const result = await strategy.validate({
      sub: 'user-1',
      username: 'jdoe',
    });

    expect(result.roles).toEqual([]);
  });
});
