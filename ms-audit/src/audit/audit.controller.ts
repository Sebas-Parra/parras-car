import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) { }

  @Get()
  @Roles('admin', 'root')
  findAll() {
    return this.auditService.findAll();
  }

  @Get(':id')
  @Roles('admin', 'root')
  findOne(@Param('id') id: string) {
    return this.auditService.findOne(id);
  }
}
