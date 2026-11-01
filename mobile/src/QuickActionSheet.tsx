// Création rapide d'une action (ticket 17) : initiative, titre, tâche BABOK.
// Initiatives proposées, tâche présélectionnée et validation viennent de
// @app/shared, comme sur le web ; le responsable est la personne qui crée.
import {
  ACTION_TITLE_MAX_LENGTH,
  type ActionDto,
  type BabokDto,
  canCreateActionIn,
  createActionSchema,
  findBabokElement,
  type InitiativeDto,
  suggestTasks,
  tasksOfKnowledgeArea,
} from '@app/shared';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { type Api, ApiError } from './api';
import { describeError, useI18n } from './i18n';
import { type AppTheme, useStyles, useTheme } from './theme';
import { babokLabel, Chip, Sheet, Text, useUiStyles } from './ui';

export function QuickActionSheet({
  api,
  babok,
  initiatives,
  onCreated,
  onClose,
}: {
  api: Api;
  babok: BabokDto | null;
  initiatives: InitiativeDto[];
  onCreated: (action: ActionDto) => void;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const ui = useUiStyles();
  const styles = useStyles(makeStyles);
  const theme = useTheme();
  const editable = initiatives.filter(canCreateActionIn);
  // Initiative choisie ; à défaut, la première proposée (la liste peut arriver après l'ouverture).
  const [initiativeChoice, setChosenInitiative] = useState<string | null>(null);
  const chosenInitiative = initiativeChoice ?? editable[0]?.id ?? '';
  const [title, setTitle] = useState('');
  // Tâche choisie par le BA ; à défaut, la première tâche proposée est présélectionnée.
  const [chosenTask, setChosenTask] = useState<string | null>(null);
  const [loadedActions, setLoadedActions] = useState<{ initiativeId: string; hasActions: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  // Erreur gardée telle quelle pour suivre un changement de langue.
  const [failure, setFailure] = useState<unknown>(null);

  useEffect(() => {
    if (!chosenInitiative) return;
    api.listActions(chosenInitiative).then(
      (actions) => setLoadedActions({ initiativeId: chosenInitiative, hasActions: actions.length > 0 }),
      setFailure,
    );
  }, [api, chosenInitiative]);

  const hasActions = loadedActions?.initiativeId === chosenInitiative ? loadedActions.hasActions : null;
  const suggestions = hasActions == null ? [] : suggestTasks({ kind: 'initiative', hasActions });
  const taskId = chosenTask ?? suggestions[0]?.taskId ?? '';

  async function create() {
    // Même schéma de validation que l'API (@app/shared).
    const parsed = createActionSchema.safeParse({ title, taskId });
    if (!parsed.success || !chosenInitiative) {
      setFailure({ invalid: true });
      return;
    }
    setSaving(true);
    try {
      onCreated(await api.createAction(chosenInitiative, parsed.data));
    } catch (e) {
      setFailure(e instanceof ApiError && e.status === 400 && !e.refusal ? { invalid: true } : e);
      setSaving(false);
    }
  }

  return (
    <Sheet title={t('actions.new')} onClose={onClose}>
      {editable.length === 0 ? (
        <Text>{t('actions.noEditableInitiative')}</Text>
      ) : (
        <>
          <Text style={ui.label}>{t('action.initiative')}</Text>
          <View style={ui.chips}>
            {editable.map((i) => (
              <Chip
                key={i.id}
                label={`${i.code} · ${i.name}`}
                selected={chosenInitiative === i.id}
                onPress={() => setChosenInitiative(i.id)}
              />
            ))}
          </View>
          <Text style={ui.label}>{t('action.title')}</Text>
          <TextInput
            style={ui.input}
            placeholderTextColor={theme.colors.muted}
            value={title}
            onChangeText={setTitle}
            maxLength={ACTION_TITLE_MAX_LENGTH}
            autoFocus
            accessibilityLabel={t('action.title')}
          />
          {suggestions.length > 0 && (
            <>
              <Text style={ui.label}>{t('suggestion.tasks')}</Text>
              {suggestions.map((s) => {
                const suggested = babok && findBabokElement(babok, s.taskId);
                return (
                  suggested && (
                    <View key={s.taskId} style={styles.suggestion}>
                      <Chip
                        label={babokLabel(suggested, locale)}
                        selected={taskId === s.taskId}
                        onPress={() => setChosenTask(s.taskId)}
                      />
                      <Text style={ui.muted}>{t(`suggestion.task.${s.reason}`)}</Text>
                    </View>
                  )
                );
              })}
            </>
          )}
          <Text style={ui.label}>{t('action.task')}</Text>
          {!babok ? (
            <ActivityIndicator />
          ) : (
            babok.knowledgeAreas.map((area) => (
              <View key={area.id} style={styles.area}>
                <Text style={ui.muted}>
                  {area.section} {area.name[locale]}
                </Text>
                <View style={ui.chips}>
                  {tasksOfKnowledgeArea(babok, area.id).map((task) => (
                    <Chip
                      key={task.id}
                      label={babokLabel(task, locale)}
                      selected={taskId === task.id}
                      onPress={() => setChosenTask(task.id)}
                    />
                  ))}
                </View>
              </View>
            ))
          )}
          {failure != null && (
            <Text style={ui.error}>{isInvalid(failure) ? t('action.invalid') : describeError(t, failure)}</Text>
          )}
          <Pressable
            style={[ui.primary, saving && ui.primaryDisabled]}
            disabled={saving}
            onPress={() => void create()}
            accessibilityRole="button"
          >
            <Text style={ui.primaryText}>{t('action.create')}</Text>
          </Pressable>
        </>
      )}
    </Sheet>
  );
}

const isInvalid = (failure: unknown) => (failure as { invalid?: boolean }).invalid === true;

const makeStyles = ({ space }: AppTheme) =>
  StyleSheet.create({
    suggestion: { gap: space[1] },
    area: { gap: space[1] },
  });
