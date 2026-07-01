import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AssignmentsClient } from './clients/assignments.client';
import { VehiclesClient } from './clients/vehicles.client';
import { ZonesClient } from './clients/zones.client';
import { Ticket } from './entities/ticket.entity';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket]), AuthModule],
  controllers: [TicketsController],
  providers: [TicketsService, ZonesClient, VehiclesClient, AssignmentsClient],
  exports: [TicketsService],
})
export class TicketsModule {}
