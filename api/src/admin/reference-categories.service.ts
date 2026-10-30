import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import {
  checkAcronymChange,
  REFERENCE_CATEGORIES,
  type ReferenceCategory,
  type ReferenceCategoryDto,
  type ReferenceRefusal,
} from '@app/shared';
import { sql } from 'kysely';
import { DatabaseService, type Tx } from '../db/database.service.js';
import { isConstraintViolation } from '../db/pg-errors.js';

/**
 * Acronymes des références (ticket 09) : règles de @app/shared (première
 * barrière), fonction admin_set_reference_acronym de la base (seconde barrière,
 * migration 0012).
 */
@Injectable()
export class ReferenceCategoriesService {
  constructor(private readonly database: DatabaseService) {}

  list(adminId: string): Promise<ReferenceCategoryDto[]> {
    return this.database.asAdmin(adminId, (tx) => loadCategories(tx));
  }

  /** Les références déjà attribuées ne changent pas. */
  setAcronym(adminId: string, category: ReferenceCategory, acronym: string): Promise<ReferenceCategoryDto[]> {
    return this.database.asAdmin(adminId, async (tx) => {
      const refusal = checkAcronymChange(await loadCategories(tx), category, acronym);
      if (refusal) throw referenceRefusal(refusal);
      try {
        await sql`SELECT admin_set_reference_acronym(${category}, ${acronym})`.execute(tx);
      } catch (error) {
        // Changement concurrent au profit d'une autre catégorie, refusé par la base.
        if (
          isConstraintViolation(error, 'reference_acronym_taken') ||
          isConstraintViolation(error, 'reference_category_acronym_fkey')
        ) {
          throw referenceRefusal('acronymTaken');
        }
        throw error;
      }
      return loadCategories(tx);
    });
  }
}

/** Dans l'ordre de REFERENCE_CATEGORIES, chacune avec les acronymes qu'elle a portés. */
async function loadCategories(tx: Tx): Promise<ReferenceCategoryDto[]> {
  const [categories, acronyms] = await Promise.all([
    tx.selectFrom('reference_category').select(['category', 'acronym']).execute(),
    tx.selectFrom('reference_acronym').select(['category', 'acronym']).orderBy('acronym').execute(),
  ]);
  return REFERENCE_CATEGORIES.map((category) => ({
    category,
    acronym: categories.find((c) => c.category === category)!.acronym,
    usedAcronyms: acronyms.filter((a) => a.category === category).map((a) => a.acronym),
  }));
}

export function referenceRefusal(refusal: ReferenceRefusal) {
  return refusal === 'invalidAcronym'
    ? new BadRequestException({ statusCode: 400, refusal })
    : new ConflictException({ statusCode: 409, refusal });
}
