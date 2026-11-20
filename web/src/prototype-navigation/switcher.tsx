// PROTOTYPE jetable : barre flottante pour passer d'une variante à l'autre (← →).
import { useEffect } from 'react';

export function PrototypeSwitcher({
  variants,
  current,
  onChange,
}: {
  variants: readonly { key: string; name: string }[];
  current: string;
  onChange: (key: string) => void;
}) {
  const index = Math.max(0, variants.findIndex((v) => v.key === current));
  const step = (delta: number) => onChange(variants[(index + delta + variants.length) % variants.length]!.key);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.matches('input, textarea, select') || el.isContentEditable)) return;
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Pas de garde « production » : la route n'existe que sur la branche jetable
  // prototype/navigation-arborescence, et la responsable valide sur acta.localhost (build de production).
  const v = variants[index]!;
  return (
    <div className="proto-switcher" role="toolbar" aria-label="Variantes du prototype">
      <button type="button" aria-label="Variante précédente" onClick={() => step(-1)}>
        ←
      </button>
      <span>
        PROTOTYPE · {v.key} ({v.name})
      </span>
      <button type="button" aria-label="Variante suivante" onClick={() => step(1)}>
        →
      </button>
    </div>
  );
}
