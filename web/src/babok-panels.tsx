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
import { useState } from 'react';
import { useI18n } from './i18n';
import { Panel, usePanels } from './panels';

/** Nom dans la langue de l'interface ; en français, le nom anglais en info-bulle (ADR-0013). */
export function BabokName({ element }: { element: BabokElementDto }) {
  const { locale } = useI18n();
  return <span title={babokEnglishName(element, locale)}>{element.name[locale]}</span>;
}

/** Lien vers la fiche d'un élément, ouverte dans un panneau superposé. */
function BabokLink({ element, pill = false }: { element: BabokElementDto; pill?: boolean }) {
  const { open } = usePanels();
  return (
    <button
      type="button"
      className={pill ? 'link pill' : 'link'}
      onClick={(event) => {
        // Dans un <summary>, ouvrir la fiche sans déplier la liste.
        event.preventDefault();
        open({ kind: 'babokElement', elementId: element.id });
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

/** Intitulé d'un terme du BABOK, l'anglais en info-bulle. */
function Term({ as: Tag = 'h3', term }: { as?: 'h3' | 'dt'; term: 'babok.knowledgeArea' | 'babok.knowledgeAreas' | 'babok.tasks' | 'babok.techniques' }) {
  const { t, locale } = useI18n();
  return <Tag title={englishTermTooltip(locale, term)}>{t(term)}</Tag>;
}

/** Vue d'ensemble, en deux onglets (validé le 01.11.2026) : les domaines et leurs tâches, les techniques. */
export function BabokPanel({ babok, onClose }: { babok: BabokDto; onClose: () => void }) {
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<'areas' | 'techniques'>('areas');
  return (
    <Panel title={t('babok.title')} kicker={t('babok.kicker')} onClose={onClose}>
      <p className="notice">{t('babok.notice')}</p>
      <div role="tablist" className="tabs">
        <button type="button" role="tab" id="babok-tab-areas" aria-controls="babok-areas" aria-selected={tab === 'areas'} onClick={() => setTab('areas')}>
          {t('babok.areasTab')}
        </button>
        <button
          type="button"
          role="tab"
          id="babok-tab-techniques"
          aria-controls="babok-techniques"
          aria-selected={tab === 'techniques'}
          onClick={() => setTab('techniques')}
        >
          <span title={englishTermTooltip(locale, 'babok.techniques')}>{t('babok.techniques')}</span>
          <span className="count">{babok.techniques.length}</span>
        </button>
      </div>
      <div role="tabpanel" id="babok-areas" aria-labelledby="babok-tab-areas" hidden={tab !== 'areas'}>
        {babok.knowledgeAreas.map((area) => (
          <section key={area.id} className="babok-area">
            <h4>
              <BabokLink element={area} />
            </h4>
            <div className="disclosure-list">
              {tasksOfKnowledgeArea(babok, area.id).map((task) => (
                <BabokItem key={task.id} element={task} linked={techniquesOfTask(babok, task)} />
              ))}
            </div>
          </section>
        ))}
      </div>
      <div role="tabpanel" id="babok-techniques" aria-labelledby="babok-tab-techniques" hidden={tab !== 'techniques'}>
        <div className="disclosure-list">
          {babok.techniques.map((technique) => (
            <BabokItem key={technique.id} element={technique} linked={tasksUsingTechnique(babok, technique.id)} />
          ))}
        </div>
      </div>
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
      title={element.name[locale]}
      titleTooltip={babokEnglishName(element, locale)}
      kicker={
        <>
          <span title={englishTermTooltip(locale, `babok.${element.kind}`)}>{t(`babok.${element.kind}`)}</span>{' '}
          <span className="code">{t('babok.section', { section: element.section })}</span>
        </>
      }
      onClose={onClose}
    >
      <p className="babok-summary">{element.summary[locale]}</p>
      {element.kind === 'knowledgeArea' && (
        <>
          <h3 className="group-title" title={englishTermTooltip(locale, 'babok.tasks')}>
            {t('babok.tasks')} <span className="count">{tasksOfKnowledgeArea(babok, element.id).length}</span>
          </h3>
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
          <h3 className="group-title">
            {t('babok.techniquesOfTask')} <span className="count">{techniquesOfTask(babok, element).length}</span>
          </h3>
          <BabokLinks elements={techniquesOfTask(babok, element)} />
        </>
      )}
      {element.kind === 'technique' && (
        <>
          <h3 className="group-title">
            {t('babok.tasksUsingTechnique')} <span className="count">{tasksUsingTechnique(babok, element.id).length}</span>
          </h3>
          <BabokLinks elements={tasksUsingTechnique(babok, element.id)} />
        </>
      )}
    </Panel>
  );
}
