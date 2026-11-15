// Images du texte d'une page (ticket 26, décision 10, points 7 à 9) : chacune est
// une pièce jointe de la page, lue avec les droits du membre (jeton), jamais par
// une adresse publique. Le contenu d'un fichier ne change jamais : une image lue
// une fois reste en mémoire jusqu'à sa suppression. Une image supprimée laisse
// « Image supprimée » à sa place, dans tout enregistrement qui l'affichait.
import {
  checkAttachmentUpload,
  isImageAttachment,
  isPageUploadRef,
  PAGE_UPLOAD_PREFIX,
  type PageDoc,
  type PageUpload,
  pageUploadKeys,
  pageUploadRef,
} from '@app/shared';
import { createContext, useContext, useEffect, useState } from 'react';
import { api, ApiError } from './api';
import type { UiError } from './errors';
import { useI18n } from './i18n';

/** Initiative de la page affichée : d'où lire ses images. */
export const PageImageSource = createContext<string | null>(null);

/** Adresse locale (blob:) d'une image, ou 'deleted' / 'unavailable'. */
export type ImageState = string | 'deleted' | 'unavailable';

const cache = new Map<string, Promise<ImageState>>();

/** Lit une image une fois, puis la garde. */
export function loadAttachmentImage(initiativeId: string, attachmentId: string): Promise<ImageState> {
  let loaded = cache.get(attachmentId);
  if (!loaded) {
    loaded = api.attachmentImage(initiativeId, attachmentId).then(
      (blob) => URL.createObjectURL(blob),
      (e: unknown) => {
        // Un essai raté (réseau) se retente à l'affichage suivant ; une suppression est définitive.
        cache.delete(attachmentId);
        return e instanceof ApiError && e.refusal === 'attachmentDeleted' ? 'deleted' : 'unavailable';
      },
    );
    cache.set(attachmentId, loaded);
  }
  return loaded;
}

/**
 * À l'ouverture d'une page : les images sont relues, pour qu'une image supprimée
 * entre-temps par un autre membre affiche « Image supprimée ».
 */
export function forgetAttachmentImages() {
  for (const id of [...cache.keys()]) forgetAttachmentImage(id);
}

/** Après la suppression du fichier : son image ne s'affiche plus. */
export function forgetAttachmentImage(attachmentId: string) {
  const loaded = cache.get(attachmentId);
  cache.delete(attachmentId);
  void loaded?.then((state) => state.startsWith('blob:') && URL.revokeObjectURL(state));
}

/**
 * Images insérées pendant une saisie (décision 10, point 7) : leurs fichiers restent
 * dans le navigateur et ne partent qu'avec l'enregistrement, seulement s'ils sont
 * encore dans le texte. Abandonner la saisie, ou fermer l'onglet, ne laisse donc
 * rien sur le serveur.
 */
export class PendingImages {
  private next = 1;
  private readonly files = new Map<string, File>();
  private readonly urls = new Map<string, string>();

  constructor(private readonly initiativeId: string) {}

  /**
   * Fichiers choisis, collés ou déposés : les images aux formats et tailles des
   * pièces jointes sont acceptées ; la limite de l'initiative est vérifiée à
   * l'enregistrement, par l'API.
   */
  add(files: readonly File[]): { refs: string[]; refused: { name: string; error: UiError }[] } {
    const refs: string[] = [];
    const refused: { name: string; error: UiError }[] = [];
    for (const file of files) {
      // Le navigateur nomme une image collée (souvent « image.png ») ; sans nom ni extension, elle est refusée.
      const name = file.name;
      const refusal =
        checkAttachmentUpload({ name, sizeBytes: file.size }, { usedBytes: 0, quotaBytes: Number.POSITIVE_INFINITY }) ??
        (isImageAttachment(name) ? null : 'notAnImage');
      if (refusal) {
        refused.push({ name, error: { key: `attachment.refusal.${refusal}` } });
        continue;
      }
      const key = String(this.next++);
      this.files.set(key, file);
      refs.push(pageUploadRef(key));
    }
    return { refs, refused };
  }

  /** Adresse affichable dans l'éditeur : le fichier local, ou l'image enregistrée. */
  readonly resolve = (ref: string): Promise<ImageState> => {
    if (!isPageUploadRef(ref)) return loadAttachmentImage(this.initiativeId, ref);
    const key = ref.slice(PAGE_UPLOAD_PREFIX.length);
    const file = this.files.get(key);
    if (!file) return Promise.resolve('unavailable');
    let url = this.urls.get(key);
    if (!url) {
      url = URL.createObjectURL(file);
      this.urls.set(key, url);
    }
    return Promise.resolve(url);
  };

  /** Fichiers à envoyer avec l'enregistrement : ceux des images encore dans le texte. */
  sendable(doc: PageDoc | null): { uploads: PageUpload[]; files: File[] } {
    const kept = pageUploadKeys(doc).flatMap((key) => {
      const file = this.files.get(key);
      return file ? [{ key, file }] : [];
    });
    return {
      uploads: kept.map(({ key, file }) => ({ key, name: file.name, sizeBytes: file.size })),
      files: kept.map(({ file }) => file),
    };
  }

  /** Fin de la saisie : les copies locales sont libérées. */
  release() {
    for (const url of this.urls.values()) URL.revokeObjectURL(url);
    this.urls.clear();
  }
}

/** Image d'un enregistrement de la page, en lecture seule. */
export function PageImage({ attachmentId }: { attachmentId: string }) {
  const { t } = useI18n();
  const initiativeId = useContext(PageImageSource);
  const [state, setState] = useState<ImageState | null>(null);

  useEffect(() => {
    if (!initiativeId) return;
    let cancelled = false;
    void loadAttachmentImage(initiativeId, attachmentId).then((s) => !cancelled && setState(s));
    return () => {
      cancelled = true;
    };
  }, [initiativeId, attachmentId]);

  if (state === 'deleted' || state === 'unavailable') {
    return (
      <p className="page-image page-image-missing">
        <small>{t(state === 'deleted' ? 'page.imageDeleted' : 'page.imageUnavailable')}</small>
      </p>
    );
  }
  return <p className="page-image">{state && <img src={state} alt={t('page.image')} />}</p>;
}
