// Écran Pages d'une initiative (ticket 22, décisions 07, 08 et 13) : arborescence
// à gauche (au-dessus sur petit écran), document en pleine page. « Modifier » passe
// la page en écriture au même endroit ; une nouvelle page n'existe qu'à son premier
// enregistrement. Règles dans @app/shared (pages.ts).
import {
  can,
  checkPageDelete,
  createPageSchema,
  dropPlacement,
  flattenPageTree,
  type InitiativeDto,
  keyboardPlacement,
  memberName,
  PAGE_TEXT_MAX_LENGTH,
  PAGE_TITLE_MAX_LENGTH,
  type PageDoc,
  type PageDto,
  type PageKeyboardMove,
  type PagePlacement,
  type PageRefusal,
  type PageRow,
  pageTextLength,
  type ReferenceDto,
  sortByReference,
} from '@app/shared';
import { ArrowDown, ArrowUp, IndentDecrease, IndentIncrease, Pencil, Plus } from 'lucide-react';
import { type DragEvent, type KeyboardEvent, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from './api';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { formatDate } from './initiative-panels';
import { PageContent } from './page-content';
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
}

export function PagesScreen({
  initiativeId,
  pageId,
  initiative,
  version,
  onChanged,
}: {
  initiativeId: string;
  /** Page ouverte ; null : aucune. */
  pageId: string | null;
  /** Absente tant que la liste des initiatives n'est pas chargée. */
  initiative: InitiativeDto | undefined;
  /** Change à chaque création, modification, déplacement ou suppression d'une page. */
  version: number;
  onChanged: () => void;
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
  return (
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
          {shownDraft ? (
            <PageEditForm
              initiativeId={initiativeId}
              page={null}
              parentId={shownDraft.parentId}
              parentTitle={tree?.find((p) => p.id === shownDraft.parentId)?.title ?? null}
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
              canEdit={canEdit}
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
  canEdit,
  onAddChild,
  onMove,
  onChanged,
}: {
  initiativeId: string;
  pageId: string;
  tree: PageRow[];
  canEdit: boolean;
  onAddChild: () => void;
  onMove: (placement: PagePlacement) => void;
  onChanged: () => void;
}) {
  const { t, locale } = useI18n();
  const { replaceScreen } = useScreens();
  const [page, setPage] = useState<PageDto | null>(null);
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<UiError | null>(null);

  useEffect(() => {
    api.getPage(initiativeId, pageId).then(setPage, (e: unknown) => {
      if (isRefusal(e)) setMissing(true);
      else setError(toUiError(e));
    });
  }, [initiativeId, pageId]);

  if (missing) return <p className="error" role="alert">{t('pages.notFound')}</p>;
  if (!page) return <ErrorMessage error={error} />;

  if (editing && canEdit) {
    return (
      <PageEditForm
        initiativeId={initiativeId}
        page={page}
        parentId={page.parentId}
        parentTitle={null}
        onSaved={(saved) => {
          setPage(saved);
          setEditing(false);
          onChanged();
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const moveTo = (move: PageKeyboardMove) => keyboardPlacement(tree, page.id, move);
  return (
    <article className="page-view">
      <div className="panel-kicker">
        {t('referenceCategory.page')} <span className="code">{page.reference}</span>
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
      </div>
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
            refusal={checkPageDelete(tree, page.id)}
            onDeleted={() => {
              onChanged();
              replaceScreen({ kind: 'pages', initiativeId, pageId: null });
            }}
          />
        </section>
      )}
    </article>
  );
}

/** Suppression définitive après confirmation ; refusée tant que la page a des sous-pages. */
function DeletePage({
  page,
  refusal,
  onDeleted,
}: {
  page: PageDto;
  /** Refus connu d'avance (sous-pages) : affiché sans demander de confirmation. */
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
  parentId,
  parentTitle,
  onSaved,
  onCancel,
}: {
  initiativeId: string;
  /** Null : nouvelle page, créée au premier enregistrement. */
  page: PageDto | null;
  parentId: string | null;
  /** Nouvelle sous-page : titre de sa parente. */
  parentTitle: string | null;
  onSaved: (page: PageDto) => void;
  onCancel: () => void;
}) {
  const { t, locale } = useI18n();
  const { settleScreen } = usePanels();
  const references = useReferences();
  const [title, setTitle] = useState(page?.title ?? '');
  const [doc, setDoc] = useState<PageDoc | null>(page?.content ?? null);
  // Contenu tel que l'éditeur l'a lu à l'ouverture : y revenir (Annuler, Ctrl+Z) n'est pas une modification.
  const [baseline, setBaseline] = useState<string | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  const [titleMissing, setTitleMissing] = useState(false);

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

  async function save(): Promise<boolean> {
    // Un document vide devient null (pageContentSchema).
    const parsed = createPageSchema.safeParse({ title, content: doc, parentId });
    if (!parsed.success) {
      setTitleMissing(!title.trim());
      setError(tooLong ? { key: 'page.tooLong', params: { max: PAGE_TEXT_MAX_LENGTH.toLocaleString(locale) } } : { key: 'page.titleRequired' });
      return false;
    }
    try {
      const saved = page
        ? await api.updatePage(initiativeId, page.id, {
            title: parsed.data.title,
            ...(contentChanged && { content: parsed.data.content }),
          })
        : await api.createPage(initiativeId, parsed.data);
      setError(null);
      onSaved(saved);
      return true;
    } catch (e) {
      setError(toUiError(e));
      return false;
    }
  }

  const onSubmit = useUnsavedForm({ title, content: contentChanged ? serialized : '' }, save);

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
      <ErrorMessage error={error} />
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
      <Suspense fallback={<p>{t('common.loading')}</p>}>
        <PageEditor
          initialContent={page?.content ?? null}
          references={suggestions}
          label={t('page.contentLabel')}
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
