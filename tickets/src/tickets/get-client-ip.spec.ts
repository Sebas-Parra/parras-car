import { Request } from 'express';
import { getClientIp } from './get-client-ip';

function buildRequest(overrides: Partial<Request>): Request {
  return { headers: {}, ...overrides } as Request;
}

describe('getClientIp', () => {
  it('prefers the first X-Forwarded-For value over req.ip', () => {
    const req = buildRequest({
      headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
      ip: '172.18.0.7',
    });
    expect(getClientIp(req)).toBe('203.0.113.5');
  });

  it('falls back to req.ip when there is no X-Forwarded-For header', () => {
    const req = buildRequest({ headers: {}, ip: '172.18.0.7' });
    expect(getClientIp(req)).toBe('172.18.0.7');
  });

  it('strips the IPv4-mapped-IPv6 prefix', () => {
    const req = buildRequest({ headers: {}, ip: '::ffff:127.0.0.1' });
    expect(getClientIp(req)).toBe('127.0.0.1');
  });

  it('returns undefined when neither source is available', () => {
    const req = buildRequest({ headers: {}, ip: undefined });
    expect(getClientIp(req)).toBeUndefined();
  });
});
