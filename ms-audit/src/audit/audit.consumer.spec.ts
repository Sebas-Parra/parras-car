import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { AuditConsumer } from './audit.consumer';
import { AuditService } from './audit.service';

jest.mock('amqplib');

describe('AuditConsumer', () => {
  let consumer: AuditConsumer;
  let channel: {
    assertExchange: jest.Mock;
    assertQueue: jest.Mock;
    bindQueue: jest.Mock;
    consume: jest.Mock;
    ack: jest.Mock;
    nack: jest.Mock;
  };

  const configValues: Record<string, string> = {
    RABBITMQ_HOST: 'localhost',
    RABBITMQ_PORT: '5672',
    RABBITMQ_USER: 'guest',
    RABBITMQ_PASSWORD: 'guest',
    RABBITMQ_QUEUE: 'audit_queue',
    RABBITMQ_EXCHANGE: 'audit_exchange',
    RABBITMQ_ROUTING_KEY: 'audit_event',
  };

  beforeEach(async () => {
    channel = {
      assertExchange: jest.fn(),
      assertQueue: jest.fn(),
      bindQueue: jest.fn(),
      consume: jest.fn(),
      ack: jest.fn(),
      nack: jest.fn(),
    };
    const connection = {
      createChannel: jest.fn().mockResolvedValue(channel),
      on: jest.fn(),
    };
    (amqp.connect as jest.Mock).mockResolvedValue(connection);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditConsumer,
        { provide: ConfigService, useValue: { get: (key: string) => configValues[key] } },
        { provide: AuditService, useValue: { create: jest.fn() } },
      ],
    }).compile();

    consumer = module.get<AuditConsumer>(AuditConsumer);
  });

  it('declares a dead-letter exchange and binds a DLQ to it', async () => {
    await consumer.onModuleInit();

    expect(channel.assertExchange).toHaveBeenCalledWith('audit_exchange.dlx', 'fanout', { durable: true });
    expect(channel.assertQueue).toHaveBeenCalledWith('audit_queue.dlq', { durable: true });
    expect(channel.bindQueue).toHaveBeenCalledWith('audit_queue.dlq', 'audit_exchange.dlx', '');
  });

  it('configures the main queue to dead-letter into the DLX', async () => {
    await consumer.onModuleInit();

    expect(channel.assertQueue).toHaveBeenCalledWith('audit_queue', {
      durable: true,
      arguments: { 'x-dead-letter-exchange': 'audit_exchange.dlx' },
    });
  });
});
