import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { currentUser, initAuth } from './auth';
import './styles.css';

const root = createRoot(document.getElementById('root')!);

initAuth()
  .then(currentUser)
  .then((user) => {
    root.render(
      <StrictMode>
        <App user={user} />
      </StrictMode>,
    );
  })
  .catch((error: unknown) => {
    root.render(<p className="error">Impossible de démarrer : {String(error)}</p>);
  });
