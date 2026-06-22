import { IsIn, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';
import {
  BaseVehicleDto,
  CarDto,
  MotorcycleDto,
  PickupTruckDto,
  TIPOS_VEHICULO,
  normalizeTipoVehiculo,
} from './create-vehicle.dto';

class UpdateCarDto extends PartialType(CarDto) {}
class UpdateMotorcycleDto extends PartialType(MotorcycleDto) {}
class UpdatePickupTruckDto extends PartialType(PickupTruckDto) {}
class UpdateBaseVehicleDto extends PartialType(BaseVehicleDto) {}

export class UpdateVehicleDto {
  @Transform(({ value }) => normalizeTipoVehiculo(value))
  @IsIn(TIPOS_VEHICULO, {
    message: `tipo es obligatorio y debe ser uno de: ${TIPOS_VEHICULO.join(', ')}`,
  })
  tipo!: string;

  @ValidateNested()
  @Type((opts) => {
    const object = opts?.object as UpdateVehicleDto;
    if (!object) return UpdateBaseVehicleDto;

    switch (normalizeTipoVehiculo(object.tipo)) {
      case 'car':
        return UpdateCarDto;
      case 'motocicleta':
        return UpdateMotorcycleDto;
      case 'pickupTruck':
        return UpdatePickupTruckDto;
      default:
        return UpdateBaseVehicleDto;
    }
  })
  datos!: UpdateCarDto | UpdateMotorcycleDto | UpdatePickupTruckDto;
}
