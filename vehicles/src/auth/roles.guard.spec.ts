import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  const buildContext = (user: unknown): ExecutionContext => {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('allows access when no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = buildContext({ roles: ['admin'] });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies access when user has no roles', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    const context = buildContext(undefined);
    expect(guard.canActivate(context)).toBe(false);
  });

  it('allows access when user has one of the required roles', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin', 'root']);
    const context = buildContext({ roles: ['root'] });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies access when user lacks all required roles', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin', 'root']);
    const context = buildContext({ roles: ['cliente'] });
    expect(guard.canActivate(context)).toBe(false);
  });
});
