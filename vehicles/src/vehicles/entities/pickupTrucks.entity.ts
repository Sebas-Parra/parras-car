import { Column } from 'typeorm';
import { Vehicle } from './vehicle.entity';

export class PickupTruck extends Vehicle {
  @Column()
  payloadCapacity!: number;
  @Column()
  cab!: string;

  getType(): string {
    return 'PickupTruck';
  }
}
