import type { ProjectRole } from '@app/shared';
import { PowerSyncContext, useQuery } from '@powersync/react-native';
import { randomUUID } from 'expo-crypto';
import { useEffect, useState } from 'react';
import { FlatList, Text } from 'react-native';
import type { Api } from './api';
import { Connector, db } from './powersync';
import { ProjectForm, ROLE_LABELS, styles } from './ProjectForm';

interface Props {
  endpoint: string;
  getToken: () => string;
  api: Api;
}

/** Mode hors ligne : la liste vient de la réplique locale, synchronisée par PowerSync. */
export default function OfflineProjects({ endpoint, getToken, api }: Props) {
  const [rejection, setRejection] = useState<string | null>(null);

  useEffect(() => {
    void db.connect(new Connector(endpoint, getToken, api, setRejection));
    return () => void db.disconnect();
  }, [endpoint, getToken, api]);

  return (
    <PowerSyncContext.Provider value={db}>
      {rejection && <Text style={styles.error}>{rejection}</Text>}
      <LocalProjects />
    </PowerSyncContext.Provider>
  );
}

function LocalProjects() {
  // Le rôle n'est connu qu'après synchronisation de la ligne project_member.
  const { data: projects } = useQuery<{ id: string; name: string; role: ProjectRole | null }>(
    `SELECT p.id, p.name, m.role
       FROM project p LEFT JOIN project_member m ON m.project_id = p.id
      ORDER BY p.created_at DESC`,
  );

  async function create(name: string) {
    await db.execute('INSERT INTO project (id, name, created_at) VALUES (?, ?, ?)', [
      randomUUID(),
      name,
      new Date().toISOString(),
    ]);
  }

  return (
    <>
      <ProjectForm onCreate={create} />
      <FlatList
        data={projects}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <Text style={styles.item}>
            {item.name}{' '}
            <Text style={styles.role}>{item.role ? ROLE_LABELS[item.role] : 'en attente de synchronisation'}</Text>
          </Text>
        )}
        ListEmptyComponent={<Text>Aucun projet pour l'instant.</Text>}
      />
    </>
  );
}
