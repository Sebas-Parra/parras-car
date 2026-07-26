import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { Vehicle } from './entities/vehicle.entity';
import { FactoryVehiculos } from './factory/factory-vehicle';
import { AuditEvent, EventPublisher } from './event-published.service';

const ASSIGNMENTS_URL = process.env.ASSIGNMENTS_SERVICE_URL ?? 'http://assignments:8001';

export interface ActingUser {
  userId: string;
  username: string;
  roles: string[];
}

@Injectable()
export class VehiclesService {
  private readonly logger = new Logger(VehiclesService.name);

  constructor(
    @InjectRepository(Vehicle)
    private repositoryVehicle: Repository<Vehicle>,
    private eventPublisher: EventPublisher
  ) { }

  // Método auxiliar para publicar eventos
  private async emitEvent(
    accion: string,
    vehiculo: Vehicle,
    actingUser: ActingUser,
    ip?: string,
    datosExtra?: any,
  ) {
    const event: AuditEvent = {
      servicio: 'ms-vehiculos',
      accion,
      entidad: 'VEHICULO',
      entidadId: vehiculo.id,
      datos: { ...vehiculo, ...datosExtra },
      usuario: actingUser.username,
      rol: actingUser.roles[0],
      ip,
    };
    await this.eventPublisher.publish(event);
  }

  private async autoAssignToClient(vehicleId: string, userId: string) {
    try {
      const res = await fetch(`${ASSIGNMENTS_URL}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          vehicle_id: vehicleId,
        }),
      });
      if (!res.ok) {
        this.logger.error(`Failed to auto-assign vehicle ${vehicleId} to user ${userId}: ${res.statusText}`);
      } else {
        this.logger.log(`Vehicle ${vehicleId} auto-assigned to user ${userId}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error auto-assigning vehicle ${vehicleId}: ${errorMsg}`);
    }
  }

  async create(createVehicleDto: CreateVehicleDto, actingUser: ActingUser, ip?: string): Promise<Vehicle> {
    const exist = await this.repositoryVehicle.findOne({
      where: { plate: createVehicleDto.datos.plate },
    });
    if (exist) {
      throw new ConflictException(
        `Ya existe un vehículo con la placa '${createVehicleDto.datos.plate}'`,
      );
    }
    const vehicle = FactoryVehiculos.create(createVehicleDto);
    const saved = await this.repositoryVehicle.save(vehicle);
    await this.emitEvent('CREATE', saved, actingUser, ip);

    // Auto-assign to client if role is 'cliente'
    if (actingUser.roles.includes('cliente')) {
      await this.autoAssignToClient(saved.id, actingUser.userId);
    }

    return saved
  }

  async findAll(
    actingUser: ActingUser | undefined,
    page: number,
    pageSize: number,
  ): Promise<{ data: Vehicle[]; total: number; page: number; pageSize: number }> {
    const skip = (page - 1) * pageSize;

    // If user is 'cliente', only return their assigned vehicles
    if (actingUser?.roles.includes('cliente')) {
      this.logger.debug(`Filtering vehicles for cliente user: ${actingUser.username}`);
      try {
        // Endpoint de solo-IDs (no llama de vuelta a vehicles) — evita el ciclo
        // vehicles -> assignments -> vehicles que dispara /fleet vía findOne().
        const fleetRes = await fetch(`${ASSIGNMENTS_URL}/assignments/${actingUser.userId}/vehicle-ids`, {
          headers: { 'Content-Type': 'application/json' },
        });

        if (!fleetRes.ok) {
          this.logger.error(
            `Failed to fetch fleet for user ${actingUser.userId}: ${fleetRes.statusText}`,
          );
          throw new ServiceUnavailableException(
            'No se pudo obtener la flota de vehículos. Intenta de nuevo.',
          );
        }

        const fleet = await fleetRes.json();
        const vehicleIds: string[] = fleet.vehicle_ids || [];

        if (vehicleIds.length === 0) {
          this.logger.debug(`User ${actingUser.username} has no assigned vehicles`);
          return { data: [], total: 0, page, pageSize };
        }

        this.logger.debug(
          `Returning ${vehicleIds.length} vehicles for user ${actingUser.username}`,
        );
        const [data, total] = await this.repositoryVehicle.findAndCount({
          where: { id: In(vehicleIds) },
          skip,
          take: pageSize,
        });
        return { data, total, page, pageSize };
      } catch (error) {
        if (error instanceof ServiceUnavailableException) {
          throw error;
        }
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Error fetching client fleet for ${actingUser.userId}: ${errorMsg}`);
        throw new ServiceUnavailableException(
          'Error al obtener vehículos. El servicio de asignaciones no está disponible.',
        );
      }
    }

