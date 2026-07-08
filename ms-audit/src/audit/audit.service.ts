import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateAuditEventDto } from './dto/create-audit-event.dto';
import { Repository } from 'typeorm';
import { EventAudit } from './entities/event-audit.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(EventAudit)
    private auditRepo: Repository<EventAudit>,
  ) { }

  async create(dto: CreateAuditEventDto): Promise<EventAudit> {
    const newEvent = this.auditRepo.create({
      service: dto.servicio,
      action: dto.accion,
      entity: dto.entidad,
      datos: dto.datos,
      username: dto.usuario,
      rol: dto.rol,
      ip: dto.ip,
      mac: dto.mac,
      timestamp: new Date(),
    });

    return this.auditRepo.save(newEvent);
  }

  async findAll(): Promise<EventAudit[]> {
    return this.auditRepo.find({ order: { timestamp: 'DESC' } });
  }

  async findOne(id: string): Promise<EventAudit | null> {
    return this.auditRepo.findOne({ where: { id } });
  }
}
