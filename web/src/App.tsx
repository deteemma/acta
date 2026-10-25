import { createProjectSchema, type ProjectDto, type ProjectRole } from '@app/shared';
import type { User } from 'oidc-client-ts';
import { type FormEvent, useEffect, useState } from 'react';
import { api } from './api';
import { login, logout } from './auth';

const ROLE_LABELS: Record<ProjectRole, string> = {
  owner: 'Propriétaire',
  contributor: 'Contributeur',
  reader: 'Lecteur',
};

export function App({ user }: { user: User | null }) {
  if (!user) {
    return (
      <main>
        <h1>Modèle d'application</h1>
        <button onClick={() => void login()}>Se connecter</button>
      </main>
    );
  }
  return (
    <main>
      <header>
        <h1>Mes projets</h1>
        <span>
          {user.profile.name ?? user.profile.preferred_username}{' '}
          <button onClick={() => void logout()}>Se déconnecter</button>
        </span>
      </header>
      <Projects />
    </main>
  );
}

function Projects() {
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listProjects().then(setProjects, (e: unknown) => setError(String(e)));
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    // Même schéma de validation que l'API (@app/shared).
    const parsed = createProjectSchema.safeParse({ name });
    if (!parsed.success) {
      setError('Le nom est obligatoire (120 caractères au plus).');
      return;
    }
    try {
      const project = await api.createProject(parsed.data);
      setProjects((list) => [project, ...list]);
      setName('');
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <>
      <form onSubmit={(e) => void create(e)}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du projet" />
        <button type="submit">Créer</button>
      </form>
      {error && <p className="error">{error}</p>}
      <ul>
        {projects.map((p) => (
          <li key={p.id}>
            {p.name} <small>{ROLE_LABELS[p.myRole]}</small>
          </li>
        ))}
      </ul>
      {projects.length === 0 && <p>Aucun projet pour l'instant.</p>}
    </>
  );
}
