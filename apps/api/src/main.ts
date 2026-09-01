import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { ApiResponseInterceptor } from './common/api-response.interceptor';

export async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.use(helmet());
  app.enableShutdownHooks();
  app.setGlobalPrefix('api/v1', { exclude: ['api/docs', 'api/docs-json'] });
  app.enableCors({
    origin: (process.env.WEB_APP_URL ?? 'http://localhost:3000').split(',').map((origin) => origin.trim()),
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Workspace-Id', 'X-Request-Id'],
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new ApiResponseInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Scrapo Lead Hunter API')
    .setDescription('Independent, workspace-scoped REST API for the Scrapo Lead Hunter clients.')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .addApiKey({ type: 'apiKey', name: 'X-Workspace-Id', in: 'header' }, 'workspace')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, { jsonDocumentUrl: 'api/docs-json' });
  if (process.env.GENERATE_OPENAPI === 'true') {
    writeFileSync(join(process.cwd(), 'openapi.json'), JSON.stringify(document, null, 2));
  }

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  Logger.log(`API listening on http://localhost:${port}/api/v1`, 'Bootstrap');
  Logger.log(`Swagger available at http://localhost:${port}/api/docs`, 'Bootstrap');
  return app;
}

if (process.env.NODE_ENV !== 'test') {
  void bootstrap();
}
