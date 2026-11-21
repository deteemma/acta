// Liens (tickets 19 et 25, décision 04) : section « Liens » de la fiche d'un ticket
// et d'une page, tickets et pages liés d'un besoin ou d'une exigence. Un lien se
// crée ou se retire depuis l'un ou l'autre objet. Règles dans @app/shared
// (links.ts, roles.ts).
import {
  type InitiativeLinksDto,
  type LinkEnd,
  linkCandidates,
  LINK_SIDES,
  type LinkSide,
  linksOfPage,
  linksOfTicket,
  type NeedDto,
  PAGE_LINK_OBJECT_KINDS,
  type PageLinkObjectKind,
  pagesLinkedTo,
  type PageRow,
  type RequirementDto,
  type TicketRow,
  ticketsLinkedTo,
} from '@app/shared';
import { type ReactNode, useEffect, useState } from 'react';
import { api } from './api';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { NeedLink } from './need-screen';
import { usePanels } from './panels';
import { useScreens } from './screens';
import { TicketStatusLabel, ticketTarget } from './ticket-parts';
import { useUnsavedForm } from './unsaved-changes';

/**
 * Ce que l'on lie : depuis un ticket, un autre ticket avec la nature vue d'ici ;
 * `ticket` sans nature depuis une page, un besoin ou une exigence ; un besoin, une
 * exigence ou une page.
 */
type Relation = LinkSide | 'ticket' | 'need' | 'requirement' | 'page';

export interface LinkData {
  links: InitiativeLinksDto;
  tickets: TicketRow[];
  needs: NeedDto[];
  requirements: RequirementDto[];
  pages: PageRow[];
}

