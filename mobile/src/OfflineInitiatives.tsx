import type { InitiativeRole } from '@app/shared';
import { PowerSyncContext, useQuery } from '@powersync/react-native';
import { randomUUID } from 'expo-crypto';
import { useEffect, useState } from 'react';
import { FlatList, Text } from 'react-native';
import type { Api } from './api';
import { useI18n } from './i18n';
import { Connector, db } from './powersync';
import { InitiativeForm, styles } from './InitiativeForm';

interface Props {
  endpoint: string;
  getToken: () => string;
  api: Api;
}

/** Mode hors ligne : la liste vient de la réplique locale, synchronisée par PowerSync. */
export default function OfflineInitiatives({ endpoint, getToken, api }: Props) {
  const { t } = useI18n();
  const [rejection, setRejection] = useState<number | null>(null);

  useEffect(() => {
    void db.connect(new Connector(endpoint, getToken, api, setRejection));
    return () => void db.disconnect();
  }, [endpoint, getToken, api]);

  return (
    <PowerSyncContext.Provider value={db}>
      {rejection != null && <Text style={styles.error}>{t('sync.rejected', { status: rejection })}</Text>}
      <LocalInitiatives />
    </PowerSyncContext.Provider>
  );
}

function LocalInitiatives() {
  const { t } = useI18n();
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
            <Text style={styles.role}>{item.role ? t(`role.${item.role}`) : t('initiatives.pendingSync')}</Text>
          </Text>
        )}
        ListEmptyComponent={<Text>{t('initiatives.empty')}</Text>}
      />
    </>
  );
}
