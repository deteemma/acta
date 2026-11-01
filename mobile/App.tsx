import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
  useFonts,
} from '@expo-google-fonts/ibm-plex-sans';
import type { BabokDto, InitiativeDto, PublicConfigDto } from '@app/shared';
import { StatusBar } from 'expo-status-bar';
import { LogOut, Plus } from 'lucide-react-native';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, View } from 'react-native';
import { ActionSheet } from './src/ActionSheet';
import { ApiError, createApi } from './src/api';
import { useLogin } from './src/auth';
import { fetchPublicConfig, OFFLINE_MODE } from './src/config';
import { describeError, I18nProvider, LanguageSelector, useI18n } from './src/i18n';
import { MyActions } from './src/MyActions';
import { OnlineInitiatives } from './src/OnlineInitiatives';
import { QuickActionSheet } from './src/QuickActionSheet';
import { getAccessToken } from './src/session';
import { type AppTheme, useStyles, useTheme } from './src/theme';
import { SheetModal, Text, useUiStyles } from './src/ui';

// Chargé seulement en mode hors ligne : PowerSync repose sur un module natif
// absent d'Expo Go.
const OfflineInitiatives = lazy(() => import('./src/OfflineInitiatives'));

export default function App() {
  // Polices d'ACTA (refonte du design, ticket 06) ; en cas d'échec, celles du téléphone.
  const [fontsLoaded, fontsError] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
    IBMPlexMono_400Regular,
  });
  if (!fontsLoaded && !fontsError) return null;
  return (
    <I18nProvider>
      <Root />
    </I18nProvider>
  );
}

function Root() {
  const { t } = useI18n();
  const styles = useStyles(makeStyles);
  const ui = useUiStyles();
  const [config, setConfig] = useState<PublicConfigDto | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    fetchPublicConfig().then(setConfig, setError);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      {error != null && (
        <Text style={ui.error}>
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
  const styles = useStyles(makeStyles);
  const ui = useUiStyles();
  const theme = useTheme();
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
    // Accueil : logotype, accroche, connexion, langue (comme sur le web, ticket 05).
    return (
      <View style={styles.signedOut}>
        <Logotype large />
        <Text style={styles.tagline}>{t('app.tagline')}</Text>
        <Pressable
          style={[ui.primary, !auth.ready && ui.primaryDisabled]}
          disabled={!auth.ready}
          onPress={() => void auth.login()}
          accessibilityRole="button"
        >
          <Text style={ui.primaryText}>{t('auth.login')}</Text>
        </Pressable>
        <LanguageSelector />
        {auth.error && <Text style={ui.error}>{auth.error}</Text>}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* En-tête validé le 01.11.2026 : logotype, langue et déconnexion en icônes, onglets en deux segments. */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Logotype />
          <LanguageSelector />
          <Pressable
            onPress={auth.logout}
            accessibilityRole="button"
            accessibilityLabel={t('auth.logout')}
            style={ui.iconButton}
          >
            <LogOut color={theme.colors.text} size={22} strokeWidth={1.75} />
          </Pressable>
        </View>
        <View style={styles.segments} accessibilityRole="tablist">
          {(['actions', 'initiatives'] as const).map((value) => (
            <Pressable
              key={value}
              onPress={() => setTab(value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === value }}
              style={[styles.segment, tab === value && styles.segmentSelected]}
            >
              <Text style={tab === value ? styles.segmentTextSelected : styles.segmentText}>
                {t(value === 'actions' ? 'actions.title' : 'initiatives.title')}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      {loadError != null && <Text style={[ui.error, styles.padded]}>{describeError(t, loadError)}</Text>}
      <View style={styles.body}>
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
      </View>
      <Pressable
        style={styles.fab}
        onPress={() => setSheet({ kind: 'create' })}
        accessibilityRole="button"
        accessibilityLabel={t('actions.new')}
      >
        <Plus color={theme.colors.onAccent} size={22} strokeWidth={2} />
        <Text style={styles.fabText}>{t('actions.fab')}</Text>
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

/** « ACTA » espacé, précédé d'une barre d'accent, comme sur le web. */
function Logotype({ large = false }: { large?: boolean }) {
  const { t } = useI18n();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.logotype} accessibilityRole="header">
      <View style={[styles.logotypeBar, large && styles.logotypeBarLarge]} />
      <Text style={[styles.logotypeText, large && styles.logotypeTextLarge]}>{t('app.title')}</Text>
    </View>
  );
}

const makeStyles = ({ colors, space, radius, text, fonts, shadows }: AppTheme) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  padded: { paddingHorizontal: space[4] },
  body: { flex: 1, paddingHorizontal: space[4], paddingTop: space[4] },
  header: {
    gap: space[3],
    paddingHorizontal: space[4],
    paddingTop: space[3],
    paddingBottom: space[3],
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  logotype: { flexDirection: 'row', alignItems: 'center', gap: space[2], marginRight: 'auto' },
  logotypeBar: { width: 6, height: 18, borderRadius: 2, backgroundColor: colors.accent },
  logotypeBarLarge: { width: 10, height: 30 },
  logotypeText: { fontFamily: fonts.bold, fontSize: text.sectionTitle, letterSpacing: 3, color: colors.accentStrong },
  logotypeTextLarge: { fontSize: text.pageTitle, letterSpacing: 5 },
  segments: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  segment: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  segmentSelected: { backgroundColor: colors.surface, boxShadow: shadows.shadowPopover },
  segmentText: { color: colors.muted, fontSize: text.body },
  segmentTextSelected: { fontFamily: fonts.semibold, fontSize: text.body },
  signedOut: { flex: 1, justifyContent: 'center', gap: space[4], padding: space[6] },
  tagline: { color: colors.muted, fontSize: text.sectionTitle },
  fab: {
    position: 'absolute',
    right: space[4],
    bottom: space[6],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    minHeight: 56,
    paddingHorizontal: space[6],
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    boxShadow: shadows.shadowFab,
  },
  fabText: { color: colors.onAccent, fontFamily: fonts.semibold, fontSize: text.sectionTitle },
  });
