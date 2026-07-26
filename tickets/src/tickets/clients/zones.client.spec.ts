import { ServiceUnavailableException } from '@nestjs/common';
import { ZonesClient } from './zones.client';

describe('ZonesClient', () => {
  let client: ZonesClient;
  const originalFetch = global.fetch;

  beforeEach(() => {
    client = new ZonesClient();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('findPlaceById', () => {
    it('returns the matching place from the list', async () => {
      const places = [{ id: 'place-1' }, { id: 'place-2' }];
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(places),
      }) as any;

      const result = await client.findPlaceById('place-2', 'Bearer token');

      expect(result).toEqual({ id: 'place-2' });
    });

    it('returns null when no place matches', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue([]),
      }) as any;

      const result = await client.findPlaceById('missing', 'Bearer token');

      expect(result).toBeNull();
    });

    it('returns null when the response is not ok', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false }) as any;

      const result = await client.findPlaceById('place-1', 'Bearer token');

      expect(result).toBeNull();
    });

    it('throws ServiceUnavailableException when the request fails', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('network'));

      await expect(
        client.findPlaceById('place-1', 'Bearer token'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('findZoneById', () => {
    it('returns the zone when the response is ok', async () => {
      const zone = { id: 'zone-1', type: 'REGULAR' };
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(zone),
      }) as any;

      const result = await client.findZoneById('zone-1', 'Bearer token');

      expect(result).toEqual(zone);
    });

    it('returns null when the response is not ok', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false }) as any;

      const result = await client.findZoneById('zone-1', 'Bearer token');

      expect(result).toBeNull();
    });

    it('throws ServiceUnavailableException when the request fails', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('network'));

      await expect(
        client.findZoneById('zone-1', 'Bearer token'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('setStatus', () => {
    it('resolves when the response is ok', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true }) as any;

      await expect(
        client.setStatus('place-1', 'OCCUPIED', 'Bearer token'),
      ).resolves.toBeUndefined();
    });

    it('throws ServiceUnavailableException when the response is not ok', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue({ ok: false, status: 500 }) as any;

      await expect(
        client.setStatus('place-1', 'OCCUPIED', 'Bearer token'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('throws ServiceUnavailableException when the request fails', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('network'));

      await expect(
        client.setStatus('place-1', 'OCCUPIED', 'Bearer token'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });
});
