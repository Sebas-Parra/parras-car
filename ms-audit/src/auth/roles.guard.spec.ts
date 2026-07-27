import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from './roles.decorator';
import { PERMISSIONS_KEY } from './permissions.decorator';

function buildContext(user: { roles?: string[]; permissions?: string[] } | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function buildReflector(roles: string[] | undefined, permissions: string[] | undefined): Reflector {
  return {
    getAllAndOverride: jest.fn((key: string) => (key === ROLES_KEY ? roles : permissions)),
  } as unknown as Reflector;
}

describe('RolesGuard', () => {
  it('allows access when no roles or permissions are required', () => {
    const guard = new RolesGuard(buildReflector(undefined, undefined));
    expect(guard.canActivate(buildContext({ roles: ['cliente'] }))).toBe(true);
  });

  it('allows access when the user has one of the required roles', () => {
    const guard = new RolesGuard(buildReflector(['admin', 'root'], undefined));
    expect(guard.canActivate(buildContext({ roles: ['admin'] }))).toBe(true);
  });

  it('denies access when the user has none of the required roles', () => {
    const guard = new RolesGuard(buildReflector(['admin', 'root'], undefined));
    expect(guard.canActivate(buildContext({ roles: ['cliente'] }))).toBe(false);
  });

  it('denies access when there is no authenticated user on the request', () => {
    const guard = new RolesGuard(buildReflector(['admin', 'root'], undefined));
    expect(guard.canActivate(buildContext(undefined))).toBe(false);
  });

  it('allows access via a required permission even without a matching role', () => {
    const guard = new RolesGuard(buildReflector(['admin', 'root'], ['ver_auditoria']));
    expect(guard.canActivate(buildContext({ roles: ['auditor'], permissions: ['ver_auditoria'] }))).toBe(true);
  });

  it('denies access when neither the required roles nor permissions match', () => {
    const guard = new RolesGuard(buildReflector(['admin', 'root'], ['ver_auditoria']));
    expect(guard.canActivate(buildContext({ roles: ['cliente'], permissions: ['publico'] }))).toBe(false);
  });
});
