import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import {
  APP_ADMIN_ROLE,
  type ReferenceCategory,
  type ReferenceCategoryDto,
  referenceCategorySchema,
  updateReferenceCategorySchema,
  type UpdateReferenceCategoryInput,
} from '@app/shared';
import { type AuthenticatedUser, CurrentUser, RequireAppRole } from '../auth/authenticated-user.js';
import { ZodValidationPipe } from '../zod-validation.pipe.js';
import { ReferenceCategoriesService } from './reference-categories.service.js';

/** Acronymes des références (ticket 09) : réservés au rôle administrateur. */
@Controller('admin/reference-categories')
@RequireAppRole(APP_ADMIN_ROLE)
export class ReferenceCategoriesController {
  constructor(private readonly categories: ReferenceCategoriesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<ReferenceCategoryDto[]> {
    return this.categories.list(user.id);
  }

  /** Renvoie toutes les catégories, à jour. */
  @Patch(':category')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('category', new ZodValidationPipe(referenceCategorySchema)) category: ReferenceCategory,
    @Body(new ZodValidationPipe(updateReferenceCategorySchema)) body: UpdateReferenceCategoryInput,
  ): Promise<ReferenceCategoryDto[]> {
    return this.categories.setAcronym(user.id, category, body.acronym);
  }
}
