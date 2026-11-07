// Fiche d'une action (ticket 17) : plein écran, glissée depuis le bas, en
// consultation. Libellés et règles de @app/shared, comme sur le web. En-tête
// et carte des informations : refonte du design, ticket 06.
import { type ActionDto, actionStatusTone, type BabokDto, findBabokElement, memberName } from '@app/shared';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { Api } from './api';
import { describeError, useI18n } from './i18n';
import { RichText } from './RichText';
import { type AppTheme, useStyles } from './theme';
import { babokLabel, formatDate, formatDateTime, Sheet, StatusBadge, Text, useUiStyles } from './ui';

export function ActionSheet({
  api,
  babok,
  initiativeId,
  actionId,
  onClose,
}: {
  api: Api;
  babok: BabokDto | null;
  initiativeId: string;
  actionId: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const ui = useUiStyles();
  const [action, setAction] = useState<ActionDto | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    api.getAction(initiativeId, actionId).then(setAction, setError);
  }, [api, initiativeId, actionId]);

  return (
    <Sheet
      kicker={
        action && (
          <>
            {t('action.kicker')} <Text style={ui.code}>{action.reference}</Text>
          </>
        )
      }
      title={action ? action.title : t('common.loading')}
      badges={action && <StatusBadge tone={actionStatusTone(action.status)} label={t(`actionStatus.${action.status}`)} />}
      onClose={onClose}
    >
      {error != null && <Text style={ui.error}>{describeError(t, error)}</Text>}
      {!action && error == null && <ActivityIndicator />}
      {action && <ActionDetails action={action} babok={babok} />}
    </Sheet>
  );
}

function ActionDetails({ action, babok }: { action: ActionDto; babok: BabokDto | null }) {
  const { t, locale } = useI18n();
  const ui = useUiStyles();
  const babokName = (id: string) => {
    const element = babok && findBabokElement(babok, id);
    return element ? babokLabel(element, locale) : id;
  };
  const lines = (list: string[], none: string) => (list.length === 0 ? none : list.join('\n'));
  const references = (list: { reference: string; title: string }[]) => list.map((item) => `${item.reference} ${item.title}`);

  return (
    <>
      {action.initiative.archived && <Text style={ui.muted}>{t('initiative.archived')}</Text>}
      <View style={ui.card}>
        <Field label={t('action.task')} value={babokName(action.taskId)} />
        <Field label={t('action.technique')} value={action.techniqueId ? babokName(action.techniqueId) : t('initiative.notSet')} />
        <Field
          label={t('action.assignee')}
          value={memberName(action.assignee) + (action.assignee.eligible ? '' : ` · ${t('action.assigneeNotEligible')}`)}
        />
        <Field label={t('action.dueDate')} value={action.dueDate ? formatDate(locale, action.dueDate) : t('action.noDueDate')} />
        <Field label={t('action.stakeholders')} value={lines(action.stakeholders.map((s) => s.name), t('action.noStakeholders'))} />
        <Field label={t('action.needs')} value={lines(references(action.needs), t('action.noNeeds'))} />
        <Field label={t('action.requirements')} value={lines(references(action.requirements), t('action.noRequirements'))} />
      </View>
      <Text style={ui.label}>{t('action.description')}</Text>
      {action.description ? <RichText source={action.description} /> : <Text style={ui.muted}>{t('initiative.notSet')}</Text>}
      <Text style={ui.muted}>
        {t('action.created', { date: formatDateTime(locale, action.createdAt), name: memberName(action.createdBy) })}
        {'\n'}
        {t('action.updated', { date: formatDateTime(locale, action.updatedAt), name: memberName(action.updatedBy) })}
      </Text>
    </>
  );
}

/** Une information de la carte : libellé à gauche, valeur à droite. */
function Field({ label, value }: { label: string; value: string }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

const makeStyles = ({ colors, space, text }: AppTheme) =>
  StyleSheet.create({
    field: { flexDirection: 'row', gap: space[3] },
    fieldLabel: { width: 112, color: colors.muted, fontSize: text.small },
    fieldValue: { flex: 1, fontSize: text.body },
  });
