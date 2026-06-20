import { Clasification } from '../entities/enum/Clasification';
import { TypeOfMotorbike } from '../entities/enum/TypeOfMotorbike';

export class ResponseVehicleDto {
  id!: string;
  plate!: string;
  brand!: string;
  model!: string;
  color!: string;
  year!: number;
  clasification!: Clasification;
  numberOfDoors!: number;
  trunkCapacity!: number;
  cab!: string;
  payloadCapacity!: number;
  type!: TypeOfMotorbike;
}
