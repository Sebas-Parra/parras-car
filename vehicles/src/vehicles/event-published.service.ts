import {
    Injectable,
    Logger,
    OnModuleInit,
    OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';

export interface AuditEvent {
    servicio: string;
    accion: string;
    entidad: string;
    entidadId?: string;
    datos?: any;
    usuario?: string;
    ip?: string;
}

@Injectable()
export class EventPublisher implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(EventPublisher.name);
    private connection: any = null; // any para evitar conflictos de tipos
    private channel: any = null;
    private exchange: string;
    private routingKey: string;
    private isConnected = false;
    private connectionPromise: Promise<void> | null = null;
    private reconnectTimeout: NodeJS.Timeout | null = null;

    constructor(private configService: ConfigService) {
        this.exchange =
            this.configService.get('RABBITMQ_EXCHANGE') ?? 'audit_exchange';
        this.routingKey =
            this.configService.get('RABBITMQ_ROUTING_KEY') ?? 'audit.event';
    }

    async onModuleInit() {
        await this.connect();
    }

    private async connect(): Promise<void> {
        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        this.connectionPromise = this.doConnect();
        try {
            await this.connectionPromise;
        } finally {
            this.connectionPromise = null;
        }
    }

    private async doConnect(): Promise<void> {
        const host = this.configService.get('RABBITMQ_HOST');
        const port = this.configService.get('RABBITMQ_PORT');
        const user = this.configService.get('RABBITMQ_USER');
        const pass = this.configService.get('RABBITMQ_PASSWORD');
        const url = `amqp://${user}:${pass}@${host}:${port}`;

        try {
            this.connection = await amqp.connect(url);
            this.channel = await this.connection.createChannel();
            await this.channel.assertExchange(this.exchange, 'topic', {
                durable: true,
            });
            this.isConnected = true;
            this.logger.log('✅ Conectado a RabbitMQ para publicación de eventos');

            // Manejar cierre inesperado
            this.connection.on('close', () => {
                this.logger.warn(
                    '⚠️ Conexión a RabbitMQ cerrada, intentando reconectar...',
                );
                this.isConnected = false;
                this.channel = null;
                this.connection = null;
                this.scheduleReconnect();
            });

            this.connection.on('error', (err: any) => {
                this.logger.error(`❌ Error en conexión RabbitMQ: ${err.message}`);
                this.isConnected = false;
                this.channel = null;
                this.connection = null;
                this.scheduleReconnect();
            });
        } catch (error) {
            this.isConnected = false;
            const errorMessage =
                error instanceof Error ? error.message : 'Error desconocido';
            this.logger.error(`❌ Error conectando a RabbitMQ: ${errorMessage}`);
            this.scheduleReconnect();
        }
    }

    private scheduleReconnect() {
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = setTimeout(() => {
            this.logger.log('Intentando reconectar a RabbitMQ...');
            this.connect();
        }, 5000);
    }

    async publish(event: AuditEvent): Promise<void> {
        // Si no está conectado, intenta conectar (espera hasta 5s)
        if (!this.isConnected || !this.channel) {
            this.logger.warn('⏳ Canal no establecido, intentando conectar...');
            await this.connect();

            if (!this.isConnected || !this.channel) {
                this.logger.error(
                    '❌ No se pudo establecer conexión con RabbitMQ, evento no publicado',
                );
                return;
            }
        }

        try {
            const message = Buffer.from(JSON.stringify(event));
            this.channel.publish(this.exchange, this.routingKey, message, {
                persistent: true,
            });
            this.logger.debug(
                `📤 Evento publicado: ${event.accion} en ${event.servicio}`,
            );
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : 'Error desconocido';
            this.logger.error(`❌ Error publicando evento: ${errorMessage}`);
            this.isConnected = false;
            this.channel = null;
        }
    }

    async onModuleDestroy() {
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        try {
            if (this.channel) await this.channel.close();
            if (this.connection) await this.connection.close();
        } catch (error) {
            // Ignoramos errores al cerrar
        }
        this.logger.log('Conexión a RabbitMQ cerrada');
    }
}
