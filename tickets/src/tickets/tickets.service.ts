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

// Tarifa por hora o fracción según el tipo de vehículo (USD).
const HOURLY_RATES: Record<string, number> = {
  car: Number(process.env.RATE_CAR ?? 1.0),
  motocicleta: Number(process.env.RATE_MOTORCYCLE ?? 0.5),
  pickupTruck: Number(process.env.RATE_PICKUP ?? 1.5),
};
// Tarifa de respaldo si el tipo del vehículo es desconocido.
const DEFAULT_RATE = Number(process.env.TICKET_PRICE ?? 1.0);
const HOUR_MS = 60 * 60 * 1000;

function rateForTipo(tipo?: string): number {
  return (tipo && HOURLY_RATES[tipo]) || DEFAULT_RATE;
}

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    private readonly zonesClient: ZonesClient,
    private readonly vehiclesClient: VehiclesClient,
    private readonly assignmentsClient: AssignmentsClient,
  ) {}

  async create(
    dto: CreateTicketDto,
    idEmpleado: string,
    authHeader: string,
  ): Promise<Ticket> {
    const vehicle = await this.vehiclesClient.findByPlate(dto.placa, authHeader);
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

    const place = await this.zonesClient.findPlaceById(dto.idEspacio, authHeader);
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
      tipoVehiculo: vehicle.tipo,
      tarifaHora: rateForTipo(vehicle.tipo),
      idUsuario: assignment.user_id,
      idEmpleadoIngreso: idEmpleado,
      fechaHoraIngreso,
      estado: EstadoTicket.ACTIVO,
      valorRecaudado: 0,
    });
    const saved = await this.ticketRepository.save(ticket);

    try {
      await this.zonesClient.setStatus(place.id, 'OCCUPIED', authHeader);
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

  async pay(id: string, idEmpleado: string, authHeader: string): Promise<Ticket> {
    const ticket = await this.findOne(id);
    if (ticket.estado !== EstadoTicket.ACTIVO) {
      throw new ConflictException(
        `El ticket '${ticket.codigo}' no está activo (estado: ${ticket.estado})`,
      );
    }
    const fechaHoraSalida = new Date();
    ticket.estado = EstadoTicket.PAGADO;
    ticket.fechaHoraSalida = fechaHoraSalida;
    ticket.valorRecaudado = this.calcularValor(ticket, fechaHoraSalida);
    ticket.idEmpleadoPago = idEmpleado;
    const saved = await this.ticketRepository.save(ticket);
    await this.zonesClient.setStatus(ticket.idEspacio, 'AVAILABLE', authHeader);
    return saved;
  }

  async cancel(id: string, idEmpleado: string, authHeader: string): Promise<Ticket> {
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
    await this.zonesClient.setStatus(ticket.idEspacio, 'AVAILABLE', authHeader);
    return saved;
  }

  // Cobro por hora o fracción: se factura la hora completa apenas se inicia.
  // p.ej. 1 min → 1 hora, 61 min → 2 horas. Mínimo 1 hora.
  private calcularValor(ticket: Ticket, salida: Date): number {
    const tarifa =
      Number(ticket.tarifaHora) || rateForTipo(ticket.tipoVehiculo);
    const elapsedMs = salida.getTime() - ticket.fechaHoraIngreso.getTime();
    const horas = Math.max(1, Math.ceil(elapsedMs / HOUR_MS));
    return Math.round(tarifa * horas * 100) / 100;
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
