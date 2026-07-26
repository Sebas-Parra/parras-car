import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  const buildContext = (user?: any): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as any;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('allows access when the route has no required roles', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(buildContext({ roles: ['recaudador'] }))).toBe(
      true,
    );
  });

  it('denies access when the user has no roles', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);

    expect(guard.canActivate(buildContext(undefined))).toBe(false);
  });

  it('denies access when the user does not have one of the required roles', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin', 'root']);

    expect(guard.canActivate(buildContext({ roles: ['recaudador'] }))).toBe(
      false,
    );
  });

  it('allows access when the user has one of the required roles', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin', 'root']);

    expect(guard.canActivate(buildContext({ roles: ['root'] }))).toBe(true);
  });
});
