import { ChildEntity, Column } from 'typeorm';
import { Vehicle } from './vehicle.entity';

@ChildEntity('pickupTruck')
export class PickupTruck extends Vehicle {
  @Column()
  payloadCapacity!: number;

  @Column()
  cab!: string;

  getType(): string {
    return 'PickupTruck';
  }
}
