import { createProjectSchema, type ProjectRole } from '@app/shared';
import { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';

export const ROLE_LABELS: Record<ProjectRole, string> = {
  owner: 'Propriétaire',
  contributor: 'Contributeur',
  reader: 'Lecteur',
};

/** Saisie d'un nouveau projet, validée avec le schéma partagé (@app/shared). */
export function ProjectForm({ onCreate }: { onCreate: (name: string) => Promise<void> }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const parsed = createProjectSchema.safeParse({ name });
    if (!parsed.success) {
      setError('Le nom est obligatoire (120 caractères au plus).');
      return;
    }
    try {
      await onCreate(parsed.data.name);
      setName('');
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <View>
      <View style={styles.row}>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nom du projet" />
        <Button title="Créer" onPress={() => void submit()} />
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  input: { flex: 1, borderWidth: 1, borderColor: '#999', borderRadius: 4, padding: 8 },
  item: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  role: { opacity: 0.6 },
  error: { color: '#c62828', marginVertical: 8 },
});
