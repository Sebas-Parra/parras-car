import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from './roles.decorator';

function buildContext(user: { roles: string[] } | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows access when no roles are required', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(buildContext({ roles: ['cliente'] }))).toBe(true);
  });

  it('allows access when the user has one of the required roles', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['admin', 'root']) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(buildContext({ roles: ['admin'] }))).toBe(true);
  });

  it('denies access when the user has none of the required roles', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['admin', 'root']) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(buildContext({ roles: ['cliente'] }))).toBe(false);
  });

  it('denies access when there is no authenticated user on the request', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['admin', 'root']) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(buildContext(undefined))).toBe(false);
  });
});
