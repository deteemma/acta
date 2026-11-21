// Écrans de données d'une initiative (ADR-0021, N11) : l'initiative elle-même
// (Aperçu, Membres, Désignations, Paramètres), son tableau de bord, son équipe et
// les listes des branches pas encore reprises par leur ticket. Les fiches gardent
// leurs champs, droits et contrôles : seul leur conteneur change.
import {
  type BabokDto,
  can,
  DASHBOARD_TABS,
  INITIATIVE_TABS,
  type InitiativeDto,
  type InitiativeScreen,
  type InitiativeTreeNode,
  type MessageKey,
  type OwnerDesignationDto,
  pathToNode,
  screenNodeKey,
  STAKEHOLDERS_TABS,
  TEAM_TABS,
  type TreeNodeRef,
  treeNodeKey,
} from '@app/shared';
import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { DashboardTasks } from './dashboard-screen';
import { DataScreen, type Tab } from './data-screen';
import { EmptyState } from './empty-state';
import { ErrorMessage, type UiError } from './errors';
import { useI18n } from './i18n';
import { formatDate, InitiativeCode, InitiativeDetails, InitiativeForm, OwnerActions } from './initiative-panels';
import type { InitiativeData } from './initiative-tree';
import { canEditNeeds, NeedList } from './need-panels';
import { usePanels } from './panels';
import { canEditRequirements, ExportRequirementsButton, RequirementList } from './requirement-panels';
import { canEditStakeholders, StakeholderList, StakeholderMatrix } from './stakeholder-panels';
import { SuggestedActions } from './suggested-actions';
import { OwnerDesignations, TeamMembers } from './team-section';

/** Écrans affichés dans l'écran de données ; les tickets et les pages gardent encore le leur. */
export type ElementScreen = Exclude<InitiativeScreen, { kind: 'tickets' | 'pages' }>;

