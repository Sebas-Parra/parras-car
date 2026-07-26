import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CarDto, MotorcycleDto } from './create-vehicle.dto';

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
