import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AssignmentsClient } from './clients/assignments.client';
import { VehiclesClient } from './clients/vehicles.client';
import { ZonesClient } from './clients/zones.client';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { EstadoTicket } from './entities/enum/estado-ticket.enum';
import { Ticket } from './entities/ticket.entity';

const TICKET_PRICE = Number(process.env.TICKET_PRICE ?? 1.0);

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    private readonly zonesClient: ZonesClient,
    private readonly vehiclesClient: VehiclesClient,
    private readonly assignmentsClient: AssignmentsClient,
  ) {}

  async create(dto: CreateTicketDto, idEmpleado: string): Promise<Ticket> {
    const vehicle = await this.vehiclesClient.findByPlate(dto.placa);
    if (!vehicle) {
      throw new NotFoundException(
        `No existe un vehículo con la placa '${dto.placa}'`,
      );
    }
    if (!vehicle.active) {
      throw new ConflictException(
        `El vehículo con placa '${dto.placa}' está inactivo`,
      );
    }

    const activeTicket = await this.ticketRepository.findOne({
      where: { placa: dto.placa, estado: EstadoTicket.ACTIVO },
    });
    if (activeTicket) {
      throw new ConflictException(
        `El vehículo con placa '${dto.placa}' ya tiene un ticket activo (${activeTicket.codigo})`,
      );
    }

    const assignment = await this.assignmentsClient.findActiveByVehicle(
      vehicle.id,
    );
    if (!assignment) {
      throw new ConflictException(
        `El vehículo con placa '${dto.placa}' no tiene un propietario asignado`,
      );
    }

    const place = await this.zonesClient.findPlaceById(dto.idEspacio);
    if (!place) {
      throw new NotFoundException(`Espacio '${dto.idEspacio}' no encontrado`);
    }
    if (!place.active || place.status !== 'AVAILABLE') {
      throw new ConflictException(
        `El espacio '${place.code}' no está disponible (estado: ${place.status})`,
      );
    }

    const fechaHoraIngreso = new Date();
    const codigo = await this.generateUniqueCode(place.code, fechaHoraIngreso);

    const ticket = this.ticketRepository.create({
      codigo,
      idEspacio: place.id,
      codigoEspacio: place.code,
      placa: dto.placa,
      idVehiculo: vehicle.id,
      idUsuario: assignment.user_id,
      idEmpleadoIngreso: idEmpleado,
      fechaHoraIngreso,
      estado: EstadoTicket.ACTIVO,
      valorRecaudado: 0,
    });
    const saved = await this.ticketRepository.save(ticket);

    try {
      await this.zonesClient.setStatus(place.id, 'OCCUPIED');
    } catch (error) {
      // Compensación: si zones no confirma la ocupación, no dejamos un
      // ticket "activo" sobre un espacio que sigue apareciendo disponible.
      await this.ticketRepository.delete(saved.id);
      throw error;
    }

    return saved;
  }

  findAll(): Promise<Ticket[]> {
    return this.ticketRepository.find();
  }

  async findOne(id: string): Promise<Ticket> {
    const ticket = await this.ticketRepository.findOne({ where: { id } });
    if (!ticket) {
      throw new NotFoundException(`Ticket con id '${id}' no encontrado`);
    }
    return ticket;
  }

  async pay(id: string, idEmpleado: string): Promise<Ticket> {
    const ticket = await this.findOne(id);
    if (ticket.estado !== EstadoTicket.ACTIVO) {
      throw new ConflictException(
        `El ticket '${ticket.codigo}' no está activo (estado: ${ticket.estado})`,
      );
    }
    ticket.estado = EstadoTicket.PAGADO;
    ticket.fechaHoraSalida = new Date();
    ticket.valorRecaudado = TICKET_PRICE;
    ticket.idEmpleadoPago = idEmpleado;
    const saved = await this.ticketRepository.save(ticket);
    await this.zonesClient.setStatus(ticket.idEspacio, 'AVAILABLE');
    return saved;
  }

  async cancel(id: string, idEmpleado: string): Promise<Ticket> {
    const ticket = await this.findOne(id);
    if (ticket.estado !== EstadoTicket.ACTIVO) {
      throw new ConflictException(
        `El ticket '${ticket.codigo}' no está activo (estado: ${ticket.estado})`,
      );
    }
    ticket.estado = EstadoTicket.ANULADO;
    ticket.fechaHoraSalida = new Date();
    ticket.idEmpleadoPago = idEmpleado;
    const saved = await this.ticketRepository.save(ticket);
    await this.zonesClient.setStatus(ticket.idEspacio, 'AVAILABLE');
    return saved;
  }

  private async generateUniqueCode(
    placeCode: string,
    date: Date,
  ): Promise<string> {
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;

    let codigo = `TCK-${placeCode}-${stamp}`;
    let suffix = 1;
    while (await this.ticketRepository.findOne({ where: { codigo } })) {
      codigo = `TCK-${placeCode}-${stamp}-${suffix++}`;
    }
    return codigo;
  }
}