/** Liens de l'initiative et objets qu'ils relient ; rechargés à chaque écriture sur un objet ou un lien. */
export function useLinkData(initiativeId: string, version: number, withAnalysis: boolean) {
  const [data, setData] = useState<LinkData | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  useEffect(() => {
    Promise.all([
      api.listLinks(initiativeId),
      api.listTickets(initiativeId),
      withAnalysis ? api.listNeeds(initiativeId) : Promise.resolve([]),
      withAnalysis ? api.listRequirements(initiativeId) : Promise.resolve([]),
      api.listPages(initiativeId),
    ]).then(
      ([links, tickets, needs, requirements, pages]) => setData({ links, tickets, needs, requirements, pages }),
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

/** Une page s'ouvre sur l'écran Pages, panneaux fermés (ticket 22, choix 6). */
function PageButton({ initiativeId, page }: { initiativeId: string; page: PageRow }) {
  const { goTo } = useScreens();
  return (
    <button type="button" className="link" onClick={() => void goTo({ kind: 'pages', initiativeId, pageId: page.id })}>
      <span className="code">{page.reference}</span> {page.title}
    </button>
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

/** Un groupe de la section « Liens » : titre avec le nombre, puis les objets. */
function LinkGroup<O extends { id: string; reference: string }>({
  title,
  items,
  render,
  onRemove,
}: {
  title: string;
  items: readonly O[];
  render: (item: O) => ReactNode;
  /** Absent : pas de droit d'écriture. */
  onRemove?: (item: O) => void;
}) {
  if (items.length === 0) return null;
  return (
    <>
      <h4 className="section-title">
        {title} <span className="count">{items.length}</span>
      </h4>
      <ul className="links">
        {items.map((item) => (
          <li key={item.id}>
            {render(item)}
            {onRemove && <RemoveButton reference={item.reference} onRemove={() => onRemove(item)} />}
          </li>
        ))}
      </ul>
    </>
  );
}

/** Retire un lien puis prévient la fiche ; l'erreur s'affiche dans la section. */
function useRemove(onChanged: () => void) {
  const [error, setError] = useState<UiError | null>(null);
  async function remove(run: () => Promise<void>) {
    try {
      await run();
      setError(null);
      onChanged();
    } catch (e) {
      setError(toUiError(e));
    }
  }
  return { error, remove: (run: () => Promise<void>) => void remove(run) };
}

/**
 * Section « Liens » de la fiche d'un ticket, tout type : tickets liés avec la nature
 * vue de ce ticket, besoins, exigences et pages. Hors de l'historique du ticket.
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
  const { error, remove } = useRemove(onChanged);
  if (!data) return <ErrorMessage error={loadError} />;
  const shown = linksOfTicket(data.links, ticketId, data);
  const pages = pagesLinkedTo(data.links, { kind: 'ticket', id: ticketId }, data.pages);
  const empty = shown.tickets.length + shown.needs.length + shown.requirements.length + pages.length === 0;
  const linkedTickets = shown.tickets.map(({ side, ticket }) => ({ id: ticket.id, reference: ticket.reference, side, ticket }));

  return (
    <section className="links-section">
      <h3 className="group-title">{t('link.section')}</h3>
      {empty && (
        <p>
          <small>{t('link.none')}</small>
        </p>
      )}
      <LinkGroup
        title={t('link.tickets')}
        items={linkedTickets}
        render={({ side, ticket }) => (
          <>
            <span className="link-side">{t(`linkSide.${side}`)}</span> <TicketButton initiativeId={initiativeId} ticket={ticket} />
          </>
        )}
        onRemove={canEdit ? ({ ticket }) => remove(() => api.removeTicketLink(initiativeId, ticketId, ticket.id)) : undefined}
      />
      <LinkGroup
        title={t('link.needs')}
        items={shown.needs}
        render={(need) => (
          <NeedLink initiativeId={initiativeId} need={need} />
        )}
        onRemove={canEdit ? (need) => remove(() => api.removeNeedLink(initiativeId, ticketId, need.id)) : undefined}
      />
      <LinkGroup
        title={t('link.requirements')}
        items={shown.requirements}
        render={(requirement) => (
          <button type="button" className="link" onClick={() => open({ kind: 'requirement', initiativeId, requirementId: requirement.id })}>
            <strong>{requirement.reference}</strong> {requirement.title}
          </button>
        )}
        onRemove={canEdit ? (requirement) => remove(() => api.removeRequirementLink(initiativeId, ticketId, requirement.id)) : undefined}
      />
      <LinkGroup
        title={t('link.pages')}
        items={pages}
        render={(page) => <PageButton initiativeId={initiativeId} page={page} />}
        onRemove={canEdit ? (page) => remove(() => api.removePageLink(initiativeId, page.id, 'ticket', ticketId)) : undefined}
      />
      <ErrorMessage error={error} />
      {canEdit && (
        <AddLinkForm
          end={{ kind: 'ticket', id: ticketId }}
          data={data}
          relations={[...LINK_SIDES, 'need', 'requirement', 'page']}
          onCreate={async (relation, objectId) => {
            if (relation === 'need') return api.createNeedLink(initiativeId, { ticketId, needId: objectId });
            if (relation === 'requirement') return api.createRequirementLink(initiativeId, { ticketId, requirementId: objectId });
            if (relation === 'page') return api.createPageLink(initiativeId, { pageId: objectId, object: { kind: 'ticket', id: ticketId } });
            if (relation === 'ticket') throw new Error('un lien entre tickets a une nature');
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
 * Section « Liens » d'une page, en bas du document (ticket 25) : tickets de tout
 * type, besoins et exigences, sans nature ; jamais une autre page. Les données
 * viennent de l'écran, qui s'en sert aussi pour le refus de suppression.
 */
export function PageLinks({
  initiativeId,
  pageId,
  data,
  canEdit,
  onLinks,
  onChanged,
}: {
  initiativeId: string;
  pageId: string;
  data: LinkData;
  /** Propriétaire ou contributeur, initiative non archivée. */
  canEdit: boolean;
  /** Liens renvoyés par l'API après une création. */
  onLinks: (links: InitiativeLinksDto) => void;
  /** Après un retrait : les fiches ouvertes se relisent. */
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const { open } = usePanels();
  const { error, remove } = useRemove(onChanged);
  const shown = linksOfPage(data.links, pageId, data);
  const empty = shown.tickets.length + shown.needs.length + shown.requirements.length === 0;
  const removeLink = (kind: PageLinkObjectKind, objectId: string) =>
    remove(() => api.removePageLink(initiativeId, pageId, kind, objectId));

  return (
    <section className="links-section page-links">
      <h3 className="group-title">{t('link.section')}</h3>
      {empty && (
        <p>
          <small>{t('link.none')}</small>
        </p>
      )}
      <LinkGroup
        title={t('link.tickets')}
        items={shown.tickets}
        render={(ticket) => <TicketButton initiativeId={initiativeId} ticket={ticket} />}
        onRemove={canEdit ? (ticket) => removeLink('ticket', ticket.id) : undefined}
      />
      <LinkGroup
        title={t('link.needs')}
        items={shown.needs}
        render={(need) => (
          <NeedLink initiativeId={initiativeId} need={need} />
        )}
        onRemove={canEdit ? (need) => removeLink('need', need.id) : undefined}
      />
      <LinkGroup
        title={t('link.requirements')}
        items={shown.requirements}
        render={(requirement) => (
          <button type="button" className="link" onClick={() => open({ kind: 'requirement', initiativeId, requirementId: requirement.id })}>
            <strong>{requirement.reference}</strong> {requirement.title}
          </button>
        )}
        onRemove={canEdit ? (requirement) => removeLink('requirement', requirement.id) : undefined}
      />
      <ErrorMessage error={error} />
      {canEdit && (
        <AddLinkForm
          end={{ kind: 'page', id: pageId }}
          data={data}
          relations={['ticket', 'need', 'requirement']}
          hint={t('link.pageHint')}
          onCreate={(relation, objectId) => {
            const kind = PAGE_LINK_OBJECT_KINDS.find((k) => k === relation);
            if (!kind) throw new Error(`relation inattendue depuis une page : ${relation}`);
            return api.createPageLink(initiativeId, { pageId, object: { kind, id: objectId } });
          }}
          onCreated={(links) => {
            onLinks(links);
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
  const { error, remove } = useRemove(onChanged);
  if (!data) return <ErrorMessage error={loadError} />;
  const tickets = ticketsLinkedTo(data.links, end, data.tickets);
  const pages = pagesLinkedTo(data.links, end, data.pages);
  const removeTicket = (ticketId: string) =>
    remove(() =>
      end.kind === 'need' ? api.removeNeedLink(initiativeId, ticketId, end.id) : api.removeRequirementLink(initiativeId, ticketId, end.id),
    );
  const created = (links: InitiativeLinksDto) => {
    setLinks(links);
    onChanged();
  };

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
              {canEdit && <RemoveButton reference={ticket.reference} onRemove={() => removeTicket(ticket.id)} />}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <AddLinkForm
          end={end}
          data={data}
          relations={['ticket']}
          onCreate={(_relation, ticketId) =>
            end.kind === 'need'
              ? api.createNeedLink(initiativeId, { ticketId, needId: end.id })
              : api.createRequirementLink(initiativeId, { ticketId, requirementId: end.id })
          }
          onCreated={created}
        />
      )}
      <h4 className="section-title">
        {t('link.pages')} <span className="count">{pages.length}</span>
      </h4>
      {pages.length === 0 ? (
        <p>{t('link.noPages')}</p>
      ) : (
        <ul className="links">
          {pages.map((page) => (
            <li key={page.id}>
              <PageButton initiativeId={initiativeId} page={page} />
              {canEdit && (
                <RemoveButton
                  reference={page.reference}
                  onRemove={() => remove(() => api.removePageLink(initiativeId, page.id, end.kind, end.id))}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      <ErrorMessage error={error} />
      {canEdit && (
        <AddLinkForm
          end={end}
          data={data}
          relations={['page']}
          onCreate={(_relation, pageId) => api.createPageLink(initiativeId, { pageId, object: { kind: end.kind, id: end.id } })}
          onCreated={created}
        />
      )}
    </>
  );
}

/** Libellé d'une relation dans la liste « Lien ». */
function useRelationLabel() {
  const { t } = useI18n();
  return (relation: Relation) =>
    relation === 'ticket'
      ? t('link.ticketGroup')
      : relation === 'need'
        ? t('link.toNeed')
        : relation === 'requirement'
          ? t('link.toRequirement')
          : relation === 'page'
            ? t('link.toPage')
            : t(`linkSide.${relation}`);
}

/**
 * Ajout d'un lien : la relation (nature d'un lien entre tickets, ou sorte d'objet),
 * quand il y a le choix, puis l'objet. Ne sont proposés ni l'objet lui-même ni ceux
 * déjà liés, ni une page depuis une page. Vidé une fois le lien créé.
 */
function AddLinkForm({
  end,
  data,
  relations,
  hint,
  onCreate,
  onCreated,
}: {
  end: LinkEnd;
  data: LinkData;
  /** Relations proposées, la première par défaut ; « est lié à » par défaut depuis un ticket. */
  relations: readonly Relation[];
  hint?: string;
  onCreate: (relation: Relation, objectId: string) => Promise<InitiativeLinksDto>;
  onCreated: (links: InitiativeLinksDto) => void;
}) {
  const { t } = useI18n();
  const label = useRelationLabel();
  const initialRelation: Relation = relations.includes('relates_to') ? 'relates_to' : (relations[0] ?? 'ticket');
  const [relation, setRelation] = useState<Relation>(initialRelation);
  const [objectId, setObjectId] = useState('');
  const [error, setError] = useState<UiError | null>(null);
  const submit = useUnsavedForm({ relation, objectId }, create);
  const candidates = linkCandidates(data.links, end, data);
  const options: { id: string; reference: string; title: string }[] =
    relation === 'need'
      ? candidates.needs
      : relation === 'requirement'
        ? candidates.requirements
        : relation === 'page'
          ? candidates.pages
          : candidates.tickets;
  const ticketSides = relations.filter((r): r is LinkSide => LINK_SIDES.some((side) => side === r));
  const others = relations.filter((r) => !ticketSides.includes(r as LinkSide));
  const objectLabel = relations.length > 1 ? t('link.object') : label(relation);

  async function create() {
    if (!objectId) return false;
    try {
      onCreated(await onCreate(relation, objectId));
      setError(null);
      setRelation(initialRelation);
      setObjectId('');
      return { relation: initialRelation, objectId: '' };
    } catch (e) {
      setError(toUiError(e));
      return false;
    }
  }

  return (
    <form className="stacked add-link" onSubmit={submit}>
      <h4 className="section-title">{t(relations.length === 1 && relations[0] === 'page' ? 'link.addPage' : 'link.add')}</h4>
      {relations.length > 1 && (
        <label>
          {t('link.relation')}
          <select
            value={relation}
            onChange={(e) => {
              setRelation(e.target.value as Relation);
              setObjectId('');
            }}
          >
            {ticketSides.length > 0 && (
              <optgroup label={t('link.ticketGroup')}>
                {ticketSides.map((side) => (
                  <option key={side} value={side}>
                    {label(side)}
                  </option>
                ))}
              </optgroup>
            )}
            {others.map((r) => (
              <option key={r} value={r}>
                {label(r)}
              </option>
            ))}
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
            {objectLabel}
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
        <small>{hint ?? t('link.hint')}</small>
      </p>
      <ErrorMessage error={error} />
    </form>
  );
}
