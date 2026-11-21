// Alertes dans l'application (ticket 15), sans courriel : badge des nouvelles
// alertes et écran qui les liste, dans la zone de droite (navigation par
// arborescence, N3). Règles dans @app/shared (alerts.ts).
import { memberName, type ActionDto, type Alert, alertKey, localDate, type MeDto, type MessageKey, myAlerts } from '@app/shared';
import { Bell, Clock, type LucideIcon, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from './api';
import { EmptyState } from './empty-state';
import { ScreenLayout } from './data-screen';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { formatDate } from './initiative-sheet';
import { useOpenNode } from './references';
import { useScreens } from './screens';
import { useTicketTypes } from './ticket-types';

const ALERT_GROUPS: { kind: Alert['kind']; title: MessageKey; Icon: LucideIcon }[] = [
  { kind: 'overdue', title: 'alerts.groupOverdue', Icon: Clock },
  { kind: 'assigned', title: 'alerts.groupAssigned', Icon: UserPlus },
];

/** Relecture de mes actions : une attribution par un autre membre ou un changement de jour fait naître une alerte. */
const REFRESH_MS = 60_000;

/**
 * Mes alertes, relues après chaque écriture sur une action et chaque minute ;
 * null tant qu'elles ne sont pas connues.
 */
export function useMyAlerts(me: MeDto | null, actionsVersion: number): Alert[] | null {
  const [actions, setActions] = useState<ActionDto[] | null>(null);
  const ticketTypes = useTicketTypes();
  const [today, setToday] = useState(() => localDate(new Date().toISOString()));

  useEffect(() => {
    const load = () => {
      setToday(localDate(new Date().toISOString()));
      // Sans réponse, les alertes restent celles déjà connues.
      api.listMyActions().then(setActions, () => undefined);
    };
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [actionsVersion]);

  return me && actions ? myAlerts(ticketTypes, actions, me, today) : null;
}

/** Bouton d'en-tête : le badge compte les nouvelles alertes ; il mène à leur écran. */
export function AlertsButton({ alerts, current }: { alerts: Alert[] | null; current: boolean }) {
  const { t } = useI18n();
  const { goTo } = useScreens();
  const count = (alerts ?? []).filter((a) => a.isNew).length;
  return (
    <button
      type="button"
      className="ghost icon-only alerts-button"
      aria-current={current ? 'page' : undefined}
      onClick={() => void goTo({ kind: 'alerts' })}
      aria-label={count > 0 ? t('alerts.openWithNew', { count }) : t('alerts.open')}
      title={t('alerts.open')}
    >
      <Bell />
      {count > 0 && <span className="alert-badge">{count}</span>}
    </button>
  );
}

/**
 * Écran des alertes ; l'ouvrir les marque comme vues (le badge revient à zéro),
 * mais celles qui étaient nouvelles le restent à l'écran tant qu'on y reste.
 */
export function AlertsScreen({ alerts, onSeen }: { alerts: Alert[] | null; onSeen: (me: MeDto) => void }) {
  const { t } = useI18n();
  return (
    <ScreenLayout crumbs={[]} title={t('alerts.title')}>
      {/* Adresse ouverte directement : les alertes arrivent après l'écran. */}
      {alerts ? <AlertList alerts={alerts} onSeen={onSeen} /> : <p>{t('common.loading')}</p>}
    </ScreenLayout>
  );
}

function AlertList({ alerts, onSeen }: { alerts: Alert[]; onSeen: (me: MeDto) => void }) {
  const { t, locale } = useI18n();
  const openNode = useOpenNode();
  // Nouvelles à l'ouverture : elles le restent tant que l'écran est affiché.
  const [newKeys] = useState(() => new Set(alerts.filter((a) => a.isNew).map(alertKey)));
  const [error, setError] = useState<UiError | null>(null);

  useEffect(() => {
    api.markAlertsSeen({ alertKeys: alerts.map(alertKey) }).then(onSeen, (e: unknown) => setError(toUiError(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <ErrorMessage error={error} />
      {alerts.length === 0 && <EmptyState subject="alerts" title={t('alerts.empty')} hint={t('empty.alertsHint')} />}
      {/* Deux groupes, l'échéance dépassée en tête (refonte du design, validé le 01.11.2026). */}
      {ALERT_GROUPS.map(({ kind: groupKind, title, Icon }) => {
        const ofKind = alerts.filter((a) => a.kind === groupKind);
        if (ofKind.length === 0) return null;
        return (
          <section key={groupKind}>
            <h2 className="group-title">
              {t(title)} <span className="count">{ofKind.length}</span>
            </h2>
            <ul className="links dense-list alert-list">
              {ofKind.map(({ kind, action }) => {
                const isNew = newKeys.has(alertKey({ kind, action }));
                return (
                  <li key={alertKey({ kind, action })} className={isNew ? 'is-new' : undefined}>
                    <span className={`alert-icon alert-${kind}`}>
                      <Icon />
                    </span>
                    <button
                      type="button"
                      className="link"
                      onClick={() => openNode(action.initiative.id, { kind: 'ticket', id: action.id })}
                    >
                      <span className="code">{action.reference}</span> {action.title}
                    </button>
                    {isNew && <span className="badge tone-progress">{t('alerts.new')}</span>}
                    <small className="alert-detail">
                      {kind === 'overdue'
                        ? t('alerts.overdue', { date: formatDate(locale, action.dueDate!) })
                        : t('alerts.assigned', {
                            name: memberName(action.assignedBy),
                            date: formatDate(locale, action.assignedAt),
                          })}
                    </small>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </>
  );
}
