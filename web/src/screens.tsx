// Écran principal (ticket 17, décision 13) : « Mes actions » ou « Tickets ». Changer
// d'écran ferme les panneaux, avec l'alerte des modifications non enregistrées ;
// l'adresse du navigateur suit l'écran, et « Précédent » est un changement d'écran.
import { parseScreenPath, sameScreen, type Screen, screenPath } from '@app/shared';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePanels } from './panels';

interface Screens {
  screen: Screen;
  /** Ferme les panneaux, avec l'alerte, puis affiche l'écran. */
  goTo: (screen: Screen) => void;
  /** L'initiative n'est plus accessible (supprimée, quittée) : son écran laisse place à l'accueil. */
  initiativeGone: (initiativeId: string) => void;
}

const ScreensContext = createContext<Screens | null>(null);

/** Rang de l'entrée en cours de l'historique : il dit de combien « Précédent » a reculé. */
const currentIndex = () => (window.history.state as { screenIndex?: number } | null)?.screenIndex ?? 0;

export function ScreensProvider({ children }: { children: ReactNode }) {
  const { leaveAll } = usePanels();
  const [screen, setScreen] = useState(() => parseScreenPath(window.location.pathname));
  // Écran affiché et son rang : l'adresse peut déjà être ailleurs pendant une alerte.
  const shown = useRef({ screen, index: currentIndex() });

  const show = useCallback((next: Screen, index: number) => {
    shown.current = { screen: next, index };
    setScreen(next);
  }, []);

  const goTo = useCallback(
    (next: Screen) => {
      void leaveAll().then((left) => {
        if (!left || sameScreen(next, shown.current.screen)) return;
        const index = shown.current.index + 1;
        window.history.pushState({ screenIndex: index }, '', screenPath(next));
        show(next, index);
      });
    },
    [leaveAll, show],
  );

  const initiativeGone = useCallback(
    (initiativeId: string) => {
      const current = shown.current.screen;
      if (current.kind !== 'tickets' || current.initiativeId !== initiativeId) return;
      const home: Screen = { kind: 'myActions' };
      window.history.replaceState({ screenIndex: shown.current.index }, '', screenPath(home));
      show(home, shown.current.index);
    },
    [show],
  );

  // Adresse inconnue : l'accueil s'affiche, l'adresse suit. Le rang survit au rechargement.
  useEffect(() => {
    window.history.replaceState({ screenIndex: shown.current.index }, '', screenPath(shown.current.screen));
  }, []);

  useEffect(() => {
    async function onPopState() {
      // Retour sur l'entrée affichée : c'est l'annulation d'un « Précédent » refusé.
      if (currentIndex() === shown.current.index) return;
      if (await leaveAll()) {
        show(parseScreenPath(window.location.pathname), currentIndex());
        return;
      }
      // Saisie conservée : l'adresse revient sur l'écran qui reste affiché. go(0) rechargerait la page.
      const delta = shown.current.index - currentIndex();
      if (delta !== 0) window.history.go(delta);
    }
    const listener = () => void onPopState();
    window.addEventListener('popstate', listener);
    return () => window.removeEventListener('popstate', listener);
  }, [leaveAll, show]);

  const value = useMemo(() => ({ screen, goTo, initiativeGone }), [screen, goTo, initiativeGone]);
  return <ScreensContext.Provider value={value}>{children}</ScreensContext.Provider>;
}

export function useScreens(): Screens {
  const screens = useContext(ScreensContext);
  if (!screens) throw new Error('useScreens() hors de ScreensProvider');
  return screens;
}
