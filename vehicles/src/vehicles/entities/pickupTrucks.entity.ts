import { ChildEntity, Column } from 'typeorm';
import { Vehicle } from './vehicle.entity';

@ChildEntity('pickupTruck')
export class PickupTruck extends Vehicle {
  @Column()
  payloadCapacity!: number;

  @Column()
  cab!: string;

  get tipo(): string {
    return 'pickupTruck';
  }
}
