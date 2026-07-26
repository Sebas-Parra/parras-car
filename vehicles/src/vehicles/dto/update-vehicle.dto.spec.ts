import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateVehicleDto } from './update-vehicle.dto';

describe('UpdateVehicleDto validation', () => {
  it('accepts a partial car update', async () => {
    const dto = plainToInstance(UpdateVehicleDto, {
      tipo: 'car',
      datos: { brand: 'Toyota' },
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts a partial motorcycle update', async () => {
    const dto = plainToInstance(UpdateVehicleDto, {
      tipo: 'motocicleta',
      datos: { typeOfMotorbike: 'SPORT' },
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts a partial pickup truck update', async () => {
    const dto = plainToInstance(UpdateVehicleDto, {
      tipo: 'pickupTruck',
      datos: { cab: 'Crew' },
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts a partial update with an unrecognized tipo (falls back to base)', async () => {
    const dto = plainToInstance(UpdateVehicleDto, {
      tipo: 'boat',
      datos: {},
    });

    const errors = await validate(dto);
    const tipoError = errors.find((e) => e.property === 'tipo');
    expect(tipoError).toBeDefined();
  });

  it('normalizes tipo case-insensitively', async () => {
    const dto = plainToInstance(UpdateVehicleDto, {
      tipo: 'CAR',
      datos: { brand: 'Toyota' },
    });

    expect(dto.tipo).toBe('car');
  });
});
