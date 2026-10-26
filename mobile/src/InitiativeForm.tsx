import { createInitiativeSchema } from '@app/shared';
import { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { describeError, useI18n } from './i18n';

/** Saisie d'une nouvelle initiative, validée avec le schéma partagé (@app/shared). */
export function InitiativeForm({ onCreate }: { onCreate: (code: string, name: string) => Promise<void> }) {
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  // Erreur gardée telle quelle pour suivre un changement de langue.
  const [failure, setFailure] = useState<unknown>(null);

  async function submit() {
    const parsed = createInitiativeSchema.safeParse({ code, name });
    if (!parsed.success) {
      setFailure({ invalid: true });
      return;
    }
    try {
      await onCreate(parsed.data.code, parsed.data.name);
      setCode('');
      setName('');
      setFailure(null);
    } catch (e) {
      setFailure(e);
    }
  }

  return (
    <View>
      <View style={styles.row}>
        <TextInput
          style={styles.code}
          value={code}
          onChangeText={(text) => setCode(text.toUpperCase())}
          autoCapitalize="characters"
          placeholder={t('initiatives.codeShortPlaceholder')}
        />
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder={t('initiatives.namePlaceholder')} />
        <Button title={t('initiatives.create')} onPress={() => void submit()} />
      </View>
      {failure != null && (
        <Text style={styles.error}>
          {isInvalid(failure) ? t('initiatives.invalid') : describeError(t, failure)}
        </Text>
      )}
    </View>
  );
}

const isInvalid = (failure: unknown) => (failure as { invalid?: boolean }).invalid === true;

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  code: { width: 80, borderWidth: 1, borderColor: '#999', borderRadius: 4, padding: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#999', borderRadius: 4, padding: 8 },
  item: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  role: { opacity: 0.6 },
  error: { color: '#c62828', marginVertical: 8 },
});
