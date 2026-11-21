// Pages dans l'arborescence de l'initiative (ADR-0021, N9, N11, N15 ; tickets 22
// à 27, décisions 07 à 09) : le nœud Pages liste les pages, chaque page s'affiche
// dans l'écran de données, en onglets Contenu, Liens, Commentaires, Pièces jointes
// et Historique. « Modifier » passe le contenu en écriture au même endroit ; une
// page ou une sous-page se crée en fenêtre de dialogue (modèle et titre), puis
// s'ouvre en écriture (décision du 21.11.2026). Le rangement (glisser-déposer,
// Alt + flèches) se fait dans l'arborescence (initiative-tree.tsx). Règles dans
// @app/shared (pages.ts, page-templates.ts, page-revisions.ts, links.ts).
import {
  type BabokDto,
  can,
  checkPageDelete,
  createPageSchema,
  createPageWithImagesSchema,
  findBabokElement,
  flattenPageTree,
  type InitiativeDto,
  type InitiativeTreeNode,
  keyboardPlacement,
  memberName,
  type MessageKey,
  PAGE_KEYBOARD_MOVES,
  PAGE_TABS,
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
  type PageTab,
  type PageTemplateDto,
  pageTemplateGroups,
  isPageSaveRefusal,
  pageTextLength,
  type ReferenceDto,
  sortByReference,
} from '@app/shared';
import { ArrowDown, ArrowUp, FilePlus, IndentDecrease, IndentIncrease, Pencil, Plus } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from './api';
import { BabokName } from './babok-screens';
import { PageComments } from './comments';
import { DataScreen } from './data-screen';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { formatDate } from './initiative-sheet';
import { PageLinks, useLinkData } from './link-sections';
import { FileError, PageAttachments } from './attachments';
import { PageContent } from './page-content';
import { forgetAttachmentImages, PageImageSource, PendingImages } from './page-images';
import { PageComparison, PageDiff, PageHistory, PageRevisionView, type PageShown, VersionNoteField } from './page-history';
import { Dialog, useCloseSilently, useDialogs } from './dialogs';
import { useScreens } from './screens';
import { useOpenNode, useReferences } from './references';
import { formatDateTime } from './team-section';
import { useUnsavedForm } from './unsaved-changes';

// Tiptap n'est chargé qu'à la première écriture (ADR-0019, point 5).
const PageEditor = lazy(() => import('./page-editor'));

/** Le non-membre reçoit 404 de l'API : même refus pour une page disparue. */
const isRefusal = (error: unknown) => error instanceof ApiError && (error.status === 403 || error.status === 404);

export const canEditPages = (initiative: InitiativeDto) =>
  can(initiative.myRole, 'editPages', { archived: initiative.archivedAt != null });

/** Boutons de déplacement de la page ouverte ; dans l'arborescence, Alt + flèches. */
const MOVE_ICONS: Record<PageKeyboardMove, typeof ArrowUp> = {
  up: ArrowUp,
  down: ArrowDown,
  indent: IndentIncrease,
  outdent: IndentDecrease,
};

/** Liste du nœud Pages : les pages dans l'ordre de l'arborescence, sous-pages en retrait. */
export function PageList({ initiativeId, pages, canEdit }: { initiativeId: string; pages: PageRow[]; canEdit: boolean }) {
  const { t } = useI18n();
  const openNode = useOpenNode();
  const nodes = useMemo(() => flattenPageTree(pages), [pages]);
  if (nodes.length === 0) return <p className="page-empty">{t(canEdit ? 'pages.emptyHint' : 'pages.emptyHintReadOnly')}</p>;
  return (
    <>
      <ul className="links dense-list page-list">
        {nodes.map(({ page, depth }) => (
          <li key={page.id} style={{ paddingInlineStart: `calc(${depth} * var(--space-4))` }}>
            <button type="button" className="link" onClick={() => openNode(initiativeId, { kind: 'page', id: page.id })}>
              <span className="code">{page.reference}</span> {page.title}
            </button>
          </li>
        ))}
      </ul>
      {canEdit && <p className="page-empty">{t('pages.treeHint')}</p>}
    </>
  );
}

