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

class BaseVehicleDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{3}-\d{4}$/, {
    message: 'Plate must be in the format ABC-1234',
  })
  plate!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(2, {
    message: 'Brand must be at least 2 characters long',
  })
  @MaxLength(30, {
    message: 'Brand must be at most 30 characters long',
  })
  @Matches(/^[\p{L}\s-]+$/u, {
    message:
      'Brand can only contain letters, spaces, and hyphens (e.g. Citroën, Mercedes-Benz)',
  })
  brand!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(1, {
    message: 'Model must be at least 1 character long',
  })
  @MaxLength(150, {
    message: 'Model must be at most 150 characters long',
  })
  @Matches(/^[\p{L}\p{N}\s-]+$/u, {
    message:
      'Model can only contain letters, numbers, spaces, and hyphens (e.g. CX-5, F-150, 3)',
  })
  model!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(2, {
    message: 'Color must be at least 2 characters long',
  })
  @MaxLength(50, {
    message: 'Color must be at most 50 characters long',
  })
  @Matches(/^[\p{L}\s-]+$/u, {
    message:
      'Color can only contain letters, spaces, and hyphens (e.g. Blue, Azul Marino, Gris-Perla)',
  })
  color!: string;

  @IsNotEmpty()
  @IsInt({
    message: 'Year must be an integer',
  })
  @Min(1885, {
    message: 'Year must be greater than or equal to 1885',
  })
  @Max(new Date().getFullYear() + 1, {
    message: `Year must be less than or equal to ${new Date().getFullYear() + 1}`,
  })
  year!: number;

  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  @IsNotEmpty()
  @IsEnum(Clasification, {
    message: 'Clasification must be one of: ELECTRIC, HYBRID, GASOLINE, DIESEL',
  })
  clasification!: Clasification;
}

class CarDto extends BaseVehicleDto {
  @IsNotEmpty()
  @IsInt({
    message: 'Number of doors must be an integer',
  })
  @Min(2, {
    message: 'Number of doors must be at least 2',
  })
  @Max(6, {
    message: 'Number of doors must be at most 6',
  })
  numberOfDoors!: number;

  @IsNotEmpty()
  @IsNumber(
    {},
    {
      message: 'Trunk capacity must be a number',
    },
  )
  @Min(0, {
    message: 'Trunk capacity must be greater than or equal to 0 liters',
  })
  @Max(2000, {
    message: 'Trunk capacity must be less than or equal to 2000 liters',
  })
  trunkCapacity!: number;
}

class MotorcycleDto extends BaseVehicleDto {
  @IsNotEmpty()
  @Matches(/^[A-Z]{2}-\d{3}[A-Z]$/, {
    message: 'Plate must be in the format AB-123C',
  })
  declare plate: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  @IsNotEmpty()
  @IsEnum(TypeOfMotorbike, {
    message:
      'Type of motorbike must be one of: ENDURO, SPORT, CRUISER, SCOOTER, TOURING',
  })
  typeOfMotorbike!: TypeOfMotorbike;
}

class PickupTruckDto extends BaseVehicleDto {
  @IsNumber(
    {},
    {
      message: 'Trunk capacity must be a number',
    },
  )
  @IsNotEmpty()
  @IsNumber(
    {},
    {
      message: 'Payload capacity must be a number',
    },
  )
  @Min(0, {
    message: 'Payload capacity must be greater than or equal to 0 kg',
  })
  @Max(50000, {
    message: 'Payload capacity must be less than or equal to 50000 kg',
  })
  payloadCapacity!: number;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @Matches(/^[\p{L}\s-]+$/u, {
    message:
      'Cab type can only contain letters, spaces, and hyphens (e.g. Regular, Extended, Crew)',
  })
  cab!: string;
}

export class CreateVehicleDto {
  @IsIn(['car', 'motocicleta', 'pickupTruck'])
  tipo!: string;

  @ValidateNested()
  @Type((opts) => {
    const object = opts?.object as CreateVehicleDto;
    if (!object) return BaseVehicleDto;

    switch (object.tipo) {
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
