import { type AnalysisObjectRef, type BabokDto, findBabokElement, type InitiativeDto, type MeDto } from '@app/shared';
import type { User } from 'oidc-client-ts';
import { useEffect, useState } from 'react';
import { ActionPanel, CreateActionPanel } from './action-panels';
import { AdminPanel } from './admin-panel';
import { AlertsButton, AlertsPanel, useMyAlerts } from './alerts';
import { api } from './api';
import { BabokElementPanel, BabokPanel } from './babok-panels';
import { DashboardPanel } from './dashboard-panel';
import { login, logout } from './auth';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { I18nProvider, LanguageSelector, useI18n } from './i18n';
import { CreateInitiativePanel, InitiativePanel, MemberPanel } from './initiative-panels';
import { MyActions } from './my-actions';
import { NeedPanel } from './need-panels';
import { StakeholderPanel, StakeholdersPanel } from './stakeholder-panels';
import { IS_MAC, Palette, usePaletteShortcut } from './palette';
import { FabContext, PanelHost, type PanelContent, PanelsProvider, usePanels } from './panels';
import { ReferencesProvider } from './references';
import { RequirementPanel } from './requirement-panels';

export function App({ user }: { user: User | null }) {
  return (
    <I18nProvider signedIn={!!user}>
      {user ? <SignedIn user={user} /> : <SignedOut />}
    </I18nProvider>
  );
}

function SignedOut() {
  const { t } = useI18n();
  // Échec avant la redirection vers Keycloak (réseau, certificat…) : à afficher.
  const [failure, setFailure] = useState<string | null>(null);
  return (
    <main>
      <header>
        <h1>{t('app.title')}</h1>
        <LanguageSelector />
      </header>
      <button onClick={() => login().catch((e: unknown) => setFailure(String(e)))}>{t('auth.login')}</button>
      {failure && <p className="error">{t('auth.loginFailed', { error: failure })}</p>}
    </main>
  );
}

function SignedIn({ user }: { user: User }) {
  return (
    <PanelsProvider>
      <Shell user={user} />
    </PanelsProvider>
  );
}

