import { Request } from 'express';

export function getClientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const raw = forwardedValue ? forwardedValue.split(',')[0].trim() : req.ip;
  if (!raw) return undefined;
  return raw.startsWith('::ffff:') ? raw.slice('::ffff:'.length) : raw;
}
