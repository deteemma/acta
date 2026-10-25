import type { ProjectDto } from '@app/shared';
import { useEffect, useState } from 'react';
import { FlatList, Text } from 'react-native';
import type { Api } from './api';
import { ProjectForm, ROLE_LABELS, styles } from './ProjectForm';

/** Mode connecté : lectures et écritures directement via l'API. */
export function OnlineProjects({ api }: { api: Api }) {
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listProjects().then(setProjects, (e: unknown) => setError(String(e)));
  }, [api]);

  async function create(name: string) {
    const project = await api.createProject({ name });
    setProjects((list) => [project, ...list]);
  }

  return (
    <>
      <ProjectForm onCreate={create} />
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={projects}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <Text style={styles.item}>
            {item.name} <Text style={styles.role}>{ROLE_LABELS[item.myRole]}</Text>
          </Text>
        )}
        ListEmptyComponent={<Text>Aucun projet pour l'instant.</Text>}
      />
    </>
  );
}
