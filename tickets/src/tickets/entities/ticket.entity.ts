import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EstadoTicket } from './enum/estado-ticket.enum';

@Entity()
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  codigo!: string;

  @Index()
  @Column()
  idEspacio!: string;

  @Column()
  codigoEspacio!: string;

  @Index()
  @Column()
  placa!: string;

  @Column()
  idVehiculo!: string;

  // Tipo del vehículo capturado al ingreso (car | motocicleta | pickupTruck).
  // Determina la tarifa; se guarda para no depender de vehicles al cobrar.
  @Column({ nullable: true })
  tipoVehiculo?: string;

  // Tarifa por hora (o fracción) vigente al momento del ingreso. Se congela
  // aquí para que un cambio de tarifas no altere tickets ya emitidos.
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  tarifaHora!: number;

  @Column()
  idUsuario!: string;

  @Column()
  idEmpleadoIngreso!: string;

  @Column({ nullable: true })
  idEmpleadoPago?: string;

  @Column({ type: 'timestamptz' })
  fechaHoraIngreso!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  fechaHoraSalida?: Date;

  @Index()
  @Column({ type: 'enum', enum: EstadoTicket, default: EstadoTicket.ACTIVO })
  estado!: EstadoTicket;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  valorRecaudado!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
