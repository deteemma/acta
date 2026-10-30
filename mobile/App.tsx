import type { PublicConfigDto } from '@app/shared';
import { StatusBar } from 'expo-status-bar';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Button, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { ApiError, createApi } from './src/api';
import { useLogin } from './src/auth';
import { fetchPublicConfig, OFFLINE_MODE } from './src/config';
import { I18nProvider, LanguageSelector, useI18n } from './src/i18n';
import { OnlineInitiatives } from './src/OnlineInitiatives';
import { getAccessToken } from './src/session';

// Chargé seulement en mode hors ligne : PowerSync repose sur un module natif
// absent d'Expo Go.
const OfflineInitiatives = lazy(() => import('./src/OfflineInitiatives'));

export default function App() {
  return (
    <I18nProvider>
      <Root />
    </I18nProvider>
  );
}

function Root() {
  const { t } = useI18n();
  const [config, setConfig] = useState<PublicConfigDto | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    fetchPublicConfig().then(setConfig, setError);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      {error != null && (
        <Text style={styles.error}>
          {error instanceof ApiError ? t('app.configUnavailable', { status: error.status }) : String(error)}
        </Text>
      )}
      {!config && error == null && <ActivityIndicator />}
      {config && <Main config={config} />}
    </SafeAreaView>
  );
}

function Main({ config }: { config: PublicConfigDto }) {
  const { t, linkAccount, unlinkAccount } = useI18n();
  const auth = useLogin(config.oidcIssuerUrl, config.mobileClientId);
  const api = useMemo(() => createApi(getAccessToken), []);
  const signedIn = !!auth.session;

  useEffect(() => {
    if (signedIn) linkAccount(api);
    else unlinkAccount();
  }, [signedIn, api, linkAccount, unlinkAccount]);

  if (!auth.session) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>{t('app.title')}</Text>
        <LanguageSelector />
        <Button title={t('auth.login')} disabled={!auth.ready} onPress={() => void auth.login()} />
        {auth.error && <Text style={styles.error}>{auth.error}</Text>}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('initiatives.title')}</Text>
        <LanguageSelector />
        <Button title={t('auth.logout')} onPress={auth.logout} />
      </View>
      {OFFLINE_MODE && config.powersyncUrl ? (
        <Suspense fallback={<ActivityIndicator />}>
          <OfflineInitiatives endpoint={config.powersyncUrl} getToken={getAccessToken} api={api} />
        </Suspense>
      ) : (
        <OnlineInitiatives api={api} />
      )}
    </View>
  );
}

export const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title: { fontSize: 22, fontWeight: '600' },
  error: { color: '#c62828', marginVertical: 8 },
});
