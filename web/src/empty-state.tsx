// États vides (refonte du design, ticket 05) : illustration au trait, texte,
// aide et, si le rôle le permet, l'action utile. Style A validé le 01.11.2026.
import { Bell, FileText, Folder, Lightbulb, ListChecks, type LucideIcon, Users } from 'lucide-react';
import type { ReactNode } from 'react';

export type EmptyStateSubject = 'actions' | 'initiatives' | 'stakeholders' | 'needs' | 'requirements' | 'alerts';

const SUBJECT_ICONS: Record<EmptyStateSubject, LucideIcon> = {
  actions: ListChecks,
  initiatives: Folder,
  stakeholders: Users,
  needs: Lightbulb,
  requirements: FileText,
  alerts: Bell,
};

/** Une feuille au trait gris, le sujet en couleur d'accent. */
function Illustration({ subject }: { subject: EmptyStateSubject }) {
  const Icon = SUBJECT_ICONS[subject];
  return (
    <svg className="empty-illustration" viewBox="0 0 120 96" aria-hidden="true">
      <rect className="line-muted" x="26" y="8" width="68" height="80" rx="6" />
      <path className="line-muted" d="M40 66h40M40 76h26" />
      <Icon x={42} y={18} width={36} height={36} strokeWidth={1.5} className="line-accent" absoluteStrokeWidth={false} />
    </svg>
  );
}

export function EmptyState({
  subject,
  title,
  hint,
  action,
  compact = false,
}: {
  subject: EmptyStateSubject;
  title: string;
  hint: string;
  /** Le bouton de l'action utile, seulement si le rôle la permet. */
  action?: ReactNode;
  /** Barre latérale : plus petit. */
  compact?: boolean;
}) {
  return (
    <div className={`empty-state${compact ? ' compact' : ''}`}>
      <Illustration subject={subject} />
      <p className="empty-title">{title}</p>
      <p className="empty-hint">{hint}</p>
      {action}
    </div>
  );
}
