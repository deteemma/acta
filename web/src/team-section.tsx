// Équipe d'une initiative (ADR-0015) : membres, rôles, indication « BA de
// l'équipe », invitation, départ et trace des désignations de propriétaire.
// Les contrôles proposés et les refus suivent les règles de @app/shared (team.ts).
import {
  addMemberSchema,
  can,
  checkTeamChange,
  INITIATIVE_ROLES,
  type InitiativeDto,
  type InitiativeMemberDto,
  type InitiativeRole,
  type Locale,
  type MemberNameDto,
  type OwnerDesignationDto,
  type TeamChange,
} from '@app/shared';
import { type FormEvent, useState } from 'react';
import { api } from './api';
import { ErrorMessage, teamRefusalError, toUiError, type UiError } from './errors';
import { useI18n } from './i18n';
import { usePanels } from './panels';

export const memberName = (member: MemberNameDto) => member.displayName ?? member.email ?? member.userId;

/** Date et heure d'une désignation, dans la langue de l'interface. */
const formatDateTime = (locale: Locale, date: string) =>
  new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(date));

export function TeamSection({
  initiative,
  members,
  designations,
  onChanged,
  onLeft,
}: {
  initiative: InitiativeDto;
  members: InitiativeMemberDto[];
  designations: OwnerDesignationDto[];
  /** L'équipe a changé : recharger l'initiative, ses membres et la trace. */
  onChanged: () => void;
  /** L'utilisateur a quitté l'initiative. */
  onLeft: () => void;
}) {
  const { t, locale } = useI18n();
  const { open } = usePanels();
  const [error, setError] = useState<UiError | null>(null);
  const [confirmingRemoval, setConfirmingRemoval] = useState<InitiativeMemberDto | null>(null);

  const state = { archived: initiative.archivedAt != null };
  const me = members.find((m) => m.isMe);
  const editable = me != null && can(initiative.myRole, 'changeTeam', state);
  // Contrôle proposé si l'utilisateur en a le droit ; les autres refus s'affichent à l'usage.
  const permitted = (change: TeamChange) =>
    editable && checkTeamChange(members, me.userId, change) !== 'forbidden';

  async function apply(change: TeamChange, call: () => Promise<void>, then = onChanged) {
    const refusal = me ? checkTeamChange(members, me.userId, change) : 'forbidden';
    if (refusal) {
      setError(teamRefusalError(refusal));
      return;
    }
    try {
      await call();
      setError(null);
      then();
    } catch (e) {
      setError(toUiError(e));
    }
  }

  const setRole = (member: InitiativeMemberDto, role: InitiativeRole) =>
    apply({ kind: 'setRole', userId: member.userId, role }, () =>
      api.updateMember(initiative.id, member.userId, { role }),
    );
  const setTeamBa = (member: InitiativeMemberDto, isTeamBa: boolean) =>
    apply({ kind: 'setTeamBa', userId: member.userId, isTeamBa }, () =>
      api.updateMember(initiative.id, member.userId, { isTeamBa }),
    );
  const remove = (member: InitiativeMemberDto) =>
    apply(
      { kind: 'remove', userId: member.userId },
      () => api.removeMember(initiative.id, member.userId),
      member.isMe ? onLeft : onChanged,
    ).finally(() => setConfirmingRemoval(null));

  return (
    <section className="team">
      <h3>{t('initiative.members')}</h3>
      <ErrorMessage error={error} />
      {confirmingRemoval && (
        <div role="alertdialog" aria-labelledby="removal-confirm" className="confirm">
          <p id="removal-confirm">
            {confirmingRemoval.isMe
              ? t('team.leaveConfirm', { code: initiative.code })
              : t('team.removeConfirm', { name: memberName(confirmingRemoval) })}
          </p>
          <button type="button" autoFocus onClick={() => setConfirmingRemoval(null)}>
            {t('common.cancel')}
          </button>{' '}
          <button type="button" className="danger" onClick={() => void remove(confirmingRemoval)}>
            {t('team.confirm')}
          </button>
        </div>
      )}
      <ul className="links team-members">
        {members.map((member) => {
          const name = memberName(member);
          const canSetRole = me?.role === 'owner' && permitted({ kind: 'setRole', userId: member.userId, role: 'reader' });
          const canDesignate =
            !canSetRole && member.role !== 'owner' && permitted({ kind: 'setRole', userId: member.userId, role: 'owner' });
          // Un lecteur ne porte pas l'indication ; sur soi-même, elle se retire seulement.
          const canToggleBa =
            member.role !== 'reader' &&
            permitted({ kind: 'setTeamBa', userId: member.userId, isTeamBa: !member.isTeamBa });
          const canRemove = permitted({ kind: 'remove', userId: member.userId });
          return (
            <li key={member.userId}>
              <button type="button" className="link" onClick={() => open({ kind: 'member', member })}>
                {name}
              </button>
              {member.isMe && <small> ({t('member.you')})</small>}
              <span className="team-controls">
                {canSetRole ? (
                  <select
                    aria-label={t('team.role', { name })}
                    value={member.role}
                    onChange={(e) => void setRole(member, e.target.value as InitiativeRole)}
                  >
                    <RoleOptions />
                  </select>
                ) : (
                  <small>{t(`role.${member.role}`)}</small>
                )}
                {canToggleBa ? (
                  <label className="inline">
                    <input
                      type="checkbox"
                      checked={member.isTeamBa}
                      aria-label={t('team.teamBa', { name })}
                      onChange={(e) => void setTeamBa(member, e.target.checked)}
                    />
                    {t('member.teamBa')}
                  </label>
                ) : (
                  member.isTeamBa && <small className="badge">{t('member.teamBa')}</small>
                )}
                {canDesignate && (
                  <button type="button" onClick={() => void setRole(member, 'owner')}>
                    {t(member.isMe ? 'team.designateMeOwner' : 'team.designateOwner')}
                  </button>
                )}
                {canRemove && (
                  <button type="button" className="danger" onClick={() => setConfirmingRemoval(member)}>
                    {t(member.isMe ? 'team.leave' : 'team.remove')}
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {can(initiative.myRole, 'manageMembers', state) && <InviteForm initiativeId={initiative.id} onInvited={onChanged} />}
      <h4>{t('team.ownerHistory')}</h4>
      {designations.length === 0 ? (
        <p>
          <small>{t('team.ownerHistoryEmpty')}</small>
        </p>
      ) : (
        <ul className="owner-history">
          {designations.map((d, index) => (
            <li key={index}>
              {d.designatedBy
                ? t('team.ownerDesignation', {
                    date: formatDateTime(locale, d.designatedAt),
                    user: memberName(d.user),
                    by: memberName(d.designatedBy),
                  })
                : t('team.ownerDesignationUnknown', {
                    date: formatDateTime(locale, d.designatedAt),
                    user: memberName(d.user),
                  })}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RoleOptions() {
  const { t } = useI18n();
  return INITIATIVE_ROLES.map((role) => (
    <option key={role} value={role}>
      {t(`role.${role}`)}
    </option>
  ));
}

/** Invitation par courriel d'un utilisateur connecté au moins une fois (propriétaire). */
function InviteForm({ initiativeId, onInvited }: { initiativeId: string; onInvited: () => void }) {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InitiativeRole>('contributor');
  const [isTeamBa, setIsTeamBa] = useState(false);
  const [error, setError] = useState<UiError | null>(null);

  async function invite(event: FormEvent) {
    event.preventDefault();
    // Même schéma de validation que l'API (@app/shared).
    const parsed = addMemberSchema.safeParse({ email: email.trim(), role, isTeamBa: role !== 'reader' && isTeamBa });
    if (!parsed.success) {
      setError({ key: 'team.inviteInvalid' });
      return;
    }
    try {
      await api.addMember(initiativeId, parsed.data);
      setError(null);
      setEmail('');
      setIsTeamBa(false);
      onInvited();
    } catch (e) {
      setError(toUiError(e));
    }
  }

  return (
    <form className="stacked invite" onSubmit={(e) => void invite(e)}>
      <h4>{t('team.invite')}</h4>
      <label>
        {t('team.inviteEmail')}
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <small>{t('team.inviteHint')}</small>
      <label>
        {t('member.role')}
        <select value={role} onChange={(e) => setRole(e.target.value as InitiativeRole)}>
          <RoleOptions />
        </select>
      </label>
      <label className="inline">
        <input
          type="checkbox"
          checked={role !== 'reader' && isTeamBa}
          disabled={role === 'reader'}
          onChange={(e) => setIsTeamBa(e.target.checked)}
        />
        {t('member.teamBa')}
      </label>
      <button type="submit">{t('team.inviteButton')}</button>
      <ErrorMessage error={error} />
    </form>
  );
}
