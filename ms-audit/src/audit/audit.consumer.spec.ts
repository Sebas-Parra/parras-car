import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { AuditConsumer } from './audit.consumer';
import { AuditService } from './audit.service';

jest.mock('amqplib');

describe('AuditConsumer', () => {
  let consumer: AuditConsumer;
  let auditService: { create: jest.Mock };
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

    auditService = { create: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditConsumer,
        { provide: ConfigService, useValue: { get: (key: string) => configValues[key] } },
        { provide: AuditService, useValue: auditService },
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

  describe('message handling', () => {
    const validPayload = {
      servicio: 'ms-tickets',
      accion: 'CREATE',
      entidad: 'TICKET',
      usuario: 'juan.perez',
      rol: 'admin',
      ip: '203.0.113.5',
    };

    const getConsumeCallback = async () => {
      await consumer.onModuleInit();
      return channel.consume.mock.calls[0][1] as (msg: any) => Promise<void>;
    };

    it('dead-letters (does not requeue) a message that fails JSON parsing/DTO validation', async () => {
      const onMessage = await getConsumeCallback();
      const msg = { content: Buffer.from('not-valid-json') };

      await onMessage(msg);

      expect(channel.nack).toHaveBeenCalledWith(msg, false, false);
      expect(auditService.create).not.toHaveBeenCalled();
    });

    it('requeues (does not dead-letter) a message when auditService.create fails transiently', async () => {
      auditService.create.mockRejectedValue(new Error('connection timeout'));
      const onMessage = await getConsumeCallback();
      const msg = { content: Buffer.from(JSON.stringify(validPayload)) };

      await onMessage(msg);

      expect(auditService.create).toHaveBeenCalled();
      expect(channel.nack).toHaveBeenCalledWith(msg, true, false);
      expect(channel.ack).not.toHaveBeenCalled();
    });
  });
});
