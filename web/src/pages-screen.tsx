// Écran Pages d'une initiative (ticket 22, décisions 07, 08 et 13) : arborescence
// à gauche (au-dessus sur petit écran), document en pleine page. « Modifier » passe
// la page en écriture au même endroit ; une nouvelle page n'existe qu'à son premier
// enregistrement, vide ou depuis un modèle (ticket 27). Liens et commentaires en
// bas du document (ticket 25). Règles dans @app/shared (pages.ts, page-templates.ts,
// links.ts, comments.ts).
import {
  type BabokDto,
  can,
  checkPageDelete,
  createPageWithImagesSchema,
  dropPlacement,
  flattenPageTree,
  findBabokElement,
  type InitiativeDto,
  keyboardPlacement,
  memberName,
  PAGE_TEXT_MAX_LENGTH,
  PAGE_TITLE_MAX_LENGTH,
  type PageChangedSinceBody,
  type PageDoc,
  type PageDto,
  type PageKeyboardMove,
  type PagePlacement,
  type PageRefusal,
  type PageRevisionRow,
  type PageRow,
  type PageTemplateDto,
  pageTemplateGroups,
  isPageSaveRefusal,
  pageTextLength,
  type ReferenceDto,
  sortByReference,
} from '@app/shared';
import { ArrowDown, ArrowUp, FilePlus, History, IndentDecrease, IndentIncrease, Pencil, Plus } from 'lucide-react';
import { type DragEvent, type KeyboardEvent, lazy, type ReactNode, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from './api';
import { BabokName } from './babok-panels';
import { PageComments } from './comments';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { formatDate } from './initiative-panels';
import { PageLinks, useLinkData } from './link-panels';
import { FileError, PageAttachments } from './attachments';
import { PageContent } from './page-content';
import { forgetAttachmentImages, PageImageSource, PendingImages } from './page-images';
import { PageComparison, PageDiff, PageHistory, PageRevisionView, type PageShown, VersionNoteField } from './page-history';
import { SCREEN_TITLE_ID, usePanels } from './panels';
import { useReferences } from './references';
import { useScreens } from './screens';
import { formatDateTime } from './team-section';
import { useUnsavedForm } from './unsaved-changes';

// Tiptap n'est chargé qu'à la première écriture (ADR-0019, point 5).
const PageEditor = lazy(() => import('./page-editor'));

/** Le non-membre reçoit 404 de l'API : même refus pour une initiative disparue. */
const isRefusal = (error: unknown) => error instanceof ApiError && (error.status === 403 || error.status === 404);

/** Déplacements de la page sélectionnée : touche (avec Alt) dans l'arborescence, bouton sur la page ouverte. */
const KEYBOARD_MOVES: { move: PageKeyboardMove; key: string; icon: typeof ArrowUp }[] = [
  { move: 'up', key: 'ArrowUp', icon: ArrowUp },
  { move: 'down', key: 'ArrowDown', icon: ArrowDown },
  { move: 'indent', key: 'ArrowRight', icon: IndentIncrease },
  { move: 'outdent', key: 'ArrowLeft', icon: IndentDecrease },
];

/** Page en cours de création, rattachée à la page ouverte quand elle a été demandée. */
interface Draft {
  parentId: string | null;
  /** Page ouverte au moment de la demande : changer de page abandonne le brouillon. */
  at: string | null;
  /** Absent tant que l'on choisit ; null : page vide ; sinon le modèle choisi. */
  template?: PageTemplateDto | null;
}

export function PagesScreen({
  initiativeId,
  pageId,
  initiative,
  babok,
  version,
  onChanged,
  myId,
  linksVersion,
  onLinksChanged,
}: {
  initiativeId: string;
  /** Page ouverte ; null : aucune. */
  pageId: string | null;
  /** Référentiel : regroupe les modèles et nomme la tâche d'une page ; null tant qu'il n'est pas chargé. */
  babok: BabokDto | null;
  /** Absente tant que la liste des initiatives n'est pas chargée. */
  initiative: InitiativeDto | undefined;
  /** Change à chaque création, modification, déplacement ou suppression d'une page. */
  version: number;
  onChanged: () => void;
  /** Auteur des commentaires ; null tant que le compte n'est pas chargé. */
  myId: string | null;
  /** Change à chaque écriture sur un ticket ou un lien, ici ou dans un panneau. */
  linksVersion: number;
  onLinksChanged: () => void;
}) {
  const { t, locale } = useI18n();
  const { goTo, replaceScreen } = useScreens();
  const [tree, setTree] = useState<PageRow[] | null>(null);
  const [refused, setRefused] = useState(false);
  const [error, setError] = useState<UiError | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [status, setStatus] = useState('');
  const focusAfterMoveRef = useRef<string | null>(null);

  useEffect(() => {
    api.listPages(initiativeId).then(
      (rows) => {
        setTree(rows);
        setError(null);
      },
      (e: unknown) => {
        if (isRefusal(e)) setRefused(true);
        else setError(toUiError(e));
      },
    );
  }, [initiativeId, version]);

  if (refused) {
    return (
      <>
        <h1>{t('pages.title')}</h1>
        <p className="error" role="alert">
          {t('pages.refused')}
        </p>
      </>
    );
  }

  const canEdit = !!initiative && can(initiative.myRole, 'editPages', { archived: initiative.archivedAt != null });
  const openPage = (id: string) => void goTo({ kind: 'pages', initiativeId, pageId: id });
  // Quitte la page ouverte (avec l'alerte si elle est en écriture), puis ouvre le brouillon.
  const startDraft = (parentId: string | null) =>
    void goTo({ kind: 'pages', initiativeId, pageId }).then((left) => left && setDraft({ parentId, at: pageId }));

  async function move(id: string, placement: PagePlacement) {
    try {
      focusAfterMoveRef.current = id;
      setTree(await api.movePage(initiativeId, id, placement));
      setError(null);
      const moved = tree?.find((p) => p.id === id);
      setStatus(t('pages.moved', { title: moved?.title ?? '' }));
    } catch (e) {
      setError(toUiError(e));
    }
  }

  const shownDraft = draft && draft.at === pageId ? draft : null;
  const draftParentTitle = tree?.find((p) => p.id === shownDraft?.parentId)?.title ?? null;
  return (
    <PageImageSource.Provider value={initiativeId}>
    <section className="pages">
      {initiative && (
        <div className="panel-kicker">
          {t('initiative.kicker')} <span className="code">{initiative.code}</span> · {initiative.name}
        </div>
      )}
      <div className="tickets-header">
        <h1>{t('pages.title')}</h1>
        {canEdit && (
          <button type="button" className="primary" onClick={() => startDraft(null)}>
            <Plus />
            {t('pages.new')}
          </button>
        )}
      </div>
      {initiative?.archivedAt && (
        <p className="notice">{t('initiative.archivedOn', { date: formatDate(locale, initiative.archivedAt) })}</p>
      )}
      <ErrorMessage error={error} />
      <p className="visually-hidden" role="status">
        {status}
      </p>
      <div className="pages-layout">
        <nav className="pages-tree" aria-label={t('pages.tree')}>
          {tree && tree.length === 0 && <p className="pages-tree-empty">{t(canEdit ? 'pages.emptyHint' : 'pages.emptyHintReadOnly')}</p>}
          {tree && tree.length > 0 && (
            <PageTree
              tree={tree}
              selectedId={shownDraft ? null : pageId}
              canEdit={canEdit}
              focusAfterMoveRef={focusAfterMoveRef}
              onOpen={openPage}
              onAddChild={startDraft}
              onMove={(id, placement) => void move(id, placement)}
            />
          )}
        </nav>
        <div className="pages-document">
          {shownDraft && shownDraft.template === undefined ? (
            <PageTemplateChooser
              babok={babok}
              parentTitle={draftParentTitle}
              onChoose={(template) => setDraft({ ...shownDraft, template })}
              onCancel={() => setDraft(null)}
            />
          ) : shownDraft ? (
            <PageEditForm
              initiativeId={initiativeId}
              page={null}
              template={shownDraft.template ?? null}
              parentId={shownDraft.parentId}
              parentTitle={draftParentTitle}
              onSaved={(created) => {
                setDraft(null);
                onChanged();
                // La page créée s'ouvre, sans étape de plus pour « Précédent ».
                replaceScreen({ kind: 'pages', initiativeId, pageId: created.id });
              }}
              onCancel={() => setDraft(null)}
            />
          ) : pageId ? (
            <PageView
              key={pageId}
              initiativeId={initiativeId}
              pageId={pageId}
              tree={tree ?? []}
              babok={babok}
              canEdit={canEdit}
              initiative={initiative && { myRole: initiative.myRole, archived: initiative.archivedAt != null }}
              myId={myId}
              linksVersion={linksVersion + version}
              onLinksChanged={onLinksChanged}
              onAddChild={() => startDraft(pageId)}
              onMove={(placement) => void move(pageId, placement)}
              onChanged={onChanged}
            />
          ) : (
            tree && tree.length > 0 && <p className="pages-choose">{t('pages.choose')}</p>
          )}
        </div>
      </div>
    </section>
    </PageImageSource.Provider>
  );
}

/**
 * Arborescence : un clic ouvre la page. Glisser une page sur le haut d'une ligne
 * la place avant, sur le reste de la ligne elle devient sa sous-page (décision 08,
 * point 7). Au clavier : flèches pour parcourir, Alt + flèches pour déplacer.
 */
function PageTree({
  tree,
  selectedId,
  canEdit,
  focusAfterMoveRef,
  onOpen,
  onAddChild,
  onMove,
}: {
  tree: PageRow[];
  selectedId: string | null;
  canEdit: boolean;
  focusAfterMoveRef: { current: string | null };
  onOpen: (id: string) => void;
  onAddChild: (parentId: string) => void;
  onMove: (id: string, placement: PagePlacement) => void;
}) {
  const { t } = useI18n();
  const nodes = useMemo(() => flattenPageTree(tree), [tree]);
  const [dragged, setDragged] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; zone: 'before' | 'inside' } | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  // Déplacement au clavier impossible : dit pourquoi, jusqu'à la touche suivante.
  const [blocked, setBlocked] = useState<string | null>(null);
  const list = useRef<HTMLUListElement>(null);
  // Ligne qui reçoit le focus au clavier : la page ouverte, sinon la première.
  const tabStop = nodes.some((n) => n.page.id === focused) ? focused : (selectedId ?? nodes[0]?.page.id);

  const rowOf = (id: string) => list.current?.querySelector<HTMLElement>(`[data-page-id="${id}"]`);

  // La page déplacée au clavier garde le focus à sa nouvelle place.
  useEffect(() => {
    const id = focusAfterMoveRef.current;
    if (!id) return;
    focusAfterMoveRef.current = null;
    if (list.current?.contains(document.activeElement)) rowOf(id)?.focus();
  }, [tree, focusAfterMoveRef]);

  function onKeyDown(event: KeyboardEvent<HTMLLIElement>, id: string) {
    const index = nodes.findIndex((n) => n.page.id === id);
    setBlocked(null);
    if (event.altKey && canEdit) {
      const move = KEYBOARD_MOVES.find((m) => m.key === event.key)?.move;
      if (!move) return;
      event.preventDefault();
      const placement = keyboardPlacement(tree, id, move);
      if (placement) onMove(id, placement);
      else setBlocked(t(`pages.cannotMove.${move}`, { title: nodes[index]?.page.title ?? '' }));
      return;
    }
    const target =
      event.key === 'ArrowDown' ? nodes[index + 1] : event.key === 'ArrowUp' ? nodes[index - 1]
      : event.key === 'Home' ? nodes[0] : event.key === 'End' ? nodes.at(-1) : undefined;
    if (target) {
      event.preventDefault();
      setFocused(target.page.id);
      rowOf(target.page.id)?.focus();
    } else if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) {
      event.preventDefault();
      onOpen(id);
    }
  }

  function zoneOf(event: DragEvent<HTMLElement>): 'before' | 'inside' {
    const box = event.currentTarget.getBoundingClientRect();
    // Haut de la ligne : avant elle ; le reste : sous-page.
    return event.clientY - box.top < box.height * 0.3 ? 'before' : 'inside';
  }

  function onDragOver(event: DragEvent<HTMLLIElement>, id: string) {
    if (!dragged) return;
    const zone = zoneOf(event);
    if (!dropPlacement(tree, dragged, id, zone)) {
      setDrop(null);
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (drop?.id !== id || drop.zone !== zone) setDrop({ id, zone });
  }

  function onDrop(event: DragEvent<HTMLLIElement>, id: string) {
    event.preventDefault();
    const placement = dragged && dropPlacement(tree, dragged, id, zoneOf(event));
    if (dragged && placement) onMove(dragged, placement);
    setDragged(null);
    setDrop(null);
  }

  return (
    <>
      <ul ref={list} role="tree" aria-label={t('pages.tree')} className="page-tree">
        {nodes.map(({ page, depth, hasChildren }) => (
          <li
            key={page.id}
            data-page-id={page.id}
            role="treeitem"
            aria-level={depth + 1}
            aria-selected={page.id === selectedId}
            aria-expanded={hasChildren ? true : undefined}
            tabIndex={page.id === tabStop ? 0 : -1}
            className={[
              'page-tree-row',
              page.id === selectedId ? 'selected' : '',
              page.id === dragged ? 'dragging' : '',
              drop?.id === page.id ? `drop-${drop.zone}` : '',
            ].join(' ')}
            style={{ paddingInlineStart: `calc(var(--space-2) + ${depth} * var(--space-4))` }}
            draggable={canEdit}
            onClick={() => onOpen(page.id)}
            onFocus={(e) => e.target === e.currentTarget && setFocused(page.id)}
            onKeyDown={(e) => onKeyDown(e, page.id)}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', page.reference);
              setDragged(page.id);
            }}
            onDragEnd={() => {
              setDragged(null);
              setDrop(null);
            }}
            onDragOver={(e) => onDragOver(e, page.id)}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDrop(null);
            }}
            onDrop={(e) => onDrop(e, page.id)}
          >
            <span className="page-tree-title" title={`${page.reference} · ${page.title}`}>
              {page.title}
            </span>
            {canEdit && (
              <button
                type="button"
                className="ghost icon-only page-tree-add"
                tabIndex={-1}
                aria-label={t('pages.addChild', { title: page.title })}
                title={t('pages.addChild', { title: page.title })}
                onClick={(e) => {
                  e.stopPropagation();
                  onAddChild(page.id);
                }}
              >
                <Plus />
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="page-tree-blocked" role="status">
        {blocked}
      </p>
      {canEdit && <p className="page-tree-hint">{t('pages.treeHint')}</p>}
    </>
  );
}

/** Page ouverte : lecture, ou écriture au même endroit après « Modifier ». */
function PageView({
  initiativeId,
  pageId,
  tree,
  babok,
  canEdit,
  initiative,
  myId,
  linksVersion,
  onLinksChanged,
  onAddChild,
  onMove,
  onChanged,
}: {
  initiativeId: string;
  pageId: string;
  tree: PageRow[];
  babok: BabokDto | null;
  canEdit: boolean;
  /** Rôle et archivage, pour les commentaires ; absent tant que la liste des initiatives n'est pas chargée. */
  initiative: { myRole: InitiativeDto['myRole']; archived: boolean } | undefined;
  myId: string | null;
  linksVersion: number;
  onLinksChanged: () => void;
  onAddChild: () => void;
  onMove: (placement: PagePlacement) => void;
  onChanged: () => void;
}) {
  const { t, locale } = useI18n();
  const { replaceScreen } = useScreens();
  const { open } = usePanels();
  const [page, setPage] = useState<PageDto | null>(null);
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<UiError | null>(null);
  // Historique en volet à droite (décision 08, point 6) ; le centre montre la page, un enregistrement ou une comparaison.
  const [historyOpen, setHistoryOpen] = useState(false);
  const [shown, setShown] = useState<PageShown>({ kind: 'page' });
  const [revisions, setRevisions] = useState<PageRevisionRow[] | null>(null);
  const [status, setStatus] = useState('');
  // Liens de l'initiative : section « Liens » et refus de supprimer une page liée.
  const { data: linkData, setLinks, error: linksError } = useLinkData(initiativeId, linksVersion, true);

  const loadPage = () =>
    api.getPage(initiativeId, pageId).then(setPage, (e: unknown) => {
      if (isRefusal(e)) setMissing(true);
      else setError(toUiError(e));
    });
  useEffect(() => {
    // Images relues à l'ouverture : une image supprimée entre-temps n'est plus montrée.
    forgetAttachmentImages();
    void loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- la page se relit quand elle change d'identifiant
  }, [initiativeId, pageId]);

  // L'historique se relit à son ouverture et à chaque nouvel enregistrement de la page.
  const revisionId = page?.revisionId;
  useEffect(() => {
    if (!historyOpen || !revisionId) return;
    api.listPageRevisions(initiativeId, pageId).then(setRevisions, (e: unknown) => setError(toUiError(e)));
  }, [initiativeId, pageId, historyOpen, revisionId]);

  if (missing) return <p className="error" role="alert">{t('pages.notFound')}</p>;
  if (!page) return <ErrorMessage error={error} />;

  const show = (next: PageShown) => {
    setShown(next);
    setStatus('');
  };
  const history = historyOpen && (
    <PageHistory
      revisions={revisions}
      shown={shown}
      onShow={show}
      onClose={() => {
        setHistoryOpen(false);
        setShown({ kind: 'page' });
      }}
    />
  );
  const withHistory = (center: ReactNode) => (
    <div className={historyOpen ? 'page-with-history' : undefined}>
      <div className="page-with-history-center">
        <p className="visually-hidden" role="status">
          {status}
        </p>
        {center}
      </div>
      {history}
    </div>
  );

  if (shown.kind === 'revision' && revisions?.some((r) => r.id === shown.id)) {
    return withHistory(
      <PageRevisionView
        key={shown.id}
        initiativeId={initiativeId}
        pageId={pageId}
        revisionId={shown.id}
        revisions={revisions}
        canEdit={canEdit}
        onShow={show}
        onRevisions={(list, message) => {
          setRevisions(list);
          setStatus(message);
          // Dernière version et modifications depuis : relues avec la page.
          void loadPage();
        }}
        onRestored={(message) => {
          setShown({ kind: 'page' });
          setStatus(message);
          void loadPage();
          onChanged();
        }}
      />,
    );
  }
  if (shown.kind === 'compare') {
    return withHistory(
      <PageComparison
        key={`${shown.fromId}-${shown.toId}`}
        initiativeId={initiativeId}
        pageId={pageId}
        fromId={shown.fromId}
        toId={shown.toId}
        onShow={show}
      />,
    );
  }

  if (editing && canEdit) {
    return (
      <PageEditForm
        initiativeId={initiativeId}
        page={page}
        template={null}
        parentId={page.parentId}
        parentTitle={null}
        onSaved={(saved) => {
          setPage(saved);
          setEditing(false);
          onChanged();
        }}
        onCancel={() => setEditing(false)}
        onTakeTheirs={(latest) => {
          setPage(latest);
          setEditing(false);
          // Son titre a pu changer : l'arborescence se relit.
          onChanged();
        }}
      />
    );
  }

  const moveTo = (move: PageKeyboardMove) => keyboardPlacement(tree, page.id, move);
  const task = page.taskId && babok ? findBabokElement(babok, page.taskId) : undefined;
  const { lastVersion, modifiedSinceLastVersion } = page.versions;
  return withHistory(
    <article className="page-view">
      <div className="panel-kicker">
        {t('referenceCategory.page')} <span className="code">{page.reference}</span>
        {lastVersion !== null && (
          <>
            {' '}
            <span className="badge accent">{t('page.versionBadge', { number: lastVersion })}</span>
            {modifiedSinceLastVersion && <small> · {t('page.modifiedSinceVersion', { number: lastVersion })}</small>}
          </>
        )}
      </div>
      <div className="page-view-header">
        <h2 id={SCREEN_TITLE_ID} className="page-view-title">
          {page.title}
        </h2>
        {canEdit && (
          <span className="page-view-actions">
            <button type="button" className="primary" onClick={() => setEditing(true)}>
              <Pencil />
              {t('page.edit')}
            </button>
            <button type="button" onClick={onAddChild}>
              <Plus />
              {t('page.addChild')}
            </button>
          </span>
        )}
        <button type="button" aria-pressed={historyOpen} onClick={() => setHistoryOpen(!historyOpen)}>
          <History />
          {t('page.history')}
        </button>
      </div>
      {page.template && (
        // Modèle d'origine, sous le nom qu'il portait, et sa tâche : figés (décision 09, points 7 et 8).
        <p className="page-origin">
          <small>
            {t('page.template', { name: page.template.name })}
            {task && (
              <>
                {' · '}
                {t('page.task')}{' '}
                <button type="button" className="link" onClick={() => open({ kind: 'babokElement', elementId: task.id })}>
                  <span className="code">{task.section}</span> <BabokName element={task} />
                </button>
              </>
            )}
          </small>
        </p>
      )}
      <ErrorMessage error={error} />
      {/* Un document vide est enregistré sans contenu (pageContentSchema). */}
      {page.content ? (
        <PageContent doc={page.content} />
      ) : (
        <p className="page-empty">{t('page.emptyContent')}</p>
      )}
      <p className="audit">
        <small>
          {t('page.created', { date: formatDateTime(locale, page.createdAt), name: memberName(page.createdBy) })}
          <br />
          {t('page.updated', { date: formatDateTime(locale, page.updatedAt), name: memberName(page.updatedBy) })}
        </small>
      </p>
      {linkData ? (
        <PageLinks
          initiativeId={initiativeId}
          pageId={page.id}
          data={linkData}
          canEdit={!!initiative && can(initiative.myRole, 'editLinks', { archived: initiative.archived })}
          onLinks={setLinks}
          onChanged={onLinksChanged}
        />
      ) : (
        <ErrorMessage error={linksError} />
      )}
      {initiative && <PageComments initiativeId={initiativeId} pageId={page.id} initiative={initiative} myId={myId} />}
      {initiative && (
        // Rechargée à chaque enregistrement : nouvelles images et mention « affichée dans le texte » (ticket 26).
        <PageAttachments key={page.revisionId} initiativeId={initiativeId} pageId={page.id} initiative={initiative} />
      )}
      {canEdit && (
        <section className="owner-actions page-owner-actions">
          <div role="group" aria-label={t('page.moveGroup')} className="page-move">
            <small>{t('page.moveGroup')}</small>
            {KEYBOARD_MOVES.map(({ move, icon: Icon }) => {
              const placement = moveTo(move);
              return (
                <button
                  key={move}
                  type="button"
                  className="ghost"
                  disabled={!placement}
                  onClick={() => placement && onMove(placement)}
                >
                  <Icon />
                  {t(`page.move.${move}`)}
                </button>
              );
            })}
          </div>
          <DeletePage
            page={page}
            refusal={checkPageDelete(tree, page.id, linkData?.links ?? { pageLinks: [] })}
            onDeleted={() => {
              onChanged();
              replaceScreen({ kind: 'pages', initiativeId, pageId: null });
            }}
          />
        </section>
      )}
    </article>,
  );
}

/** Suppression définitive après confirmation ; refusée tant que la page a des sous-pages ou des liens. */
function DeletePage({
  page,
  refusal,
  onDeleted,
}: {
  page: PageDto;
  /** Refus connu d'avance (sous-pages, liens) : affiché sans demander de confirmation. */
  refusal: PageRefusal | null;
  onDeleted: () => void;
}) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<UiError | null>(null);

  async function remove() {
    try {
      await api.deletePage(page.initiativeId, page.id);
      onDeleted();
    } catch (e) {
      setConfirming(false);
      setError(toUiError(e));
    }
  }

  return (
    <div>
      <ErrorMessage error={error} />
      {confirming ? (
        <div role="alertdialog" aria-labelledby="page-delete-confirm" className="confirm">
          <p id="page-delete-confirm">{t('page.deleteConfirm', { reference: page.reference, title: page.title })}</p>
          <button type="button" autoFocus onClick={() => setConfirming(false)}>
            {t('common.cancel')}
          </button>{' '}
          <button type="button" className="danger" onClick={() => void remove()}>
            {t('page.deleteConfirmButton')}
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            className="danger"
            onClick={() => (refusal ? setError({ key: `page.refusal.${refusal}` }) : setConfirming(true))}
          >
            {t('page.delete')}
          </button>
        </>
      )}
    </div>
  );
}

