import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm/browser/repository/Repository.js';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { Vehicle } from './entities/vehicle.entity';
import { FactoryVehiculos } from './factory/factory-vehicle';

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
      throw new Error(
        `Vehicle with plate ${createVehicleDto.datos.plate} already exists`,
      );
    }
    const vehicle = FactoryVehiculos.create(createVehicleDto);
    return this.repositoryVehicle.save(vehicle);
  }

  findAll(): Promise<Vehicle[]> {
    return this.repositoryVehicle.find();
  }

  async findOne(id: string): Promise<Vehicle> {
    const exist = await this.repositoryVehicle.findOne({ where: { id } });
    if (!exist) {
      throw new Error(`Vehicle with id ${id} not found`);
    }
    return exist;
  }

  async update(id: string, updateVehicleDto: UpdateVehicleDto): Promise<Vehicle> {
    const vehicle = await this.findOne(id);
    Object.assign(vehicle, updateVehicleDto);
    return this.repositoryVehicle.save(vehicle);
  }

  async remove(id: string): Promise<void> {
    const vehicle = await this.findOne(id);
    await this.repositoryVehicle.remove(vehicle);
  }
}
