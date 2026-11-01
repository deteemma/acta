// Largeur réglable de la barre latérale et du panneau ancré (validé le
// 01.11.2026) : poignée glissée à la souris, flèches au clavier, double-clic
// pour revenir à la largeur par défaut. Retenue sur ce navigateur seulement.
import { type KeyboardEvent, type PointerEvent, useRef, useState } from 'react';

const REM = 16;
/** Pas des flèches du clavier. */
const KEY_STEP = REM;

export interface ResizableArea {
  /** Propriété CSS qui porte la largeur, en pixels. */
  property: string;
  storageKey: string;
  defaultPx: number;
  minPx: number;
  /** Largeur maximale, selon la largeur de la fenêtre. */
  maxPx: () => number;
  /** Bord que la poignée déplace : la barre latérale s'élargit vers la droite, le panneau vers la gauche. */
  grows: 'right' | 'left';
}

export const SIDEBAR: ResizableArea = {
  property: '--sidebar-width',
  storageKey: 'acta.sidebarWidth',
  defaultPx: 15 * REM,
  minPx: 12 * REM,
  maxPx: () => 24 * REM,
  grows: 'right',
};

export const DOCKED_PANEL: ResizableArea = {
  property: '--docked-panel-width',
  storageKey: 'acta.panelWidth',
  defaultPx: 32 * REM,
  minPx: 24 * REM,
  maxPx: () => Math.round(window.innerWidth * 0.6),
  grows: 'left',
};

const clamp = (area: ResizableArea, px: number) => Math.round(Math.min(Math.max(px, area.minPx), area.maxPx()));

function readStored(area: ResizableArea): number | null {
  try {
    const value = Number(localStorage.getItem(area.storageKey));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function apply(area: ResizableArea, px: number | null) {
  // Sans réglage, la feuille de styles donne la largeur par défaut.
  if (px === null) document.documentElement.style.removeProperty(area.property);
  else document.documentElement.style.setProperty(area.property, `${px}px`);
  try {
    if (px === null) localStorage.removeItem(area.storageKey);
    else localStorage.setItem(area.storageKey, String(px));
  } catch {
    // Stockage indisponible (navigation privée) : le réglage vaut pour la session.
  }
}

/** Au démarrage : reprend les largeurs retenues sur ce navigateur. */
export function restoreWidths() {
  for (const area of [SIDEBAR, DOCKED_PANEL]) {
    const stored = readStored(area);
    if (stored !== null) document.documentElement.style.setProperty(area.property, `${stored}px`);
  }
}

/** Poignée sur le bord intérieur d'une zone (séparateur réglable, au sens de l'accessibilité). */
export function ResizeHandle({ area, label, className }: { area: ResizableArea; label: string; className: string }) {
  const [width, setWidth] = useState(() => clamp(area, readStored(area) ?? area.defaultPx));
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);

  const set = (px: number | null) => {
    const next = px === null ? area.defaultPx : clamp(area, px);
    setWidth(next);
    apply(area, px === null ? null : next);
  };

  function start(event: PointerEvent<HTMLDivElement>) {
    drag.current = { startX: event.clientX, startWidth: width };
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.classList.add('resizing');
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    const dx = event.clientX - drag.current.startX;
    set(drag.current.startWidth + (area.grows === 'right' ? dx : -dx));
  }

  function end() {
    drag.current = null;
    document.body.classList.remove('resizing');
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const wider = area.grows === 'right' ? 'ArrowRight' : 'ArrowLeft';
    const narrower = area.grows === 'right' ? 'ArrowLeft' : 'ArrowRight';
    if (event.key === wider) set(width + KEY_STEP);
    else if (event.key === narrower) set(width - KEY_STEP);
    else if (event.key === 'Home') set(area.minPx);
    else if (event.key === 'End') set(area.maxPx());
    else return;
    event.preventDefault();
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={area.minPx}
      aria-valuemax={area.maxPx()}
      tabIndex={0}
      className={`resize-handle ${className}`}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={() => set(null)}
      onKeyDown={onKeyDown}
    />
  );
}
