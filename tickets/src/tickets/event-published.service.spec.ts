import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { EventPublisher } from './event-published.service';

jest.mock('amqplib', () => ({
  connect: jest.fn(),
}));

describe('EventPublisher', () => {
  let configService: { get: jest.Mock };
  let channel: {
    assertExchange: jest.Mock;
    publish: jest.Mock;
    close: jest.Mock;
  };
  let connection: {
    createChannel: jest.Mock;
    on: jest.Mock;
    close: jest.Mock;
  };

  beforeEach(() => {
    jest.useFakeTimers();
    configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          RABBITMQ_HOST: 'localhost',
          RABBITMQ_PORT: '5672',
          RABBITMQ_USER: 'guest',
          RABBITMQ_PASSWORD: 'guest',
        };
        return values[key];
      }),
    };
    channel = {
      assertExchange: jest.fn().mockResolvedValue(undefined),
      publish: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };
    connection = {
      createChannel: jest.fn().mockResolvedValue(channel),
      on: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };
    (amqp.connect as jest.Mock).mockReset().mockResolvedValue(connection);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('connects to RabbitMQ and asserts the exchange on module init', async () => {
    const publisher = new EventPublisher(
      configService as unknown as ConfigService,
    );

    await publisher.onModuleInit();

    expect(amqp.connect).toHaveBeenCalledWith(
      'amqp://guest:guest@localhost:5672',
    );
    expect(channel.assertExchange).toHaveBeenCalledWith(
      'audit_exchange',
      'topic',
      { durable: true },
    );
  });

  it('publishes a message on the configured exchange once connected', async () => {
    const publisher = new EventPublisher(
      configService as unknown as ConfigService,
    );
    await publisher.onModuleInit();

    await publisher.publish({
      servicio: 'ms-tickets',
      accion: 'CREATE',
      entidad: 'TICKET',
    });

    expect(channel.publish).toHaveBeenCalledWith(
      'audit_exchange',
      'audit_event',
      expect.any(Buffer),
      { persistent: true },
    );
  });

  it('tries to connect before publishing when not yet connected, and no-ops if it still fails', async () => {
    (amqp.connect as jest.Mock).mockRejectedValueOnce(
      new Error('connection refused'),
    );
    const publisher = new EventPublisher(
      configService as unknown as ConfigService,
    );

    await publisher.publish({
      servicio: 'ms-tickets',
      accion: 'CREATE',
      entidad: 'TICKET',
    });

    expect(channel.publish).not.toHaveBeenCalled();
  });

  it('marks itself disconnected and schedules a reconnect if publish throws', async () => {
    const publisher = new EventPublisher(
      configService as unknown as ConfigService,
    );
    await publisher.onModuleInit();
    channel.publish.mockImplementation(() => {
      throw new Error('channel closed');
    });

    await publisher.publish({
      servicio: 'ms-tickets',
      accion: 'CREATE',
      entidad: 'TICKET',
    });

    // A second publish call should try to reconnect since isConnected was reset.
    await publisher.publish({
      servicio: 'ms-tickets',
      accion: 'CREATE',
      entidad: 'TICKET',
    });

    expect(amqp.connect).toHaveBeenCalledTimes(2);
  });

  it('reconnects when the connection emits a close event', async () => {
    const publisher = new EventPublisher(
      configService as unknown as ConfigService,
    );
    await publisher.onModuleInit();

    const closeHandler = connection.on.mock.calls.find(
      ([event]) => event === 'close',
    )?.[1];
    expect(closeHandler).toBeDefined();
    closeHandler();

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    expect(amqp.connect).toHaveBeenCalledTimes(2);
  });

  it('reconnects when the connection emits an error event', async () => {
    const publisher = new EventPublisher(
      configService as unknown as ConfigService,
    );
    await publisher.onModuleInit();

    const errorHandler = connection.on.mock.calls.find(
      ([event]) => event === 'error',
    )?.[1];
    expect(errorHandler).toBeDefined();
    errorHandler(new Error('boom'));

    jest.advanceTimersByTime(5000);
    await Promise.resolve();

    expect(amqp.connect).toHaveBeenCalledTimes(2);
  });

  it('closes the channel and connection on module destroy', async () => {
    const publisher = new EventPublisher(
      configService as unknown as ConfigService,
    );
    await publisher.onModuleInit();

    await publisher.onModuleDestroy();

    expect(channel.close).toHaveBeenCalled();
    expect(connection.close).toHaveBeenCalled();
  });

  it('swallows errors thrown while closing on module destroy', async () => {
    const publisher = new EventPublisher(
      configService as unknown as ConfigService,
    );
    await publisher.onModuleInit();
    channel.close.mockRejectedValue(new Error('already closed'));

    await expect(publisher.onModuleDestroy()).resolves.toBeUndefined();
  });

  it('does nothing on module destroy when never connected', async () => {
    const publisher = new EventPublisher(
      configService as unknown as ConfigService,
    );

    await expect(publisher.onModuleDestroy()).resolves.toBeUndefined();
  });
});
