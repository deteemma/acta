// Éléments d'interface communs aux écrans des actions. Couleurs, police et
// espacements du thème (refonte du design, ticket 06).
import { type BabokElementDto, babokEnglishName, type Locale, type StatusTone } from '@app/shared';
import { type LucideIcon, X } from 'lucide-react-native';
import { type ComponentRef, type ReactNode, useEffect, useRef } from 'react';
import { Modal, Pressable, Text as RNText, SafeAreaView, ScrollView, StyleSheet, type TextProps, View } from 'react-native';
import { useI18n } from './i18n';
import { useStyles, useTheme } from './theme';

/** Texte dans la police et la couleur du thème ; à utiliser à la place de celui de React Native. */
export function Text({ style, ...props }: TextProps) {
  const ui = useUiStyles();
  return <RNText {...props} style={[ui.text, style]} />;
}

/**
 * Écran plein écran glissé depuis le bas ; le bouton retour d'Android le ferme.
 * Une seule fenêtre pour tous les écrans : iOS ignore celle qui s'ouvrirait
 * pendant qu'une autre se ferme (création rapide, puis fiche de l'action).
 */
export function SheetModal({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const ui = useUiStyles();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={ui.sheet}>{children}</SafeAreaView>
    </Modal>
  );
}

/**
 * Contenu d'un écran de SheetModal : sur-titre (nature, code), titre, badges,
 * bouton Fermer, corps défilant.
 */
export function Sheet({
  kicker,
  title,
  badges,
  scrollToEndOn,
  onClose,
  children,
}: {
  kicker?: ReactNode;
  title: string;
  badges?: ReactNode;
  /** Quand cette valeur change (erreur affichée en bas de la feuille), le corps défile jusqu'en bas. */
  scrollToEndOn?: unknown;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  const ui = useUiStyles();
  const theme = useTheme();
  const body = useRef<ComponentRef<typeof ScrollView>>(null);
  useEffect(() => {
    if (scrollToEndOn != null) body.current?.scrollToEnd();
  }, [scrollToEndOn]);
  return (
    <>
      <View style={ui.sheetHeader}>
        <View style={ui.sheetHeading}>
          {kicker && <Text style={ui.kicker}>{kicker}</Text>}
          <Text style={ui.sheetTitle} accessibilityRole="header">
            {title}
          </Text>
          {badges && <View style={ui.chips}>{badges}</View>}
        </View>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t('panel.close')} style={ui.iconButton}>
          <X color={theme.colors.text} size={24} strokeWidth={1.75} />
        </Pressable>
      </View>
      <ScrollView ref={body} contentContainerStyle={ui.sheetBody} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </>
  );
}

/** Choix à cocher (filtre, initiative, tâche). */
export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const ui = useUiStyles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[ui.chip, selected && ui.chipSelected]}
    >
      <Text style={selected ? ui.chipTextSelected : ui.chipText}>{label}</Text>
    </Pressable>
  );
}

/** Badge d'un statut, coloré selon sa famille (@app/shared). */
export function StatusBadge({ tone, label }: { tone: StatusTone; label: string }) {
  const ui = useUiStyles();
  const colors = useTheme().tone(tone);
  return (
    <View
      style={[ui.badge, { backgroundColor: colors.background }, colors.border ? { borderWidth: 1, borderColor: colors.border } : null]}
    >
      <View style={[ui.badgeDot, { backgroundColor: colors.color }]} />
      <Text style={[ui.badgeText, { color: colors.color }]}>{label}</Text>
    </View>
  );
}

/** Liste vide : l'icône du sujet, le texte actuel et l'aide (refonte du design, ticket 05). */
export function EmptyState({ icon: Icon, title, hint }: { icon: LucideIcon; title: string; hint: string }) {
  const ui = useUiStyles();
  const theme = useTheme();
  return (
    <View style={ui.empty}>
      <View style={ui.emptyIcon}>
        <Icon color={theme.colors.accent} size={32} strokeWidth={1.5} />
      </View>
      <Text style={ui.emptyTitle}>{title}</Text>
      <Text style={ui.muted}>{hint}</Text>
    </View>
  );
}

/**
 * Tâche ou technique : son numéro et son nom ; en français, le terme anglais du
 * BABOK entre parenthèses (ADR-0013 : info-bulle sur le web, absente du mobile).
 */
export function babokLabel(element: BabokElementDto, locale: Locale): string {
  const english = babokEnglishName(element, locale);
  return `${element.section} ${element.name[locale]}${english ? ` (${english})` : ''}`;
}

/** Date et heure (création, modification), dans la langue de l'interface. */
export const formatDateTime = (locale: Locale, date: string) =>
  new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(date));

/** Date AAAA-MM-JJ ou horodatage, dans la langue de l'interface. */
export function formatDate(locale: Locale, date: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: date.length === 10 ? 'UTC' : undefined }).format(
    new Date(date),
  );
}

/** Styles communs, dans le thème du téléphone. */
export function useUiStyles() {
  return useStyles(({ colors, space, radius, text, fonts }) =>
    StyleSheet.create({
    text: { color: colors.text, fontFamily: fonts.regular, fontSize: text.body },
    sheet: { flex: 1, backgroundColor: colors.bg },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space[2],
      paddingVertical: space[3],
      paddingLeft: space[4],
      paddingRight: space[2],
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sheetHeading: { flex: 1, gap: space[1] },
    kicker: { color: colors.muted, fontSize: text.small },
    sheetTitle: { fontFamily: fonts.semibold, fontSize: text.panelTitle },
    iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
    sheetBody: { padding: space[4], gap: space[3] },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
    chip: {
      minHeight: 36,
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      paddingHorizontal: space[3],
      backgroundColor: colors.surface,
    },
    chipSelected: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
    chipText: { fontSize: text.body },
    chipTextSelected: { fontSize: text.body, fontFamily: fonts.semibold, color: colors.accentStrong },
    label: {
      fontFamily: fonts.semibold,
      fontSize: text.label,
      letterSpacing: 0.9,
      textTransform: 'uppercase',
      color: colors.muted,
      marginTop: space[1],
    },
    muted: { color: colors.muted, fontSize: text.small },
    code: { fontFamily: fonts.mono, fontSize: text.code, color: colors.muted },
    error: { color: colors.danger, marginVertical: space[2] },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: space[3],
      gap: space[3],
    },
    input: {
      minHeight: 48,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      paddingHorizontal: space[3],
      backgroundColor: colors.surface,
      color: colors.text,
      fontFamily: fonts.regular,
      fontSize: text.body,
    },
    primary: {
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.lg,
      backgroundColor: colors.accent,
    },
    primaryDisabled: { opacity: 0.5 },
    primaryText: { color: colors.onAccent, fontFamily: fonts.semibold, fontSize: text.sectionTitle },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 6,
      height: 24,
      paddingHorizontal: space[2],
      borderRadius: radius.md,
    },
    badgeDot: { width: 6, height: 6, borderRadius: 3 },
    badgeText: { fontFamily: fonts.semibold, fontSize: text.badge },
    empty: {
      alignItems: 'center',
      gap: space[2],
      paddingVertical: space[8],
      paddingHorizontal: space[4],
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      borderRadius: radius.lg,
    },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accentSoft,
    },
    emptyTitle: { fontFamily: fonts.semibold, textAlign: 'center' },
    }),
  );
}
