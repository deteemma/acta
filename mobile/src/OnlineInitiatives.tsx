import type { InitiativeDto } from '@app/shared';
import { useEffect, useState } from 'react';
import { FlatList, Text } from 'react-native';
import type { Api } from './api';
import { describeError, useI18n } from './i18n';
import { InitiativeForm, styles } from './InitiativeForm';

/** Mode connecté : lectures et écritures directement via l'API. */
export function OnlineInitiatives({ api }: { api: Api }) {
  const { t } = useI18n();
  const [initiatives, setInitiatives] = useState<InitiativeDto[]>([]);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    api.listInitiatives().then(setInitiatives, setError);
  }, [api]);

  async function create(code: string, name: string) {
    const initiative = await api.createInitiative({ code, name });
    setInitiatives((list) => [initiative, ...list]);
  }

  return (
    <>
      <InitiativeForm onCreate={create} />
      {error != null && <Text style={styles.error}>{describeError(t, error)}</Text>}
      <FlatList
        data={initiatives}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <Text style={styles.item}>
            {item.code} {item.name} <Text style={styles.role}>{t(`role.${item.myRole}`)}</Text>
          </Text>
        )}
        ListEmptyComponent={<Text>{t('initiatives.empty')}</Text>}
      />
    </>
  );
}
