import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { EventPublisher } from './event-published.service';

jest.mock('amqplib');

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
  const connectMock = amqp.connect as unknown as jest.Mock;

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
    connectMock.mockReset();
    connectMock.mockResolvedValue(connection);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  const buildPublisher = () =>
    new EventPublisher(configService as unknown as ConfigService);

  it('uses default exchange and routing key when not configured', () => {
    configService.get.mockReturnValue(undefined);
    const publisher = buildPublisher();
    expect(publisher).toBeDefined();
  });

  it('connects successfully on module init and registers close/error handlers', async () => {
    const publisher = buildPublisher();
    await publisher.onModuleInit();

    expect(connectMock).toHaveBeenCalledWith('amqp://guest:guest@localhost:5672');
    expect(connection.createChannel).toHaveBeenCalled();
    expect(channel.assertExchange).toHaveBeenCalledWith(
      'audit_exchange',
      'topic',
      { durable: true },
    );
    expect(connection.on).toHaveBeenCalledWith('close', expect.any(Function));
    expect(connection.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('schedules a reconnect when the initial connection fails', async () => {
    connectMock.mockRejectedValueOnce(new Error('down'));
    const publisher = buildPublisher();
    await publisher.onModuleInit();

    expect(connectMock).toHaveBeenCalledTimes(1);

    connectMock.mockResolvedValueOnce(connection);
    await jest.advanceTimersByTimeAsync(5000);

    expect(connectMock).toHaveBeenCalledTimes(2);
  });

  it('schedules a reconnect when the close handler fires', async () => {
    const publisher = buildPublisher();
    await publisher.onModuleInit();

    const closeHandler = connection.on.mock.calls.find((c) => c[0] === 'close')?.[1];
    connectMock.mockResolvedValueOnce(connection);
    closeHandler();

    await jest.advanceTimersByTimeAsync(5000);
    expect(connectMock).toHaveBeenCalledTimes(2);
  });

  it('schedules a reconnect when the error handler fires', async () => {
    const publisher = buildPublisher();
    await publisher.onModuleInit();

    const errorHandler = connection.on.mock.calls.find((c) => c[0] === 'error')?.[1];
    connectMock.mockResolvedValueOnce(connection);
    errorHandler(new Error('boom'));

    await jest.advanceTimersByTimeAsync(5000);
    expect(connectMock).toHaveBeenCalledTimes(2);
  });

  it('publishes an event once connected', async () => {
    const publisher = buildPublisher();
    await publisher.onModuleInit();

    await publisher.publish({
      servicio: 'ms-vehiculos',
      accion: 'CREATE',
      entidad: 'VEHICULO',
    });

    expect(channel.publish).toHaveBeenCalledWith(
      'audit_exchange',
      'audit.event',
      expect.any(Buffer),
      { persistent: true },
    );
  });

  it('connects lazily when publish is called before init', async () => {
    const publisher = buildPublisher();

    await publisher.publish({
      servicio: 'ms-vehiculos',
      accion: 'CREATE',
      entidad: 'VEHICULO',
    });

    expect(connectMock).toHaveBeenCalled();
    expect(channel.publish).toHaveBeenCalled();
  });

  it('does not publish and logs an error when connection cannot be established', async () => {
    connectMock.mockRejectedValue(new Error('down'));
    const publisher = buildPublisher();

    await expect(
      publisher.publish({
        servicio: 'ms-vehiculos',
        accion: 'CREATE',
        entidad: 'VEHICULO',
      }),
    ).resolves.toBeUndefined();

    expect(channel.publish).not.toHaveBeenCalled();
  });

  it('marks the connection as broken when channel.publish throws', async () => {
    const publisher = buildPublisher();
    await publisher.onModuleInit();
    channel.publish.mockImplementation(() => {
      throw new Error('publish failed');
    });

    await publisher.publish({
      servicio: 'ms-vehiculos',
      accion: 'CREATE',
      entidad: 'VEHICULO',
    });

    // A subsequent publish should reconnect since the channel was reset.
    connectMock.mockResolvedValueOnce(connection);
    channel.publish.mockImplementation(() => undefined);
    await publisher.publish({
      servicio: 'ms-vehiculos',
      accion: 'CREATE',
      entidad: 'VEHICULO',
    });
    expect(channel.publish).toHaveBeenCalled();
  });

  it('closes the channel and connection on module destroy', async () => {
    const publisher = buildPublisher();
    await publisher.onModuleInit();

    await publisher.onModuleDestroy();

    expect(channel.close).toHaveBeenCalled();
    expect(connection.close).toHaveBeenCalled();
  });

  it('swallows errors while closing on module destroy', async () => {
    const publisher = buildPublisher();
    await publisher.onModuleInit();
    channel.close.mockRejectedValueOnce(new Error('close failed'));

    await expect(publisher.onModuleDestroy()).resolves.toBeUndefined();
  });

  it('module destroy is a no-op when never connected', async () => {
    const publisher = buildPublisher();
    await expect(publisher.onModuleDestroy()).resolves.toBeUndefined();
  });
});
