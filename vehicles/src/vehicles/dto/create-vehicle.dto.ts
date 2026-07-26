import {
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { TypeOfMotorbike } from '../entities/enum/TypeOfMotorbike';
import { Clasification } from '../entities/enum/Clasification';

export const TIPOS_VEHICULO = ['car', 'motocicleta', 'pickupTruck'] as const;

export function normalizeTipoVehiculo(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const match = TIPOS_VEHICULO.find(
    (tipo) => tipo.toLowerCase() === value.toLowerCase(),
  );
  return match ?? value;
}

export class BaseVehicleDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{3}-\d{4}$/, {
    message: 'La placa debe tener el formato ABC-1234',
  })
  plate!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(2, {
    message: 'La marca debe tener al menos 2 caracteres',
  })
  @MaxLength(30, {
    message: 'La marca debe tener como máximo 30 caracteres',
  })
  @Matches(/^[\p{L}\s-]+$/u, {
    message:
      'La marca solo puede contener letras, espacios y guiones (ej. Citroën, Mercedes-Benz)',
  })
  brand!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(2, {
    message: 'El modelo debe tener al menos 2 caracteres',
  })
  @MaxLength(50, {
    message: 'El modelo debe tener como máximo 50 caracteres',
  })
  @Matches(/^[\p{L}\p{N}\s-]+$/u, {
    message:
      'El modelo solo puede contener letras, números, espacios y guiones (ej. CX-5, F-150, Corolla)',
  })
  model!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(2, {
    message: 'El color debe tener al menos 2 caracteres',
  })
  @MaxLength(50, {
    message: 'El color debe tener como máximo 50 caracteres',
  })
  @Matches(/^[\p{L}\s-]+$/u, {
    message:
      'El color solo puede contener letras, espacios y guiones (ej. Azul, Azul Marino, Gris Perla)',
  })
  color!: string;

  @IsNotEmpty()
  @IsInt({
    message: 'El año debe ser un número entero',
  })
  @Min(1885, {
    message: 'El año debe ser mayor o igual a 1885',
  })
  @Max(new Date().getFullYear() + 1, {
    message: `El año debe ser menor o igual a ${new Date().getFullYear() + 1}`,
  })
  year!: number;

  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  @IsNotEmpty()
  @IsEnum(Clasification, {
    message: 'La clasificación debe ser una de: ELECTRIC, HYBRID, GASOLINE, DIESEL',
  })
  clasification!: Clasification;
}

export class CarDto extends BaseVehicleDto {
  @IsNotEmpty()
  @IsInt({
    message: 'El número de puertas debe ser un número entero',
  })
  @Min(2, {
    message: 'El número de puertas debe ser al menos 2',
  })
  @Max(6, {
    message: 'El número de puertas debe ser como máximo 6',
  })
  numberOfDoors!: number;

  @IsNotEmpty()
  @IsNumber(
    {},
    {
      message: 'La capacidad del baúl debe ser un número',
    },
  )
  @Min(0, {
    message: 'La capacidad del baúl debe ser mayor o igual a 0 litros',
  })
  @Max(2000, {
    message: 'La capacidad del baúl debe ser menor o igual a 2000 litros',
  })
  trunkCapacity!: number;
}

export class MotorcycleDto extends BaseVehicleDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsNotEmpty()
  @Matches(/^[A-Z]{2}-\d{3}[A-Z]$/, {
    message: 'La placa debe tener el formato AB-123C',
  })
  declare plate: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  @IsNotEmpty()
  @IsEnum(TypeOfMotorbike, {
    message:
      'El tipo de motocicleta debe ser uno de: ENDURO, SPORT, CRUISER, SCOOTER, TOURING',
  })
  typeOfMotorbike!: TypeOfMotorbike;
}

export class PickupTruckDto extends BaseVehicleDto {
  @IsNumber(
    {},
    {
      message: 'La capacidad de carga debe ser un número',
    },
  )
  @IsNotEmpty()
  @IsNumber(
    {},
    {
      message: 'La capacidad de carga debe ser un número',
    },
  )
  @Min(0, {
    message: 'La capacidad de carga debe ser mayor o igual a 0 kg',
  })
  @Max(50000, {
    message: 'La capacidad de carga debe ser menor o igual a 50000 kg',
  })
  payloadCapacity!: number;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @Matches(/^[\p{L}\s-]+$/u, {
    message:
      'La cabina solo puede contener letras, espacios y guiones (ej. Regular, Extendida, Doble)',
  })
  cab!: string;
}

export class CreateVehicleDto {
  @Transform(({ value }) => normalizeTipoVehiculo(value))
  @IsIn(TIPOS_VEHICULO)
  tipo!: string;

  @ValidateNested()
  @Type((opts) => {
    const object = opts?.object as CreateVehicleDto;
    if (!object) return BaseVehicleDto;

    switch (normalizeTipoVehiculo(object.tipo)) {
      case 'car':
        return CarDto;
      case 'motocicleta':
        return MotorcycleDto;
      case 'pickupTruck':
        return PickupTruckDto;
      default:
        return BaseVehicleDto;
    }
  })
  datos!: CarDto | MotorcycleDto | PickupTruckDto;
}
