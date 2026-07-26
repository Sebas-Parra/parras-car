import { ServiceUnavailableException } from '@nestjs/common';
import { AssignmentsClient } from './assignments.client';

describe('AssignmentsClient', () => {
  let client: AssignmentsClient;
  const originalFetch = global.fetch;

  beforeEach(() => {
    client = new AssignmentsClient();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns the active assignment for the vehicle', async () => {
    const assignment = { user_id: 'u1', vehicle_id: 'v1', active: true };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(assignment),
    }) as any;

    const result = await client.findActiveByVehicle('v1');

    expect(result).toEqual(assignment);
  });

  it('returns null when the assignment is not found (404)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }) as any;

    const result = await client.findActiveByVehicle('v1');

    expect(result).toBeNull();
  });

  it('returns null for other non-ok responses', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }) as any;

    const result = await client.findActiveByVehicle('v1');

    expect(result).toBeNull();
  });

  it('throws ServiceUnavailableException when the request fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network'));

    await expect(client.findActiveByVehicle('v1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
