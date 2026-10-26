// Contenu des panneaux : fiche d'une initiative, membre, création rapide.
import { createInitiativeSchema, type InitiativeDto, type InitiativeMemberDto } from '@app/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { api } from './api';
import { ErrorMessage, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { Panel, usePanels } from './panels';

export function InitiativePanel({ initiativeId, onClose }: { initiativeId: string; onClose: () => void }) {
  const { t } = useI18n();
  const { open } = usePanels();
  const [initiative, setInitiative] = useState<InitiativeDto | null>(null);
  const [members, setMembers] = useState<InitiativeMemberDto[] | null>(null);
  const [error, setError] = useState<UiError | null>(null);

  useEffect(() => {
    Promise.all([api.getInitiative(initiativeId), api.listMembers(initiativeId)]).then(([i, m]) => {
      setInitiative(i);
      setMembers(m);
    }, (e: unknown) => setError(toUiError(e)));
  }, [initiativeId]);

  return (
    <Panel title={initiative ? `${initiative.code} · ${initiative.name}` : t('common.loading')} onClose={onClose}>
      <ErrorMessage error={error} />
      {initiative && members && (
        <>
          <dl>
            <dt>{t('initiative.code')}</dt>
            <dd>{initiative.code}</dd>
            <dt>{t('initiative.name')}</dt>
            <dd>{initiative.name}</dd>
            <dt>{t('initiative.myRole')}</dt>
            <dd>{t(`role.${initiative.myRole}`)}</dd>
          </dl>
          <h3>{t('initiative.members')}</h3>
          <ul className="links">
            {members.map((member) => (
              <li key={member.userId}>
                <button type="button" className="link" onClick={() => open({ kind: 'member', member })}>
                  {memberName(member)}
                </button>{' '}
                <small>{t(`role.${member.role}`)}</small>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

const memberName = (member: InitiativeMemberDto) => member.displayName ?? member.email ?? member.userId;

export function MemberPanel({ member, onClose }: { member: InitiativeMemberDto; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Panel title={memberName(member)} onClose={onClose}>
      <dl>
        <dt>{t('member.email')}</dt>
        <dd>{member.email ?? '—'}</dd>
        <dt>{t('member.role')}</dt>
        <dd>{t(`role.${member.role}`)}</dd>
        <dt>{t('member.teamBa')}</dt>
        <dd>{t(member.isTeamBa ? 'common.yes' : 'common.no')}</dd>
      </dl>
    </Panel>
  );
}

/** Création rapide, ouverte par le bouton flottant « + ». La fiche créée remplace le panneau. */
export function CreateInitiativePanel({
  onCreated,
  onClose,
}: {
  onCreated: (initiative: InitiativeDto) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { replace } = usePanels();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<UiError | null>(null);

  async function create(event: FormEvent) {
    event.preventDefault();
    // Même schéma de validation que l'API (@app/shared).
    const parsed = createInitiativeSchema.safeParse({ code, name });
    if (!parsed.success) {
      setError({ key: 'initiatives.invalid' });
      return;
    }
    try {
      const initiative = await api.createInitiative(parsed.data);
      onCreated(initiative);
      replace({ kind: 'initiative', initiativeId: initiative.id });
    } catch (e) {
      setError(toUiError(e));
    }
  }

  return (
    <Panel title={t('initiatives.new')} onClose={onClose}>
      <form className="stacked" onSubmit={(e) => void create(e)}>
        <label>
          {t('initiative.code')}
          <input
            data-autofocus
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={t('initiatives.codePlaceholder')}
          />
        </label>
        <label>
          {t('initiative.name')}
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('initiatives.namePlaceholder')} />
        </label>
        <button type="submit">{t('initiatives.create')}</button>
      </form>
      <ErrorMessage error={error} />
    </Panel>
  );
}
