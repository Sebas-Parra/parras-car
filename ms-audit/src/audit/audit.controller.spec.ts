import { Reflector } from '@nestjs/core';
import { AuditController } from './audit.controller';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { ROLES_KEY } from '../auth/roles.decorator';

describe('AuditController', () => {
  it('applies JwtAuthGuard and RolesGuard at the controller level', () => {
    const guards = Reflect.getMetadata('__guards__', AuditController);
    expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
  });

  it('requires admin or root for findAll', () => {
    const roles = new Reflector().get(ROLES_KEY, AuditController.prototype.findAll);
    expect(roles).toEqual(['admin', 'root']);
  });

  it('requires admin or root for findOne', () => {
    const roles = new Reflector().get(ROLES_KEY, AuditController.prototype.findOne);
    expect(roles).toEqual(['admin', 'root']);
  });

  it('no longer exposes a create/POST handler', () => {
    expect((AuditController.prototype as any).create).toBeUndefined();
  });
});
