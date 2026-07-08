import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'event_audit' })
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

    @Column({ type: 'varchar', length: 25, nullable: true })
    username!: string

    @Column({ type: 'varchar', length: 15, nullable: true })
    rol?: string

    @Column({ type: 'varchar', length: 15, nullable: true })
    ip?: string

    @Column({ type: 'varchar', length: 17, nullable: true })
    mac?: string

    @Column()
    timestamp!: Date
}
