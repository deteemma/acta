import type { InitiativeDto } from '@app/shared';
import { useEffect, useState } from 'react';
import { FlatList, Text } from 'react-native';
import type { Api } from './api';
import { InitiativeForm, ROLE_LABELS, styles } from './InitiativeForm';

/** Mode connecté : lectures et écritures directement via l'API. */
export function OnlineInitiatives({ api }: { api: Api }) {
  const [initiatives, setInitiatives] = useState<InitiativeDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listInitiatives().then(setInitiatives, (e: unknown) => setError(String(e)));
  }, [api]);

  async function create(code: string, name: string) {
    const initiative = await api.createInitiative({ code, name });
    setInitiatives((list) => [initiative, ...list]);
  }

  return (
    <>
      <InitiativeForm onCreate={create} />
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={initiatives}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <Text style={styles.item}>
            {item.code} {item.name} <Text style={styles.role}>{ROLE_LABELS[item.myRole]}</Text>
          </Text>
        )}
        ListEmptyComponent={<Text>Aucune initiative pour l'instant.</Text>}
      />
    </>
  );
}
