// Écran principal (tickets 17 et 22, décision 13) : « Mes actions », « Tickets » ou
// « Pages ». Changer d'écran, ou de page ouverte, ferme les panneaux et quitte la
// page en écriture, avec l'alerte des modifications non enregistrées ; l'adresse
// du navigateur suit l'écran, et « Précédent » est un changement d'écran.
import { parseScreenPath, sameScreen, type Screen, screenInitiativeId, screenPath } from '@app/shared';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { type PanelContent, usePanels } from './panels';

interface Screens {
  screen: Screen;
  /**
   * Ferme les panneaux et quitte la saisie de l'écran, avec l'alerte, puis affiche
   * l'écran et, s'il est fourni, ce panneau ; vrai si la sortie a eu lieu.
   */
  goTo: (screen: Screen, panel?: PanelContent) => Promise<boolean>;
  /** Remplace l'écran sans alerte ni étape pour « Précédent » : la page qui vient d'être créée. */
  replaceScreen: (screen: Screen) => void;
  /** Affiche les tickets de l'initiative et sa fiche : l'écran et la fiche montrent la même (décision 13). */
  showInitiative: (initiativeId: string) => void;
  /** L'initiative n'est plus accessible (supprimée, quittée) : son écran laisse place à l'accueil. */
  initiativeGone: (initiativeId: string) => void;
}

const ScreensContext = createContext<Screens | null>(null);

/** Rang de l'entrée en cours de l'historique : il dit de combien « Précédent » a reculé. */
const currentIndex = () => (window.history.state as { screenIndex?: number } | null)?.screenIndex ?? 0;

export function ScreensProvider({ children }: { children: ReactNode }) {
  const { leaveScreen, open } = usePanels();
  const [screen, setScreen] = useState(() => parseScreenPath(window.location.pathname));
  // Écran affiché et son rang : l'adresse peut déjà être ailleurs pendant une alerte.
  const shown = useRef({ screen, index: currentIndex() });

  const show = useCallback((next: Screen, index: number) => {
    shown.current = { screen: next, index };
    setScreen(next);
  }, []);

  const goTo = useCallback(
    async (next: Screen, panel?: PanelContent) => {
      if (!(await leaveScreen())) return false;
      if (!sameScreen(next, shown.current.screen)) {
        const index = shown.current.index + 1;
        window.history.pushState({ screenIndex: index }, '', screenPath(next));
        show(next, index);
      }
      if (panel) open(panel);
      return true;
    },
    [leaveScreen, open, show],
  );

  const replaceScreen = useCallback(
    (next: Screen) => {
      window.history.replaceState({ screenIndex: shown.current.index }, '', screenPath(next));
      show(next, shown.current.index);
    },
    [show],
  );

  const showInitiative = useCallback(
    (initiativeId: string) => void goTo({ kind: 'tickets', initiativeId }, { kind: 'initiative', initiativeId }),
    [goTo],
  );

  const initiativeGone = useCallback(
    (initiativeId: string) => {
      if (screenInitiativeId(shown.current.screen) === initiativeId) replaceScreen({ kind: 'myActions' });
    },
    [replaceScreen],
  );

  // Adresse inconnue : l'accueil s'affiche, l'adresse suit. Le rang survit au rechargement.
  useEffect(() => {
    window.history.replaceState({ screenIndex: shown.current.index }, '', screenPath(shown.current.screen));
  }, []);

  useEffect(() => {
    async function onPopState() {
      // Retour sur l'entrée affichée : c'est l'annulation d'un « Précédent » refusé.
      if (currentIndex() === shown.current.index) return;
      if (await leaveScreen()) {
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
  }, [leaveScreen, show]);

  const value = useMemo(
    () => ({ screen, goTo, replaceScreen, showInitiative, initiativeGone }),
    [screen, goTo, replaceScreen, showInitiative, initiativeGone],
  );
  return <ScreensContext.Provider value={value}>{children}</ScreensContext.Provider>;
}

export function useScreens(): Screens {
  const screens = useContext(ScreensContext);
  if (!screens) throw new Error('useScreens() hors de ScreensProvider');
  return screens;
}
