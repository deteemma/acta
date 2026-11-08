// Types Kysely des tables (voir api/migrations). À tenir à jour avec les migrations.
import type { ColumnType, Generated } from 'kysely';
import type {
  AnalysisApproach,
  InitiativeRole,
  Locale,
  NeedNature,
  PageDoc,
  ReferenceCategory,
  RequirementSnapshot,
  RequirementStatus,
  RequirementSubtype,
  RequirementType,
  StakeholderKind,
  StakeholderLevel,
  StakeholderRole,
  RiskLevel,
  TicketSnapshot,
  TicketStatus,
  TicketType,
} from '@app/shared';

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;
/** Colonne facultative : absente à l'insertion. */
type Optional<T> = ColumnType<T | null, T | null | undefined, T | null>;

export interface AppUserTable {
  id: string;
  email: string | null;
  display_name: string | null;
  locale: Generated<Locale | null>;
  /** Dernière ouverture du panneau des alertes, ou date de référence (migration 0016). */
  alerts_seen_at: Generated<Date>;
  /** Alertes listées à la dernière ouverture ; null avant la première. */
  alerts_seen_keys: Generated<string[] | null>;
  /** Compte désactivé dans Keycloak ; écrit par admin_set_user_deactivated (migration 0007). */
  deactivated_at: ColumnType<Date | null, undefined, never>;
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

/** Ticket (migrations 0010, 0018, 0019) : référence, statut initial, auteurs et dates écrits par un déclencheur. */
export interface TicketTable {
  id: string;
  initiative_id: string;
  type: ColumnType<TicketType, TicketType, never>;
  reference: ColumnType<string, never, never>;
  title: string;
  description: Optional<string>;
  /** Action seulement ; obligatoire pour elle (contrainte ticket_action_fields). */
  task_id: Optional<string>;
  technique_id: Optional<string>;
  /** Obligatoire pour l'Action, facultatif pour les autres types. */
  assignee_id: Optional<string>;
  /** Dernière attribution (migration 0016) : écrite par un déclencheur. */
  assigned_by: ColumnType<string, never, never>;
  assigned_at: ColumnType<Date, never, never>;
  /** Colonne « date » : lue en texte AAAA-MM-JJ (voir ActionsService). */
  due_date: Optional<string>;
  status: Generated<TicketStatus>;
  epic_id: Optional<string>;
  /** Risque seulement. */
  probability: Optional<RiskLevel>;
  impact: Optional<RiskLevel>;
  /** Suggestion d'où l'action est créée (migration 0015) ; fixée à la création. */
  suggestion_key: Optional<string>;
  created_by: ColumnType<string, never, never>;
  created_at: ColumnType<Date, never, never>;
  updated_by: ColumnType<string, never, never>;
  updated_at: ColumnType<Date, never, never>;
}

/** Page (migration 0020) : référence, auteurs et dates écrits par un déclencheur. */
export interface PageTable {
  id: string;
  initiative_id: string;
  reference: ColumnType<string, never, never>;
  title: string;
  /** JSON de Tiptap (ADR-0019), validé par pageContentSchema. */
  content: ColumnType<PageDoc | null, string | null, string | null>;
  parent_id: Optional<string>;
  position: number;
  created_by: ColumnType<string, never, never>;
  created_at: ColumnType<Date, never, never>;
  updated_by: ColumnType<string, never, never>;
  updated_at: ColumnType<Date, never, never>;
}

/** Suggestion écartée par l'équipe (migration 0015). */
export interface SuggestionDismissalTable {
  initiative_id: string;
  suggestion_key: string;
  dismissed_by: Generated<string>;
  dismissed_at: Generated<Date>;
}

/** Partie prenante (migration 0011) : auteurs et dates écrits par un déclencheur. */
export interface StakeholderTable {
  id: string;
  initiative_id: string;
  name: string;
  kind: StakeholderKind;
  /** Tableau d'un type énuméré : lu par `roles::text[]` (voir StakeholdersService). */
  roles: StakeholderRole[];
  influence: Optional<StakeholderLevel>;
  interest: Optional<StakeholderLevel>;
  contact: Optional<string>;
  notes: Optional<string>;
  user_id: Optional<string>;
  created_by: ColumnType<string, never, never>;
  created_at: ColumnType<Date, never, never>;
  updated_by: ColumnType<string, never, never>;
  updated_at: ColumnType<Date, never, never>;
}

/** Partie prenante concernée par une action (migration 0011) : créé ou retiré, jamais modifié. */
export interface ActionStakeholderTable {
  initiative_id: string;
  ticket_id: string;
  stakeholder_id: string;
}

/** Partie prenante interrogée par une question (migration 0019) : créé ou retiré, jamais modifié. */
export interface QuestionStakeholderTable {
  initiative_id: string;
  ticket_id: string;
  ticket_type: Generated<'question'>;
  stakeholder_id: string;
}

/** Acronymes des références (migration 0012) : écrits seulement par admin_set_reference_acronym. */
export interface ReferenceCategoryTable {
  category: ReferenceCategory;
  acronym: string;
}

export interface ReferenceAcronymTable {
  acronym: string;
  category: ReferenceCategory;
}

/** Statut d'exigence (migration 0017) : écrit seulement par les fonctions admin_*. */
export interface RequirementStatusTable {
  code: RequirementStatus;
  babok: boolean;
  label_fr: string | null;
  label_en: string | null;
  active: boolean;
  created_at: Date | null;
}

/** Besoin (migration 0012) : référence, auteurs et dates écrits par un déclencheur. */
export interface NeedTable {
  id: string;
  initiative_id: string;
  reference: ColumnType<string, never, never>;
  title: string;
  nature: NeedNature;
  description: Optional<string>;
  created_by: ColumnType<string, never, never>;
  created_at: ColumnType<Date, never, never>;
  updated_by: ColumnType<string, never, never>;
  updated_at: ColumnType<Date, never, never>;
}

/** Partie prenante à l'origine d'un besoin (migration 0012) : créé ou retiré, jamais modifié. */
export interface NeedStakeholderTable {
  initiative_id: string;
  need_id: string;
  stakeholder_id: string;
}

/** Lien ticket ↔ besoin (migrations 0012, 0018) : créé ou retiré, jamais modifié. */
export interface TicketNeedTable {
  initiative_id: string;
  ticket_id: string;
  need_id: string;
}

/** Exigence (migration 0013) : référence, auteurs et dates écrits par un déclencheur. */
export interface RequirementTable {
  id: string;
  initiative_id: string;
  reference: ColumnType<string, never, never>;
  title: string;
  statement: string;
  type: RequirementType;
  subtype: Optional<RequirementSubtype>;
  status: Generated<RequirementStatus>;
  parent_id: Optional<string>;
  created_by: ColumnType<string, never, never>;
  created_at: ColumnType<Date, never, never>;
  updated_by: ColumnType<string, never, never>;
  updated_at: ColumnType<Date, never, never>;
}

/** Source d'une exigence (migration 0013) : créé ou retiré, jamais modifié. */
export interface RequirementStakeholderTable {
  initiative_id: string;
  requirement_id: string;
  stakeholder_id: string;
}

/** Besoin lié à une exigence (migration 0013) : créé ou retiré, jamais modifié. */
export interface RequirementNeedTable {
  initiative_id: string;
  requirement_id: string;
  need_id: string;
}

/** Lien ticket ↔ exigence (migrations 0013, 0018) : créé ou retiré, jamais modifié. */
export interface TicketRequirementTable {
  initiative_id: string;
  ticket_id: string;
  requirement_id: string;
}

/** Historique d'une exigence (migration 0013) : écrit seulement par la base, en lecture seule. */
export interface RequirementVersionTable {
  id: ColumnType<string, never, never>;
  initiative_id: ColumnType<string, never, never>;
  requirement_id: ColumnType<string, never, never>;
  changed_by: ColumnType<string, never, never>;
  changed_at: ColumnType<Date, never, never>;
  snapshot: ColumnType<RequirementSnapshot, never, never>;
}

/** Historique d'un ticket (migration 0018) : écrit seulement par la base, en lecture seule. */
export interface TicketVersionTable {
  id: ColumnType<string, never, never>;
  initiative_id: ColumnType<string, never, never>;
  ticket_id: ColumnType<string, never, never>;
  changed_by: ColumnType<string, never, never>;
  changed_at: ColumnType<Date, never, never>;
  snapshot_before: ColumnType<TicketSnapshot, never, never>;
  snapshot_after: ColumnType<TicketSnapshot, never, never>;
}

/** Référentiel BABOK (migration 0009) : lecture seule, aucune écriture possible. */
interface BabokElementColumns {
  id: string;
  section: string;
  position: number;
  name_en: string;
  name_fr: string;
  summary_en: string;
  summary_fr: string;
}

export type BabokKnowledgeAreaTable = BabokElementColumns;

export interface BabokTaskTable extends BabokElementColumns {
  knowledge_area_id: string;
}

export type BabokTechniqueTable = BabokElementColumns;

export interface BabokTaskTechniqueTable {
  task_id: string;
  technique_id: string;
}

export interface Database {
  action_stakeholder: ActionStakeholderTable;
  app_user: AppUserTable;
  babok_knowledge_area: BabokKnowledgeAreaTable;
  babok_task: BabokTaskTable;
  babok_task_technique: BabokTaskTechniqueTable;
  babok_technique: BabokTechniqueTable;
  initiative: InitiativeTable;
  initiative_member: InitiativeMemberTable;
  need: NeedTable;
  need_stakeholder: NeedStakeholderTable;
  owner_designation: OwnerDesignationTable;
  page: PageTable;
  reference_acronym: ReferenceAcronymTable;
  reference_category: ReferenceCategoryTable;
  requirement: RequirementTable;
  requirement_need: RequirementNeedTable;
  requirement_status: RequirementStatusTable;
  requirement_stakeholder: RequirementStakeholderTable;
  requirement_version: RequirementVersionTable;
  stakeholder: StakeholderTable;
  suggestion_dismissal: SuggestionDismissalTable;
  question_stakeholder: QuestionStakeholderTable;
  ticket: TicketTable;
  ticket_need: TicketNeedTable;
  ticket_requirement: TicketRequirementTable;
  ticket_version: TicketVersionTable;
}
