import { Reflector } from '@nestjs/core';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
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

  describe('handlers', () => {
    let controller: AuditController;
    let auditService: { findAll: jest.Mock; findOne: jest.Mock };

    beforeEach(() => {
      auditService = {
        findAll: jest.fn().mockResolvedValue([{ id: 'evt-1' }]),
        findOne: jest.fn().mockResolvedValue({ id: 'evt-1' }),
      };
      controller = new AuditController(auditService as unknown as AuditService);
    });

    it('findAll delegates to AuditService.findAll', async () => {
      await expect(controller.findAll()).resolves.toEqual([{ id: 'evt-1' }]);
      expect(auditService.findAll).toHaveBeenCalled();
    });

    it('findOne delegates to AuditService.findOne with the given id', async () => {
      await expect(controller.findOne('evt-1')).resolves.toEqual({ id: 'evt-1' });
      expect(auditService.findOne).toHaveBeenCalledWith('evt-1');
    });
  });
});
