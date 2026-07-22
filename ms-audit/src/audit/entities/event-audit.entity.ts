import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'event_audit' })
@Index(['service', 'entity', 'timestamp'])
export class EventAudit {
    @PrimaryGeneratedColumn('uuid')
    id!: string

    @Column({ type: 'varchar', length: 20 })
    service!: string

    @Column({ type: 'varchar', length: 15 }) //CRUD
    action!: string

    @Column({ type: 'varchar', length: 30 })
    entity!: string

    @Column({ type: 'jsonb', nullable: true })
    datos?: any

    @Column({ type: 'varchar', length: 25, nullable: false })
    username!: string

    @Column({ type: 'varchar', length: 15, nullable: false })
    rol!: string

    @Column({ type: 'varchar', length: 15, nullable: false })
    ip!: string

    @Column({ type: 'varchar', length: 17, nullable: true })
    mac?: string

    @Column()
    timestamp!: Date

    @Column({ type: 'timestamptz', nullable: true })
    eventTimestamp?: Date
}
