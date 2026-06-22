import { ChildEntity, Column } from 'typeorm';
import { TypeOfMotorbike } from './enum/TypeOfMotorbike';
import { Vehicle } from './vehicle.entity';

@ChildEntity('motorcycle')
export class Motorcycle extends Vehicle {
  @Column({ type: 'enum', enum: TypeOfMotorbike })
  typeOfMotorbike!: TypeOfMotorbike;
  get tipo(): string {
    return 'motocicleta';
  }
}
