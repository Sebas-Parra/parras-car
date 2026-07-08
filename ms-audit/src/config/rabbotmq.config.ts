import { ConfigService } from '@nestjs/config';

export const getRabbitMQConfig = (config: ConfigService) => ({
    host: config.get('RABBITMQ_HOST'),
    port: +config.get('RABBITMQ_PORT'),
    username: config.get('RABBITMQ_USER'),
    password: config.get('RABBITMQ_PASSWORD'),
    queue: config.get('RABBITMQ_QUEUE'),
    exchange: config.get('RABBITMQ_EXCHANGE'),
    routingKey: config.get('RABBITMQ_ROUTING_KEY'),
});