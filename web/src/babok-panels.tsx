// Référentiel BABOK (ticket 06, ADR-0012) : consultation en lecture seule.
import {
  type BabokDto,
  type BabokElementDto,
  babokEnglishName,
  englishTermTooltip,
  findBabokElement,
  tasksOfKnowledgeArea,
  tasksUsingTechnique,
  techniquesOfTask,
} from '@app/shared';
import { useI18n } from './i18n';
import { Panel, usePanels } from './panels';

/** Nom dans la langue de l'interface ; en français, le nom anglais en info-bulle (ADR-0013). */
export function BabokName({ element }: { element: BabokElementDto }) {
  const { locale } = useI18n();
  return <span title={babokEnglishName(element, locale)}>{element.name[locale]}</span>;
}

/** Lien vers la fiche d'un élément, ouverte dans un panneau superposé. */
function BabokLink({ element }: { element: BabokElementDto }) {
  const { open } = usePanels();
  return (
    <button
      type="button"
      className="link"
      onClick={(event) => {
        // Dans un <summary>, ouvrir la fiche sans déplier la liste.
        event.preventDefault();
        open({ kind: 'babokElement', elementId: element.id });
      }}
    >
      <strong>{element.section}</strong> <BabokName element={element} />
    </button>
  );
}

function BabokLinks({ elements }: { elements: BabokElementDto[] }) {
  return (
    <ul className="links">
      {elements.map((e) => (
        <li key={e.id}>
          <BabokLink element={e} />
        </li>
      ))}
    </ul>
  );
}

/** Intitulé d'un terme du BABOK, l'anglais en info-bulle. */
function Term({ as: Tag = 'h3', term }: { as?: 'h3' | 'dt'; term: 'babok.knowledgeArea' | 'babok.knowledgeAreas' | 'babok.tasks' | 'babok.techniques' }) {
  const { t, locale } = useI18n();
  return <Tag title={englishTermTooltip(locale, term)}>{t(term)}</Tag>;
}

/** Vue d'ensemble : les domaines et leurs tâches, puis les techniques. */
export function BabokPanel({ babok, onClose }: { babok: BabokDto; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Panel title={t('babok.title')} onClose={onClose}>
      <p className="notice">{t('babok.notice')}</p>
      <Term term="babok.knowledgeAreas" />
      {babok.knowledgeAreas.map((area) => (
        <section key={area.id} className="babok-area">
          <h4>
            <BabokLink element={area} />
          </h4>
          {tasksOfKnowledgeArea(babok, area.id).map((task) => (
            <details key={task.id} className="babok-item">
              <summary>
                <BabokLink element={task} />
              </summary>
              <BabokLinks elements={techniquesOfTask(babok, task)} />
            </details>
          ))}
        </section>
      ))}
      <Term term="babok.techniques" />
      {babok.techniques.map((technique) => (
        <details key={technique.id} className="babok-item">
          <summary>
            <BabokLink element={technique} />
          </summary>
          <BabokLinks elements={tasksUsingTechnique(babok, technique.id)} />
        </details>
      ))}
    </Panel>
  );
}

/** Fiche d'un élément : nom, renvoi de section, résumé et éléments liés. */
export function BabokElementPanel({
  babok,
  element,
  onClose,
}: {
  babok: BabokDto;
  element: BabokElementDto;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  return (
    <Panel
      title={`${element.section} ${element.name[locale]}`}
      titleTooltip={babokEnglishName(element, locale)}
      onClose={onClose}
    >
      <p>
        <small title={englishTermTooltip(locale, `babok.${element.kind}`)}>{t(`babok.${element.kind}`)}</small>
        {' · '}
        <small>{t('babok.section', { section: element.section })}</small>
      </p>
      <p>{element.summary[locale]}</p>
      {element.kind === 'knowledgeArea' && (
        <>
          <Term term="babok.tasks" />
          <BabokLinks elements={tasksOfKnowledgeArea(babok, element.id)} />
        </>
      )}
      {element.kind === 'task' && (
        <>
          <dl>
            <Term as="dt" term="babok.knowledgeArea" />
            <dd>
              <BabokLink element={findBabokElement(babok, element.knowledgeAreaId)!} />
            </dd>
          </dl>
          <h3>{t('babok.techniquesOfTask')}</h3>
          <BabokLinks elements={techniquesOfTask(babok, element)} />
        </>
      )}
      {element.kind === 'technique' && (
        <>
          <h3>{t('babok.tasksUsingTechnique')}</h3>
          <BabokLinks elements={tasksUsingTechnique(babok, element.id)} />
        </>
      )}
    </Panel>
  );
}
