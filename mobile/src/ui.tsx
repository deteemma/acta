// Éléments d'interface communs aux écrans des actions.
import { type BabokElementDto, babokEnglishName, type Locale } from '@app/shared';
import type { ReactNode } from 'react';
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useI18n } from './i18n';

/**
 * Écran plein écran glissé depuis le bas ; le bouton retour d'Android le ferme.
 * Une seule fenêtre pour tous les écrans : iOS ignore celle qui s'ouvrirait
 * pendant qu'une autre se ferme (création rapide, puis fiche de l'action).
 */
export function SheetModal({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.sheet}>{children}</SafeAreaView>
    </Modal>
  );
}

/** Contenu d'un écran de SheetModal : titre, bouton Fermer, corps défilant. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <>
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle} accessibilityRole="header">
          {title}
        </Text>
        <Pressable onPress={onClose} accessibilityRole="button" hitSlop={12}>
          <Text style={styles.close}>{t('panel.close')}</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </>
  );
}

/** Choix à cocher (filtre, initiative, tâche). */
export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={selected ? styles.chipTextSelected : undefined}>{label}</Text>
    </Pressable>
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

export const styles = StyleSheet.create({
  sheet: { flex: 1 },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: { flex: 1, fontSize: 18, fontWeight: '600' },
  close: { color: '#1565c0', fontSize: 16 },
  sheetBody: { padding: 16, gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#999', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipSelected: { backgroundColor: '#1565c0', borderColor: '#1565c0' },
  chipTextSelected: { color: '#fff' },
  label: { fontWeight: '600', marginTop: 4 },
  muted: { opacity: 0.6 },
  error: { color: '#c62828', marginVertical: 8 },
});
