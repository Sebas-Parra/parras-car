import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Car } from './vehicles/entities/car.entity';
import { Motorcycle } from './vehicles/entities/motorcycle.entity';
import { PickupTruck } from './vehicles/entities/pickupTrucks.entity';
import { Vehicle } from './vehicles/entities/vehicle.entity';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { VehiclesModule } from './vehicles/vehicles.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.getOrThrow<string>('DB_HOST'),
        port: Number(configService.getOrThrow<string>('DB_PORT')),
        username: configService.getOrThrow<string>('DB_USUARIO'),
        password: configService.getOrThrow<string>('DB_CONTRASENA'),
        database: configService.getOrThrow<string>('DB_NOMBRE'),
        entities: [Vehicle, Car, Motorcycle, PickupTruck],
        synchronize: true,
        logging: true,
      }),
      inject: [ConfigService],
    }),
    VehiclesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
