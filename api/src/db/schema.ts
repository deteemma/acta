// Types Kysely des tables (voir api/migrations). À tenir à jour avec les migrations.
import type { ColumnType, Generated } from 'kysely';
import type { InitiativeRole, Locale } from '@app/shared';

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;

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

export interface Database {
  app_user: AppUserTable;
  initiative: InitiativeTable;
  initiative_member: InitiativeMemberTable;
}