export function InitiativeDataScreen({
  screen,
  data,
  babok,
  actionsVersion,
  onNavigate,
  onSelectNode,
  onInitiativeChanged,
  onTeamChanged,
  onInitiativeGone,
  onActionCreated,
}: {
  screen: ElementScreen;
  data: InitiativeData;
  babok: BabokDto | null;
  actionsVersion: number;
  /** Autre onglet : une adresse de plus, gardée par l'alerte. */
  onNavigate: (screen: InitiativeScreen) => void;
  onSelectNode: (node: InitiativeTreeNode) => void;
  onInitiativeChanged: (initiative: InitiativeDto) => void;
  /** L'équipe a changé : l'initiative, ses membres et la trace sont relus. */
  onTeamChanged: () => void;
  /** Supprimée ou quittée : elle n'est plus accessible. */
  onInitiativeGone: (initiativeId: string) => void;
  onActionCreated: () => void;
}) {
  const { t, locale } = useI18n();
  const { open } = usePanels();
  const [error, setError] = useState<UiError | null>(null);
  const { initiative, members, tree } = data;
  const initiativeId = initiative.id;
  const state = { archived: initiative.archivedAt != null };
  const path = pathToNode(tree, screenNodeKey(screen) ?? tree.key);
  const crumbs = path.slice(0, -1);
  const childNode = (ref: TreeNodeRef) => tree.children.find((c) => c.key === treeNodeKey(ref));
  const me = members.find((m) => m.isMe);
  const archivedBadge = initiative.archivedAt && <span className="badge">{t('initiative.archived')}</span>;

  const tabsOf = <T extends string>(ids: readonly T[], prefix: string, counts: Partial<Record<T, number>> = {}): Tab<T>[] =>
    ids.map((id) => ({ id, label: t(`${prefix}.${id}` as MessageKey), ...(counts[id] !== undefined && { count: counts[id] }) }));

  const common = { crumbs, onCrumb: onSelectNode };
  // Tableau de bord, équipe et branches : « Initiative CRM », puis le libellé du nœud.
  const inInitiative = { ...common, kind: t('initiative.kicker'), reference: initiative.code, badges: archivedBadge };

  switch (screen.kind) {
    case 'initiative': {
      // Nombres par branche, ceux de l'arborescence ; chaque carte ouvre son nœud.
      const counts: { label: string; node: InitiativeTreeNode | undefined }[] = [
        { label: t('tree.stakeholders'), node: childNode({ kind: 'branch', branch: 'stakeholders' }) },
        { label: t('tree.needs'), node: childNode({ kind: 'branch', branch: 'needs' }) },
        { label: t('tree.requirements'), node: childNode({ kind: 'branch', branch: 'requirements' }) },
        { label: t('overview.openTickets'), node: childNode({ kind: 'branch', branch: 'tickets' }) },
        { label: t('tree.pages'), node: childNode({ kind: 'branch', branch: 'pages' }) },
        { label: t('overview.members'), node: childNode({ kind: 'team' }) },
      ];
      return (
        <DataScreen
          {...common}
          kind={t('initiative.kicker')}
          reference={initiative.code}
          title={initiative.name}
          badges={
            <>
              <span className="badge">{t('initiative.myRoleBadge', { role: t(`role.${initiative.myRole}`) })}</span>
              {me?.isTeamBa && <span className="badge">{t('member.teamBa')}</span>}
              {archivedBadge}
            </>
          }
          tabs={tabsOf(INITIATIVE_TABS, 'initiativeTab', { members: members.length })}
          tab={screen.tab}
          onTab={(tab) => onNavigate({ ...screen, tab })}
        >
          {initiative.archivedAt && screen.tab === 'overview' && (
            <p className="notice">{t('initiative.archivedOn', { date: formatDate(locale, initiative.archivedAt) })}</p>
          )}
          {screen.tab === 'overview' && (
            <>
              <ul className="overview-counts">
                {counts.map(
                  ({ label, node }) =>
                    node && (
                      <li key={node.key}>
                        <button type="button" className="overview-count" onClick={() => onSelectNode(node)}>
                          <strong>{node.count ?? 0}</strong>
                          <span>{label}</span>
                        </button>
                      </li>
                    ),
                )}
              </ul>
              {can(initiative.myRole, 'edit', state) ? (
                <InitiativeForm initiative={initiative} onSaved={onInitiativeChanged} />
              ) : (
                <InitiativeDetails initiative={initiative} />
              )}
            </>
          )}
          {(screen.tab === 'members' || screen.tab === 'designations') && (
            <TeamTab tab={screen.tab} data={data} onTeamChanged={onTeamChanged} onLeft={() => onInitiativeGone(initiativeId)} />
          )}
          {screen.tab === 'settings' && (
            <>
              <InitiativeCode key={initiative.code} initiative={initiative} onSaved={onInitiativeChanged} />
              {can(initiative.myRole, 'archive', state) && (
                <OwnerActions initiative={initiative} onChanged={onInitiativeChanged} onDeleted={() => onInitiativeGone(initiativeId)} />
              )}
            </>
          )}
        </DataScreen>
      );
    }
    case 'dashboard':
      return (
        <DataScreen
          {...inInitiative}
          title={t('tree.dashboard')}
          tabs={tabsOf(DASHBOARD_TABS, 'dashboardTab')}
          tab={screen.tab}
          onTab={(tab) => onNavigate({ ...screen, tab })}
        >
          {!babok ? (
            <p>{t('common.loading')}</p>
          ) : screen.tab === 'tasks' ? (
            <DashboardTasks initiativeId={initiativeId} babok={babok} actionsVersion={actionsVersion} />
          ) : (
            <SuggestedActions initiative={initiative} babok={babok} onActionCreated={onActionCreated} />
          )}
        </DataScreen>
      );
    case 'team':
      return (
        <DataScreen
          {...inInitiative}
          title={t('tree.team')}
          tabs={tabsOf(TEAM_TABS, 'initiativeTab', { members: members.length })}
          tab={screen.tab}
          onTab={(tab) => onNavigate({ ...screen, tab })}
        >
          <TeamTab tab={screen.tab} data={data} onTeamChanged={onTeamChanged} onLeft={() => onInitiativeGone(initiativeId)} />
        </DataScreen>
      );
    case 'stakeholders':
      return (
        <DataScreen
          {...inInitiative}
          title={t('tree.stakeholders')}
          tabs={tabsOf(STAKEHOLDERS_TABS, 'stakeholdersTab', { list: data.stakeholders.length })}
          tab={screen.tab}
          onTab={(tab) => onNavigate({ ...screen, tab })}
        >
          <BranchToolbar>
            {canEditStakeholders(initiative) && (
              <button type="button" onClick={() => open({ kind: 'stakeholder', initiativeId })}>
                <Plus />
                {t('stakeholders.new')}
              </button>
            )}
          </BranchToolbar>
          {data.stakeholders.length === 0 ? (
            <EmptyState subject="stakeholders" title={t('stakeholders.empty')} hint={t('empty.stakeholdersHint')} />
          ) : screen.tab === 'list' ? (
            <StakeholderList stakeholders={data.stakeholders} />
          ) : (
            <StakeholderMatrix stakeholders={data.stakeholders} />
          )}
        </DataScreen>
      );
    case 'needs':
      return (
        <DataScreen {...inInitiative} title={t('tree.needs')}>
          <BranchToolbar>
            {canEditNeeds(initiative) && (
              <button type="button" onClick={() => open({ kind: 'need', initiativeId })}>
                <Plus />
                {t('needs.new')}
              </button>
            )}
          </BranchToolbar>
          <NeedList needs={data.needs} />
          {data.needs.length === 0 && <EmptyState subject="needs" title={t('needs.sectionEmpty')} hint={t('empty.needsHint')} />}
        </DataScreen>
      );
    case 'requirements':
      return (
        <DataScreen {...inInitiative} title={t('tree.requirements')}>
          <ErrorMessage error={error} />
          <BranchToolbar>
            {data.requirements.length > 0 && <ExportRequirementsButton initiative={initiative} onError={setError} />}
            {canEditRequirements(initiative) && (
              <button type="button" onClick={() => open({ kind: 'requirement', initiativeId })}>
                <Plus />
                {t('requirements.new')}
              </button>
            )}
          </BranchToolbar>
          <RequirementList requirements={data.requirements} />
          {data.requirements.length === 0 && (
            <EmptyState subject="requirements" title={t('requirements.sectionEmpty')} hint={t('empty.requirementsHint')} />
          )}
        </DataScreen>
      );
  }
}

/** Onglets Membres et Désignations, communs à l'initiative et à son équipe (N11). */
function TeamTab({
  tab,
  data,
  onTeamChanged,
  onLeft,
}: {
  tab: 'members' | 'designations';
  data: { initiative: InitiativeDto; members: InitiativeData['members']; designations: OwnerDesignationDto[] };
  onTeamChanged: () => void;
  onLeft: () => void;
}) {
  return tab === 'members' ? (
    <TeamMembers initiative={data.initiative} members={data.members} onChanged={onTeamChanged} onLeft={onLeft} />
  ) : (
    <OwnerDesignations designations={data.designations} />
  );
}

function BranchToolbar({ children }: { children: ReactNode }) {
  return <div className="section-buttons branch-toolbar">{children}</div>;
}
