import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles && !requiredPermissions) return true;

    const { user } = context.switchToHttp().getRequest();
    const roleMatch = !!requiredRoles && requiredRoles.some((role) => (user?.roles as string[])?.includes(role));
    const permissionMatch =
      !!requiredPermissions && requiredPermissions.some((perm) => (user?.permissions as string[])?.includes(perm));

    // @Roles y @Permissions se combinan con OR: cualquiera de los dos basta.
    return roleMatch || permissionMatch;
  }
}
