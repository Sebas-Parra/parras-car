import {
  ConflictException,
  ForbiddenException,
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
import { SseService } from 'src/sse/sse.services';

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

const PLACE_TYPE_LABELS: Record<string, string> = {
  CAR: 'auto',
  BIKE: 'moto',
  BUS: 'bus',
};

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  car: 'auto',
  motocicleta: 'motocicleta',
  pickupTruck: 'camioneta',
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

export interface Requester {
  userId: string;
  roles: string[];
}

// Un cliente (sin ningún rol de staff) solo puede ver sus propios tickets.
const STAFF_ROLES = ['recaudador', 'admin', 'root'];
const isClienteOnly = (roles: string[]) => !roles.some((r) => STAFF_ROLES.includes(r));

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    private readonly zonesClient: ZonesClient,
    private readonly vehiclesClient: VehiclesClient,
    private readonly assignmentsClient: AssignmentsClient,
    private readonly eventPublisher: EventPublisher,
    private readonly sseService: SseService,
  ) { }

  private async emitEvent(
    accion: string,
    ticket: Ticket,
    actingUser: ActingUser,
    ip?: string,
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
      ip,
    };
    await this.eventPublisher.publish(event);
  }

  async create(
    dto: CreateTicketDto,
    idEmpleado: string,
    authHeader: string,
    actingUser: ActingUser,
    ip?: string,
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
      const placeLabel = PLACE_TYPE_LABELS[place.type] ?? place.type;
      const vehicleLabel = vehicle.tipo
        ? VEHICLE_TYPE_LABELS[vehicle.tipo] ?? vehicle.tipo
        : 'desconocido';
      const allowedLabels = allowedTipos
        .map((t) => VEHICLE_TYPE_LABELS[t] ?? t)
        .join(' o ');
      throw new ConflictException(
        `El espacio '${place.code}' es para vehículos de tipo ${placeLabel} ` +
        `y no admite vehículos de tipo ${vehicleLabel}` +
        (allowedLabels ? ` (permitido: ${allowedLabels})` : ''),
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

    await this.emitEvent('CREATE', saved, actingUser, ip);
    await this.sseService.emitEvent('espacio-actualizado', {
      id: saved.idEspacio,
      codigo: saved.codigoEspacio,
      estado: 'OCCUPIED',
      evento: 'ticket-creado',
      placa: saved.placa,
      tipoVehiculo: saved.tipoVehiculo,
      tarifaHora: saved.tarifaHora,
      codigoTicket: saved.codigo,
    });
    return saved;
  }

  async findAll(
    page: number,
    pageSize: number,
    estado: EstadoTicket | undefined,
    requester: Requester,
    idUsuario?: string,
  ): Promise<{ data: Ticket[]; total: number; page: number; pageSize: number }> {
    // Un cliente solo puede ver lo suyo (se ignora cualquier idUsuario que
    // mande); el staff puede filtrar por un usuario puntual, ej. para
    // verificar tickets activos de otro usuario antes de desactivarlo.
    const ownerFilter = isClienteOnly(requester.roles)
      ? { idUsuario: requester.userId }
      : idUsuario
        ? { idUsuario }
        : {};

    // Con filtro por estado (ej. ACTIVO) no paginamos: lo usan otras páginas
    // del dashboard para saber qué vehículos/espacios están ocupados ahora
    // mismo, un conjunto acotado por la capacidad real de estacionamiento,
    // a diferencia del historial completo de tickets.
    if (estado) {
      const data = await this.ticketRepository.find({
        where: { estado, ...ownerFilter },
        order: { fechaHoraIngreso: 'DESC' },
      });
      return { data, total: data.length, page: 1, pageSize: data.length };
    }

    const [data, total] = await this.ticketRepository.findAndCount({
      where: ownerFilter,
      order: { fechaHoraIngreso: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { data, total, page, pageSize };
  }

  private async findTicketOrFail(id: string): Promise<Ticket> {
    const ticket = await this.ticketRepository.findOne({ where: { id } });
    if (!ticket) {
      throw new NotFoundException(`Ticket con id '${id}' no encontrado`);
    }
    return ticket;
  }

  async findOne(id: string, requester: Requester): Promise<Ticket> {
    const ticket = await this.findTicketOrFail(id);
    if (isClienteOnly(requester.roles) && ticket.idUsuario !== requester.userId) {
      throw new ForbiddenException('No puedes consultar tickets de otro usuario.');
    }
    return ticket;
  }

  async pay(
    id: string,
    idEmpleado: string,
    authHeader: string,
    actingUser: ActingUser,
    ip?: string,
  ): Promise<Ticket> {
    const ticket = await this.findTicketOrFail(id);
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
    await this.emitEvent('UPDATE', saved, actingUser, ip);
    await this.sseService.emitEvent('espacio-actualizado', {
      id: saved.idEspacio,
      estado: 'AVAILABLE',
      evento: 'ticket-pagado',
      codigo: saved.codigo,
      placa: saved.placa,
      valor: saved.valorRecaudado,
    });
    return saved;
  }

  async cancel(
    id: string,
    idEmpleado: string,
    authHeader: string,
    actingUser: ActingUser,
    ip?: string,
  ): Promise<Ticket> {
    const ticket = await this.findTicketOrFail(id);
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
    await this.emitEvent('DELETE', saved, actingUser, ip);
    await this.sseService.emitEvent('espacio-actualizado', {
      id: saved.idEspacio,
      estado: 'AVAILABLE',
      evento: 'ticket-cancelado',
      codigo: saved.codigo,
      placa: saved.placa,
    });
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