/**
 * Écriture d'une page, existante ou nouvelle : barre d'enregistrement en haut
 * (Enregistrer, Annuler, compteur), titre, puis l'éditeur. Déclaré par
 * useUnsavedForm : changer de page ou d'écran déclenche l'alerte.
 */
function PageEditForm({
  initiativeId,
  page,
  template,
  parentId,
  parentTitle,
  onSaved,
  onCancel,
  onTakeTheirs,
}: {
  initiativeId: string;
  /** Null : nouvelle page, créée au premier enregistrement. */
  page: PageDto | null;
  /** Nouvelle page depuis un modèle : titre et contenu préremplis dans la langue de l'interface. */
  template: PageTemplateDto | null;
  parentId: string | null;
  /** Nouvelle sous-page : titre de sa parente. */
  parentTitle: string | null;
  onSaved: (page: PageDto) => void;
  onCancel: () => void;
  /** « Abandonner ma saisie et prendre la sienne » : la page dans son état actuel (ticket 24). */
  onTakeTheirs?: (latest: PageDto) => void;
}) {
  const { t, locale } = useI18n();
  const { settleScreen } = usePanels();
  // Modification simultanée (ticket 24) : la page telle qu'enregistrée entre-temps,
  // quand l'API a refusé l'enregistrement ; null tant qu'il n'y a pas eu de refus.
  const [latest, setLatest] = useState<PageDto | null>(null);
  const [comparing, setComparing] = useState(false);
  const references = useReferences();
  // La langue de la page est celle de l'interface à l'ouverture du brouillon (décision 09, point 4).
  const [templateLocale] = useState(locale);
  const [title, setTitle] = useState(page?.title ?? template?.name[templateLocale] ?? '');
  const [doc, setDoc] = useState<PageDoc | null>(page?.content ?? null);
  // Contenu tel que l'éditeur l'a lu à l'ouverture : y revenir (Annuler, Ctrl+Z) n'est pas une modification.
  const [baseline, setBaseline] = useState<string | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  const [titleMissing, setTitleMissing] = useState(false);
  // Pas de version à la création (décision 07, point 5).
  const [asVersion, setAsVersion] = useState(false);
  const [versionNote, setVersionNote] = useState('');

  // Images insérées pendant la saisie : gardées dans le navigateur jusqu'à « Enregistrer » (ticket 26).
  const [pendingImages] = useState(() => new PendingImages(initiativeId));
  const [imageErrors, setImageErrors] = useState<{ name: string; error: UiError }[]>([]);
  useEffect(() => () => pendingImages.release(), [pendingImages]);
  const onImageFiles = useCallback(
    (files: File[]) => {
      const { refs, refused } = pendingImages.add(files);
      setImageErrors(refused);
      return refs;
    },
    [pendingImages],
  );

  const serialized = doc && JSON.stringify(doc);
  const contentChanged = baseline !== null && serialized !== baseline;
  const length = doc ? pageTextLength(doc) : 0;
  const tooLong = length > PAGE_TEXT_MAX_LENGTH;

  // Les références de l'initiative de la page d'abord, puis celles de mes autres initiatives.
  const suggestions = useMemo(() => {
    const all = sortByReference([...references.values()]);
    const own = (r: ReferenceDto) => r.initiativeId === initiativeId;
    return [...all.filter(own), ...all.filter((r) => !own(r))].filter((r) => r.id !== page?.id);
  }, [references, initiativeId, page?.id]);

  /**
   * Enregistre la saisie, basée sur l'état de la page à son ouverture. `onTopOf` :
   * « Enregistrer ma saisie à la suite » de cet état ; la saisie entière, titre et
   * contenu, le remplace (décision 08, point 9).
   */
  async function save(onTopOf?: PageDto): Promise<boolean> {
    // Images insérées depuis l'ouverture et encore dans le texte : leurs fichiers partent avec l'enregistrement.
    const sent = pendingImages.sendable(doc);
    // Un document vide devient null (pageContentSchema).
    const parsed = createPageWithImagesSchema.safeParse({
      title,
      content: doc,
      parentId,
      template: template && { id: template.id, locale: templateLocale },
      uploads: sent.uploads,
    });
    if (!parsed.success) {
      setTitleMissing(!title.trim());
      setError(tooLong ? { key: 'page.tooLong', params: { max: PAGE_TEXT_MAX_LENGTH.toLocaleString(locale) } } : { key: 'page.titleRequired' });
      return false;
    }
    const { uploads, ...created } = parsed.data;
    const changes = page && {
      baseRevisionId: (onTopOf ?? page).revisionId,
      title: created.title,
      ...((contentChanged || onTopOf) && { content: created.content }),
      ...(asVersion && { version: { note: versionNote.trim() || null } }),
    };
    try {
      const saved =
        uploads.length > 0
          ? await api.savePageWithImages(initiativeId, page?.id ?? null, { ...(changes ?? created), uploads }, sent.files)
          : changes
            ? await api.updatePage(initiativeId, page.id, changes)
            : await api.createPage(initiativeId, created);
      setError(null);
      onSaved(saved);
      return true;
    } catch (e) {
      if (e instanceof ApiError && isPageSaveRefusal(e.refusal)) {
        // La page a été enregistrée entre-temps : le bandeau le dit, la saisie reste.
        setLatest((e.body as PageChangedSinceBody).page);
        setComparing(false);
        setError(null);
      } else {
        setError(fileError(e));
      }
      return false;
    }
  }

  /** Refus visant l'un des fichiers envoyés : le message nomme le fichier. */
  function fileError(e: unknown): UiError {
    const error = toUiError(e);
    const name = e instanceof ApiError ? (e.body as { name?: unknown } | undefined)?.name : undefined;
    if (typeof name !== 'string') return error;
    return { raw: t('attachment.fileError', { name, message: 'raw' in error ? error.raw : t(error.key, error.params) }) };
  }

  const onSubmit = useUnsavedForm(
    { title, content: contentChanged ? serialized : '', asVersion, versionNote: asVersion ? versionNote : '' },
    save,
  );

  const titleLabel = page ? page.title : parentTitle ? t('pages.newChildOf', { title: parentTitle }) : t('pages.new');
  return (
    <form className="page-edit" onSubmit={onSubmit} noValidate>
      <div className="page-save-bar">
        <span id={SCREEN_TITLE_ID} className="page-save-bar-title">
          {titleLabel}
        </span>
        <span className={`page-counter${tooLong ? ' over' : ''}`} aria-live="polite">
          {t('page.counter', { count: length.toLocaleString(locale), max: PAGE_TEXT_MAX_LENGTH.toLocaleString(locale) })}
        </span>
        <button type="button" onClick={() => void settleScreen().then((left) => left && onCancel())}>
          {t('common.cancel')}
        </button>
        <button type="submit" className="primary">
          {t('page.save')}
        </button>
      </div>
      {page && (
        <div className="page-save-version">
          <label className="checkbox">
            <input type="checkbox" checked={asVersion} onChange={(e) => setAsVersion(e.target.checked)} />
            {t('page.saveAsVersion', { number: (latest ?? page).versions.nextVersion })}
          </label>
          {asVersion && <VersionNoteField note={versionNote} onChange={setVersionNote} />}
        </div>
      )}
      <ErrorMessage error={error} />
      {latest && (
        // Bandeau du refus (décision 08, point 9) : reste affiché au-dessus de la saisie.
        <div className="page-conflict" role="alert">
          <p>
            {t('pageConflict.message', {
              name: memberName(latest.updatedBy),
              date: formatDateTime(locale, latest.updatedAt),
            })}
          </p>
          <div className="page-conflict-buttons">
            <button type="button" aria-expanded={comparing} onClick={() => setComparing(!comparing)}>
              {t(comparing ? 'pageConflict.hideComparison' : 'pageConflict.compare')}
            </button>
            <button type="button" className="primary" onClick={() => void save(latest)}>
              {t('pageConflict.saveAnyway')}
            </button>
            <button type="button" className="danger" onClick={() => onTakeTheirs?.(latest)}>
              {t('pageConflict.takeTheirs')}
            </button>
          </div>
          <small>{t('pageConflict.saveAnywayHint')}</small>
          {comparing && (
            <div className="page-conflict-comparison">
              <p>
                <small>{t('pageConflict.legend')}</small>
              </p>
              <PageDiff from={latest} to={{ title, content: doc }} />
            </div>
          )}
        </div>
      )}
      <label className="page-title-field">
        <span className="visually-hidden">{t('page.titleLabel')}</span>
        <input
          autoFocus={!page}
          value={title}
          maxLength={PAGE_TITLE_MAX_LENGTH}
          placeholder={t('page.titlePlaceholder')}
          aria-invalid={titleMissing}
          onChange={(e) => {
            setTitle(e.target.value);
            setTitleMissing(false);
          }}
        />
      </label>
      {imageErrors.map(({ name, error }, i) => (
        <FileError key={i} name={name} error={error} />
      ))}
      <Suspense fallback={<p>{t('common.loading')}</p>}>
        <PageEditor
          initialContent={page?.content ?? template?.content[templateLocale] ?? null}
          references={suggestions}
          label={t('page.contentLabel')}
          resolveImage={pendingImages.resolve}
          onImageFiles={onImageFiles}
          onReady={(initial) => {
            setDoc(initial);
            setBaseline(JSON.stringify(initial));
          }}
          onChange={setDoc}
        />
      </Suspense>
    </form>
  );
}

