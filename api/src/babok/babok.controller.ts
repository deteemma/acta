import { Controller, Get } from '@nestjs/common';
import type { BabokDto, TechniqueCounts } from '@app/shared';
import { type AuthenticatedUser, CurrentUser } from '../auth/authenticated-user.js';
import { BabokService } from './babok.service.js';

/**
 * Référentiel BABOK : consultable par tout utilisateur connecté (guard global),
 * administrateur compris ; aucune route d'écriture (ADR-0012).
 */
@Controller('babok')
export class BabokController {
  constructor(private readonly babok: BabokService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser): Promise<BabokDto> {
    return this.babok.get(user.id);
  }

  /** Nombre d'actions par technique dans toute l'application (ticket 13) : des nombres seuls. */
  @Get('technique-usage')
  techniqueUsage(@CurrentUser() user: AuthenticatedUser): Promise<TechniqueCounts> {
    return this.babok.techniqueUsage(user.id);
  }
}