/** Page dans l'écran de données : en-tête, onglets Contenu, Liens, Commentaires, Pièces jointes, Historique. */
export function PageScreen({
  initiative,
  row,
  pages,
  babok,
  tab,
  crumbs,
  onCrumb,
  linksVersion,
  myId,
  startEditing,
  onEditStarted,
  onTab,
  onChanged,
  onLinksChanged,
  onAddChild,
  onDeleted,
}: {
  initiative: InitiativeDto;
  /** Ligne de la page dans l'arborescence : son en-tête avant chargement. */
  row: PageRow;
  /** Pages de l'initiative : déplacements possibles, sous-pages qui empêchent la suppression. */
  pages: PageRow[];
  /** Référentiel : nomme la tâche du modèle d'origine ; null tant qu'il n'est pas chargé. */
  babok: BabokDto | null;
  tab: PageTab;
  crumbs: InitiativeTreeNode[];
  onCrumb: (node: InitiativeTreeNode) => void;
  /** Change à chaque écriture sur un ticket ou un lien : les liens se relisent. */
  linksVersion: number;
  myId: string | null;
  /** Page tout juste créée : elle s'ouvre en écriture. */
  startEditing: boolean;
  onEditStarted: () => void;
  /** Autre onglet : une adresse de plus, gardée par l'alerte. */
  onTab: (tab: PageTab) => void;
  /** Page modifiée, déplacée ou restaurée : l'arborescence suit. */
  onChanged: () => void;
  onLinksChanged: () => void;
  onAddChild: () => void;
  onDeleted: () => void;
}) {
  const { t, locale } = useI18n();
  const [page, setPage] = useState<PageDto | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<UiError | null>(null);
  const initiativeId = initiative.id;
  const archived = initiative.archivedAt != null;
  // Liens de l'initiative : onglet Liens et refus de supprimer une page liée.
  const links = useLinkData(initiativeId, linksVersion, true);

  const loadPage = useCallback(
    () =>
      api.getPage(initiativeId, row.id).then(setPage, (e: unknown) => {
        if (isRefusal(e)) setMissing(true);
        else setError(toUiError(e));
      }),
    [initiativeId, row.id],
  );
  useEffect(() => {
    // Images relues à l'ouverture : une image supprimée entre-temps n'est plus montrée.
    forgetAttachmentImages();
    void loadPage();
  }, [loadPage]);

  const lastVersion = page?.versions.lastVersion ?? null;
  return (
    <PageImageSource.Provider value={initiativeId}>
      <DataScreen
        crumbs={crumbs}
        onCrumb={onCrumb}
        kind={t('referenceCategory.page')}
        reference={row.reference}
        title={page?.title ?? row.title}
        badges={
          page &&
          lastVersion !== null && (
            <>
              <span className="badge accent">{t('page.versionBadge', { number: lastVersion })}</span>
              {page.versions.modifiedSinceLastVersion && <small>{t('page.modifiedSinceVersion', { number: lastVersion })}</small>}
            </>
          )
        }
        tabs={PAGE_TABS.map((id) => ({ id, label: t(`pageTab.${id}` as MessageKey) }))}
        tab={tab}
        onTab={onTab}
      >
        {initiative.archivedAt && (
          <p className="notice">{t('initiative.archivedOn', { date: formatDate(locale, initiative.archivedAt) })}</p>
        )}
        {missing ? (
          <p className="error" role="alert">
            {t('pages.notFound')}
          </p>
        ) : !page ? (
          (error && <ErrorMessage error={error} />) || <p>{t('common.loading')}</p>
        ) : (
          <>
            {tab === 'content' && (
              <PageContentTab
                page={page}
                pages={pages}
                babok={babok}
                canEdit={canEditPages(initiative)}
                links={links.data?.links ?? { pageLinks: [] }}
                startEditing={startEditing}
                onEditStarted={onEditStarted}
                onSaved={(saved) => {
                  setPage(saved);
                  onChanged();
                }}
                onMoved={onChanged}
                onAddChild={onAddChild}
                onDeleted={onDeleted}
              />
            )}
            {tab === 'links' &&
              (links.data ? (
                <PageLinks
                  initiativeId={initiativeId}
                  pageId={page.id}
                  data={links.data}
                  canEdit={can(initiative.myRole, 'editLinks', { archived })}
                  onLinks={links.setLinks}
                  onChanged={onLinksChanged}
                />
              ) : (
                <ErrorMessage error={links.error} />
              ))}
            {tab === 'comments' && (
              <PageComments initiativeId={initiativeId} pageId={page.id} initiative={{ myRole: initiative.myRole, archived }} myId={myId} />
            )}
            {tab === 'attachments' && (
              // Relue à chaque enregistrement : nouvelles images et mention « affichée dans le texte » (ticket 26).
              <PageAttachments
                key={page.revisionId}
                initiativeId={initiativeId}
                pageId={page.id}
                initiative={{ myRole: initiative.myRole, archived }}
              />
            )}
            {tab === 'history' && (
              <PageHistoryTab
                initiativeId={initiativeId}
                page={page}
                canEdit={canEditPages(initiative)}
                onReload={() => void loadPage()}
                onRestored={() => {
                  void loadPage();
                  onChanged();
                }}
              />
            )}
          </>
        )}
      </DataScreen>
    </PageImageSource.Provider>
  );
}

