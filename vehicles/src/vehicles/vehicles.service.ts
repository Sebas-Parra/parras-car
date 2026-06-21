import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { Car } from './entities/car.entity';
import { Motorcycle } from './entities/motorcycle.entity';
import { PickupTruck } from './entities/pickupTrucks.entity';
import { Vehicle } from './entities/vehicle.entity';
import { FactoryVehiculos } from './factory/factory-vehicle';

const TIPO_ENTITY_MAP: Record<string, new (...args: unknown[]) => Vehicle> = {
  car: Car,
  motocicleta: Motorcycle,
  pickupTruck: PickupTruck,
};

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle)
    private repositoryVehicle: Repository<Vehicle>,
  ) {}

  async create(createVehicleDto: CreateVehicleDto): Promise<Vehicle> {
    const exist = await this.repositoryVehicle.findOne({
      where: { plate: createVehicleDto.datos.plate },
    });
    if (exist) {
      throw new ConflictException(
        `Ya existe un vehículo con la placa '${createVehicleDto.datos.plate}'`,
      );
    }
    const vehicle = FactoryVehiculos.create(createVehicleDto);
    return this.repositoryVehicle.save(vehicle);
  }

  findAll(): Promise<Vehicle[]> {
    return this.repositoryVehicle.find({ where: { active: true } });
  }

  async findOne(id: string): Promise<Vehicle> {
    const vehicle = await this.repositoryVehicle.findOne({ where: { id } });
    if (!vehicle) {
      throw new NotFoundException(`Vehículo con id '${id}' no encontrado`);
    }
    return vehicle;
  }

  async update(id: string, updateVehicleDto: UpdateVehicleDto): Promise<Vehicle> {
    const vehicle = await this.findOne(id);
    if (!vehicle.active) {
      throw new ConflictException(
        `No se puede actualizar un vehículo inactivo`,
      );
    }
    if (!(vehicle instanceof TIPO_ENTITY_MAP[updateVehicleDto.tipo])) {
      throw new ConflictException(
        `No se puede cambiar el tipo de vehículo`,
      );
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
    return this.repositoryVehicle.save(vehicle);
  }

  async remove(id: string): Promise<void> {
    const vehicle = await this.findOne(id);
    if (!vehicle.active) {
      throw new ConflictException(`El vehículo ya está inactivo`);
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
