// Besoins (ticket 09) : problème ou opportunité à traiter (BACCM), identifié par
// une référence (references.ts). Règles écrites une seule fois ici, appliquées
// par l'API et reproduites par la base (migration 0012).
import { z } from 'zod';
import type { MemberNameDto } from './schemas.js';
import { stakeholderIdsSchema, type StakeholderRefDto } from './stakeholders.js';

/** Nature d'un besoin. */
export const NEED_NATURES = ['problem', 'opportunity'] as const;
export type NeedNature = (typeof NEED_NATURES)[number];

export const NEED_TITLE_MAX_LENGTH = 200;
/** Texte mis en forme (rich-text.ts), même limite que la description d'une action. */
export const NEED_DESCRIPTION_MAX_LENGTH = 20000;

const needFields = {
  title: z.string().trim().min(1).max(NEED_TITLE_MAX_LENGTH),
  nature: z.enum(NEED_NATURES),
  /** Vide = pas de description. */
  description: z
    .string()
    .trim()
    .max(NEED_DESCRIPTION_MAX_LENGTH)
    .transform((text) => text || null)
    .nullable(),
  /** Parties prenantes à l'origine du besoin, de la même initiative ; aucune ou plusieurs. */
  stakeholderIds: stakeholderIdsSchema,
};

/** Création : titre et nature obligatoires ; la référence est attribuée par la base. */
export const createNeedSchema = z.object({
  title: needFields.title,
  nature: needFields.nature,
  description: needFields.description.optional(),
  stakeholderIds: needFields.stakeholderIds.optional(),
});
export type CreateNeedInput = z.infer<typeof createNeedSchema>;

/** Modification : seuls les champs fournis changent ; `stakeholderIds` remplace l'ensemble. */
export const updateNeedSchema = z.object(needFields).partial();
export type UpdateNeedInput = z.infer<typeof updateNeedSchema>;

/** Besoins liés à une action ou à une exigence, de la même initiative ; un doublon est ignoré. */
export const needIdsSchema = z.array(z.uuid()).transform((ids) => [...new Set(ids)]);

/** Besoin tel que renvoyé par l'API. */
export interface NeedDto {
  id: string;
  initiativeId: string;
  /** Ex. CRM-BE-001 ; attribuée à la création, ne change plus. */
  reference: string;
  title: string;
  nature: NeedNature;
  /** Texte mis en forme (voir rich-text.ts) ; null si vide. */
  description: string | null;
  /** Parties prenantes à l'origine, par ordre alphabétique. */
  stakeholders: StakeholderRefDto[];
  createdAt: string;
  createdBy: MemberNameDto;
  updatedAt: string;
  updatedBy: MemberNameDto;
}

/** Besoin lié à un autre objet, tel que cet objet le montre. */
export interface NeedRefDto {
  id: string;
  reference: string;
  title: string;
}

/**
 * Refus d'une écriture sur un besoin, renvoyés par l'API (`refusal`) :
 * - `unknownNeed` : un objet est lié à un besoin absent de l'initiative ;
 * - `needLinked` : le besoin est lié à une action ou à une exigence.
 */
export const NEED_REFUSALS = ['unknownNeed', 'needLinked'] as const;
export type NeedRefusal = (typeof NEED_REFUSALS)[number];
export const isNeedRefusal = (value: unknown): value is NeedRefusal => NEED_REFUSALS.some((r) => r === value);
