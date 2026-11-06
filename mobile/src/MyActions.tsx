// Écran d'accueil « Mes actions » (ticket 17) : mêmes filtres que sur le web,
// filtrage et tri par @app/shared (selectMyActions). Mode connecté seulement.
// Présentation : refonte du design, ticket 06.
import {
  ACTION_STATUSES,
  type ActionDto,
  type ActionStatus,
  actionStatusTone,
  type BabokDto,
  DEFAULT_MY_ACTIONS_STATUSES,
  findBabokElement,
  type InitiativeDto,
  selectMyActions,
  toggleActionStatus,
} from '@app/shared';
import { ListChecks } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { Api } from './api';
import { describeError, useI18n } from './i18n';
import { type AppTheme, useStyles } from './theme';
import { babokLabel, Chip, EmptyState, formatDate, StatusBadge, Text, useUiStyles } from './ui';

export function MyActions({
  api,
  initiatives,
  babok,
  version,
  onOpen,
}: {
  api: Api;
  initiatives: InitiativeDto[];
  babok: BabokDto | null;
  /** Change à chaque création d'une action : la liste se recharge. */
  version: number;
  onOpen: (action: ActionDto) => void;
}) {
  const { t, locale } = useI18n();
  const ui = useUiStyles();
  const styles = useStyles(makeStyles);
  const [actions, setActions] = useState<ActionDto[]>([]);
  const [statuses, setStatuses] = useState<readonly ActionStatus[]>(DEFAULT_MY_ACTIONS_STATUSES);
  const [initiativeId, setInitiativeId] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    api.listMyActions().then(setActions, setError);
  }, [api, version]);

  const shown = selectMyActions(actions, { statuses, initiativeId });

  return (
    <FlatList
      data={shown}
      keyExtractor={(a) => a.id}
      ListHeaderComponent={
        <View style={styles.filters}>
          <Text style={ui.label}>{t('actions.filterStatuses')}</Text>
          <View style={ui.chips}>
            {ACTION_STATUSES.map((s) => (
              <Chip
                key={s}
                label={t(`actionStatus.${s}`)}
                selected={statuses.includes(s)}
                onPress={() => setStatuses((current) => toggleActionStatus(current, s))}
              />
            ))}
          </View>
          <Text style={ui.label}>{t('actions.filterInitiative')}</Text>
          <ScrollView horizontal contentContainerStyle={styles.row} showsHorizontalScrollIndicator={false}>
            <Chip label={t('actions.allInitiatives')} selected={!initiativeId} onPress={() => setInitiativeId(null)} />
            {initiatives.map((i) => (
              <Chip
                key={i.id}
                label={`${i.code} · ${i.name}${i.archivedAt ? ` (${t('initiative.archived')})` : ''}`}
                selected={initiativeId === i.id}
                onPress={() => setInitiativeId(i.id)}
              />
            ))}
          </ScrollView>
          {error != null && <Text style={ui.error}>{describeError(t, error)}</Text>}
        </View>
      }
      renderItem={({ item, index }) => {
        const task = babok && findBabokElement(babok, item.taskId);
        return (
          <Pressable
            style={[styles.item, index === 0 && styles.first, index === shown.length - 1 && styles.last]}
            onPress={() => onOpen(item)}
            accessibilityRole="button"
          >
            <Text style={styles.itemTitle}>
              <Text style={ui.code}>{item.reference}</Text> {item.title}
            </Text>
            <View style={styles.meta}>
              <Text style={ui.code}>{item.initiative.code}</Text>
              <Text style={ui.code}>{item.dueDate ? formatDate(locale, item.dueDate) : t('action.noDueDate')}</Text>
              <StatusBadge tone={actionStatusTone(item.status)} label={t(`actionStatus.${item.status}`)} />
              {item.initiative.archived && <Text style={ui.muted}>{t('initiative.archived')}</Text>}
            </View>
            {task && <Text style={ui.muted}>{babokLabel(task, locale)}</Text>}
          </Pressable>
        );
      }}
      ListEmptyComponent={<EmptyState icon={ListChecks} title={t('actions.empty')} hint={t('empty.actionsHint')} />}
      ListFooterComponent={
        !initiativeId && actions.some((a) => a.initiative.archived) ? (
          <Text style={[ui.muted, styles.footer]}>{t('actions.archivedHidden')}</Text>
        ) : undefined
      }
      // Laisse le bouton « + Action » au-dessus de la dernière ligne.
      contentContainerStyle={styles.list}
    />
  );
}

const makeStyles = ({ colors, space, radius, text, fonts }: AppTheme) =>
  StyleSheet.create({
    filters: { gap: space[2], marginBottom: space[3] },
    row: { flexDirection: 'row', gap: space[2] },
    // Lignes dans une carte : bordure commune, coins arrondis aux extrémités.
    item: {
      gap: space[1],
      paddingVertical: space[3],
      paddingHorizontal: space[3],
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderTopWidth: 0,
      borderColor: colors.border,
    },
    first: { borderTopWidth: 1, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
    last: { borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
    itemTitle: { fontFamily: fonts.medium, fontSize: text.sectionTitle },
    meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[2] },
    footer: { marginTop: space[3] },
    list: { paddingBottom: 96 },
  });
