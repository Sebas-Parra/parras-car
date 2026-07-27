import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Permissions } from '../auth/permissions.decorator';

const MAX_PAGE_SIZE = 100;

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) { }

  @Get()
  @Roles('admin', 'root')
  @Permissions('ver_auditoria')
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    return this.auditService.findAll(Math.max(1, page), Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE));
  }

  @Get(':id')
  @Roles('admin', 'root')
  @Permissions('ver_auditoria')
  findOne(@Param('id') id: string) {
    return this.auditService.findOne(id);
  }
}