/** Onglet Contenu : lecture, ou écriture au même endroit après « Modifier ». */
function PageContentTab({
  page,
  pages,
  babok,
  canEdit,
  links,
  startEditing,
  onEditStarted,
  onSaved,
  onMoved,
  onAddChild,
  onDeleted,
}: {
  page: PageDto;
  pages: PageRow[];
  babok: BabokDto | null;
  canEdit: boolean;
  links: Parameters<typeof checkPageDelete>[2];
  startEditing: boolean;
  onEditStarted: () => void;
  onSaved: (page: PageDto) => void;
  onMoved: () => void;
  onAddChild: () => void;
  onDeleted: () => void;
}) {
  const { t, locale } = useI18n();
  const { goTo } = useScreens();
  const [editing, setEditing] = useState(startEditing);
  const [error, setError] = useState<UiError | null>(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (startEditing) onEditStarted();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule fois, à l'ouverture
  }, []);

  if (editing && canEdit) {
    return (
      <PageEditForm
        initiativeId={page.initiativeId}
        page={page}
        onSaved={(saved) => {
          setEditing(false);
          onSaved(saved);
        }}
        onCancel={() => setEditing(false)}
        onTakeTheirs={(latest) => {
          setEditing(false);
          // Son titre a pu changer : l'arborescence se relit.
          onSaved(latest);
        }}
      />
    );
  }

  async function move(placement: PagePlacement) {
    try {
      await api.movePage(page.initiativeId, page.id, placement);
      setError(null);
      setStatus(t('pages.moved', { title: page.title }));
      onMoved();
    } catch (e) {
      setError(toUiError(e));
    }
  }

  const task = page.template && page.taskId && babok ? findBabokElement(babok, page.taskId) : undefined;
  return (
    <article className="page-view">
      {canEdit && (
        <div className="section-buttons branch-toolbar">
          <button type="button" className="primary" onClick={() => setEditing(true)}>
            <Pencil />
            {t('page.edit')}
          </button>
          <button type="button" onClick={onAddChild}>
            <Plus />
            {t('page.addChild')}
          </button>
        </div>
      )}
      {page.template && (
        // Modèle d'origine, sous le nom qu'il portait, et sa tâche : figés (décision 09, points 7 et 8).
        <p className="page-origin">
          <small>
            {t('page.template', { name: page.template.name })}
            {task && (
              <>
                {' · '}
                {t('page.task')}{' '}
                <button type="button" className="link" onClick={() => void goTo({ kind: 'babokElement', elementId: task.id })}>
                  <span className="code">{task.section}</span> <BabokName element={task} />
                </button>
              </>
            )}
          </small>
        </p>
      )}
      <ErrorMessage error={error} />
      <p className="visually-hidden" role="status">
        {status}
      </p>
      {/* Un document vide est enregistré sans contenu (pageContentSchema). */}
      {page.content ? <PageContent doc={page.content} /> : <p className="page-empty">{t('page.emptyContent')}</p>}
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
            {PAGE_KEYBOARD_MOVES.map((name) => {
              const placement = keyboardPlacement(pages, page.id, name);
              const Icon = MOVE_ICONS[name];
              return (
                <button key={name} type="button" className="ghost" disabled={!placement} onClick={() => placement && void move(placement)}>
                  <Icon />
                  {t(`page.move.${name}`)}
                </button>
              );
            })}
          </div>
          <DeletePage page={page} refusal={checkPageDelete(pages, page.id, links)} onDeleted={onDeleted} />
        </section>
      )}
    </article>
  );
}

