// Types Kysely des tables (voir api/migrations). À tenir à jour avec les migrations.
import type { ColumnType, Generated } from 'kysely';
import type { ProjectRole } from '@app/shared';

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;

export interface AppUserTable {
  id: string;
  email: string | null;
  display_name: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ProjectTable {
  id: string;
  name: string;
  created_by: Generated<string>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ProjectMemberTable {
  project_id: string;
  user_id: string;
  role: ProjectRole;
  created_at: Timestamp;
}

export interface Database {
  app_user: AppUserTable;
  project: ProjectTable;
  project_member: ProjectMemberTable;
}
