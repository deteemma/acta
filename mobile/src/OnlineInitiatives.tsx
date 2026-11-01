import type { InitiativeDto } from '@app/shared';
import { Folder } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList } from 'react-native';
import type { Api } from './api';
import { describeError, useI18n } from './i18n';
import { InitiativeForm, InitiativeRow } from './InitiativeForm';
import { EmptyState, Text, useUiStyles } from './ui';

/** Mode connecté : lectures et écritures directement via l'API. */
export function OnlineInitiatives({ api }: { api: Api }) {
  const { t } = useI18n();
  const ui = useUiStyles();
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
      {error != null && <Text style={ui.error}>{describeError(t, error)}</Text>}
      <FlatList
        data={initiatives}
        keyExtractor={(p) => p.id}
        renderItem={({ item, index }) => (
          <InitiativeRow
            initiative={item}
            role={t(`role.${item.myRole}`)}
            first={index === 0}
            last={index === initiatives.length - 1}
          />
        )}
        ListEmptyComponent={<EmptyState icon={Folder} title={t('initiatives.empty')} hint={t('empty.initiativesHint')} />}
      />
    </>
  );
}
