import type { InitiativeRole } from '@app/shared';
import { PowerSyncContext, useQuery } from '@powersync/react-native';
import { randomUUID } from 'expo-crypto';
import { useEffect, useState } from 'react';
import { FlatList, Text } from 'react-native';
import type { Api } from './api';
import { Connector, db } from './powersync';
import { InitiativeForm, ROLE_LABELS, styles } from './InitiativeForm';

interface Props {
  endpoint: string;
  getToken: () => string;
  api: Api;
}

/** Mode hors ligne : la liste vient de la réplique locale, synchronisée par PowerSync. */
export default function OfflineInitiatives({ endpoint, getToken, api }: Props) {
  const [rejection, setRejection] = useState<string | null>(null);

  useEffect(() => {
    void db.connect(new Connector(endpoint, getToken, api, setRejection));
    return () => void db.disconnect();
  }, [endpoint, getToken, api]);

  return (
    <PowerSyncContext.Provider value={db}>
      {rejection && <Text style={styles.error}>{rejection}</Text>}
      <LocalInitiatives />
    </PowerSyncContext.Provider>
  );
}

function LocalInitiatives() {
  // Le rôle n'est connu qu'après synchronisation de la ligne initiative_member.
  const { data: initiatives } = useQuery<{ id: string; code: string; name: string; role: InitiativeRole | null }>(
    `SELECT p.id, p.code, p.name, m.role
       FROM initiative p LEFT JOIN initiative_member m ON m.initiative_id = p.id
      ORDER BY p.created_at DESC`,
  );

  async function create(code: string, name: string) {
    await db.execute('INSERT INTO initiative (id, code, name, created_at) VALUES (?, ?, ?, ?)', [
      randomUUID(),
      code,
      name,
      new Date().toISOString(),
    ]);
  }

  return (
    <>
      <InitiativeForm onCreate={create} />
      <FlatList
        data={initiatives}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <Text style={styles.item}>
            {item.code} {item.name}{' '}
            <Text style={styles.role}>{item.role ? ROLE_LABELS[item.role] : 'en attente de synchronisation'}</Text>
          </Text>
        )}
        ListEmptyComponent={<Text>Aucune initiative pour l'instant.</Text>}
      />
    </>
  );
}
