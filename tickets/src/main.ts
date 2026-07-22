import { NestFactory } from '@nestjs/core';
import {
  BadRequestException,
  ValidationPipe,
  ValidationError,
} from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './tickets/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Dashboard de monitoreo de espacios consume /sse/espacios vía EventSource
  // desde un origen distinto (Vite dev server, etc.) — habilitamos CORS para esa lectura.
  app.enableCors({
    origin: true,
    methods: ['GET'],
  });
  app.useGlobalFilters(new AllExceptionsFilter());
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

  const config = new DocumentBuilder()
    .setTitle('Tickets Service')
    .setVersion('1.0.0')
    .addServer('/tickets', 'API Gateway')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
