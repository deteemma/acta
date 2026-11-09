// Liens (ticket 19, décision 04) : section « Liens » de la fiche d'un ticket, et
// tickets liés d'un besoin ou d'une exigence. Un lien se crée ou se retire depuis
// l'un ou l'autre objet. Règles dans @app/shared (links.ts, roles.ts).
import {
  type InitiativeLinksDto,
  type LinkEnd,
  linkCandidates,
  LINK_SIDES,
  type LinkSide,
  linksOfTicket,
  type NeedDto,
  type RequirementDto,
  type TicketRow,
  ticketsLinkedTo,
} from '@app/shared';
import { type ReactNode, useEffect, useState } from 'react';
import { api } from './api';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { usePanels } from './panels';
import { TicketStatusLabel, ticketTarget } from './ticket-parts';
import { useUnsavedForm } from './unsaved-changes';

/** Ce que l'on lie depuis un ticket : un autre ticket, avec la nature vue d'ici, ou un besoin, ou une exigence. */
type Relation = LinkSide | 'need' | 'requirement';

interface LinkData {
  links: InitiativeLinksDto;
  tickets: TicketRow[];
  needs: NeedDto[];
  requirements: RequirementDto[];
}

/** Liens de l'initiative et objets qu'ils relient ; rechargés à chaque écriture sur un ticket ou un lien. */
function useLinkData(initiativeId: string, version: number, withAnalysis: boolean) {
  const [data, setData] = useState<LinkData | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  useEffect(() => {
    Promise.all([
      api.listLinks(initiativeId),
      api.listTickets(initiativeId),
      withAnalysis ? api.listNeeds(initiativeId) : Promise.resolve([]),
      withAnalysis ? api.listRequirements(initiativeId) : Promise.resolve([]),
    ]).then(
      ([links, tickets, needs, requirements]) => setData({ links, tickets, needs, requirements }),
      (e: unknown) => setError(toUiError(e)),
    );
  }, [initiativeId, version, withAnalysis]);
  return { data, setLinks: (links: InitiativeLinksDto) => setData((d) => d && { ...d, links }), error };
}

function TicketButton({ initiativeId, ticket }: { initiativeId: string; ticket: TicketRow }) {
  const { open } = usePanels();
  return (
    <>
      <button type="button" className="link" onClick={() => open(ticketTarget(initiativeId, ticket))}>
        <span className="code">{ticket.reference}</span> {ticket.title}
      </button>{' '}
      <TicketStatusLabel type={ticket.type} status={ticket.status} />
    </>
  );
}

function RemoveButton({ reference, onRemove }: { reference: string; onRemove: () => void }) {
  const { t } = useI18n();
  return (
    <button type="button" className="ghost link-remove" aria-label={t('link.removeLabel', { reference })} onClick={onRemove}>
      {t('link.remove')}
    </button>
  );
}

/**
 * Section « Liens » de la fiche d'un ticket, tout type : tickets liés avec la nature
 * vue de ce ticket, besoins et exigences. Hors de l'historique du ticket.
 */
