// Palette de commandes (Ctrl+K / Cmd+K) : accès direct à la fiche d'une
// initiative, d'un objet référencé (ticket 09) ou d'un élément du référentiel BABOK.
import {
  type BabokDto,
  type BabokElementDto,
  type InitiativeDto,
  type ReferenceDto,
  searchBabok,
  searchInitiatives,
  searchReferences,
} from '@app/shared';
import { type KeyboardEvent, useEffect, useState } from 'react';
import { api } from './api';
import { BabokName } from './babok-panels';
import { useI18n } from './i18n';
import { Panel, type PanelContent, usePanels } from './panels';
import { referenceTarget } from './references';

type Result =
  | { kind: 'initiative'; item: InitiativeDto }
  | { kind: 'reference'; item: ReferenceDto }
  | { kind: 'babok'; item: BabokElementDto };

export const IS_MAC = /Mac|iPhone|iPad/.test(navigator.userAgent);

/** Ouvre la palette au raccourci Ctrl+K (Cmd+K sur Mac), depuis n'importe quel écran. */
export function usePaletteShortcut() {
  const { stack, open } = usePanels();
  const paletteOpen = stack.at(-1)?.content.kind === 'palette';
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      // Touche physique K, quelle que soit la disposition du clavier ; AltGr (Ctrl+Alt) exclu.
      if ((IS_MAC ? event.metaKey : event.ctrlKey) && !event.altKey && event.code === 'KeyK') {
        event.preventDefault();
        if (!paletteOpen) open({ kind: 'palette' });
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, paletteOpen]);
}

export function Palette({
  initiatives,
  babok,
  onClose,
}: {
  initiatives: InitiativeDto[];
  /** Absent tant que le référentiel n'est pas chargé. */
  babok: BabokDto | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { replace } = usePanels();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  // Rechargées à chaque ouverture ; sans réponse, la palette garde les autres résultats.
  const [references, setReferences] = useState<ReferenceDto[]>([]);
  useEffect(() => {
    api.listReferences().then(setReferences, () => undefined);
  }, []);
  // Les initiatives d'abord, puis les références, puis le référentiel.
  const results: Result[] = [
    ...searchInitiatives(initiatives, query).map((item) => ({ kind: 'initiative' as const, item })),
    ...searchReferences(references, query).map((item) => ({ kind: 'reference' as const, item })),
    ...(babok ? searchBabok(babok, query) : []).map((item) => ({ kind: 'babok' as const, item })),
  ];
  const current = Math.min(active, results.length - 1);

  const target = (result: Result): PanelContent => {
    switch (result.kind) {
      case 'initiative':
        return { kind: 'initiative', initiativeId: result.item.id };
      case 'reference':
        return referenceTarget(result.item);
      case 'babok':
        return { kind: 'babokElement', elementId: result.item.id };
    }
  };
  const optionId = (result: Result) => `palette-${result.kind}-${result.item.id}`;
  const select = (result: Result) => replace(target(result));

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current + step + results.length) % Math.max(results.length, 1));
    } else if (event.key === 'Enter' && results[current]) {
      event.preventDefault();
      select(results[current]);
    }
  }

  return (
    <Panel title={t('palette.label')} variant="palette" onClose={onClose}>
      <input
        data-autofocus
        role="combobox"
        aria-expanded="true"
        aria-controls="palette-results"
        aria-autocomplete="list"
        aria-activedescendant={results[current] ? optionId(results[current]) : undefined}
        aria-label={t('palette.placeholder')}
        placeholder={t('palette.placeholder')}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
      />
      <ul id="palette-results" role="listbox" aria-label={t('palette.label')} className="palette-results">
        {results.map((result, index) => (
          <li
            key={optionId(result)}
            id={optionId(result)}
            role="option"
            aria-selected={index === current}
            onMouseMove={() => setActive(index)}
            onClick={() => select(result)}
          >
            {result.kind === 'initiative' ? (
              <>
                <strong>{result.item.code}</strong> {result.item.name}
                {result.item.archivedAt && <small> · {t('initiative.archived')}</small>}
              </>
            ) : result.kind === 'reference' ? (
              <>
                <strong>{result.item.reference}</strong> {result.item.title}{' '}
                <small>· {t(`referenceCategory.${result.item.category}`)}</small>
                {result.item.initiativeArchived && <small> · {t('initiative.archived')}</small>}
              </>
            ) : (
              <>
                <strong>{result.item.section}</strong> <BabokName element={result.item} />{' '}
                <small>· {t(`babok.${result.item.kind}`)}</small>
              </>
            )}
          </li>
        ))}
      </ul>
      <p role="status">{results.length === 0 && t('palette.noResults')}</p>
    </Panel>
  );
}
