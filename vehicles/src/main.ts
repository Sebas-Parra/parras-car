import { NestFactory } from '@nestjs/core';
import {
  BadRequestException,
  ValidationPipe,
  ValidationError,
} from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors: ValidationError[]) => {
        const messages = errors.flatMap((e) =>
          Object.values(e.constraints ?? {}).concat(
            (e.children ?? []).flatMap((child) =>
              Object.values(child.constraints ?? {}),
            ),
          ),
        );
        return new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          message: messages,
        });
      },
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
