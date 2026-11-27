// Assistant (spécification .scratch/assistant/spec.md, textes du ticket 08) : bouton
// « Demander à l'assistant », fenêtre de la demande, onglet « Assistant » et carte
// de l'avis. Absent sans assistant installé (AS25). Composants maison (ADR-0017),
// tokens de design (ADR-0018). Règles dans @app/shared (assistant-requests.ts).
import {
  type AssistantMode,
  type AssistantRequestDto,
  ASSISTANT_MODES,
  canAskAgain,
  canCancel,
  DEFAULT_ASSISTANT_MODE,
  isFinalStatus,
  type Locale,
  type MessageKey,
  OFFERED_ASSISTANT_USAGES,
  type OfferedAssistantUsage,
  queuePositionMessage,
  type UnfinishedRequestBody,
} from '@app/shared';
import { AlertTriangle, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from './api';
import { isAssistantInstalled } from './auth';
import { Dialog, useDialogs } from './dialogs';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { formatDate } from './initiative-sheet';
import { RichText } from './rich-text';
import { useUnsavedForm } from './unsaved-changes';

/** Intervalle de relecture tant qu'une demande n'est pas terminée. */
const POLL_MS = 10_000;

/** Prévient les écrans qu'une demande vient d'être posée. */
const requested = new EventTarget();

/** Mes demandes sur l'initiative, relues tant qu'une demande n'est pas terminée. */
export function useAssistantRequests(initiativeId: string): AssistantRequestDto[] | null {
  // Rangées avec leur initiative : celles d'une autre initiative ne s'affichent pas.
  const [loaded, setLoaded] = useState<{ initiativeId: string; list: AssistantRequestDto[] } | null>(null);
  const installed = isAssistantInstalled();
  const requests = loaded?.initiativeId === initiativeId ? loaded.list : null;

  const load = useCallback(() => {
    api.listAssistantRequests(initiativeId).then(
      (list) => setLoaded({ initiativeId, list }),
      () => setLoaded({ initiativeId, list: [] }),
    );
  }, [initiativeId]);

  useEffect(() => {
    if (!installed) return;
    load();
    requested.addEventListener('requested', load);
    return () => requested.removeEventListener('requested', load);
  }, [installed, load]);

  const unfinished = requests?.some((r) => !isFinalStatus(r.status)) ?? false;
  useEffect(() => {
    if (!unfinished) return;
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [unfinished, load]);

  return installed ? requests : null;
}

/** Bouton de l'en-tête de l'écran de données : initiative et tableau de bord (AS22). */
export function AskAssistantButton({ initiativeId }: { initiativeId: string }) {
  const { t } = useI18n();
  const { open } = useDialogs();
  if (!isAssistantInstalled()) return null;
  return (
    <button type="button" onClick={() => open({ kind: 'askAssistant', initiativeId })}>
      <Sparkles aria-hidden="true" />
      {t('assistant.ask')}
    </button>
  );
}

/** Ce qui sera transmis, avant l'envoi, et « Données lues » de l'avis (ticket 08). */
const SENT: readonly MessageKey[] = [
  'assistant.sent.babokTasks',
  'assistant.sent.sheet',
  'assistant.sent.analysis',
  'assistant.sent.tickets',
  'assistant.sent.suggested',
  'assistant.sent.pageList',
  'assistant.sent.facts',
];
const NOT_SENT: readonly MessageKey[] = [
  'assistant.notSent.pageContents',
  'assistant.notSent.comments',
  'assistant.notSent.history',
  'assistant.notSent.attachments',
  'assistant.notSent.closedDescriptions',
  'assistant.notSent.previousAdvice',
];

function Transmitted({ title, initiallyOpen }: { title: MessageKey; initiallyOpen: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <section className="assistant-transmitted">
      <button type="button" className="link assistant-disclosure" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
        {t(title)}
      </button>
      {open && (
        <div className="assistant-transmitted-cols">
          <div>
            <h4>{t('assistant.sentTitle')}</h4>
            <ul>
              {SENT.map((key) => (
                <li key={key}>{t(key)}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4>{t('assistant.notSentTitle')}</h4>
            <ul>
              {NOT_SENT.map((key) => (
                <li key={key}>{t(key)}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

/** Fenêtre de la demande (AS12, AS22) : usage, mode, encadré, envoi, puis position dans la file. */
export function AskAssistantDialog({
  initiativeId,
  initialMode = DEFAULT_ASSISTANT_MODE,
  onClose,
}: {
  initiativeId: string;
  /** Mode repris par « Reposer la question », modifiable avant l'envoi (AS7, AS12). */
  initialMode?: AssistantMode;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  // Un seul usage proposé pour l'instant (Faire le point) : son choix viendra avec les suivants.
  const [usage] = useState<OfferedAssistantUsage>(OFFERED_ASSISTANT_USAGES[0]);
  const [mode, setMode] = useState<AssistantMode>(initialMode);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<UiError | null>(null);
  const [sent, setSent] = useState<AssistantRequestDto | null>(null);
  const submit = useUnsavedForm({ usage, mode }, send);

  async function send(): Promise<boolean> {
    setSending(true);
    setError(null);
    try {
      setSent(await api.createAssistantRequest(initiativeId, { usage, mode, locale }));
      requested.dispatchEvent(new Event('requested'));
      return true;
    } catch (e) {
      setError(refusalError(e, t));
      return false;
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog title={t('assistant.ask')} onClose={onClose}>
      {sent ? (
        <div className="assistant-sent">
          <RequestProgress request={sent} />
        </div>
      ) : (
        <form className="assistant-form" onSubmit={submit}>
          <p className="assistant-usage">
            <strong>{t(`assistant.usage.${usage}`)}</strong>
            <small>{t(`assistant.usageHint.${usage}`)}</small>
          </p>
          <fieldset className="assistant-modes">
            <legend>{t('assistant.modeQuestion')}</legend>
            {ASSISTANT_MODES.map((m) => (
              <label key={m} className={mode === m ? 'is-checked' : ''}>
                <input type="radio" name="assistant-mode" checked={mode === m} onChange={() => setMode(m)} />
                <span>
                  <strong>{t(`assistant.mode.${m}`)}</strong>
                  <small>{t(`assistant.modeHint.${m}`)}</small>
                </span>
              </label>
            ))}
          </fieldset>
          {mode === 'thorough' && (
            <p className="assistant-warning">
              <AlertTriangle aria-hidden="true" />
              {t('assistant.thoroughWarning')}
            </p>
          )}
          <Transmitted title="assistant.transmitted" initiallyOpen={false} />
          <ErrorMessage error={error} />
          <div className="section-buttons">
            <button type="submit" className="primary" disabled={sending} data-autofocus>
              <Sparkles aria-hidden="true" />
              {t('assistant.send')}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

/** Refus de l'envoi ; « demande non terminée » nomme la demande qui attend (AS3, ticket 08). */
function refusalError(error: unknown, t: (key: MessageKey, params?: Record<string, string | number>) => string): UiError {
  if (error instanceof ApiError && error.refusal === 'unfinished') {
    const body = error.body as UnfinishedRequestBody;
    return {
      key: 'assistant.refusal.unfinished',
      params: { usage: t(`assistant.usage.${body.usage}`), status: t(`assistantStatus.${body.status}`).toLowerCase() },
    };
  }
  return toUiError(error);
}

/** Date et heure de lecture : 26.11.2026 à 14:32 (ticket 08). */
function readAtText(locale: Locale, iso: string, t: (key: MessageKey, params?: Record<string, string>) => string) {
  const at = new Date(iso);
  const date = new Intl.DateTimeFormat(locale === 'fr' ? 'fr-CH' : 'en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(at);
  const time = new Intl.DateTimeFormat(locale === 'fr' ? 'fr-CH' : 'en-GB', { hour: '2-digit', minute: '2-digit' }).format(at);
  return t('assistant.readAt', { date, time });
}

const STATUS_TONE = {
  pending: 'neutral',
  running: 'progress',
  answered: 'positive',
  failed: 'negative',
  cancelled: 'muted',
} as const;

/** Onglet « Assistant » de l'initiative (AS22) : mes demandes, en cartes repliables. */
export function AssistantRequests({ requests }: { requests: AssistantRequestDto[] | null }) {
  const { t } = useI18n();
  if (!requests) return <p>{t('common.loading')}</p>;
  return (
    <div className="assistant-requests">
      <p className="muted">{t('assistant.privacy')}</p>
      {requests.length === 0 ? (
        <p>{t('assistant.empty')}</p>
      ) : (
        requests.map((request, index) => <RequestCard key={request.id} request={request} initiallyOpen={index === 0} />)
      )}
    </div>
  );
}

function RequestCard({ request, initiallyOpen }: { request: AssistantRequestDto; initiallyOpen: boolean }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <details className="assistant-request" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        <strong>{t(`assistant.usage.${request.usage}`)}</strong>
        <span className={`badge status tone-${STATUS_TONE[request.status]}`}>{t(`assistantStatus.${request.status}`)}</span>
        <small className="muted">{formatDate(locale, request.createdAt)}</small>
      </summary>
      <div className="assistant-request-body">
        <RequestProgress request={request} />
        {request.status === 'answered' && request.advice && <AdviceCard request={request} advice={request.advice} />}
        {canCancel(request.status) && <CancelRequest request={request} />}
        {canAskAgain(request.status) && <AskAgain request={request} />}
      </div>
    </details>
  );
}

/** « Annuler la demande », après confirmation (AS6, ticket 08). */
function CancelRequest({ request }: { request: AssistantRequestDto }) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<UiError | null>(null);
  const confirmId = `assistant-cancel-${request.id}`;

  async function cancel() {
    try {
      await api.cancelAssistantRequest(request.initiativeId, request.id);
      requested.dispatchEvent(new Event('requested'));
    } catch (e) {
      setConfirming(false);
      setError(toUiError(e));
    }
  }

  return (
    <div className="section-buttons">
      {confirming ? (
        <div role="alertdialog" aria-labelledby={confirmId} className="confirm">
          <p id={confirmId}>{t('assistant.cancelConfirm')}</p>
          <button type="button" autoFocus onClick={() => setConfirming(false)}>
            {t('common.no')}
          </button>{' '}
          <button type="button" className="danger" onClick={() => void cancel()}>
            {t('common.yes')}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)}>
          {t('assistant.cancel')}
        </button>
      )}
      <ErrorMessage error={error} />
    </div>
  );
}

/** « Reposer la question » : une nouvelle demande, même usage et même mode, modifiables (AS7, AS12). */
function AskAgain({ request }: { request: AssistantRequestDto }) {
  const { t } = useI18n();
  const { open } = useDialogs();
  return (
    <div className="section-buttons">
      <button type="button" onClick={() => open({ kind: 'askAssistant', initiativeId: request.initiativeId, mode: request.mode })}>
        <Sparkles aria-hidden="true" />
        {t('assistant.askAgain')}
      </button>
    </div>
  );
}

/** Où en est une demande qui n'a pas d'avis : file, travail en cours, échec ou annulation (ticket 08). */
function RequestProgress({ request }: { request: AssistantRequestDto }) {
  const { t, locale } = useI18n();
  switch (request.status) {
    case 'pending':
      return (
        <>
          {request.queueAhead != null && <p>{queuePositionMessage(locale, request.queueAhead)}</p>}
          {request.assistantUnavailable && <p className="assistant-warning">{t('assistant.unavailable')}</p>}
          <p className="muted">{t('assistant.waitingLeave')}</p>
        </>
      );
    case 'running':
      return <p>{t('assistant.working', { minutes: request.timeoutMinutes ?? '' })}</p>;
    case 'failed':
      return request.failureReason && <p>{t('assistant.failed', { reason: t(`assistantFailure.${request.failureReason}`) })}</p>;
    case 'cancelled':
      return (
        request.cancellationReason && (
          <p>{t('assistant.cancelled', { reason: t(`assistantCancellation.${request.cancellationReason}`) })}</p>
        )
      );
    case 'answered':
      return null;
  }
}

/**
 * Avis (AS22, AS30) : bordure en pointillés, étiquette et icône de l'assistant,
 * pour ne pas le confondre avec une action suggérée ; texte en Markdown (AS27) ;
 * phrase de nature ajoutée par ACTA, jamais demandée au modèle.
 */
function AdviceCard({ request, advice }: { request: AssistantRequestDto; advice: string }) {
  const { t, locale } = useI18n();
  return (
    <article className="assistant-advice">
      <header>
        <span className="assistant-advice-kicker">
          <Sparkles aria-hidden="true" />
          {t('assistant.adviceKicker')}
        </span>
        <small className="muted">
          {request.readAt && readAtText(locale, request.readAt, t)} · {t(`assistant.mode.${request.mode}`)}
        </small>
      </header>
      <div className="assistant-advice-text">
        <RichText source={advice} />
      </div>
      <p className="assistant-nature">{t('assistant.nature')}</p>
      <Transmitted title="assistant.dataRead" initiallyOpen={false} />
    </article>
  );
}
