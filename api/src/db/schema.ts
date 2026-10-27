// Types Kysely des tables (voir api/migrations). À tenir à jour avec les migrations.
import type { ColumnType, Generated } from 'kysely';
import type { AnalysisApproach, InitiativeRole, Locale } from '@app/shared';

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;
/** Colonne facultative : absente à l'insertion. */
type Optional<T> = ColumnType<T | null, T | null | undefined, T | null>;

export interface AppUserTable {
  id: string;
  email: string | null;
  display_name: string | null;
  locale: Generated<Locale | null>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface InitiativeTable {
  id: string;
  code: string;
  name: string;
  description: Optional<string>;
  analysis_approach: Optional<AnalysisApproach>;
  /** Colonnes « date » : lues en texte AAAA-MM-JJ (voir InitiativesService). */
  start_date: Optional<string>;
  planned_end_date: Optional<string>;
  archived_at: ColumnType<Date | null, undefined, Date | string | null>;
  archived_by: Optional<string>;
  created_by: Generated<string>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface InitiativeMemberTable {
  initiative_id: string;
  user_id: string;
  role: InitiativeRole;
  is_team_ba: Generated<boolean>;
  created_at: Timestamp;
}

/** Écrite seulement par un déclencheur (migration 0005). */
export interface OwnerDesignationTable {
  id: Generated<string>;
  initiative_id: string;
  user_id: string;
  designated_by: string | null;
  designated_at: Timestamp;
}

export interface Database {
  app_user: AppUserTable;
  initiative: InitiativeTable;
  initiative_member: InitiativeMemberTable;
  owner_designation: OwnerDesignationTable;
}