/**
 * Premier pas de « Nouvelle page » (décision 09, point 9) : une page vide, ou l'un
 * des modèles actifs, par domaine de connaissance. Rien n'est créé avant le premier
 * enregistrement ; un même modèle sert autant de fois qu'on veut.
 */
function PageTemplateChooser({
  babok,
  parentTitle,
  onChoose,
  onCancel,
}: {
  babok: BabokDto | null;
  parentTitle: string | null;
  onChoose: (template: PageTemplateDto | null) => void;
  onCancel: () => void;
}) {
  const { t, locale } = useI18n();
  const [templates, setTemplates] = useState<PageTemplateDto[] | null>(null);
  const [error, setError] = useState<UiError | null>(null);

  useEffect(() => {
    api.listPageTemplates().then(setTemplates, (e: unknown) => setError(toUiError(e)));
  }, []);

  const groups = babok && templates ? pageTemplateGroups(babok, templates, locale) : [];
  return (
    <section className="page-template-chooser" aria-labelledby={SCREEN_TITLE_ID}>
      <div className="page-save-bar">
        <span id={SCREEN_TITLE_ID} className="page-save-bar-title">
          {parentTitle ? t('pages.newChildOf', { title: parentTitle }) : t('pages.new')}
        </span>
        <button type="button" onClick={onCancel}>
          {t('common.cancel')}
        </button>
      </div>
      <h2 className="page-template-heading">{t('pages.chooseTemplate')}</h2>
      <ErrorMessage error={error} />
      <ul className="page-template-list">
        <li>
          <button type="button" autoFocus onClick={() => onChoose(null)}>
            <FilePlus />
            <span>{t('pages.blankPage')}</span>
          </button>
        </li>
      </ul>
      {!templates && !error && <p>{t('common.loading')}</p>}
      {groups.map(({ knowledgeArea, templates: ofGroup }) => (
        <section key={knowledgeArea?.id ?? 'other'}>
          <h3 className="group-title">
            {knowledgeArea ? <BabokName element={knowledgeArea} /> : t('pages.otherTemplates')}
          </h3>
          <ul className="page-template-list">
            {ofGroup.map((template) => {
              const task = template.taskId && babok ? findBabokElement(babok, template.taskId) : undefined;
              return (
                <li key={template.id}>
                  <button type="button" onClick={() => onChoose(template)}>
                    <span>{template.name[locale]}</span>
                    {task && (
                      <small>
                        <span className="code">{task.section}</span> <BabokName element={task} />
                      </small>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </section>
  );
}
