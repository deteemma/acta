// Référentiel BABOK (ticket 06, ADR-0012) : consultation en lecture seule, dans
// la zone de droite (navigation par arborescence, N3) ; ses deux onglets et
// chacun de ses éléments ont leur adresse (N12).
import {
  BABOK_TABS,
  type BabokDto,
  type BabokTab,
  type BabokElementDto,
  babokEnglishName,
  englishTermTooltip,
  findBabokElement,
  tasksOfKnowledgeArea,
  tasksUsingTechnique,
  type TaskPageDto,
  techniquesOfTask,
} from '@app/shared';
import { useEffect, useState } from 'react';
import { api } from './api';
import { type Crumb, ScreenLayout, type Tab } from './data-screen';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { useScreens } from './screens';

/** Nom dans la langue de l'interface ; en français, le nom anglais en info-bulle (ADR-0013). */
export function BabokName({ element }: { element: BabokElementDto }) {
  const { locale } = useI18n();
  return <span title={babokEnglishName(element, locale)}>{element.name[locale]}</span>;
}

/** Lien vers la fiche d'un élément, qui s'ouvre dans la zone de droite. */
function BabokLink({ element, pill = false }: { element: BabokElementDto; pill?: boolean }) {
  const { goTo } = useScreens();
  return (
    <button
      type="button"
      className={pill ? 'link pill' : 'link'}
      onClick={(event) => {
        // Dans un <summary>, ouvrir la fiche sans déplier la liste.
        event.preventDefault();
        void goTo({ kind: 'babokElement', elementId: element.id });
      }}
    >
      {!pill && <span className="code">{element.section}</span>} <BabokName element={element} />
    </button>
  );
}

/** Éléments liés, en pastilles cliquables (refonte du design, ticket 04, lot 2). */
function BabokLinks({ elements }: { elements: BabokElementDto[] }) {
  return (
    <ul className="pill-list">
      {elements.map((e) => (
        <li key={e.id}>
          <BabokLink element={e} pill />
        </li>
      ))}
    </ul>
  );
}

/** Ligne dépliable : l'élément, le nombre d'éléments liés, puis ceux-ci en pastilles. */
function BabokItem({ element, linked }: { element: BabokElementDto; linked: BabokElementDto[] }) {
  return (
    <details className="disclosure">
      <summary>
        <span className="disclosure-name">
          <BabokLink element={element} />
        </span>
        <span className="count">{linked.length}</span>
      </summary>
      <BabokLinks elements={linked} />
    </details>
  );
}

