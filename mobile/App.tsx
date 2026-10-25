import type { PublicConfigDto } from '@app/shared';
import { StatusBar } from 'expo-status-bar';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Button, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { createApi } from './src/api';
import { useLogin } from './src/auth';
import { fetchPublicConfig, OFFLINE_MODE } from './src/config';
import { OnlineProjects } from './src/OnlineProjects';
import { getAccessToken } from './src/session';

// Chargé seulement en mode hors ligne : PowerSync repose sur un module natif
// absent d'Expo Go.
const OfflineProjects = lazy(() => import('./src/OfflineProjects'));

export default function App() {
  const [config, setConfig] = useState<PublicConfigDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPublicConfig().then(setConfig, (e: unknown) => setError(String(e)));
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      {error && <Text style={styles.error}>{error}</Text>}
      {!config && !error && <ActivityIndicator />}
      {config && <Main config={config} />}
    </SafeAreaView>
  );
}

function Main({ config }: { config: PublicConfigDto }) {
  const auth = useLogin(config.oidcIssuerUrl, config.mobileClientId);
  const api = useMemo(() => createApi(getAccessToken), []);

  if (!auth.session) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Modèle d'application</Text>
        <Button title="Se connecter" disabled={!auth.ready} onPress={() => void auth.login()} />
        {auth.error && <Text style={styles.error}>{auth.error}</Text>}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes projets</Text>
        <Button title="Se déconnecter" onPress={auth.logout} />
      </View>
      {OFFLINE_MODE && config.powersyncUrl ? (
        <Suspense fallback={<ActivityIndicator />}>
          <OfflineProjects endpoint={config.powersyncUrl} getToken={getAccessToken} api={api} />
        </Suspense>
      ) : (
        <OnlineProjects api={api} />
      )}
    </View>
  );
}

export const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '600' },
  error: { color: '#c62828', marginVertical: 8 },
});
