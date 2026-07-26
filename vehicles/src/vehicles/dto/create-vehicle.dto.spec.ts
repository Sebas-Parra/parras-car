import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CarDto,
  MotorcycleDto,
  CreateVehicleDto,
  normalizeTipoVehiculo,
  TIPOS_VEHICULO,
} from './create-vehicle.dto';

const validCarPayload = {
  plate: 'PCP-2971',
  brand: 'Toyota',
  model: 'Corolla',
  color: 'Rojo',
  year: 2020,
  clasification: 'GASOLINE',
  numberOfDoors: 4,
  trunkCapacity: 300,
};

describe('CarDto validation', () => {
  it('accepts a fully valid payload', async () => {
    const dto = plainToInstance(CarDto, validCarPayload);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('uppercases a lowercase plate before validating instead of rejecting it', async () => {
    const dto = plainToInstance(CarDto, { ...validCarPayload, plate: 'pcp-2971' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.plate).toBe('PCP-2971');
  });

  it('rejects a plate with the wrong format', async () => {
    const dto = plainToInstance(CarDto, { ...validCarPayload, plate: '1234-ABC' });
    const errors = await validate(dto);
    const plateError = errors.find((e) => e.property === 'plate');
    expect(plateError).toBeDefined();
    expect(Object.values(plateError!.constraints ?? {})[0]).toContain('formato ABC-1234');
  });

  it('rejects special characters in model', async () => {
    const dto = plainToInstance(CarDto, { ...validCarPayload, model: 'Corolla!@#$%' });
    const errors = await validate(dto);
    const modelError = errors.find((e) => e.property === 'model');
    expect(modelError).toBeDefined();
    expect(Object.values(modelError!.constraints ?? {})[0]).toContain('solo puede contener letras');
  });

  it('rejects special characters in color', async () => {
    const dto = plainToInstance(CarDto, { ...validCarPayload, color: 'Rojo!@#$%' });
    const errors = await validate(dto);
    const colorError = errors.find((e) => e.property === 'color');
    expect(colorError).toBeDefined();
  });

  it('accepts accented letters in brand/model/color', async () => {
    const dto = plainToInstance(CarDto, { ...validCarPayload, brand: 'Citroën', color: 'Azul Marino' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('MotorcycleDto plate validation', () => {
  it('uppercases a lowercase plate before validating', async () => {
    const dto = plainToInstance(MotorcycleDto, {
      plate: 'ab-123c',
      brand: 'Honda',
      model: 'CBR',
      color: 'Negro',
      year: 2020,
      clasification: 'GASOLINE',
      typeOfMotorbike: 'sport',
    });
    const errors = await validate(dto);
    const plateError = errors.find((e) => e.property === 'plate');
    expect(plateError).toBeUndefined();
    expect(dto.plate).toBe('AB-123C');
  });
});

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
