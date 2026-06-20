import { BadRequestException } from '@nestjs/common';
import { CreateVehicleDto } from '../dto/create-vehicle.dto';
import { Car } from '../entities/car.entity';
import { Motorcycle } from '../entities/motorcycle.entity';
import { PickupTruck } from '../entities/pickupTrucks.entity';
import { Vehicle } from '../entities/vehicle.entity';

export class FactoryVehiculos {
  static create(dto: CreateVehicleDto): Vehicle {
    switch (dto.tipo) {
      case 'car': {
        const car = new Car();
        Object.assign(car, dto.datos);
        return car;
      }
      case 'motocicleta': {
        const motorcycle = new Motorcycle();
        Object.assign(motorcycle, dto.datos);
        return motorcycle;
      }
      case 'pickupTruck': {
        const pickupTruck = new PickupTruck();
        Object.assign(pickupTruck, dto.datos);
        return pickupTruck;
      }
      default:
        throw new BadRequestException(
          `Tipo de vehículo no soportado: ${dto.tipo}`,
        );
    }
  }
}
