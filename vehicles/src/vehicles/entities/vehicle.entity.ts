import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  TableInheritance,
} from 'typeorm';
import { Clasification } from './enum/Clasification';

@Entity()
@TableInheritance({ column: { type: 'varchar', name: 'type' } })
export abstract class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  plate!: string;

  @Column({ default: true })
  active!: boolean;

  @Column()
  brand!: string;

  @Column()
  model!: string;

  @Column()
  color!: string;

  @Column()
  year!: number;

  @Column({ type: 'enum', enum: Clasification })
  clasification!: Clasification;

  abstract get tipo(): string;

  toJSON(): Record<string, unknown> {
    const obj = Object.assign({}, this) as Record<string, unknown>;
    obj['tipo'] = this.tipo;
    return obj;
  }
}