/**
 * Onglet Historique (ticket 23 ; décision du 21.11.2026) : la liste des
 * enregistrements ; ouvrir un enregistrement ou en comparer deux en montre le
 * détail dans l'onglet, avec « Retour à l'historique ».
 */
function PageHistoryTab({
  initiativeId,
  page,
  canEdit,
  onReload,
  onRestored,
}: {
  initiativeId: string;
  page: PageDto;
  canEdit: boolean;
  /** Dernière version et modifications depuis : relues avec la page. */
  onReload: () => void;
  onRestored: () => void;
}) {
  const [shown, setShown] = useState<PageShown>({ kind: 'list' });
  const [revisions, setRevisions] = useState<PageRevisionRow[] | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<UiError | null>(null);

  // Relu à l'ouverture et à chaque nouvel enregistrement de la page.
  useEffect(() => {
    api.listPageRevisions(initiativeId, page.id).then(setRevisions, (e: unknown) => setError(toUiError(e)));
  }, [initiativeId, page.id, page.revisionId]);

  const show = (next: PageShown) => {
    setShown(next);
    setStatus('');
  };
  return (
    <>
      <p className="visually-hidden" role="status">
        {status}
      </p>
      <ErrorMessage error={error} />
      {shown.kind === 'revision' && revisions?.some((r) => r.id === shown.id) ? (
        <PageRevisionView
          key={shown.id}
          initiativeId={initiativeId}
          pageId={page.id}
          revisionId={shown.id}
          revisions={revisions}
          canEdit={canEdit}
          onShow={show}
          onRevisions={(list, message) => {
            setRevisions(list);
            setStatus(message);
            onReload();
          }}
          onRestored={(message) => {
            setShown({ kind: 'list' });
            setStatus(message);
            onRestored();
          }}
        />
      ) : shown.kind === 'compare' ? (
        <PageComparison
          key={`${shown.fromId}-${shown.toId}`}
          initiativeId={initiativeId}
          pageId={page.id}
          fromId={shown.fromId}
          toId={shown.toId}
          onShow={show}
        />
      ) : (
        <PageHistory revisions={revisions} shown={shown} onShow={show} />
      )}
    </>
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
        <button
          type="button"
          className="danger"
          onClick={() => (refusal ? setError({ key: `page.refusal.${refusal}` }) : setConfirming(true))}
        >
          {t('page.delete')}
        </button>
      )}
    </div>
  );
}

/**
 * Écriture d'une page : barre d'enregistrement en haut (Enregistrer, Annuler,
 * compteur), titre, puis l'éditeur. Déclaré par useUnsavedForm : changer de page,
 * d'onglet ou d'écran déclenche l'alerte (N13).
 */
