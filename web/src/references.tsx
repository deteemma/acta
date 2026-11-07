// Références citées dans un texte (ticket 10) : reconnues par @app/shared
// (rich-text.ts), reliées à leur objet si elles existent dans une initiative
// dont je suis membre, avec un aperçu au survol ; un clic ouvre la fiche.
import type { ReferenceDto } from '@app/shared';
import { createContext, type ReactNode, useContext, useEffect, useId, useState } from 'react';
import { api } from './api';
import { useI18n } from './i18n';
import { type PanelContent, usePanels } from './panels';
import { StatusLabel } from './requirement-statuses';
import { ticketTarget } from './ticket-parts';

const ReferencesContext = createContext<ReadonlyMap<string, ReferenceDto>>(new Map());

/** Références de mes initiatives, rechargées à chaque `version` ; sans réponse, les références restent du texte. */
export function ReferencesProvider({ version, children }: { version: number; children: ReactNode }) {
  const [references, setReferences] = useState<ReadonlyMap<string, ReferenceDto>>(new Map());
  useEffect(() => {
    api.listReferences().then((list) => setReferences(new Map(list.map((r) => [r.reference, r]))), () => undefined);
  }, [version]);
  return <ReferencesContext.Provider value={references}>{children}</ReferencesContext.Provider>;
}

/** Fiche d'un objet référencé. */
export function referenceTarget(item: ReferenceDto): PanelContent {
  switch (item.category) {
    case 'need':
      return { kind: 'need', initiativeId: item.initiativeId, needId: item.id };
    case 'requirement':
      return { kind: 'requirement', initiativeId: item.initiativeId, requirementId: item.id };
    default:
      return ticketTarget(item.initiativeId, { id: item.id, type: item.category });
  }
}

/** Référence citée : lien vers sa fiche et aperçu au survol ou au focus ; texte seul si elle est inconnue. */
export function ReferenceMention({ reference }: { reference: string }) {
  const { t } = useI18n();
  const { open } = usePanels();
  const item = useContext(ReferencesContext).get(reference);
  const [previewing, setPreviewing] = useState(false);
  const previewId = useId();
  if (!item) return <>{reference}</>;
  return (
    <span
      className="reference-mention"
      onMouseEnter={() => setPreviewing(true)}
      onMouseLeave={() => setPreviewing(false)}
    >
      <button
        type="button"
        className="link"
        aria-describedby={previewing ? previewId : undefined}
        onFocus={() => setPreviewing(true)}
        onBlur={() => setPreviewing(false)}
        onKeyDown={(e) => e.key === 'Escape' && setPreviewing(false)}
        onClick={() => open(referenceTarget(item))}
      >
        {reference}
      </button>
      {previewing && (
        <span id={previewId} role="tooltip" className="reference-preview">
          <strong>{item.reference}</strong> {item.title}
          <small>
            {t(`referenceCategory.${item.category}`)}
            {item.requirement && (
              <>
                {' · '}
                {t(`requirementType.${item.requirement.type}`)}
                {item.requirement.subtype && ` (${t(`requirementSubtype.${item.requirement.subtype}`)})`}
                {' · '}
                <StatusLabel status={item.requirement.status} />
              </>
            )}
            {item.initiativeArchived && ` · ${t('initiative.archived')}`}
          </small>
        </span>
      )}
    </span>
  );
}
