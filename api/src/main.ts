import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { ATTACHMENT_MAX_BYTES } from '@app/shared';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import { AppConfig } from './config/app-config.js';
import { SpaFallbackFilter } from './spa-fallback.filter.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    // Une page de 200 000 caractères (PAGE_TEXT_MAX_LENGTH), avec sa mise en forme
    // en JSON, dépasse le 1 Mo par défaut de Fastify.
    new FastifyAdapter({ trustProxy: true, bodyLimit: 8 * 1024 * 1024 }),
  );
  const config = app.get(AppConfig);
  // Pièces jointes (ticket 21) : contenu brut, 10 Mo au plus ; au-delà, 413 avant
  // toute lecture complète.
  app
    .getHttpAdapter()
    .getInstance()
    .addContentTypeParser('application/octet-stream', { parseAs: 'buffer', bodyLimit: ATTACHMENT_MAX_BYTES }, (_request, body, done) =>
      done(null, body),
    );

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