    // Admins and others see all vehicles
    this.logger.debug(`Returning all vehicles for user: ${actingUser?.username}`);
    const [data, total] = await this.repositoryVehicle.findAndCount({ skip, take: pageSize });
    return { data, total, page, pageSize };
  }

  // Búsqueda directa por placa (única) — usada por tickets al emitir un
  // ticket. Antes se resolvía trayendo TODO el catálogo y filtrando en
  // memoria; con /vehicles paginado eso se rompía pasado el vehículo #20.
  async findByPlate(plate: string): Promise<Vehicle | null> {
    return this.repositoryVehicle.findOne({ where: { plate } });
  }

  async findOne(id: string, actingUser?: ActingUser): Promise<Vehicle> {
    const vehicle = await this.repositoryVehicle.findOne({ where: { id } });
    if (!vehicle) {
      this.logger.warn(`Vehicle ${id} not found in database`);
      throw new NotFoundException(`Vehículo con id '${id}' no encontrado`);
    }

    // If user is 'cliente', check if vehicle belongs to them
    if (actingUser?.roles.includes('cliente')) {
      this.logger.debug(`Validating access to vehicle ${id} for cliente user ${actingUser.username}`);
      try {
        // Endpoint de solo-IDs (no llama de vuelta a vehicles) — evita el ciclo
        // vehicles -> assignments -> vehicles.
        const fleetRes = await fetch(`${ASSIGNMENTS_URL}/assignments/${actingUser.userId}/vehicle-ids`, {
          headers: { 'Content-Type': 'application/json' },
        });

        if (!fleetRes.ok) {
          this.logger.error(
            `Failed to fetch fleet for user ${actingUser.userId}: ${fleetRes.statusText}`,
          );
          throw new ServiceUnavailableException(
            'No se pudo validar acceso al vehículo. Intenta de nuevo.',
          );
        }

        const fleet = await fleetRes.json();
        const vehicleIds: string[] = fleet.vehicle_ids || [];
        const hasAccess = vehicleIds.includes(id);

        if (!hasAccess) {
          this.logger.warn(
            `User ${actingUser.username} tried to access vehicle ${id} they don't own`,
          );
          throw new NotFoundException(`Vehículo con id '${id}' no encontrado`);
        }

        this.logger.debug(`Access granted to vehicle ${id} for user ${actingUser.username}`);
      } catch (error) {
        if (
          error instanceof NotFoundException ||
          error instanceof ServiceUnavailableException
        ) {
          throw error;
        }
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Error checking vehicle access for ${actingUser.userId}: ${errorMsg}`,
        );
        throw new ServiceUnavailableException(
          'Error al validar acceso. El servicio de asignaciones no está disponible.',
        );
      }
    }

    return vehicle;
  }

  async update(id: string, updateVehicleDto: UpdateVehicleDto): Promise<Vehicle> {
    const vehicle = await this.findOne(id);
    if (!vehicle.active) {
      throw new ConflictException(`No se puede actualizar un vehículo inactivo`);
    }
    if (vehicle.tipo !== updateVehicleDto.tipo) {
      throw new ConflictException(`No se puede cambiar el tipo de vehículo`);
    }
    const newPlate = updateVehicleDto.datos?.plate;
    if (newPlate && newPlate !== vehicle.plate) {
      const plateConflict = await this.repositoryVehicle.findOne({
        where: { plate: newPlate },
      });
      if (plateConflict) {
        throw new ConflictException(
          `Ya existe un vehículo con la placa '${newPlate}'`,
        );
      }
    }
    Object.assign(vehicle, updateVehicleDto.datos ?? {});
    try {
      return await this.repositoryVehicle.manager.save(vehicle);
    } catch (error) {
      if (error instanceof QueryFailedError) {
        throw new ConflictException(`Error al guardar el vehículo: ${(error as QueryFailedError).message}`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const vehicle = await this.findOne(id);
    if (!vehicle.active) {
      throw new ConflictException(`El vehículo ya está inactivo`);
    }
    const res = await fetch(`${ASSIGNMENTS_URL}/assignments/by-vehicle/${id}`);
    if (res.ok) {
      throw new ConflictException(
        'No se puede eliminar el vehículo porque tiene un propietario activo asignado',
      );
    }
    vehicle.active = false;
    await this.repositoryVehicle.save(vehicle);
  }

  async activate(id: string): Promise<Vehicle> {
    const vehicle = await this.findOne(id);
    vehicle.active = true;
    return this.repositoryVehicle.save(vehicle);
  }
}
