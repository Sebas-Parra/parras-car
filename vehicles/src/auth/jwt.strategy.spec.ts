import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let configService: { getOrThrow: jest.Mock };
  let fetchMock: jest.Mock;

  beforeEach(() => {
    configService = { getOrThrow: jest.fn().mockReturnValue('secret') };
    strategy = new JwtStrategy(configService as unknown as ConfigService);
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns userId, username and roles fetched from the users service', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ roles: ['admin'] }),
    });

    const result = await strategy.validate({ sub: 'u1', username: 'jdoe' });

    expect(result).toEqual({ userId: 'u1', username: 'jdoe', roles: ['admin'] });
  });

  it('returns an empty roles array when the users service responds not ok', async () => {
    fetchMock.mockResolvedValue({ ok: false, statusText: 'Not Found' });

    const result = await strategy.validate({ sub: 'u1', username: 'jdoe' });

    expect(result).toEqual({ userId: 'u1', username: 'jdoe', roles: [] });
  });

  it('returns an empty roles array when the response has no roles field', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    const result = await strategy.validate({ sub: 'u1', username: 'jdoe' });

    expect(result.roles).toEqual([]);
  });

  it('returns an empty roles array when fetch throws', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    const result = await strategy.validate({ sub: 'u1', username: 'jdoe' });

    expect(result).toEqual({ userId: 'u1', username: 'jdoe', roles: [] });
  });
});
