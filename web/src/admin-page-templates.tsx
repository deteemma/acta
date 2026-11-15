// Administration des modèles de page (ticket 30, décisions 09 point 6 et 14 point
// 3) : liste par domaine de connaissance, avec la mention « livré » ou « ajouté »
// et l'état ; un modèle s'ouvre en panneau, un onglet par langue, en lecture seule
// s'il est livré, avec l'éditeur de page (sans image) s'il est ajouté. Les
// contrôles et les refus suivent @app/shared (page-template-admin.ts).
import {
  type AdminPageTemplateDto,
  type BabokDto,
  checkPageTemplateCreation,
  checkPageTemplateDeletion,
  checkPageTemplateUpdate,
  findBabokElement,
  isEditablePageTemplate,
  isPageTemplateRefusal,
  LOCALES,
  type Locale,
  PAGE_TEMPLATE_NAME_MAX_LENGTH,
  type PageDoc,
  type PageTemplateRefusal,
  pageTemplateGroups,
  pageTemplateInputSchema,
} from '@app/shared';
import { lazy, type ReactNode, Suspense, useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { api, ApiError } from './api';
import { BabokName } from './babok-panels';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { PageContent } from './page-content';
import { Panel, useCloseSilently, usePanels } from './panels';
import { useUnsavedForm } from './unsaved-changes';

// Tiptap n'est chargé qu'à l'ouverture d'un modèle ajouté (ADR-0019, point 5).
const PageEditor = lazy(() => import('./page-editor'));

// ── Liste partagée entre l'onglet et les panneaux ─────────────────────────────

let templates: AdminPageTemplateDto[] | null = null;
const listeners = new Set<() => void>();

function setTemplates(next: AdminPageTemplateDto[]) {
  templates = next;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Tous les modèles, désactivés compris ; null avant la première lecture. */
function useAdminPageTemplates(): AdminPageTemplateDto[] | null {
  return useSyncExternalStore(subscribe, () => templates);
}

const refusalError = (refusal: PageTemplateRefusal): UiError => ({ key: `pageTemplate.refusal.${refusal}` });

function pageTemplateError(error: unknown): UiError {
  if (error instanceof ApiError && isPageTemplateRefusal(error.refusal)) return refusalError(error.refusal);
  return toUiError(error);
}

/**
 * Refus des règles de @app/shared, sinon appel de l'API ; la liste est remplacée
 * par celle renvoyée. Refusé parce que la liste a changé entre-temps : elle est relue.
 */
async function run(
  refusal: PageTemplateRefusal | null,
  call: () => Promise<AdminPageTemplateDto[]>,
  setError: (error: UiError | null) => void,
): Promise<AdminPageTemplateDto[] | null> {
  if (refusal) {
    setError(refusalError(refusal));
    return null;
  }
  try {
    const next = await call();
    setTemplates(next);
    setError(null);
    return next;
  } catch (e) {
    setError(pageTemplateError(e));
    api.listAdminPageTemplates().then(setTemplates, () => undefined);
    return null;
  }
}

const taskIdsOf = (babok: BabokDto) => babok.tasks.map((task) => task.id);

// ── Onglet « Modèles de page » ───────────────────────────────────────────────

export function PageTemplatesSection({ babok }: { babok: BabokDto | null }) {
  const { t, locale } = useI18n();
  const { open } = usePanels();
  const list = useAdminPageTemplates();
  const [error, setError] = useState<UiError | null>(null);

  useEffect(() => {
    api.listAdminPageTemplates().then(setTemplates, (e: unknown) => setError(toUiError(e)));
  }, []);

  const groups = babok && list ? pageTemplateGroups(babok, list, locale, { withInactive: true }) : [];
  return (
    <section>
      <h3 className="visually-hidden">{t('admin.pageTemplates')}</h3>
      <p>
        <small>{t('admin.pageTemplatesHint')}</small>
      </p>
      <ErrorMessage error={error} />
      {(!list || !babok) && !error && <p>{t('common.loading')}</p>}
      {groups.map(({ knowledgeArea, templates: ofGroup }) => (
        <section key={knowledgeArea?.id ?? 'other'}>
          <h4 className="group-title">{knowledgeArea ? <BabokName element={knowledgeArea} /> : t('pages.otherTemplates')}</h4>
          <ul className="links dense-list team-members">
            {ofGroup.map((template) => {
              const task = template.taskId && babok ? findBabokElement(babok, template.taskId) : undefined;
              return (
                <li key={template.id}>
                  <button
                    type="button"
                    className="link"
                    onClick={() => open({ kind: 'pageTemplate', templateId: template.id })}
                  >
                    {template.name[locale]}
                  </button>
                  {task && (
                    <small>
                      {' '}
                      · <span className="code">{task.section}</span> <BabokName element={task} />
                    </small>
                  )}
                  <span className="team-controls">
                    <TemplateBadges template={template} />
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <p>
        <button type="button" onClick={() => open({ kind: 'pageTemplate' })}>
          {t('admin.pageTemplate.addTitle')}
        </button>
      </p>
    </section>
  );
}

function TemplateBadges({ template }: { template: AdminPageTemplateDto }) {
  const { t } = useI18n();
  return (
    <>
      <small className="badge">{t(template.origin === 'delivered' ? 'admin.pageTemplate.delivered' : 'admin.pageTemplate.added')}</small>
      <small className="badge">{t(template.active ? 'admin.pageTemplate.active' : 'admin.pageTemplate.inactive')}</small>
      {checkPageTemplateDeletion([template], template.id) === 'templateUsed' && <small className="badge">{t('admin.pageTemplate.used')}</small>}
    </>
  );
}

// ── Panneau d'un modèle ──────────────────────────────────────────────────────

export function PageTemplatePanel({
  babok,
  templateId,
  onClose,
}: {
  babok: BabokDto;
  /** Absent : ajout d'un modèle. */
  templateId?: string;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const list = useAdminPageTemplates();
  const [error, setError] = useState<UiError | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!templates) api.listAdminPageTemplates().then(setTemplates, (e: unknown) => setError(toUiError(e)));
  }, []);

  const template = templateId ? list?.find((item) => item.id === templateId) : undefined;
  const task = template?.taskId ? findBabokElement(babok, template.taskId) : undefined;

  async function toggle(current: AdminPageTemplateDto) {
    const change = { active: !current.active };
    const next = await run(
      checkPageTemplateUpdate(list ?? [], current.id, change, taskIdsOf(babok)),
      () => api.updatePageTemplate(current.id, change),
      setError,
    );
    const name = current.name[locale];
    setDone(next ? t(change.active ? 'admin.pageTemplate.reactivated' : 'admin.pageTemplate.deactivated', { name }) : null);
  }

  return (
    <Panel
      title={template ? template.name[locale] : t('admin.pageTemplate.new')}
      kicker={t('admin.pageTemplate.kicker')}
      badges={template && <TemplateBadges template={template} />}
      onClose={onClose}
    >
      <ErrorMessage error={error} />
      {done && <p className="notice">{done}</p>}
      {templateId && !template ? (
        !error && <p>{list ? t('pageTemplate.refusal.unknownTemplate') : t('common.loading')}</p>
      ) : template && !isEditablePageTemplate(template) ? (
        <>
          <p>
            <small>{t('admin.pageTemplate.deliveredHint')}</small>
          </p>
          {task && (
            <p>
              {t('admin.pageTemplate.task')} : <span className="code">{task.section}</span> <BabokName element={task} />
            </p>
          )}
          <LanguageTabs
            render={(language) => (
              <>
                <h3>{template.name[language]}</h3>
                <PageContent doc={template.content[language]} />
              </>
            )}
          />
          <p>
            <ToggleButton template={template} onToggle={() => void toggle(template)} />
          </p>
        </>
      ) : (
        <AddedTemplateForm
          // Modèle changé ailleurs (autre administrateur) : formulaire remis à jour.
          key={template ? JSON.stringify([template.name, template.taskId]) : 'new'}
          babok={babok}
          template={template}
          onToggle={template && (() => void toggle(template))}
          onError={setError}
          onDone={setDone}
        />
      )}
    </Panel>
  );
}

function ToggleButton({ template, onToggle }: { template: AdminPageTemplateDto; onToggle: () => void }) {
  const { t } = useI18n();
  return (
    <button type="button" className={template.active ? 'danger' : undefined} onClick={onToggle}>
      {t(template.active ? 'admin.pageTemplate.deactivate' : 'admin.pageTemplate.reactivate')}
    </button>
  );
}

/** Un onglet par langue ; tous restent montés, pour garder la saisie de chacun. */
function LanguageTabs({ render }: { render: (language: Locale) => ReactNode }) {
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<Locale>(locale);
  return (
    <>
      <div role="tablist" className="tabs" aria-label={t('admin.pageTemplate.languages')}>
        {LOCALES.map((language) => (
          <button
            key={language}
            type="button"
            role="tab"
            id={`page-template-tab-${language}`}
            aria-selected={tab === language}
            aria-controls={`page-template-${language}`}
            onClick={() => setTab(language)}
          >
            {t(`language.${language}`)}
          </button>
        ))}
      </div>
      {LOCALES.map((language) => (
        <div
          key={language}
          role="tabpanel"
          id={`page-template-${language}`}
          aria-labelledby={`page-template-tab-${language}`}
          hidden={tab !== language}
        >
          {render(language)}
        </div>
      ))}
    </>
  );
}

const noImage = () => Promise.resolve('unavailable' as const);
const noFiles = () => [];

/**
 * Modèle ajouté, ou à ajouter : tâche BABOK facultative, puis nom et contenu dans
 * chaque langue. Déclaré par useUnsavedForm : fermer le panneau déclenche l'alerte.
 */
function AddedTemplateForm({
  babok,
  template,
  onToggle,
  onError,
  onDone,
}: {
  babok: BabokDto;
  template: AdminPageTemplateDto | undefined;
  onToggle: (() => void) | undefined;
  onError: (error: UiError | null) => void;
  onDone: (message: string | null) => void;
}) {
  const { t, locale } = useI18n();
  const { replaceSaved } = usePanels();
  const closeSilently = useCloseSilently();
  const [name, setName] = useState<Record<Locale, string>>(template?.name ?? { fr: '', en: '' });
  const [taskId, setTaskId] = useState(template?.taskId ?? '');
  const [docs, setDocs] = useState<Record<Locale, PageDoc | null>>({ fr: null, en: null });
  // Contenu tel que l'éditeur le lit à l'ouverture, ou au dernier enregistrement.
  const [baselines, setBaselines] = useState<Record<Locale, string>>({ fr: '', en: '' });
  const [invalid, setInvalid] = useState(false);

  const serialized = (language: Locale) => (docs[language] ? JSON.stringify(docs[language]) : '');
  const changed = (language: Locale) => serialized(language) !== baselines[language] ? serialized(language) : '';

  const onReady = useCallback((language: Locale, doc: PageDoc) => {
    setDocs((d) => ({ ...d, [language]: doc }));
    setBaselines((b) => ({ ...b, [language]: JSON.stringify(doc) }));
  }, []);
  const onChange = useCallback((language: Locale, doc: PageDoc) => setDocs((d) => ({ ...d, [language]: doc })), []);

  const values = { nameFr: name.fr, nameEn: name.en, taskId, contentFr: changed('fr'), contentEn: changed('en') };

  async function save() {
    // Même schéma de validation que l'API (@app/shared).
    const parsed = pageTemplateInputSchema.safeParse({ name, content: docs, taskId: taskId || null });
    setInvalid(!parsed.success);
    if (!parsed.success) return false;
    const input = parsed.data;
    const list = templates ?? [];
    const next = await run(
      template
        ? checkPageTemplateUpdate(list, template.id, input, taskIdsOf(babok))
        : checkPageTemplateCreation(list, input, taskIdsOf(babok)),
      () => (template ? api.updatePageTemplate(template.id, input) : api.addPageTemplate(input)),
      onError,
    );
    if (!next) {
      onDone(null);
      return false;
    }
    if (!template) {
      // Le modèle ajouté : le seul absent de la liste d'avant.
      const created = next.find((item) => !list.some((before) => before.id === item.id));
      onDone(t('admin.pageTemplate.addedNotice', { name: input.name[locale] }));
      if (created) replaceSaved({ kind: 'pageTemplate', templateId: created.id });
      return true;
    }
    onDone(t('admin.pageTemplate.saved', { name: input.name[locale] }));
    setBaselines({ fr: serialized('fr'), en: serialized('en') });
    return { ...values, contentFr: '', contentEn: '' };
  }

  const onSubmit = useUnsavedForm(values, save);

  async function remove(current: AdminPageTemplateDto) {
    const next = await run(
      checkPageTemplateDeletion(templates ?? [], current.id),
      () => api.deletePageTemplate(current.id),
      onError,
    );
    if (next) closeSilently();
  }

  return (
    <form className="stacked" onSubmit={onSubmit} noValidate>
      <p>
        <small>{t('admin.pageTemplate.addedHint')}</small>
      </p>
      <label>
        {t('admin.pageTemplate.task')}
        <select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
          <option value="">{t('admin.pageTemplate.noTask')}</option>
          {babok.knowledgeAreas.map((area) => (
            <optgroup key={area.id} label={area.name[locale]}>
              {babok.tasks
                .filter((task) => task.knowledgeAreaId === area.id)
                .map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.section} {task.name[locale]}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <LanguageTabs
        render={(language) => (
          <div className="stacked">
            <label>
              {t('admin.pageTemplate.name')}
              <input
                value={name[language]}
                maxLength={PAGE_TEMPLATE_NAME_MAX_LENGTH}
                onChange={(e) => setName({ ...name, [language]: e.target.value })}
              />
            </label>
            <Suspense fallback={<p>{t('common.loading')}</p>}>
              <PageEditor
                initialContent={template?.content[language] ?? null}
                references={[]}
                label={t('admin.pageTemplate.content', { language: t(`language.${language}`) })}
                resolveImage={noImage}
                onImageFiles={noFiles}
                onReady={(doc) => onReady(language, doc)}
                onChange={(doc) => onChange(language, doc)}
                forTemplate
              />
            </Suspense>
          </div>
        )}
      />
      {invalid && <ErrorMessage error={{ key: 'admin.pageTemplate.invalid' }} />}
      <p className="team-controls">
        <button type="submit" className="primary">
          {t(template ? 'admin.pageTemplate.save' : 'admin.pageTemplate.add')}
        </button>
        {template && onToggle && <ToggleButton template={template} onToggle={onToggle} />}
        {/* Un modèle qui a servi ne se supprime pas : pas de bouton. */}
        {template && checkPageTemplateDeletion([template], template.id) === null && (
          <button type="button" className="danger" onClick={() => void remove(template)}>
            {t('admin.pageTemplate.delete')}
          </button>
        )}
      </p>
    </form>
  );
}
