import { Body, Controller, Get, Patch } from '@nestjs/common';
import { type MeDto, type UpdateMeInput, updateMeSchema } from '@app/shared';
import { type AuthenticatedUser, CurrentUser } from '../auth/authenticated-user.js';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import { UsersService } from './users.service.js';

/** Compte de l'utilisateur courant (langue d'interface, ADR-0013). */
@Controller('me')
export class MeController {
  constructor(private readonly users: UsersService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser): Promise<MeDto> {
    return this.users.me(user);
  }

  @Patch()
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateMeSchema)) body: UpdateMeInput,
  ): Promise<MeDto> {
    return this.users.updateMe(user, body);
  }
}
