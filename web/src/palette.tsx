// Palette de commandes (Ctrl+K / Cmd+K) : accès direct à la fiche d'une initiative.
import { type InitiativeDto, searchInitiatives } from '@app/shared';
import { type KeyboardEvent, useEffect, useState } from 'react';
import { useI18n } from './i18n';
import { Panel, usePanels } from './panels';

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

export function Palette({ initiatives, onClose }: { initiatives: InitiativeDto[]; onClose: () => void }) {
  const { t } = useI18n();
  const { replace } = usePanels();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const results = searchInitiatives(initiatives, query);
  const current = Math.min(active, results.length - 1);

  const openInitiative = (initiative: InitiativeDto) => replace({ kind: 'initiative', initiativeId: initiative.id });

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current + step + results.length) % Math.max(results.length, 1));
    } else if (event.key === 'Enter' && results[current]) {
      event.preventDefault();
      openInitiative(results[current]);
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
        aria-activedescendant={results[current] ? `palette-${results[current].id}` : undefined}
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
        {results.map((initiative, index) => (
          <li
            key={initiative.id}
            id={`palette-${initiative.id}`}
            role="option"
            aria-selected={index === current}
            onMouseMove={() => setActive(index)}
            onClick={() => openInitiative(initiative)}
          >
            <strong>{initiative.code}</strong> {initiative.name}
            {initiative.archivedAt && <small> · {t('initiative.archived')}</small>}
          </li>
        ))}
      </ul>
      <p role="status">{results.length === 0 && t('palette.noResults')}</p>
    </Panel>
  );
}
