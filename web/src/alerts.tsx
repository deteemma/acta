// Alertes dans l'application (ticket 15), sans courriel : badge des nouvelles
// alertes et panneau qui les liste. Règles dans @app/shared (alerts.ts).
import { type ActionDto, type Alert, alertKey, localDate, type MeDto, myAlerts } from '@app/shared';
import { useEffect, useState } from 'react';
import { api } from './api';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { formatDate } from './initiative-panels';
import { Panel, usePanels } from './panels';
import { memberName } from './team-section';

/** Relecture de mes actions : une attribution par un autre membre ou un changement de jour fait naître une alerte. */
const REFRESH_MS = 60_000;

/** Mes alertes, relues après chaque écriture sur une action et chaque minute. */
export function useMyAlerts(me: MeDto | null, actionsVersion: number): Alert[] {
  const [actions, setActions] = useState<ActionDto[]>([]);
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

  return me ? myAlerts(actions, me, today) : [];
}

/** Bouton d'en-tête : le badge compte les nouvelles alertes. */
export function AlertsButton({ alerts }: { alerts: Alert[] }) {
  const { t } = useI18n();
  const { open } = usePanels();
  const count = alerts.filter((a) => a.isNew).length;
  return (
    <button
      type="button"
      onClick={() => open({ kind: 'alerts' })}
      aria-label={count > 0 ? t('alerts.openWithNew', { count }) : t('alerts.open')}
    >
      {t('alerts.open')}
      {count > 0 && <span className="alert-badge">{count}</span>}
    </button>
  );
}

/**
 * Liste des alertes ; l'ouvrir les marque comme vues (le badge revient à zéro),
 * mais celles qui étaient nouvelles le restent à l'écran tant que le panneau est ouvert.
 */
export function AlertsPanel({
  alerts,
  onSeen,
  onClose,
}: {
  alerts: Alert[];
  onSeen: (me: MeDto) => void;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const { open } = usePanels();
  // Nouvelles à l'ouverture : elles le restent à l'écran tant que le panneau est ouvert.
  const [newKeys] = useState(() => new Set(alerts.filter((a) => a.isNew).map(alertKey)));
  const [error, setError] = useState<UiError | null>(null);

  useEffect(() => {
    api.markAlertsSeen({ alertKeys: alerts.map(alertKey) }).then(onSeen, (e: unknown) => setError(toUiError(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Panel title={t('alerts.title')} onClose={onClose}>
      <ErrorMessage error={error} />
      {alerts.length === 0 && <p>{t('alerts.empty')}</p>}
      <ul className="links alert-list">
        {alerts.map(({ kind, action }) => (
          <li key={alertKey({ kind, action })}>
            <button
              type="button"
              className="link"
              onClick={() => open({ kind: 'action', initiativeId: action.initiative.id, actionId: action.id })}
            >
              <strong>{action.initiative.code}</strong> {action.title}
            </button>
            <small>
              {kind === 'overdue'
                ? t('alerts.overdue', { date: formatDate(locale, action.dueDate!) })
                : t('alerts.assigned', {
                    name: memberName(action.assignedBy),
                    date: formatDate(locale, action.assignedAt),
                  })}
            </small>
            {newKeys.has(alertKey({ kind, action })) && <span className="badge">{t('alerts.new')}</span>}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
