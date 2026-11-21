// Références citées dans un texte (ticket 10) : reconnues par @app/shared
// (rich-text.ts), reliées à leur objet si elles existent dans une initiative
// dont je suis membre, avec un aperçu au survol ; un clic ouvre son nœud (N16).
import type { ReferenceDto, TreeNodeRef } from '@app/shared';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useId, useState } from 'react';
import { api } from './api';
import { useTicketLabels } from './ticket-types';
import { useI18n } from './i18n';
import { nodeDestination } from './initiative-tree';
import { StatusLabel } from './requirement-statuses';
import { useScreens } from './screens';

const ReferencesContext = createContext<ReadonlyMap<string, ReferenceDto>>(new Map());

/** Références de mes initiatives, rechargées à chaque `version` ; sans réponse, les références restent du texte. */
export function ReferencesProvider({ version, children }: { version: number; children: ReactNode }) {
  const [references, setReferences] = useState<ReadonlyMap<string, ReferenceDto>>(new Map());
  useEffect(() => {
    api.listReferences().then((list) => setReferences(new Map(list.map((r) => [r.reference, r]))), () => undefined);
  }, [version]);
  return <ReferencesContext.Provider value={references}>{children}</ReferencesContext.Provider>;
}

/** Références connues, par référence (ex. pour les proposer à la saisie de `#`). */
export const useReferences = () => useContext(ReferencesContext);

/**
 * Ouvre un objet référencé (N16) : change d'initiative si besoin et affiche son
 * nœud à droite.
 */
export function useOpenReference(): (item: ReferenceDto) => void {
  const openNode = useOpenNode();
  return useCallback(
    (item) => {
      const ref = referenceNode(item);
      if (ref) openNode(item.initiativeId, ref);
    },
    [openNode],
  );
}

/**
 * Ouvre le nœud d'un élément (lien vers une partie prenante, un besoin, un ticket…) :
 * ferme les panneaux, avec l'alerte, et l'affiche à droite.
 */
export function useOpenNode(): (initiativeId: string, ref: TreeNodeRef) => void {
  const { goTo } = useScreens();
  return useCallback(
    (initiativeId, ref) => {
      void goTo(nodeDestination(initiativeId, ref));
    },
    [goTo],
  );
}

/** Nœud de l'arborescence d'un objet référencé. */
function referenceNode(item: ReferenceDto): TreeNodeRef | null {
  switch (item.category) {
    case 'need':
    case 'requirement':
    case 'page':
      return { kind: item.category, id: item.id };
    case 'scenario':
      // L'exigence qui l'affiche, sur lui (D20).
      return item.scenario && { kind: 'scenario', id: item.id, requirementId: item.scenario.requirementId };
    default:
      return { kind: 'ticket', id: item.id };
  }
}

/** Référence citée : lien vers sa fiche et aperçu au survol ou au focus ; texte seul si elle est inconnue. */
export function ReferenceMention({ reference }: { reference: string }) {
  const { t } = useI18n();
  const { categoryLabel } = useTicketLabels();
  const openReference = useOpenReference();
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
        onClick={() => openReference(item)}
      >
        {reference}
      </button>
      {previewing && (
        <span id={previewId} role="tooltip" className="reference-preview">
          <strong>{item.reference}</strong> {item.title}
          <small>
            {categoryLabel(item.category)}
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