/** Vue d'ensemble, en deux onglets (validé le 01.11.2026) : les domaines et leurs tâches, les techniques. */
export function BabokScreen({ babok, tab }: { babok: BabokDto | null; tab: BabokTab }) {
  const { t, locale } = useI18n();
  const { goTo } = useScreens();
  const tabs: Tab<BabokTab>[] = BABOK_TABS.map((id) =>
    id === 'areas'
      ? { id, label: t('babok.areasTab') }
      : {
          id,
          label: t('babok.techniques'),
          tooltip: englishTermTooltip(locale, 'babok.techniques'),
          ...(babok && { count: babok.techniques.length }),
        },
  );
  return (
    <ScreenLayout
      crumbs={[]}
      kind={t('babok.kicker')}
      title={t('babok.title')}
      tabs={tabs}
      tab={tab}
      onTab={(next) => void goTo({ kind: 'babok', tab: next })}
    >
      <p className="notice">{t('babok.notice')}</p>
      {!babok ? (
        <p>{t('common.loading')}</p>
      ) : tab === 'areas' ? (
        babok.knowledgeAreas.map((area) => (
          <section key={area.id} className="babok-area">
            <h2>
              <BabokLink element={area} />
            </h2>
            <div className="disclosure-list">
              {tasksOfKnowledgeArea(babok, area.id).map((task) => (
                <BabokItem key={task.id} element={task} linked={techniquesOfTask(babok, task)} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className="disclosure-list">
          {babok.techniques.map((technique) => (
            <BabokItem key={technique.id} element={technique} linked={tasksUsingTechnique(babok, technique.id)} />
          ))}
        </div>
      )}
    </ScreenLayout>
  );
}

/** Fiche d'un élément : nom, renvoi de section, résumé et éléments liés. */
export function BabokElementScreen({ babok, elementId }: { babok: BabokDto | null; elementId: string }) {
  const { t, locale } = useI18n();
  const { goTo } = useScreens();
  const element = babok ? findBabokElement(babok, elementId) : undefined;
  const crumbs: Crumb[] = [{ key: 'babok', label: t('babok.title'), onSelect: () => void goTo({ kind: 'babok', tab: 'areas' }) }];
  if (!babok || !element) {
    // Section inconnue (adresse ancienne ou mal saisie).
    return (
      <ScreenLayout crumbs={crumbs} kind={t('babok.kicker')} title={babok ? elementId : t('common.loading')}>
        {babok && (
          <p className="error" role="alert">
            {t('babok.notFound')}
          </p>
        )}
      </ScreenLayout>
    );
  }
  if (element.kind === 'technique') {
    crumbs.push({ key: 'techniques', label: t('babok.techniques'), onSelect: () => void goTo({ kind: 'babok', tab: 'techniques' }) });
  } else if (element.kind === 'task') {
    const area = findBabokElement(babok, element.knowledgeAreaId);
    if (area) {
      crumbs.push({
        key: area.id,
        label: `${area.section} ${area.name[locale]}`,
        onSelect: () => void goTo({ kind: 'babokElement', elementId: area.id }),
      });
    }
  }
  return (
    <ScreenLayout
      crumbs={crumbs}
      kind={<span title={englishTermTooltip(locale, `babok.${element.kind}`)}>{t(`babok.${element.kind}`)}</span>}
      reference={t('babok.section', { section: element.section })}
      title={element.name[locale]}
      titleTooltip={babokEnglishName(element, locale)}
    >
      <p className="babok-summary">{element.summary[locale]}</p>
      {element.kind === 'knowledgeArea' && (
        <>
          <h2 className="group-title" title={englishTermTooltip(locale, 'babok.tasks')}>
            {t('babok.tasks')} <span className="count">{tasksOfKnowledgeArea(babok, element.id).length}</span>
          </h2>
          <BabokLinks elements={tasksOfKnowledgeArea(babok, element.id)} />
        </>
      )}
      {element.kind === 'task' && (
        <>
          <dl>
            <dt title={englishTermTooltip(locale, 'babok.knowledgeArea')}>{t('babok.knowledgeArea')}</dt>
            <dd>
              <BabokLink element={findBabokElement(babok, element.knowledgeAreaId)!} />
            </dd>
          </dl>
          <h2 className="group-title">
            {t('babok.techniquesOfTask')} <span className="count">{techniquesOfTask(babok, element).length}</span>
          </h2>
          <BabokLinks elements={techniquesOfTask(babok, element)} />
          <TaskPages taskId={element.id} />
        </>
      )}
      {element.kind === 'technique' && (
        <>
          <h2 className="group-title">
            {t('babok.tasksUsingTechnique')} <span className="count">{tasksUsingTechnique(babok, element.id).length}</span>
          </h2>
          <BabokLinks elements={tasksUsingTechnique(babok, element.id)} />
        </>
      )}
    </ScreenLayout>
  );
}

/**
 * Pages créées depuis un modèle de la tâche (ticket 27, décision 09, point 8), dans
 * les initiatives dont je suis membre. Une référence ouvre la page.
 */
function TaskPages({ taskId }: { taskId: string }) {
  const { t } = useI18n();
  const { goTo } = useScreens();
  const [pages, setPages] = useState<TaskPageDto[] | null>(null);
  const [error, setError] = useState<UiError | null>(null);

  useEffect(() => {
    api.listTaskPages(taskId).then(setPages, (e: unknown) => setError(toUiError(e)));
  }, [taskId]);

  return (
    <>
      <h2 className="group-title">
        {t('babok.taskPages')} {pages && <span className="count">{pages.length}</span>}
      </h2>
      <ErrorMessage error={error} />
      <p>
        <small>{t('babok.taskPagesHint')}</small>
      </p>
      {pages && pages.length === 0 && <p><small>{t('babok.taskPagesNone')}</small></p>}
      {pages && pages.length > 0 && (
        <ul className="links">
          {pages.map((page) => (
            <li key={page.id}>
              <button
                type="button"
                className="link"
                onClick={() => void goTo({ kind: 'page', initiativeId: page.initiativeId, pageId: page.id, tab: 'content' })}
              >
                <span className="code">{page.reference}</span> {page.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