/** Coque de navigation : « Mes actions », initiatives, palette (Ctrl+K), bouton « + Action » et panneaux. */
function Shell({ user }: { user: User }) {
  const { t } = useI18n();
  const { stack, open } = usePanels();
  const [initiatives, setInitiatives] = useState<InitiativeDto[]>([]);
  const [me, setMe] = useState<MeDto | null>(null);
  const [babok, setBabok] = useState<BabokDto | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  // Incrémenté à chaque écriture sur une action : les listes se rechargent.
  const [actionsVersion, setActionsVersion] = useState(0);
  const actionsChanged = () => setActionsVersion((v) => v + 1);
  // De même pour les parties prenantes.
  const [stakeholdersVersion, setStakeholdersVersion] = useState(0);
  const stakeholdersChanged = () => setStakeholdersVersion((v) => v + 1);
  // De même pour les besoins.
  const [needsVersion, setNeedsVersion] = useState(0);
  const needsChanged = () => setNeedsVersion((v) => v + 1);
  // De même pour les exigences.
  const [requirementsVersion, setRequirementsVersion] = useState(0);
  const requirementsChanged = () => setRequirementsVersion((v) => v + 1);
  // De même pour la fiche d'une initiative (approche, date de fin prévue : ticket 14).
  const [initiativeVersion, setInitiativeVersion] = useState(0);
  usePaletteShortcut();
  const alerts = useMyAlerts(me, actionsVersion);

  useEffect(() => {
    api.listInitiatives().then(setInitiatives, (e: unknown) => setError(toUiError(e)));
    // Sans réponse, pas d'accès à l'administration : l'API la refuse de toute façon.
    api.me().then(setMe, () => undefined);
    api.babok().then(setBabok, (e: unknown) => setError(toUiError(e)));
  }, []);

  const active = initiatives.filter((i) => !i.archivedAt);
  const archived = initiatives.filter((i) => i.archivedAt);
  // Panneau le plus haut qui montre une initiative ou l'un de ses objets : la
  // création rapide propose cette initiative, et part de cet objet (ticket 13).
  const fabOrigin = stack.map((e) => actionOrigin(e.content)).findLast((origin) => origin !== undefined);
  const fab = (
    <button
      type="button"
      className="fab"
      aria-label={t('actions.new')}
      title={t('actions.new')}
      disabled={!babok}
      onClick={() => open({ kind: 'createAction', ...fabOrigin })}
    >
      + {t('actions.fab')}
    </button>
  );

  return (
    // Les références citées dans un texte suivent les besoins et exigences créés, modifiés ou supprimés.
    <ReferencesProvider version={needsVersion + requirementsVersion}>
      <FabContext.Provider value={fab}>
        <main>
          <header>
            <h1>{t('actions.title')}</h1>
            <span>
              <button type="button" onClick={() => open({ kind: 'palette' })}>
                {t('palette.open')} <kbd>{IS_MAC ? '⌘K' : 'Ctrl+K'}</kbd>
              </button>{' '}
              <button type="button" disabled={!babok} onClick={() => open({ kind: 'babok' })}>
                {t('babok.open')}
              </button>{' '}
              <AlertsButton alerts={alerts} />{' '}
              {me?.isAdmin && (
                <>
                  <button type="button" onClick={() => open({ kind: 'admin' })}>
                    {t('admin.open')}
                  </button>{' '}
                </>
              )}
              {user.profile.name ?? user.profile.preferred_username} <LanguageSelector />{' '}
              <button onClick={() => void logout()}>{t('auth.logout')}</button>
            </span>
          </header>
          <ErrorMessage error={error} />
          <MyActions initiatives={[...active, ...archived]} babok={babok} version={actionsVersion} />
          <div className="section-header">
            <h2>{t('initiatives.title')}</h2>
            <button type="button" onClick={() => open({ kind: 'createInitiative' })}>
              {t('initiatives.new')}
            </button>
          </div>
          <InitiativeList initiatives={active} />
          {initiatives.length === 0 && <p>{t('initiatives.empty')}</p>}
          {archived.length > 0 && (
            <details className="archived">
              <summary>{t('initiatives.archivedSection', { count: archived.length })}</summary>
              <InitiativeList initiatives={archived} />
            </details>
          )}
        </main>
        {fab}
        <PanelHost
          render={(content, close) => {
            switch (content.kind) {
              case 'palette':
                // Les archivées après les actives.
                return <Palette initiatives={[...active, ...archived]} babok={babok} onClose={close} />;
              case 'createInitiative':
                return (
                  <CreateInitiativePanel onCreated={(i) => setInitiatives((list) => [i, ...list])} onClose={close} />
                );
              case 'initiative':
                return (
                  <InitiativePanel
                    initiativeId={content.initiativeId}
                    babok={babok}
                    actionsVersion={actionsVersion}
                    stakeholdersVersion={stakeholdersVersion}
                    needsVersion={needsVersion}
                    requirementsVersion={requirementsVersion}
                    onChanged={(changed) => {
                      setInitiatives((list) => list.map((i) => (i.id === changed.id ? changed : i)));
                      setInitiativeVersion((v) => v + 1);
                    }}
                    onDeleted={(id) => setInitiatives((list) => list.filter((i) => i.id !== id))}
                    onClose={close}
                  />
                );
              case 'dashboard':
                return (
                  babok && (
                    <DashboardPanel
                      initiativeId={content.initiativeId}
                      babok={babok}
                      actionsVersion={actionsVersion}
                      dataVersion={[actionsVersion, stakeholdersVersion, needsVersion, requirementsVersion, initiativeVersion].join('-')}
                      onActionCreated={actionsChanged}
                      onClose={close}
                    />
                  )
                );
              case 'alerts':
                return <AlertsPanel alerts={alerts} onSeen={setMe} onClose={close} />;
              case 'member':
                return <MemberPanel member={content.member} onClose={close} />;
              case 'admin':
                return me && <AdminPanel myId={me.id} onClose={close} />;
              case 'babok':
                return babok && <BabokPanel babok={babok} onClose={close} />;
              case 'babokElement': {
                const element = babok && findBabokElement(babok, content.elementId);
                return element && <BabokElementPanel babok={babok} element={element} onClose={close} />;
              }
              case 'createAction':
                return (
                  babok && (
                    <CreateActionPanel
                      babok={babok}
                      initiatives={active}
                      initiativeId={content.initiativeId}
                      from={content.from}
                      onCreated={actionsChanged}
                      onClose={close}
                    />
                  )
                );
              case 'action':
                return (
                  babok && (
                    <ActionPanel
                      babok={babok}
                      initiativeId={content.initiativeId}
                      actionId={content.actionId}
                      stakeholdersVersion={stakeholdersVersion}
                      needsVersion={needsVersion}
                      requirementsVersion={requirementsVersion}
                      onChanged={actionsChanged}
                      onClose={close}
                    />
                  )
                );
              case 'stakeholders':
                return (
                  <StakeholdersPanel initiativeId={content.initiativeId} version={stakeholdersVersion} onClose={close} />
                );
              case 'stakeholder':
                return (
                  <StakeholderPanel
                    babok={babok}
                    initiativeId={content.initiativeId}
                    stakeholderId={content.stakeholderId}
                    actionsVersion={actionsVersion}
                    needsVersion={needsVersion}
                    requirementsVersion={requirementsVersion}
                    onChanged={stakeholdersChanged}
                    onClose={close}
                  />
                );
              case 'need':
                return (
                  <NeedPanel
                    babok={babok}
                    initiativeId={content.initiativeId}
                    needId={content.needId}
                    actionsVersion={actionsVersion}
                    stakeholdersVersion={stakeholdersVersion}
                    requirementsVersion={requirementsVersion}
                    onChanged={needsChanged}
                    onClose={close}
                  />
                );
              case 'requirement':
                return (
                  <RequirementPanel
                    babok={babok}
                    initiativeId={content.initiativeId}
                    requirementId={content.requirementId}
                    actionsVersion={actionsVersion}
                    stakeholdersVersion={stakeholdersVersion}
                    needsVersion={needsVersion}
                    onChanged={requirementsChanged}
                    onClose={close}
                  />
                );
            }
          }}
        />
      </FabContext.Provider>
    </ReferencesProvider>
  );
}

