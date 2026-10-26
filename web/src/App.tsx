import { createInitiativeSchema, type InitiativeDto, type InitiativeRole } from '@app/shared';
import type { User } from 'oidc-client-ts';
import { type FormEvent, useEffect, useState } from 'react';
import { api } from './api';
import { login, logout } from './auth';

const ROLE_LABELS: Record<InitiativeRole, string> = {
  owner: 'Propriétaire',
  contributor: 'Contributeur',
  reader: 'Lecteur',
};

export function App({ user }: { user: User | null }) {
  if (!user) {
    return (
      <main>
        <h1>ACTA</h1>
        <button onClick={() => void login()}>Se connecter</button>
      </main>
    );
  }
  return (
    <main>
      <header>
        <h1>Mes initiatives</h1>
        <span>
          {user.profile.name ?? user.profile.preferred_username}{' '}
          <button onClick={() => void logout()}>Se déconnecter</button>
        </span>
      </header>
      <Initiatives />
    </main>
  );
}

function Initiatives() {
  const [initiatives, setInitiatives] = useState<InitiativeDto[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listInitiatives().then(setInitiatives, (e: unknown) => setError(String(e)));
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    // Même schéma de validation que l'API (@app/shared).
    const parsed = createInitiativeSchema.safeParse({ code, name });
    if (!parsed.success) {
      setError(
        'Le code fait 2 à 10 lettres majuscules ou chiffres et commence par une lettre ; le nom est obligatoire (120 caractères au plus).',
      );
      return;
    }
    try {
      const initiative = await api.createInitiative(parsed.data);
      setInitiatives((list) => [initiative, ...list]);
      setCode('');
      setName('');
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <>
      <form onSubmit={(e) => void create(e)}>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Code (ex. CRM)" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de l’initiative" />
        <button type="submit">Créer</button>
      </form>
      {error && <p className="error">{error}</p>}
      <ul>
        {initiatives.map((p) => (
          <li key={p.id}>
            <strong>{p.code}</strong> {p.name} <small>{ROLE_LABELS[p.myRole]}</small>
          </li>
        ))}
      </ul>
      {initiatives.length === 0 && <p>Aucune initiative pour l'instant.</p>}
    </>
  );
}
