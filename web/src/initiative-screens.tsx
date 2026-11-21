// Écrans de données d'une initiative (ADR-0021, N11) : l'initiative elle-même
// (Aperçu, Membres, Désignations, Paramètres), son tableau de bord, son équipe,
// les listes des branches, les parties prenantes, les besoins, les exigences,
// les tickets et les pages. Les fiches gardent leurs champs, droits et contrôles : seul leur
// conteneur change.
import {
  acceptsScenarios,
  type BabokDto,
  can,
  canCreateActionIn,
  DASHBOARD_TABS,
  INITIATIVE_TABS,
  type InitiativeDto,
  type InitiativeScreen,
  type InitiativeTreeNode,
  type MessageKey,
  NEED_TABS,
  type OwnerDesignationDto,
  pathToNode,
  REQUIREMENT_TABS,
  screenNodeKey,
  STAKEHOLDER_TABS,
  STAKEHOLDERS_TABS,
  TEAM_TABS,
  type PageRow,
  type TreeBranch,
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
import { canEditNeeds, NeedLinks, NeedList, NeedRequirements, NeedSheet, requirementsOfNeed } from './need-screen';
import { usePanels } from './panels';
import {
  canEditRequirements,
  ExportRequirementsButton,
  RequirementList,
  RequirementTabContent,
  TypeLabel,
} from './requirement-screen';
import { StatusLabel } from './requirement-statuses';
import {
  canEditStakeholders,
  originatedBy,
  StakeholderKicker,
  StakeholderList,
  StakeholderMatrix,
  StakeholderOrigin,
  StakeholderSheet,
} from './stakeholder-screen';
import { SuggestedActions } from './suggested-actions';
import { canEditPages, PageList, PageScreen } from './page-screen';
import { OwnerDesignations, TeamMembers } from './team-section';
import { TicketScreen } from './ticket-screen';
import { TicketList } from './ticket-list';

export function InitiativeDataScreen({
  screen,
  data,
  babok,
  pending,
  actionsVersion,
  myId,
  onNavigate,
  onReplace,
  onSelectNode,
  onInitiativeChanged,
  onTeamChanged,
  onInitiativeGone,
  onActionCreated,
  onStakeholdersChanged,
  onNeedsChanged,
  onRequirementsChanged,
  onTicketsChanged,
  onPagesChanged,
  onAddPage,
  editPageId,
  onPageEditStarted,
  onLinksChanged,
}: {
  screen: InitiativeScreen;
  data: InitiativeData;
  /** Données en cours de rechargement : un élément absent vient peut-être d'être créé. */
  pending: boolean;
  babok: BabokDto | null;
  actionsVersion: number;
  /** Pour savoir quels commentaires sont les miens. */
  myId: string | null;
  /** Autre onglet : une adresse de plus, gardée par l'alerte. */
  onNavigate: (screen: InitiativeScreen) => void;
  /** L'élément affiché vient d'être supprimé : l'écran est remplacé, sans étape pour « Précédent ». */
  onReplace: (screen: InitiativeScreen) => void;
  onSelectNode: (node: InitiativeTreeNode) => void;
  onInitiativeChanged: (initiative: InitiativeDto) => void;
  /** L'équipe a changé : l'initiative, ses membres et la trace sont relus. */
  onTeamChanged: () => void;
  /** Supprimée ou quittée : elle n'est plus accessible. */
  onInitiativeGone: (initiativeId: string) => void;
  onActionCreated: () => void;
  onStakeholdersChanged: () => void;
  onNeedsChanged: () => void;
  /** Exigence ou scénario créé, modifié, supprimé ou déplacé : l'arborescence suit. */
  onRequirementsChanged: () => void;
  /** Ticket créé, modifié (fermé, rouvert, autre Epic…) ou supprimé : l'arborescence suit. */
  onTicketsChanged: () => void;
  /** Page modifiée, déplacée, restaurée ou supprimée : l'arborescence suit. */
  onPagesChanged: () => void;
  /** « Nouvelle page », ou « Sous-page » de `parent` : fenêtre de dialogue. */
  onAddPage: (parent: PageRow | null) => void;
  /** Page tout juste créée, qui s'ouvre en écriture ; null sinon. */
  editPageId: string | null;
  onPageEditStarted: () => void;
  /** Un lien avec un ticket a été créé ou retiré. */
  onLinksChanged: () => void;
}) {
  const { t, locale } = useI18n();
  const { open } = usePanels();
  const [error, setError] = useState<UiError | null>(null);
  const { initiative, members, tree } = data;
  const initiativeId = initiative.id;
  const state = { archived: initiative.archivedAt != null };
  // Un scénario s'affiche dans son exigence : le fil d'Ariane va jusqu'à elle.
  const shownKey = screen.kind === 'scenario' ? treeNodeKey({ kind: 'requirement', id: screen.requirementId }) : screenNodeKey(screen);
  const path = pathToNode(tree, shownKey ?? tree.key);
  const crumbs = path.slice(0, -1);
  // Élément introuvable : le fil d'Ariane s'arrête à sa branche.
  const branchCrumbs = (branch: TreeBranch) => pathToNode(tree, treeNodeKey({ kind: 'branch', branch }));
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
              <button type="button" onClick={() => open({ kind: 'createStakeholder', initiativeId })}>
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
              <button type="button" onClick={() => open({ kind: 'createNeed', initiativeId })}>
                <Plus />
                {t('needs.new')}
              </button>
            )}
          </BranchToolbar>
          <NeedList needs={data.needs} />
          {data.needs.length === 0 && <EmptyState subject="needs" title={t('needs.sectionEmpty')} hint={t('empty.needsHint')} />}
        </DataScreen>
      );
    case 'stakeholder': {
      const stakeholder = data.stakeholders.find((s) => s.id === screen.stakeholderId);
      if (!stakeholder) {
        return (
          <MissingElement kind={<StakeholderKicker />} pending={pending} crumbs={branchCrumbs('stakeholders')} onCrumb={onSelectNode} />
        );
      }
      const origin = originatedBy(stakeholder.id, data.needs, data.requirements);
      return (
        <DataScreen
          {...common}
          kind={<StakeholderKicker />}
          title={stakeholder.name}
          tabs={tabsOf(STAKEHOLDER_TABS, 'stakeholderTab', { origin: origin.needs.length + origin.requirements.length })}
          tab={screen.tab}
          onTab={(tab) => onNavigate({ ...screen, tab })}
        >
          {initiative.archivedAt && <p className="notice">{t('initiative.archived')}</p>}
          {screen.tab === 'sheet' ? (
            <StakeholderSheet
              initiative={initiative}
              members={members}
              stakeholders={data.stakeholders}
              stakeholder={stakeholder}
              babok={babok}
              actionsVersion={actionsVersion}
              onChanged={onStakeholdersChanged}
              onDeleted={() => {
                onStakeholdersChanged();
                onReplace({ kind: 'stakeholders', initiativeId, tab: 'list' });
              }}
            />
          ) : (
            <StakeholderOrigin needs={origin.needs} requirements={origin.requirements} />
          )}
        </DataScreen>
      );
    }
    case 'need': {
      const need = data.needs.find((n) => n.id === screen.needId);
      if (!need) {
        return <MissingElement kind={t('need.kicker')} pending={pending} crumbs={branchCrumbs('needs')} onCrumb={onSelectNode} />;
      }
      const requirements = requirementsOfNeed(need.id, data.requirements);
      return (
        <DataScreen
          {...common}
          kind={t('need.kicker')}
          reference={need.reference}
          title={need.title}
          badges={<span className="badge">{t(`needNature.${need.nature}`)}</span>}
          tabs={tabsOf(NEED_TABS, 'needTab', { requirements: requirements.length })}
          tab={screen.tab}
          onTab={(tab) => onNavigate({ ...screen, tab })}
        >
          {initiative.archivedAt && <p className="notice">{t('initiative.archived')}</p>}
          {screen.tab === 'sheet' && (
            <NeedSheet
              initiative={initiative}
              need={need}
              stakeholders={data.stakeholders}
              onChanged={onNeedsChanged}
              onDeleted={() => {
                onNeedsChanged();
                onReplace({ kind: 'needs', initiativeId });
              }}
            />
          )}
          {screen.tab === 'requirements' && <NeedRequirements requirements={requirements} />}
          {screen.tab === 'links' && (
            <NeedLinks initiative={initiative} need={need} version={actionsVersion} onChanged={onLinksChanged} />
          )}
        </DataScreen>
      );
    }
    case 'requirement':
    case 'scenario': {
      const requirement = data.requirements.find((r) => r.id === screen.requirementId);
      if (!requirement) {
        return (
          <MissingElement kind={t('requirement.kicker')} pending={pending} crumbs={branchCrumbs('requirements')} onCrumb={onSelectNode} />
        );
      }
      const hasScenarios = acceptsScenarios(requirement);
      // Scénarios : seulement pour une exigence de solution fonctionnelle ; sinon la Fiche.
      const asked = screen.kind === 'scenario' ? 'scenarios' : screen.tab;
      const tab = asked === 'scenarios' && !hasScenarios ? 'sheet' : asked;
      const node = path.at(-1);
      const scenarioCount = node?.children.filter((c) => c.ref.kind === 'scenario').length ?? 0;
      const base = { kind: 'requirement', initiativeId, requirementId: requirement.id } as const;
      return (
        <DataScreen
          {...common}
          kind={t('requirement.kicker')}
          reference={requirement.reference}
          title={requirement.title}
          badges={
            <>
              <StatusLabel status={requirement.status} />
              <span className="badge">
                <TypeLabel type={requirement.type} subtype={requirement.subtype} />
              </span>
            </>
          }
          tabs={tabsOf(
            REQUIREMENT_TABS.filter((id) => id !== 'scenarios' || hasScenarios),
            'requirementTab',
            hasScenarios ? { scenarios: scenarioCount } : {},
          )}
          tab={tab}
          onTab={(next) => onNavigate({ ...base, tab: next })}
        >
          {initiative.archivedAt && <p className="notice">{t('initiative.archived')}</p>}
          <RequirementTabContent
            initiative={initiative}
            requirement={requirement}
            tab={tab}
            scenarioId={screen.kind === 'scenario' ? screen.scenarioId : undefined}
            stakeholders={data.stakeholders}
            needs={data.needs}
            requirements={data.requirements}
            actionsVersion={actionsVersion}
            onChanged={onRequirementsChanged}
            onDeleted={() => {
              onRequirementsChanged();
              onReplace({ kind: 'requirements', initiativeId });
            }}
            onScenariosChanged={onRequirementsChanged}
            onScenarioGone={() => onReplace({ ...base, tab: 'scenarios' })}
            onAddScenario={(language) => open({ kind: 'createScenario', initiativeId, requirementId: requirement.id, language })}
            onLinksChanged={onLinksChanged}
          />
        </DataScreen>
      );
    }
    case 'tickets':
      return (
        <DataScreen {...inInitiative} title={t('tree.tickets')}>
          {initiative.archivedAt && (
            <p className="notice">{t('initiative.archivedOn', { date: formatDate(locale, initiative.archivedAt) })}</p>
          )}
          <BranchToolbar>
            {canCreateActionIn(initiative) && (
              <button type="button" className="primary" onClick={() => open({ kind: 'createTicket', initiativeId })}>
                <Plus />
                {t('tickets.new')}
              </button>
            )}
          </BranchToolbar>
          <TicketList initiative={initiative} tickets={data.tickets} onChanged={onTicketsChanged} />
        </DataScreen>
      );
    case 'ticket': {
      const row = data.tickets.find((r) => r.id === screen.ticketId);
      if (!row) {
        return <MissingElement kind={t('tree.tickets')} pending={pending} crumbs={branchCrumbs('tickets')} onCrumb={onSelectNode} />;
      }
      return (
        <TicketScreen
          initiative={initiative}
          row={row}
          rows={data.tickets}
          members={members}
          stakeholders={data.stakeholders}
          babok={babok}
          tab={screen.tab}
          // Un ticket fermé n'est pas dans l'arborescence : Initiative › Tickets (N8).
          crumbs={crumbs.length > 0 ? crumbs : branchCrumbs('tickets')}
          onCrumb={onSelectNode}
          actionsVersion={actionsVersion}
          myId={myId}
          onTab={(tab) => onNavigate({ ...screen, tab })}
          onChanged={onTicketsChanged}
          onDeleted={() => {
            onTicketsChanged();
            onReplace({ kind: 'tickets', initiativeId });
          }}
        />
      );
    }
    case 'pages':
      return (
        <DataScreen {...inInitiative} title={t('tree.pages')}>
          {initiative.archivedAt && (
            <p className="notice">{t('initiative.archivedOn', { date: formatDate(locale, initiative.archivedAt) })}</p>
          )}
          <BranchToolbar>
            {canEditPages(initiative) && (
              <button type="button" className="primary" onClick={() => onAddPage(null)}>
                <Plus />
                {t('pages.new')}
              </button>
            )}
          </BranchToolbar>
          <PageList initiativeId={initiativeId} pages={data.pages} canEdit={canEditPages(initiative)} />
        </DataScreen>
      );
    case 'page': {
      const row = data.pages.find((p) => p.id === screen.pageId);
      if (!row) {
        return (
          <MissingElement
            kind={t('referenceCategory.page')}
            pending={pending}
            crumbs={branchCrumbs('pages')}
            onCrumb={onSelectNode}
            message={t('pages.notFound')}
          />
        );
      }
      return (
        <PageScreen
          initiative={initiative}
          row={row}
          pages={data.pages}
          babok={babok}
          tab={screen.tab}
          crumbs={crumbs}
          onCrumb={onSelectNode}
          linksVersion={actionsVersion}
          myId={myId}
          startEditing={editPageId === row.id}
          onEditStarted={onPageEditStarted}
          onTab={(tab) => onNavigate({ ...screen, tab })}
          onChanged={onPagesChanged}
          onLinksChanged={onLinksChanged}
          onAddChild={() => onAddPage(row)}
          onDeleted={() => {
            onPagesChanged();
            onReplace({ kind: 'pages', initiativeId });
          }}
        />
      );
    }
    case 'requirements':
      return (
        <DataScreen {...inInitiative} title={t('tree.requirements')}>
          <ErrorMessage error={error} />
          <BranchToolbar>
            {data.requirements.length > 0 && <ExportRequirementsButton initiative={initiative} onError={setError} />}
            {canEditRequirements(initiative) && (
              <button type="button" onClick={() => open({ kind: 'createRequirement', initiativeId })}>
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

/**
 * Élément introuvable : tout juste créé, il arrive avec le rechargement ; sinon
 * il n'existe pas ou plus (supprimé ailleurs, adresse ancienne).
 */
function MissingElement({
  kind,
  pending,
  crumbs,
  onCrumb,
  message,
}: {
  kind: ReactNode;
  pending: boolean;
  crumbs: InitiativeTreeNode[];
  onCrumb: (node: InitiativeTreeNode) => void;
  /** Message propre à l'élément introuvable ; sinon l'erreur 404. */
  message?: string;
}) {
  const { t } = useI18n();
  return (
    <DataScreen crumbs={crumbs} onCrumb={onCrumb} kind={kind} title={t('common.loading')}>
      {!pending &&
        (message ? (
          <p className="error" role="alert">
            {message}
          </p>
        ) : (
          <ErrorMessage error={{ key: 'error.http', params: { status: 404 } }} />
        ))}
    </DataScreen>
  );
}

function BranchToolbar({ children }: { children: ReactNode }) {
  return <div className="section-buttons branch-toolbar">{children}</div>;
}
