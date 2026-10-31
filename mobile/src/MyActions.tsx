// Écran d'accueil « Mes actions » (ticket 17) : mêmes filtres que sur le web,
// filtrage et tri par @app/shared (selectMyActions). Mode connecté seulement.
import {
  ACTION_STATUSES,
  type ActionDto,
  type ActionStatus,
  type BabokDto,
  DEFAULT_MY_ACTIONS_STATUSES,
  findBabokElement,
  type InitiativeDto,
  selectMyActions,
  toggleActionStatus,
} from '@app/shared';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Api } from './api';
import { describeError, useI18n } from './i18n';
import { babokLabel, Chip, formatDate, styles as ui } from './ui';

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
      renderItem={({ item }) => {
        const task = babok && findBabokElement(babok, item.taskId);
        return (
          <Pressable style={styles.item} onPress={() => onOpen(item)} accessibilityRole="button">
            <Text style={styles.itemTitle}>
              <Text style={ui.label}>{item.initiative.code} </Text>
              {item.title}
            </Text>
            <Text style={ui.muted}>
              {t(`actionStatus.${item.status}`)} · {item.dueDate ? formatDate(locale, item.dueDate) : t('action.noDueDate')}
              {item.initiative.archived ? ` · ${t('initiative.archived')}` : ''}
              {task ? ` · ${babokLabel(task, locale)}` : ''}
            </Text>
          </Pressable>
        );
      }}
      ListEmptyComponent={<Text>{t('actions.empty')}</Text>}
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

const styles = StyleSheet.create({
  filters: { gap: 6, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8 },
  item: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 2 },
  itemTitle: { fontSize: 16 },
  footer: { marginTop: 12 },
  list: { paddingBottom: 80 },
});
