import type { BabokDto, InitiativeDto, PublicConfigDto } from '@app/shared';
import { StatusBar } from 'expo-status-bar';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Button, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { ActionSheet } from './src/ActionSheet';
import { ApiError, createApi } from './src/api';
import { useLogin } from './src/auth';
import { fetchPublicConfig, OFFLINE_MODE } from './src/config';
import { describeError, I18nProvider, LanguageSelector, useI18n } from './src/i18n';
import { MyActions } from './src/MyActions';
import { OnlineInitiatives } from './src/OnlineInitiatives';
import { QuickActionSheet } from './src/QuickActionSheet';
import { getAccessToken } from './src/session';
import { Chip, SheetModal } from './src/ui';

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

type Tab = 'actions' | 'initiatives';
/** Écran plein écran ouvert : création rapide, ou fiche d'une action. */
type OpenSheet = { kind: 'create' } | { kind: 'action'; initiativeId: string; actionId: string };

function Main({ config }: { config: PublicConfigDto }) {
  const { t, linkAccount, unlinkAccount } = useI18n();
  const auth = useLogin(config.oidcIssuerUrl, config.mobileClientId);
  const api = useMemo(() => createApi(getAccessToken), []);
  const signedIn = !!auth.session;
  // « Mes actions » est l'écran d'accueil (ticket 17).
  const [tab, setTab] = useState<Tab>('actions');
  const [babok, setBabok] = useState<BabokDto | null>(null);
  const [initiatives, setInitiatives] = useState<InitiativeDto[]>([]);
  // Change à chaque action créée : « Mes actions » se recharge.
  const [actionsVersion, setActionsVersion] = useState(0);
  const [sheet, setSheet] = useState<OpenSheet | null>(null);
  // Échec du chargement du référentiel BABOK ou des initiatives.
  const [loadError, setLoadError] = useState<unknown>(null);
  const closeSheet = () => setSheet(null);

  useEffect(() => {
    if (signedIn) linkAccount(api);
    else unlinkAccount();
  }, [signedIn, api, linkAccount, unlinkAccount]);

  useEffect(() => {
    if (signedIn) api.babok().then(setBabok, setLoadError);
  }, [signedIn, api]);

  // Rechargées au retour sur l'onglet : une initiative a pu y être créée.
  useEffect(() => {
    if (signedIn) api.listInitiatives().then(setInitiatives, setLoadError);
  }, [signedIn, api, tab]);

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
        <Text style={styles.title}>{t(tab === 'actions' ? 'actions.title' : 'initiatives.title')}</Text>
        <LanguageSelector />
        <Button title={t('auth.logout')} onPress={auth.logout} />
      </View>
      {loadError != null && <Text style={styles.error}>{describeError(t, loadError)}</Text>}
      <View style={styles.tabs}>
        <Chip label={t('actions.title')} selected={tab === 'actions'} onPress={() => setTab('actions')} />
        <Chip label={t('initiatives.title')} selected={tab === 'initiatives'} onPress={() => setTab('initiatives')} />
      </View>
      {/* « Mes actions » : mode connecté seulement, même si la synchronisation hors ligne est activée. */}
      {tab === 'actions' ? (
        <MyActions
          api={api}
          initiatives={initiatives}
          babok={babok}
          version={actionsVersion}
          onOpen={(a) => setSheet({ kind: 'action', initiativeId: a.initiative.id, actionId: a.id })}
        />
      ) : OFFLINE_MODE && config.powersyncUrl ? (
        <Suspense fallback={<ActivityIndicator />}>
          <OfflineInitiatives endpoint={config.powersyncUrl} getToken={getAccessToken} api={api} />
        </Suspense>
      ) : (
        <OnlineInitiatives api={api} />
      )}
      <Pressable style={styles.fab} onPress={() => setSheet({ kind: 'create' })} accessibilityRole="button" accessibilityLabel={t('actions.new')}>
        <Text style={styles.fabText}>+ {t('actions.fab')}</Text>
      </Pressable>
      <SheetModal visible={sheet != null} onClose={closeSheet}>
        {sheet?.kind === 'create' && (
          <QuickActionSheet
            api={api}
            babok={babok}
            initiatives={initiatives}
            onCreated={(action) => {
              setActionsVersion((v) => v + 1);
              setSheet({ kind: 'action', initiativeId: action.initiative.id, actionId: action.id });
            }}
            onClose={closeSheet}
          />
        )}
        {sheet?.kind === 'action' && (
          <ActionSheet
            api={api}
            babok={babok}
            initiativeId={sheet.initiativeId}
            actionId={sheet.actionId}
            onClose={closeSheet}
          />
        )}
      </SheetModal>
    </View>
  );
}

export const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title: { fontSize: 22, fontWeight: '600' },
  tabs: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#1565c0',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    elevation: 4,
  },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: '#c62828', marginVertical: 8 },
});
