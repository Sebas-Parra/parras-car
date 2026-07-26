import { ConfigService } from '@nestjs/config';
import { getRabbitMQConfig } from './rabbotmq.config';

describe('getRabbitMQConfig', () => {
  it('builds the RabbitMQ config from ConfigService values', () => {
    const values: Record<string, string> = {
      RABBITMQ_HOST: 'localhost',
      RABBITMQ_PORT: '5672',
      RABBITMQ_USER: 'guest',
      RABBITMQ_PASSWORD: 'guest',
      RABBITMQ_QUEUE: 'audit_queue',
      RABBITMQ_EXCHANGE: 'audit_exchange',
      RABBITMQ_ROUTING_KEY: 'audit_event',
    };
    const configService = { get: (key: string) => values[key] } as unknown as ConfigService;

    expect(getRabbitMQConfig(configService)).toEqual({
      host: 'localhost',
      port: 5672,
      username: 'guest',
      password: 'guest',
      queue: 'audit_queue',
      exchange: 'audit_exchange',
      routingKey: 'audit_event',
    });
  });
});
