import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { ConfigService } from '@nestjs/config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    cors: false, // configured below from env
  });

  const config = app.get(ConfigService);

  app.use(helmet());

  app.enableCors({
    origin: (config.get<string>('CORS_ORIGINS') ?? '').split(',').filter(Boolean),
    credentials: true,
  });

  app.setGlobalPrefix('api/v1', { exclude: ['healthz', 'readyz'] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  // OpenAPI
  const docConfig = new DocumentBuilder()
    .setTitle('Full Circle Map App API')
    .setDescription('REST API for the Map Store rebuild')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, docConfig);
  SwaggerModule.setup('api/v1/docs', app, document);

  const port = config.get<number>('PORT') ?? 3001;
  await app.listen(port);

  // eslint-disable-next-line no-console
  console.log(`✔ API listening on http://localhost:${port}/api/v1`);
  // eslint-disable-next-line no-console
  console.log(`  OpenAPI: http://localhost:${port}/api/v1/docs`);
}

bootstrap();
