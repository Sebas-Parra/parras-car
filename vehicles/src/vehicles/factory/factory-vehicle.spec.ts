import { BadRequestException } from '@nestjs/common';
import { FactoryVehiculos } from './factory-vehicle';
import { Car } from '../entities/car.entity';
import { Motorcycle } from '../entities/motorcycle.entity';
import { PickupTruck } from '../entities/pickupTrucks.entity';
import { CreateVehicleDto } from '../dto/create-vehicle.dto';

describe('FactoryVehiculos', () => {
  it('creates a Car when tipo is car', () => {
    const dto = {
      tipo: 'car',
      datos: { plate: 'ABC-123', numberOfDoors: 4, trunkCapacity: 400 },
    } as unknown as CreateVehicleDto;

    const result = FactoryVehiculos.create(dto);

    expect(result).toBeInstanceOf(Car);
    expect(result.tipo).toBe('car');
    expect((result as Car).numberOfDoors).toBe(4);
  });

  it('creates a Motorcycle when tipo is motocicleta', () => {
    const dto = {
      tipo: 'motocicleta',
      datos: { plate: 'AB-123C', typeOfMotorbike: 'SPORT' },
    } as unknown as CreateVehicleDto;

    const result = FactoryVehiculos.create(dto);

    expect(result).toBeInstanceOf(Motorcycle);
    expect(result.tipo).toBe('motocicleta');
  });

  it('creates a PickupTruck when tipo is pickupTruck', () => {
    const dto = {
      tipo: 'pickupTruck',
      datos: { plate: 'ABC-123', payloadCapacity: 1000, cab: 'Crew' },
    } as unknown as CreateVehicleDto;

    const result = FactoryVehiculos.create(dto);

    expect(result).toBeInstanceOf(PickupTruck);
    expect(result.tipo).toBe('pickupTruck');
  });

  it('throws BadRequestException for an unsupported tipo', () => {
    const dto = {
      tipo: 'boat',
      datos: {},
    } as unknown as CreateVehicleDto;

    expect(() => FactoryVehiculos.create(dto)).toThrow(BadRequestException);
  });
});
