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
import { AuditEvent, EventPublisher } from './event-published.service';

// Tarifa base por hora o fracción según el TIPO DE ESPACIO (USD). La tarifa
// no depende del vehículo: una camioneta usa un espacio CAR y paga como CAR.
// Configurable por variables de entorno.
const PLACE_BASE_RATES: Record<string, number> = {
  CAR: Number(process.env.PLACE_RATE_CAR ?? 1.0),
  BIKE: Number(process.env.PLACE_RATE_BIKE ?? 0.5),
  BUS: Number(process.env.PLACE_RATE_BUS ?? 2.0),
};

// Multiplicador de la tarifa según el TIPO DE ZONA. Configurable por env.
const ZONE_MULTIPLIERS: Record<string, number> = {
  REGULAR: Number(process.env.ZONE_MULT_REGULAR ?? 1),
  VIP: Number(process.env.ZONE_MULT_VIP ?? 5),
  INTERNAL: Number(process.env.ZONE_MULT_INTERNAL ?? 3),
  EXTERNAL: Number(process.env.ZONE_MULT_EXTERNAL ?? 2),
  PREFERENTIAL: Number(process.env.ZONE_MULT_PREFERENTIAL ?? 0.5),
};

// Tarifa de respaldo si el tipo de espacio es desconocido.
const DEFAULT_RATE = Number(process.env.TICKET_PRICE ?? 1.0);
const HOUR_MS = 60 * 60 * 1000;

// Qué tipos de vehículo admite cada tipo de espacio. Un espacio CAR es más
// grande, así que acepta autos y camionetas; el BIKE solo motos. BUS se ignora
// por ahora (sin tipos livianos compatibles).
const PLACE_VEHICLE_COMPAT: Record<string, string[]> = {
  CAR: ['car', 'pickupTruck'],
  BIKE: ['motocicleta'],
  BUS: [],
};

// tarifa = base(tipoEspacio) × multiplicador(tipoZona)
function computeRate(tipoEspacio?: string, tipoZona?: string): number {
  const base =
    (tipoEspacio && PLACE_BASE_RATES[tipoEspacio]) || DEFAULT_RATE;
  const mult = (tipoZona && ZONE_MULTIPLIERS[tipoZona]) || 1;
  return Math.round(base * mult * 100) / 100;
}

export interface ActingUser {
  username: string;
  roles: string[];
}

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    private readonly zonesClient: ZonesClient,
    private readonly vehiclesClient: VehiclesClient,
    private readonly assignmentsClient: AssignmentsClient,
    private readonly eventPublisher: EventPublisher,
  ) {}

  private async emitEvent(
    accion: string,
    ticket: Ticket,
    actingUser: ActingUser,
    datosExtra?: any,
  ) {
    const event: AuditEvent = {
      servicio: 'ms-tickets',
      accion,
      entidad: 'TICKET',
      entidadId: ticket.id,
      datos: { ...ticket, ...datosExtra },
      usuario: actingUser.username,
      rol: actingUser.roles[0],
    };
    await this.eventPublisher.publish(event);
  }

  async create(
    dto: CreateTicketDto,
    idEmpleado: string,
    authHeader: string,
    actingUser: ActingUser,
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

    const allowedTipos = PLACE_VEHICLE_COMPAT[place.type] ?? [];
    if (!vehicle.tipo || !allowedTipos.includes(vehicle.tipo)) {
      throw new ConflictException(
        `El espacio '${place.code}' es de tipo ${place.type} y no admite ` +
          `vehículos de tipo '${vehicle.tipo ?? 'desconocido'}'`,
      );
    }

    // La tarifa depende solo de zones: tipo de espacio × tipo de zona.
    const zone = await this.zonesClient.findZoneById(place.idZone, authHeader);
    const tarifaHora = computeRate(place.type, zone?.type);

    const fechaHoraIngreso = new Date();
    const codigo = await this.generateUniqueCode(place.code, fechaHoraIngreso);

    const ticket = this.ticketRepository.create({
      codigo,
      idEspacio: place.id,
      codigoEspacio: place.code,
      placa: dto.placa,
      idVehiculo: vehicle.id,
      tipoVehiculo: vehicle.tipo,
      tipoEspacio: place.type,
      tipoZona: zone?.type,
      tarifaHora,
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

    await this.emitEvent('CREATE', saved, actingUser);
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

  async pay(
    id: string,
    idEmpleado: string,
    authHeader: string,
    actingUser: ActingUser,
  ): Promise<Ticket> {
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
    await this.emitEvent('UPDATE', saved, actingUser);
    return saved;
  }

  async cancel(
    id: string,
    idEmpleado: string,
    authHeader: string,
    actingUser: ActingUser,
  ): Promise<Ticket> {
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
    await this.emitEvent('DELETE', saved, actingUser);
    return saved;
  }

  // Cobro por hora o fracción: se factura la hora completa apenas se inicia.
  // p.ej. 1 min → 1 hora, 61 min → 2 horas. Mínimo 1 hora.
  private calcularValor(ticket: Ticket, salida: Date): number {
    const tarifa =
      Number(ticket.tarifaHora) ||
      computeRate(ticket.tipoEspacio, ticket.tipoZona);
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
