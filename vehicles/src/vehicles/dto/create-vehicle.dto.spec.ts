import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateVehicleDto,
  normalizeTipoVehiculo,
  TIPOS_VEHICULO,
} from './create-vehicle.dto';

describe('normalizeTipoVehiculo', () => {
  it('returns the canonical tipo when it matches case-insensitively', () => {
    expect(normalizeTipoVehiculo('CAR')).toBe('car');
    expect(normalizeTipoVehiculo('Motocicleta')).toBe('motocicleta');
  });

  it('returns the original value when it does not match a known tipo', () => {
    expect(normalizeTipoVehiculo('boat')).toBe('boat');
  });

  it('returns non-string values unchanged', () => {
    expect(normalizeTipoVehiculo(123)).toBe(123);
    expect(normalizeTipoVehiculo(undefined)).toBeUndefined();
  });
});

describe('CreateVehicleDto validation', () => {
  it('accepts a valid car payload', async () => {
    const dto = plainToInstance(CreateVehicleDto, {
      tipo: 'car',
      datos: {
        plate: 'ABC-1234',
        brand: 'Toyota',
        model: 'Corolla',
        color: 'Red',
        year: 2020,
        clasification: 'GASOLINE',
        numberOfDoors: 4,
        trunkCapacity: 400,
      },
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid motorcycle payload', async () => {
    const dto = plainToInstance(CreateVehicleDto, {
      tipo: 'motocicleta',
      datos: {
        plate: 'AB-123C',
        brand: 'Honda',
        model: 'CBR',
        color: 'Black',
        year: 2021,
        clasification: 'GASOLINE',
        typeOfMotorbike: 'SPORT',
      },
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts a valid pickup truck payload', async () => {
    const dto = plainToInstance(CreateVehicleDto, {
      tipo: 'pickupTruck',
      datos: {
        plate: 'ABC-1234',
        brand: 'Ford',
        model: 'F-150',
        color: 'Gray',
        year: 2019,
        clasification: 'DIESEL',
        payloadCapacity: 1000,
        cab: 'Crew',
      },
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects an unsupported tipo', async () => {
    const dto = plainToInstance(CreateVehicleDto, {
      tipo: 'boat',
      datos: {},
    });

    const errors = await validate(dto);
    const tipoError = errors.find((e) => e.property === 'tipo');
    expect(tipoError).toBeDefined();
  });

  it('rejects a car with an invalid plate format', async () => {
    const dto = plainToInstance(CreateVehicleDto, {
      tipo: 'car',
      datos: {
        plate: 'invalid',
        brand: 'Toyota',
        model: 'Corolla',
        color: 'Red',
        year: 2020,
        clasification: 'GASOLINE',
        numberOfDoors: 4,
        trunkCapacity: 400,
      },
    });

    const errors = await validate(dto, { validationError: { target: false } });
    const nested = errors.find((e) => e.property === 'datos');
    expect(nested?.children?.some((c) => c.property === 'plate')).toBe(true);
  });

  it('exposes the tipo list constant', () => {
    expect(TIPOS_VEHICULO).toEqual(['car', 'motocicleta', 'pickupTruck']);
  });
});
