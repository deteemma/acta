import { translate } from '@app/shared';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { currentUser, initAuth } from './auth';
import { browserLocale } from './i18n';
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
    root.render(<p className="error">{translate(browserLocale(), 'app.startFailed', { error: String(error) })}</p>);
  });
