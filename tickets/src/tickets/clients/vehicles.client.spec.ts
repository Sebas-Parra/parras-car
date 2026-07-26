import { ServiceUnavailableException } from '@nestjs/common';
import { VehiclesClient } from './vehicles.client';

describe('VehiclesClient', () => {
  let client: VehiclesClient;
  const originalFetch = global.fetch;

  beforeEach(() => {
    client = new VehiclesClient();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns the vehicle matching the given plate', async () => {
    const vehicles = [
      { id: 'v1', plate: 'ABC-123', active: true },
      { id: 'v2', plate: 'XYZ-999', active: true },
    ];
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(vehicles),
    }) as any;

    const result = await client.findByPlate('XYZ-999', 'Bearer token');

    expect(result).toEqual(vehicles[1]);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/vehicles'),
      { headers: { Authorization: 'Bearer token' } },
    );
  });

  it('returns null when no vehicle matches the plate', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue([]),
    }) as any;

    const result = await client.findByPlate('MISSING', 'Bearer token');

    expect(result).toBeNull();
  });

  it('returns null when the response is not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as any;

    const result = await client.findByPlate('ABC-123', 'Bearer token');

    expect(result).toBeNull();
  });

  it('throws ServiceUnavailableException when the request fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network'));

    await expect(
      client.findByPlate('ABC-123', 'Bearer token'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
