// Écran affiché à droite (tickets 17 et 22, décision 13 ; navigation par
// arborescence, ADR-0021) : « Mes actions », ou un élément d'une initiative et
// son onglet, ou encore les alertes, le référentiel et l'administration (N3).
// Changer d'élément, d'onglet ou d'initiative ferme les fenêtres de dialogue et
// quitte la saisie de l'écran, avec l'alerte des modifications non enregistrées
// (N13) ; l'adresse du navigateur suit l'écran, et « Précédent » est un
// changement d'écran (N12).
import { parseScreenPath, sameScreen, type Screen, screenInitiativeId, screenPath } from '@app/shared';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useDialogs } from './dialogs';

interface Screens {
  screen: Screen;
  /**
   * Ferme les fenêtres et quitte la saisie de l'écran, avec l'alerte, puis
   * affiche l'écran ; vrai si la sortie a eu lieu.
   */
  goTo: (screen: Screen) => Promise<boolean>;
  /** Remplace l'écran sans alerte ni étape pour « Précédent » : l'élément affiché vient d'être supprimé. */
  replaceScreen: (screen: Screen) => void;
  /**
   * L'élément tout juste ajouté remplace son écran d'ajout (modèle de page) ;
   * enregistré depuis l'alerte, la sortie demandée se poursuit et l'écran ne suit pas.
   */
  replaceSavedScreen: (screen: Screen) => void;
  /** Affiche l'initiative (onglet Aperçu), avec l'alerte. */
  showInitiative: (initiativeId: string) => void;
  /** L'initiative n'est plus accessible (supprimée, quittée) : son écran laisse place à l'accueil. */
  initiativeGone: (initiativeId: string) => void;
}

const ScreensContext = createContext<Screens | null>(null);

/** Rang de l'entrée en cours de l'historique : il dit de combien « Précédent » a reculé. */
const currentIndex = () => (window.history.state as { screenIndex?: number } | null)?.screenIndex ?? 0;

export function ScreensProvider({ children }: { children: ReactNode }) {
  const { leaveScreen, isLeaving } = useDialogs();
  const [screen, setScreen] = useState(() => parseScreenPath(window.location.pathname));
  // Écran affiché et son rang : l'adresse peut déjà être ailleurs pendant une alerte.
  const shown = useRef({ screen, index: currentIndex() });

  const show = useCallback((next: Screen, index: number) => {
    shown.current = { screen: next, index };
    setScreen(next);
  }, []);

  const goTo = useCallback(
    async (next: Screen) => {
      if (!(await leaveScreen())) return false;
      if (!sameScreen(next, shown.current.screen)) {
        const index = shown.current.index + 1;
        window.history.pushState({ screenIndex: index }, '', screenPath(next));
        show(next, index);
      }
      return true;
    },
    [leaveScreen, show],
  );

  const replaceScreen = useCallback(
    (next: Screen) => {
      window.history.replaceState({ screenIndex: shown.current.index }, '', screenPath(next));
      show(next, shown.current.index);
    },
    [show],
  );

  const replaceSavedScreen = useCallback(
    (next: Screen) => {
      if (!isLeaving()) replaceScreen(next);
    },
    [isLeaving, replaceScreen],
  );

  const showInitiative = useCallback(
    (initiativeId: string) => void goTo({ kind: 'initiative', initiativeId, tab: 'overview' }),
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
    () => ({ screen, goTo, replaceScreen, replaceSavedScreen, showInitiative, initiativeGone }),
    [screen, goTo, replaceScreen, replaceSavedScreen, showInitiative, initiativeGone],
  );
  return <ScreensContext.Provider value={value}>{children}</ScreensContext.Provider>;
}

export function useScreens(): Screens {
  const screens = useContext(ScreensContext);
  if (!screens) throw new Error('useScreens() hors de ScreensProvider');
  return screens;
}