export function TicketLinks({
  initiativeId,
  ticketId,
  canEdit,
  version,
  onChanged,
}: {
  initiativeId: string;
  ticketId: string;
  /** Propriétaire ou contributeur, initiative non archivée. */
  canEdit: boolean;
  /** Change à chaque écriture sur un ticket ou un lien. */
  version: number;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const { open } = usePanels();
  const { data, setLinks, error: loadError } = useLinkData(initiativeId, version, true);
  const [error, setError] = useState<UiError | null>(null);
  if (!data) return <ErrorMessage error={loadError} />;
  const shown = linksOfTicket(data.links, ticketId, data);
  const empty = shown.tickets.length + shown.needs.length + shown.requirements.length === 0;

  async function remove(run: () => Promise<void>) {
    try {
      await run();
      setError(null);
      onChanged();
    } catch (e) {
      setError(toUiError(e));
    }
  }

  return (
    <section className="links-section">
      <h3 className="group-title">{t('link.section')}</h3>
      {empty && (
        <p>
          <small>{t('link.none')}</small>
        </p>
      )}
      {shown.tickets.length > 0 && (
        <>
          <h4 className="section-title">
            {t('link.tickets')} <span className="count">{shown.tickets.length}</span>
          </h4>
          <ul className="links">
            {shown.tickets.map(({ side, ticket }) => (
              <li key={ticket.id}>
                <span className="link-side">{t(`linkSide.${side}`)}</span> <TicketButton initiativeId={initiativeId} ticket={ticket} />
                {canEdit && (
                  <RemoveButton
                    reference={ticket.reference}
                    onRemove={() => void remove(() => api.removeTicketLink(initiativeId, ticketId, ticket.id))}
                  />
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {shown.needs.length > 0 && (
        <>
          <h4 className="section-title">
            {t('link.needs')} <span className="count">{shown.needs.length}</span>
          </h4>
          <ul className="links">
            {shown.needs.map((need) => (
              <li key={need.id}>
                <button type="button" className="link" onClick={() => open({ kind: 'need', initiativeId, needId: need.id })}>
                  <strong>{need.reference}</strong> {need.title}
                </button>
                {canEdit && (
                  <RemoveButton
                    reference={need.reference}
                    onRemove={() => void remove(() => api.removeNeedLink(initiativeId, ticketId, need.id))}
                  />
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {shown.requirements.length > 0 && (
        <>
          <h4 className="section-title">
            {t('link.requirements')} <span className="count">{shown.requirements.length}</span>
          </h4>
          <ul className="links">
            {shown.requirements.map((requirement) => (
              <li key={requirement.id}>
                <button
                  type="button"
                  className="link"
                  onClick={() => open({ kind: 'requirement', initiativeId, requirementId: requirement.id })}
                >
                  <strong>{requirement.reference}</strong> {requirement.title}
                </button>
                {canEdit && (
                  <RemoveButton
                    reference={requirement.reference}
                    onRemove={() => void remove(() => api.removeRequirementLink(initiativeId, ticketId, requirement.id))}
                  />
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      <ErrorMessage error={error} />
      {canEdit && (
        <AddLinkForm
          end={{ kind: 'ticket', id: ticketId }}
          data={data}
          onCreate={async (relation, objectId) => {
            if (relation === 'need') return api.createNeedLink(initiativeId, { ticketId, needId: objectId });
            if (relation === 'requirement') return api.createRequirementLink(initiativeId, { ticketId, requirementId: objectId });
            return api.createTicketLink(initiativeId, { ticketId, otherTicketId: objectId, side: relation });
          }}
          onCreated={(links) => {
            setLinks(links);
            onChanged();
          }}
        />
      )}
    </section>
  );
}

/**
 * Tickets liés à un besoin ou à une exigence, de tout type, par référence ; on en
 * lie d'autres et on en retire depuis cette fiche. `actions` : boutons d'en-tête.
 */
export function LinkedTickets({
  initiativeId,
  end,
  canEdit,
  version,
  onChanged,
  actions,
}: {
  initiativeId: string;
  end: LinkEnd & { kind: 'need' | 'requirement' };
  canEdit: boolean;
  /** Change à chaque écriture sur un ticket ou un lien. */
  version: number;
  onChanged: () => void;
  actions?: ReactNode;
}) {
  const { t } = useI18n();
  const { data, setLinks, error: loadError } = useLinkData(initiativeId, version, false);
  const [error, setError] = useState<UiError | null>(null);
  if (!data) return <ErrorMessage error={loadError} />;
  const tickets = ticketsLinkedTo(data.links, end, data.tickets);

  async function remove(ticketId: string) {
    try {
      await (end.kind === 'need'
        ? api.removeNeedLink(initiativeId, ticketId, end.id)
        : api.removeRequirementLink(initiativeId, ticketId, end.id));
      setError(null);
      onChanged();
    } catch (e) {
      setError(toUiError(e));
    }
  }

  return (
    <>
      <div className="section-header">
        <h4>
          {t(end.kind === 'need' ? 'need.tickets' : 'requirement.tickets')} <span className="count">{tickets.length}</span>
        </h4>
        {actions}
      </div>
      {tickets.length === 0 ? (
        <p>{t(end.kind === 'need' ? 'need.noTickets' : 'requirement.noTickets')}</p>
      ) : (
        <ul className="links">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <TicketButton initiativeId={initiativeId} ticket={ticket} />
              {canEdit && <RemoveButton reference={ticket.reference} onRemove={() => void remove(ticket.id)} />}
            </li>
          ))}
        </ul>
      )}
      <ErrorMessage error={error} />
      {canEdit && (
        <AddLinkForm
          end={end}
          data={data}
          onCreate={(_relation, ticketId) =>
            end.kind === 'need'
              ? api.createNeedLink(initiativeId, { ticketId, needId: end.id })
              : api.createRequirementLink(initiativeId, { ticketId, requirementId: end.id })
          }
          onCreated={(links) => {
            setLinks(links);
            onChanged();
          }}
        />
      )}
    </>
  );
}

/**
 * Ajout d'un lien : depuis un ticket, la nature (ou besoin, exigence) puis l'objet ;
 * depuis un besoin ou une exigence, le ticket. Ne sont proposés ni l'objet lui-même
 * ni ceux déjà liés. Vidé une fois le lien créé.
 */
function AddLinkForm({
  end,
  data,
  onCreate,
  onCreated,
}: {
  end: LinkEnd;
  data: LinkData;
  onCreate: (relation: Relation, objectId: string) => Promise<InitiativeLinksDto>;
  onCreated: (links: InitiativeLinksDto) => void;
}) {
  const { t } = useI18n();
  const fromTicket = end.kind === 'ticket';
  const [relation, setRelation] = useState<Relation>(fromTicket ? 'relates_to' : 'need');
  const [objectId, setObjectId] = useState('');
  const [error, setError] = useState<UiError | null>(null);
  const initial = { relation: fromTicket ? 'relates_to' : 'need', objectId: '' };
  const submit = useUnsavedForm({ relation, objectId }, create);
  const candidates = linkCandidates(data.links, end, data);
  const options: { id: string; reference: string; title: string }[] =
    relation === 'need' && fromTicket ? candidates.needs : relation === 'requirement' ? candidates.requirements : candidates.tickets;

  async function create() {
    if (!objectId) return false;
    try {
      onCreated(await onCreate(relation, objectId));
      setError(null);
      setRelation(initial.relation as Relation);
      setObjectId('');
      return initial;
    } catch (e) {
      setError(toUiError(e));
      return false;
    }
  }

  return (
    <form className="stacked add-link" onSubmit={submit}>
      <h4 className="section-title">{t('link.add')}</h4>
      {fromTicket && (
        <label>
          {t('link.relation')}
          <select
            value={relation}
            onChange={(e) => {
              setRelation(e.target.value as Relation);
              setObjectId('');
            }}
          >
            <optgroup label={t('link.ticketGroup')}>
              {LINK_SIDES.map((side) => (
                <option key={side} value={side}>
                  {t(`linkSide.${side}`)}
                </option>
              ))}
            </optgroup>
            <option value="need">{t('link.toNeed')}</option>
            <option value="requirement">{t('link.toRequirement')}</option>
          </select>
        </label>
      )}
      {options.length === 0 ? (
        <p>
          <small>{t('link.noCandidate')}</small>
        </p>
      ) : (
        <>
          <label>
            {fromTicket ? t('link.object') : t('link.ticketGroup')}
            <select value={objectId} onChange={(e) => setObjectId(e.target.value)}>
              <option value="" disabled>
                {t('link.choose')}
              </option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.reference} {o.title}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={!objectId}>
            {t('link.create')}
          </button>
        </>
      )}
      <p>
        <small>{t('link.hint')}</small>
      </p>
      <ErrorMessage error={error} />
    </form>
  );
}
