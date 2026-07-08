import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventAudit } from './entities/event-audit.entity';
import { AuditConsumer } from './audit.consumer';

@Module({
  imports: [TypeOrmModule.forFeature([EventAudit])],
  controllers: [AuditController],
  providers: [AuditService, AuditConsumer],
})
export class AuditModule { }