/** Initiative, et objet éventuel, d'où le bouton « + Action » crée l'action depuis ce panneau. */
function actionOrigin(content: PanelContent): { initiativeId: string; from?: AnalysisObjectRef } | undefined {
  switch (content.kind) {
    case 'initiative':
    case 'dashboard':
    case 'action':
    case 'stakeholders':
      return { initiativeId: content.initiativeId };
    case 'stakeholder':
      return { initiativeId: content.initiativeId, ...(content.stakeholderId && { from: { kind: 'stakeholder', id: content.stakeholderId } }) };
    case 'need':
      return { initiativeId: content.initiativeId, ...(content.needId && { from: { kind: 'need', id: content.needId } }) };
    case 'requirement':
      return {
        initiativeId: content.initiativeId,
        ...(content.requirementId && { from: { kind: 'requirement', id: content.requirementId } }),
      };
    default:
      return undefined;
  }
}

function InitiativeList({ initiatives }: { initiatives: InitiativeDto[] }) {
  const { t } = useI18n();
  const { open } = usePanels();
  return (
    <ul className="links">
      {initiatives.map((i) => (
        <li key={i.id}>
          <button type="button" className="link" onClick={() => open({ kind: 'initiative', initiativeId: i.id })}>
            <strong>{i.code}</strong> {i.name}
          </button>{' '}
          <small>{t(`role.${i.myRole}`)}</small>
        </li>
      ))}
    </ul>
  );
}