function PageEditForm({
  initiativeId,
  page,
  onSaved,
  onCancel,
  onTakeTheirs,
}: {
  initiativeId: string;
  page: PageDto;
  onSaved: (page: PageDto) => void;
  onCancel: () => void;
  /** « Abandonner ma saisie et prendre la sienne » : la page dans son état actuel (ticket 24). */
  onTakeTheirs: (latest: PageDto) => void;
}) {
  const { t, locale } = useI18n();
  const { settleScreen } = useDialogs();
  // Modification simultanée (ticket 24) : la page telle qu'enregistrée entre-temps,
  // quand l'API a refusé l'enregistrement ; null tant qu'il n'y a pas eu de refus.
  const [latest, setLatest] = useState<PageDto | null>(null);
  const [comparing, setComparing] = useState(false);
  const references = useReferences();
  const [title, setTitle] = useState(page.title);
  const [doc, setDoc] = useState<PageDoc | null>(page.content);
  // Contenu tel que l'éditeur l'a lu à l'ouverture : y revenir (Annuler, Ctrl+Z) n'est pas une modification.
  const [baseline, setBaseline] = useState<string | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  const [titleMissing, setTitleMissing] = useState(false);
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
    return [...all.filter(own), ...all.filter((r) => !own(r))].filter((r) => r.id !== page.id);
  }, [references, initiativeId, page.id]);

  /**
   * Enregistre la saisie, basée sur l'état de la page à son ouverture. `onTopOf` :
   * « Enregistrer ma saisie à la suite » de cet état ; la saisie entière, titre et
   * contenu, le remplace (décision 08, point 9).
   */
  async function save(onTopOf?: PageDto): Promise<boolean> {
    // Images insérées depuis l'ouverture et encore dans le texte : leurs fichiers partent avec l'enregistrement.
    const sent = pendingImages.sendable(doc);
    // Un document vide devient null (pageContentSchema).
    const parsed = createPageWithImagesSchema.safeParse({ title, content: doc, uploads: sent.uploads });
    if (!parsed.success) {
      setTitleMissing(!title.trim());
      setError(tooLong ? { key: 'page.tooLong', params: { max: PAGE_TEXT_MAX_LENGTH.toLocaleString(locale) } } : { key: 'page.titleRequired' });
      return false;
    }
    const { uploads, ...edited } = parsed.data;
    const changes = {
      baseRevisionId: (onTopOf ?? page).revisionId,
      title: edited.title,
      ...((contentChanged || onTopOf) && { content: edited.content }),
      ...(asVersion && { version: { note: versionNote.trim() || null } }),
    };
    try {
      const saved =
        uploads.length > 0
          ? await api.savePageWithImages(initiativeId, page.id, { ...changes, uploads }, sent.files)
          : await api.updatePage(initiativeId, page.id, changes);
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

  return (
    <form className="page-edit" onSubmit={onSubmit} noValidate>
      <div className="page-save-bar">
        <span className="page-save-bar-title">{page.title}</span>
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
      <div className="page-save-version">
        <label className="checkbox">
          <input type="checkbox" checked={asVersion} onChange={(e) => setAsVersion(e.target.checked)} />
          {t('page.saveAsVersion', { number: (latest ?? page).versions.nextVersion })}
        </label>
        {asVersion && <VersionNoteField note={versionNote} onChange={setVersionNote} />}
      </div>
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
            <button type="button" className="danger" onClick={() => onTakeTheirs(latest)}>
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
          initialContent={page.content}
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
 * « Nouvelle page » et « Sous-page », en fenêtre de dialogue (N15 ; décision du
 * 21.11.2026) : une page vide ou l'un des modèles actifs, par domaine de
 * connaissance (décision 09, point 9), puis le titre, prérempli par le modèle.
 * La page est créée avec le contenu du modèle, dans la langue de l'interface
 * (décision 09, point 4), puis s'ouvre en écriture.
 */
export function CreatePageDialog({
  initiative,
  parent,
  babok,
  onCreated,
  onClose,
}: {
  initiative: InitiativeDto;
  /** Sous-page : sa parente. */
  parent: PageRow | null;
  babok: BabokDto | null;
  onCreated: (page: PageDto) => void;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const closeSilently = useCloseSilently();
  const [templates, setTemplates] = useState<PageTemplateDto[] | null>(null);
  // Absent tant que l'on choisit ; null : page vide ; sinon le modèle choisi.
  const [template, setTemplate] = useState<PageTemplateDto | null | undefined>(undefined);
  const [templateLocale] = useState(locale);
  const [title, setTitle] = useState('');
  const [titleMissing, setTitleMissing] = useState(false);
  const [error, setError] = useState<UiError | null>(null);
  const submit = useUnsavedForm({ template: template === undefined ? '' : (template?.id ?? 'blank'), title }, create);

  useEffect(() => {
    api.listPageTemplates().then(setTemplates, (e: unknown) => setError(toUiError(e)));
  }, []);

  function choose(chosen: PageTemplateDto | null) {
    setTemplate(chosen);
    // Le titre suit le modèle tant qu'il n'a pas été saisi.
    if (!title.trim() || templates?.some((tpl) => tpl.name[templateLocale] === title)) setTitle(chosen?.name[templateLocale] ?? '');
  }

  async function create(): Promise<boolean> {
    const parsed = createPageSchema.safeParse({
      title,
      content: template?.content[templateLocale] ?? null,
      parentId: parent?.id ?? null,
      template: template && { id: template.id, locale: templateLocale },
    });
    if (!parsed.success) {
      const content = template?.content[templateLocale];
      const tooLong = !!content && pageTextLength(content) > PAGE_TEXT_MAX_LENGTH;
      setTitleMissing(!title.trim());
      setError(tooLong ? { key: 'page.tooLong', params: { max: PAGE_TEXT_MAX_LENGTH.toLocaleString(locale) } } : { key: 'page.titleRequired' });
      return false;
    }
    try {
      const created = await api.createPage(initiative.id, parsed.data);
      // Saisie enregistrée : pas d'alerte.
      closeSilently();
      onCreated(created);
      return true;
    } catch (e) {
      setError(toUiError(e));
      return false;
    }
  }

  const groups = babok && templates ? pageTemplateGroups(babok, templates, locale) : [];
  return (
    <Dialog
      title={parent ? t('pages.newChildOf', { title: parent.title }) : t('pages.new')}
      kicker={
        <>
          {t('initiative.kicker')} <span className="code">{initiative.code}</span> · {initiative.name}
        </>
      }
      onClose={onClose}
    >
      {template === undefined ? (
        <section className="page-template-chooser">
          <h3 className="page-template-heading">{t('pages.chooseTemplate')}</h3>
          <ErrorMessage error={error} />
          <ul className="page-template-list">
            <li>
              <button type="button" data-autofocus onClick={() => choose(null)}>
                <FilePlus />
                <span>{t('pages.blankPage')}</span>
              </button>
            </li>
          </ul>
          {!templates && !error && <p>{t('common.loading')}</p>}
          {groups.map(({ knowledgeArea, templates: ofGroup }) => (
            <section key={knowledgeArea?.id ?? 'other'}>
              <h4 className="group-title">{knowledgeArea ? <BabokName element={knowledgeArea} /> : t('pages.otherTemplates')}</h4>
              <ul className="page-template-list">
                {ofGroup.map((item) => {
                  const task = item.taskId && babok ? findBabokElement(babok, item.taskId) : undefined;
                  return (
                    <li key={item.id}>
                      <button type="button" onClick={() => choose(item)}>
                        <span>{item.name[locale]}</span>
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
      ) : (
        <form className="stacked" onSubmit={submit} noValidate>
          <p>
            <small>{template ? t('page.template', { name: template.name[templateLocale] }) : t('pages.blankPage')}</small>{' '}
            <button type="button" className="link" onClick={() => setTemplate(undefined)}>
              {t('pages.changeTemplate')}
            </button>
          </p>
          <label>
            {t('page.titleLabel')}
            <input
              autoFocus
              value={title}
              maxLength={PAGE_TITLE_MAX_LENGTH}
              aria-invalid={titleMissing}
              onChange={(e) => {
                setTitle(e.target.value);
                setTitleMissing(false);
              }}
            />
          </label>
          <button type="submit" className="primary">
            {t('pages.create')}
          </button>
          <ErrorMessage error={error} />
        </form>
      )}
    </Dialog>
  );
}
