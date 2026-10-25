import { Controller, Get } from '@nestjs/common';
import type { PublicConfigDto } from '@app/shared';
import { Public } from '../auth/authenticated-user.js';
import { AppConfig } from '../config/app-config.js';
import { DatabaseService } from '../db/database.service.js';

@Controller()
export class HealthController {
  constructor(
    private readonly config: AppConfig,
    private readonly database: DatabaseService,
  ) {}

  @Public()
  @Get('health')
  async health(): Promise<{ status: 'ok' }> {
    await this.database.ping();
    return { status: 'ok' };
  }

  /** Paramètres de connexion lus au démarrage par le web et le mobile. */
  @Public()
  @Get('config')
  publicConfig(): PublicConfigDto {
    return {
      oidcIssuerUrl: this.config.oidcIssuerUrl,
      webClientId: 'web',
      mobileClientId: 'mobile',
      powersyncUrl: this.config.offlineMobile ? `${this.config.publicUrl}/powersync` : null,
    };
  }
}
