// Logotype de l'application : pointer dessus affiche le film du logo, qui démarre
// et tourne en boucle ; ne plus pointer dessus l'arrête et le cache. Le film est
// muet (le navigateur ne lance pas seul une vidéo sonore) et repart du début à
// chaque survol. Il s'affiche en position fixe, sous le logo, pour ne pas être
// coupé par la barre latérale qui défile.
import { type CSSProperties, type ElementType, type MouseEvent, useRef, useState } from 'react';
import film from './assets/film-v2-sarcelle.mp4';
import { useI18n } from './i18n';

export function Logotype({ as: Tag = 'span' }: { as?: ElementType }) {
  const { t } = useI18n();
  const video = useRef<HTMLVideoElement>(null);
  const [position, setPosition] = useState<CSSProperties | null>(null);

  function show(event: MouseEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setPosition({ top: rect.bottom + 8, left: rect.left });
    const v = video.current;
    if (!v) return;
    v.currentTime = 0;
    // Lecture refusée par le navigateur : le film reste simplement affiché à l'arrêt.
    v.play().catch(() => undefined);
  }

  function hide() {
    setPosition(null);
    video.current?.pause();
  }

  return (
    <>
      <Tag className="logotype" onMouseEnter={show} onMouseLeave={hide}>
        {t('app.title')}
      </Tag>
      <video
        ref={video}
        className="logo-film"
        src={film}
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
        hidden={position === null}
        style={position ?? undefined}
      />
    </>
  );
}
