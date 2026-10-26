import { createInitiativeSchema, type InitiativeRole } from '@app/shared';
import { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';

export const ROLE_LABELS: Record<InitiativeRole, string> = {
  owner: 'Propriétaire',
  contributor: 'Contributeur',
  reader: 'Lecteur',
};

/** Saisie d'une nouvelle initiative, validée avec le schéma partagé (@app/shared). */
export function InitiativeForm({ onCreate }: { onCreate: (code: string, name: string) => Promise<void> }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const parsed = createInitiativeSchema.safeParse({ code, name });
    if (!parsed.success) {
      setError(
        'Le code fait 2 à 10 lettres majuscules ou chiffres et commence par une lettre ; le nom est obligatoire (120 caractères au plus).',
      );
      return;
    }
    try {
      await onCreate(parsed.data.code, parsed.data.name);
      setCode('');
      setName('');
      setError(null);
    } catch (e) {
      setError(String(e));
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
          placeholder="Code"
        />
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nom de l’initiative" />
        <Button title="Créer" onPress={() => void submit()} />
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  code: { width: 80, borderWidth: 1, borderColor: '#999', borderRadius: 4, padding: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#999', borderRadius: 4, padding: 8 },
  item: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  role: { opacity: 0.6 },
  error: { color: '#c62828', marginVertical: 8 },
});
