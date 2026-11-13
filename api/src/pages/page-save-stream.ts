import type { Readable } from 'node:stream';
import { BadRequestException } from '@nestjs/common';

/** En-tête d'un enregistrement avec images : 8 Mo au plus, comme un corps JSON (main.ts). */
const HEADER_MAX_BYTES = 8 * 1024 * 1024;
/** Envoi sans aucun octet reçu pendant ce temps : abandonné (réglage technique, sans effet sur un envoi qui avance). */
const STALL_MS = 30_000;

/**
 * Lecture au fil de l'eau d'un enregistrement de page avec ses images
 * (PAGE_SAVE_WITH_IMAGES_TYPE) : l'en-tête, puis chaque fichier à son tour. Un
 * seul fichier est en mémoire à la fois ; le reste attend dans le réseau
 * (contre-pression du flux). Corps tronqué ou trop long : 400.
 */
export class PageSaveStream {
  private readonly chunks: AsyncIterator<Buffer>;
  private pending: Buffer[] = [];
  private pendingBytes = 0;

  constructor(stream: Readable) {
    this.chunks = stream[Symbol.asyncIterator]() as AsyncIterator<Buffer>;
  }

  /** L'en-tête JSON, sans le valider. */
  async header(): Promise<unknown> {
    const length = (await this.read(4)).readUInt32BE(0);
    if (length > HEADER_MAX_BYTES) throw new BadRequestException();
    try {
      return JSON.parse((await this.read(length)).toString('utf8')) as unknown;
    } catch {
      throw new BadRequestException();
    }
  }

  /**
   * Morceau suivant du corps. Un envoi arrêté plus de STALL_MS abandonne
   * l'enregistrement (400) : la transaction ouverte, son verrou et sa place de
   * transfert sont libérés au lieu d'attendre un navigateur disparu.
   */
  private async next(): Promise<IteratorResult<Buffer>> {
    let timer: NodeJS.Timeout | undefined;
    const stalled = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new BadRequestException()), STALL_MS);
    });
    try {
      return await Promise.race([this.chunks.next(), stalled]);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Exactement `size` octets : le fichier suivant. */
  async read(size: number): Promise<Buffer> {
    while (this.pendingBytes < size) {
      const next = await this.next();
      if (next.done) throw new BadRequestException();
      this.pending.push(next.value);
      this.pendingBytes += next.value.length;
    }
    const all = this.pending.length === 1 ? this.pending[0]! : Buffer.concat(this.pending);
    const rest = all.subarray(size);
    this.pending = rest.length ? [rest] : [];
    this.pendingBytes = rest.length;
    return Buffer.from(all.subarray(0, size));
  }

  /** Rien après le dernier fichier annoncé. */
  async end(): Promise<void> {
    if (this.pendingBytes > 0 || !(await this.next()).done) throw new BadRequestException();
  }
}
