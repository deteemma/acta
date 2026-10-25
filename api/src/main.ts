import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { AppConfig } from './config/app-config.js';
import { SpaFallbackFilter } from './spa-fallback.filter.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true }),
  );
  const config = app.get(AppConfig);

  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  const webEnabled = !!config.webDistDir && existsSync(config.webDistDir);
  if (webEnabled && config.webDistDir) {
    app.useStaticAssets({ root: config.webDistDir, prefix: '/' });
  }
  app.useGlobalFilters(new SpaFallbackFilter(webEnabled));

  await app.listen(config.port, '0.0.0.0');
}

void bootstrap();
