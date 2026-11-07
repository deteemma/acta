import { createInitiativeSchema, type InitiativeDto } from '@app/shared';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { describeError, useI18n } from './i18n';
import { type AppTheme, useStyles, useTheme } from './theme';
import { Text, useUiStyles } from './ui';
import { useUnsavedForm } from './unsaved-changes';

/** Saisie d'une nouvelle initiative, validée avec le schéma partagé (@app/shared). */
export function InitiativeForm({ onCreate }: { onCreate: (code: string, name: string) => Promise<void> }) {
  const { t } = useI18n();
  const ui = useUiStyles();
  const styles = useInitiativeStyles();
  const theme = useTheme();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  // Erreur gardée telle quelle pour suivre un changement de langue.
  const [failure, setFailure] = useState<unknown>(null);
  const submit = useUnsavedForm({ code, name }, create);

  async function create() {
    const parsed = createInitiativeSchema.safeParse({ code, name });
    if (!parsed.success) {
      setFailure({ invalid: true });
      return false;
    }
    try {
      await onCreate(parsed.data.code, parsed.data.name);
      setCode('');
      setName('');
      setFailure(null);
      // Le formulaire se vide : il repart de ses valeurs de départ.
      return { code: '', name: '' };
    } catch (e) {
      setFailure(e);
      return false;
    }
  }

  return (
    <View>
      <View style={styles.row}>
        <TextInput
          style={[ui.input, styles.code]}
          value={code}
          onChangeText={(text) => setCode(text.toUpperCase())}
          autoCapitalize="characters"
          placeholder={t('initiatives.codeShortPlaceholder')}
          placeholderTextColor={theme.colors.muted}
        />
        <TextInput
          style={[ui.input, styles.input]}
          value={name}
          onChangeText={setName}
          placeholder={t('initiatives.namePlaceholder')}
          placeholderTextColor={theme.colors.muted}
        />
        <Pressable style={styles.create} onPress={() => void submit()} accessibilityRole="button">
          <Text style={styles.createText}>{t('initiatives.create')}</Text>
        </Pressable>
      </View>
      {failure != null && (
        <Text style={ui.error}>{isInvalid(failure) ? t('initiatives.invalid') : describeError(t, failure)}</Text>
      )}
    </View>
  );
}

/** Ligne d'une initiative : code, nom, rôle (ou « en attente de synchronisation »). */
export function InitiativeRow({
  initiative,
  role,
  first,
  last,
}: {
  initiative: Pick<InitiativeDto, 'code' | 'name'>;
  role: string;
  first: boolean;
  last: boolean;
}) {
  const ui = useUiStyles();
  const styles = useInitiativeStyles();
  return (
    <View style={[styles.item, first && styles.first, last && styles.last]}>
      <Text style={[ui.code, styles.itemCode]}>{initiative.code}</Text>
      <View style={styles.itemName}>
        <Text>{initiative.name}</Text>
        <Text style={ui.muted}>{role}</Text>
      </View>
    </View>
  );
}

const isInvalid = (failure: unknown) => (failure as { invalid?: boolean }).invalid === true;

export const useInitiativeStyles = () => useStyles(makeStyles);

const makeStyles = ({ colors, space, radius, fonts }: AppTheme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', gap: space[2], marginBottom: space[4] },
    code: { width: 80 },
    input: { flex: 1 },
    create: {
      minHeight: 48,
      justifyContent: 'center',
      paddingHorizontal: space[4],
      borderRadius: radius.lg,
      backgroundColor: colors.accent,
    },
    createText: { color: colors.onAccent, fontFamily: fonts.semibold },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space[3],
      padding: space[3],
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderTopWidth: 0,
      borderColor: colors.border,
    },
    first: { borderTopWidth: 1, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
    last: { borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
    itemCode: { minWidth: 44 },
    itemName: { flex: 1 },
  });
