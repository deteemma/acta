import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  checkPageMove,
  checkPageRevisionDelete,
  checkPageRevisionRestore,
  checkPageVersionDeclare,
  checkPageVersionNote,
  type CreatePageInput,
  currentPageRevision,
  type DeclarePageVersionInput,
  type MovePageInput,
  movePage,
  nextPagePosition,
  nextPageVersionNumber,
  type PageDto,
  type PageRefusal,
  type PageRevisionDto,
  type PageRevisionItem,
  type PageRevisionRefusal,
  type PageRevisionRow,
  type PageRow,
  pageVersionStatus,
  type UpdatePageInput,
  type UpdatePageVersionNoteInput,
} from '@app/shared';
import { sql } from 'kysely';
import { DatabaseService, type Tx } from '../db/database.service.js';
import { isConstraintViolation, isForeignKeyViolation } from '../db/pg-errors.js';

/** Pages d'une initiative (ticket 22) : la RLS limite aux membres, les guards aux rôles. */
@Injectable()
export class PagesService {
  constructor(private readonly database: DatabaseService) {}

  /** Arborescence : toutes les pages, sans leur contenu. */
  listTree(userId: string, initiativeId: string): Promise<PageRow[]> {
    return this.database.asUser(userId, (tx) => this.selectTree(tx, initiativeId));
  }

  get(userId: string, initiativeId: string, pageId: string): Promise<PageDto> {
    return this.database.asUser(userId, (tx) => this.loadPage(tx, initiativeId, pageId));
  }

  /** Premier enregistrement : la référence est attribuée par la base, la page se place en dernier. */
  create(userId: string, initiativeId: string, input: CreatePageInput): Promise<PageDto> {
    const id = randomUUID();
    return this.database.asUser(userId, async (tx) => {
      const tree = await this.lockTree(tx, initiativeId);
      const refusal = input.parentId === null ? null : checkPageMove(tree, id, input.parentId);
      if (refusal) throw pageRefusal(refusal);
      await tx
        .insertInto('page')
        .values({
          id,
          initiative_id: initiativeId,
          title: input.title,
          content: input.content === null ? null : JSON.stringify(input.content),
          parent_id: input.parentId,
          position: nextPagePosition(tree, input.parentId),
        })
        .execute()
        .catch(translateTreeError);
      return this.loadPage(tx, initiativeId, id);
    });
  }

  /**
   * Titre et contenu : seuls les champs fournis changent ; la base conserve un
   * enregistrement s'ils changent. Avec `version`, le dernier enregistrement (le
   * nouveau, ou l'actuel si rien n'a changé) est déclaré comme version.
   */
  update(userId: string, initiativeId: string, pageId: string, input: UpdatePageInput): Promise<PageDto> {
    return this.database.asUser(userId, async (tx) => {
      const current = await this.loadPage(tx, initiativeId, pageId);
      const changes = input.title !== undefined || input.content !== undefined;
      if (!changes && !input.version) return current;
      if (changes) {
        await tx
          .updateTable('page')
          .set({
            title: input.title,
            content: input.content === undefined ? undefined : input.content && JSON.stringify(input.content),
          })
          .where('id', '=', pageId)
          .where('initiative_id', '=', initiativeId)
          .execute();
      }
      if (input.version) {
        const revisions = await this.lockRevisions(tx, pageId);
        await this.declare(tx, revisions, currentPageRevision(revisions)!.id, input.version);
      }
      return this.loadPage(tx, initiativeId, pageId);
    });
  }

  // ── Enregistrements et versions (ticket 23) ────────────────────────────────

  /** Historique, du plus récent au plus ancien, traces des enregistrements supprimés comprises. */
  listRevisions(userId: string, initiativeId: string, pageId: string): Promise<PageRevisionRow[]> {
    return this.database.asUser(userId, async (tx) => {
      await this.assertPage(tx, initiativeId, pageId);
      return this.selectRevisionRows(tx, pageId);
    });
  }

  /** Enregistrement ouvert : son titre et son contenu, ou sa seule trace s'il est supprimé. */
  getRevision(userId: string, initiativeId: string, pageId: string, revisionId: string): Promise<PageRevisionDto> {
    return this.database.asUser(userId, async (tx) => {
      await this.assertPage(tx, initiativeId, pageId);
      const [row] = await this.selectRevisionRows(tx, pageId, revisionId);
      if (!row) throw new NotFoundException();
      return row;
    });
  }

  /** Déclarer après coup un enregistrement comme version ; renvoie l'historique. */
  declareVersion(
    userId: string,
    initiativeId: string,
    pageId: string,
    revisionId: string,
    input: DeclarePageVersionInput,
  ): Promise<PageRevisionRow[]> {
    return this.onRevision(userId, initiativeId, pageId, revisionId, async (tx, revisions) => {
      await this.declare(tx, revisions, revisionId, input);
      return this.selectRevisionRows(tx, pageId);
    });
  }

  /** Corriger la note d'une version ; renvoie l'historique. */
  updateVersionNote(
    userId: string,
    initiativeId: string,
    pageId: string,
    revisionId: string,
    input: UpdatePageVersionNoteInput,
  ): Promise<PageRevisionRow[]> {
    return this.onRevision(userId, initiativeId, pageId, revisionId, async (tx, revisions) => {
      const refusal = checkPageVersionNote(revisions, revisionId);
      if (refusal) throw revisionRefusal(refusal);
      await tx
        .updateTable('page_revision')
        .set({ version_note: input.note })
        .where('id', '=', revisionId)
        .execute()
        .catch(translateRevisionError);
      return this.selectRevisionRows(tx, pageId);
    });
  }

  /** Restaurer : la page reprend le titre et le contenu, dans un nouvel enregistrement sans version. */
  restoreRevision(userId: string, initiativeId: string, pageId: string, revisionId: string): Promise<PageDto> {
    return this.onRevision(userId, initiativeId, pageId, revisionId, async (tx, revisions) => {
      const refusal = checkPageRevisionRestore(revisions, revisionId);
      if (refusal) throw revisionRefusal(refusal);
      const source = await tx
        .selectFrom('page_revision')
        .select(['title', 'content'])
        .where('id', '=', revisionId)
        .executeTakeFirstOrThrow();
      await tx
        .updateTable('page')
        .set({ title: source.title!, content: source.content === null ? null : JSON.stringify(source.content) })
        .where('id', '=', pageId)
        .where('initiative_id', '=', initiativeId)
        .execute();
      return this.loadPage(tx, initiativeId, pageId);
    });
  }

  /** Suppression définitive, sauf le dernier ; une ligne sans contenu en garde la trace. Renvoie l'historique. */
  deleteRevision(userId: string, initiativeId: string, pageId: string, revisionId: string): Promise<PageRevisionRow[]> {
    return this.onRevision(userId, initiativeId, pageId, revisionId, async (tx, revisions) => {
      const refusal = checkPageRevisionDelete(revisions, revisionId);
      if (refusal) throw revisionRefusal(refusal);
      // La base pose l'auteur et la date de la suppression, et retire le contenu.
      await tx
        .updateTable('page_revision')
        .set({ deleted_at: new Date() })
        .where('id', '=', revisionId)
        .execute()
        .catch(translateRevisionError);
      return this.selectRevisionRows(tx, pageId);
    });
  }

  /** Écriture sur un enregistrement de la page, verrou pris : 404 s'il n'en fait pas partie. */
  private onRevision<T>(
    userId: string,
    initiativeId: string,
    pageId: string,
    revisionId: string,
    write: (tx: Tx, revisions: PageRevisionItem[]) => Promise<T>,
  ): Promise<T> {
    return this.database.asUser(userId, async (tx) => {
      await this.assertPage(tx, initiativeId, pageId);
      const revisions = await this.lockRevisions(tx, pageId);
      if (!revisions.some((r) => r.id === revisionId)) throw new NotFoundException();
      return write(tx, revisions);
    });
  }

  private async declare(tx: Tx, revisions: PageRevisionItem[], revisionId: string, input: DeclarePageVersionInput) {
    const refusal = checkPageVersionDeclare(revisions, revisionId);
    if (refusal) throw revisionRefusal(refusal);
    await tx
      .updateTable('page_revision')
      .set({ version_number: nextPageVersionNumber(revisions), version_note: input.note })
      .where('id', '=', revisionId)
      .execute()
      .catch(translateRevisionError);
  }

  /** Numéros et suppressions d'une page passent l'un après l'autre (même verrou que la base). */
  private async lockRevisions(tx: Tx, pageId: string): Promise<PageRevisionItem[]> {
    await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`page_revisions:${pageId}`}, 0))`.execute(tx);
    return this.selectRevisionItems(tx, pageId);
  }

  /** Enregistrements d'une page, du plus ancien au plus récent. */
  private async selectRevisionItems(tx: Tx, pageId: string): Promise<PageRevisionItem[]> {
    const rows = await tx
      .selectFrom('page_revision')
      .select(['id', 'sequence', 'version_number', 'deleted_at'])
      .where('page_id', '=', pageId)
      .orderBy('sequence')
      .execute();
    return rows.map((r) => ({
      id: r.id,
      sequence: Number(r.sequence),
      versionNumber: r.version_number,
      deletedAt: r.deleted_at?.toISOString() ?? null,
    }));
  }

  /**
   * Enregistrements, du plus récent au plus ancien. L'historique n'a pas besoin du
   * contenu : il n'est lu que pour un enregistrement ouvert (`revisionId`).
   */
  private async selectRevisionRows(tx: Tx, pageId: string): Promise<PageRevisionRow[]>;
  private async selectRevisionRows(tx: Tx, pageId: string, revisionId: string): Promise<PageRevisionDto[]>;
  private async selectRevisionRows(tx: Tx, pageId: string, revisionId?: string): Promise<PageRevisionRow[]> {
    let query = tx
      .selectFrom('page_revision as r')
      .leftJoin('app_user as cu', 'cu.id', 'r.created_by')
      .leftJoin('app_user as du', 'du.id', 'r.deleted_by')
      .select([
        'r.id',
        'r.sequence',
        'r.created_by',
        'r.created_at',
        'cu.email as created_by_email',
        'cu.display_name as created_by_display_name',
        'r.version_number',
        'r.version_note',
        'r.deleted_by',
        'r.deleted_at',
        'du.email as deleted_by_email',
        'du.display_name as deleted_by_display_name',
      ])
      .where('r.page_id', '=', pageId)
      .orderBy('r.sequence', 'desc');
    if (revisionId) query = query.where('r.id', '=', revisionId);
    const rows = await query.execute();
    const content = revisionId
      ? await tx.selectFrom('page_revision').select(['title', 'content']).where('id', '=', revisionId).executeTakeFirst()
      : undefined;
    return rows.map((r) => ({
      id: r.id,
      sequence: Number(r.sequence),
      createdAt: r.created_at.toISOString(),
      createdBy: { userId: r.created_by, email: r.created_by_email, displayName: r.created_by_display_name },
      versionNumber: r.version_number,
      versionNote: r.version_note,
      deletedAt: r.deleted_at?.toISOString() ?? null,
      deletedBy: r.deleted_by
        ? { userId: r.deleted_by, email: r.deleted_by_email, displayName: r.deleted_by_display_name }
        : null,
      ...(content && { title: content.title, content: content.content }),
    }));
  }

  private async assertPage(tx: Tx, initiativeId: string, pageId: string): Promise<void> {
    const found = await tx
      .selectFrom('page')
      .select('id')
      .where('id', '=', pageId)
      .where('initiative_id', '=', initiativeId)
      .executeTakeFirst();
    if (!found) throw new NotFoundException();
  }

  /**
   * Déplacer ou réordonner, avec les sous-pages : les nouvelles sœurs sont
   * renumérotées. Ne change ni l'auteur ni la date de modification. Renvoie l'arborescence.
   */
  move(userId: string, initiativeId: string, pageId: string, input: MovePageInput): Promise<PageRow[]> {
    return this.database.asUser(userId, async (tx) => {
      const tree = await this.lockTree(tx, initiativeId);
      if (!tree.some((p) => p.id === pageId)) throw new NotFoundException();
      const refusal = checkPageMove(tree, pageId, input.parentId);
      if (refusal) throw pageRefusal(refusal);
      const before = new Map(tree.map((p) => [p.id, p]));
      for (const page of movePage(tree, pageId, input)) {
        const old = before.get(page.id)!;
        if (old.parentId === page.parentId && old.position === page.position) continue;
        await tx
          .updateTable('page')
          .set({ parent_id: page.parentId, position: page.position })
          .where('id', '=', page.id)
          .where('initiative_id', '=', initiativeId)
          .execute()
          .catch(translateTreeError);
      }
      return this.selectTree(tx, initiativeId);
    });
  }

  /** Définitive ; refusée tant que la page a des sous-pages. Les liens viendront avec le ticket 25. */
  remove(userId: string, initiativeId: string, pageId: string): Promise<void> {
    return this.database.asUser(userId, async (tx) => {
      await this.loadPage(tx, initiativeId, pageId);
      await tx
        .deleteFrom('page')
        .where('id', '=', pageId)
        .where('initiative_id', '=', initiativeId)
        .execute()
        .catch((error: unknown) => {
          if (isForeignKeyViolation(error)) throw pageRefusal('pageHasSubpages');
          throw error;
        });
    });
  }

  /** Les écritures sur l'arborescence d'une initiative passent l'une après l'autre (même verrou que la base). */
  private async lockTree(tx: Tx, initiativeId: string): Promise<PageRow[]> {
    await sql`SELECT pg_advisory_xact_lock(hashtextextended(${`page_tree:${initiativeId}`}, 0))`.execute(tx);
    return this.selectTree(tx, initiativeId);
  }

  private async selectTree(tx: Tx, initiativeId: string): Promise<PageRow[]> {
    const rows = await tx
      .selectFrom('page')
      .select(['id', 'reference', 'title', 'parent_id', 'position'])
      .where('initiative_id', '=', initiativeId)
      .orderBy('position')
      .execute();
    return rows.map((r) => ({ id: r.id, reference: r.reference, title: r.title, parentId: r.parent_id, position: r.position }));
  }

  private async loadPage(tx: Tx, initiativeId: string, pageId: string): Promise<PageDto> {
    const r = await tx
      .selectFrom('page as p')
      .leftJoin('app_user as cu', 'cu.id', 'p.created_by')
      .leftJoin('app_user as uu', 'uu.id', 'p.updated_by')
      .select([
        'p.id',
        'p.initiative_id',
        'p.reference',
        'p.title',
        'p.content',
        'p.parent_id',
        'p.position',
        'p.created_at',
        'p.created_by',
        'cu.email as created_by_email',
        'cu.display_name as created_by_display_name',
        'p.updated_at',
        'p.updated_by',
        'uu.email as updated_by_email',
        'uu.display_name as updated_by_display_name',
      ])
      .where('p.id', '=', pageId)
      .where('p.initiative_id', '=', initiativeId)
      .executeTakeFirst();
    if (!r) throw new NotFoundException();
    const revisions = await this.selectRevisionItems(tx, pageId);
    return {
      id: r.id,
      initiativeId: r.initiative_id,
      reference: r.reference,
      title: r.title,
      content: r.content,
      parentId: r.parent_id,
      position: r.position,
      createdAt: r.created_at.toISOString(),
      createdBy: { userId: r.created_by, email: r.created_by_email, displayName: r.created_by_display_name },
      updatedAt: r.updated_at.toISOString(),
      updatedBy: { userId: r.updated_by, email: r.updated_by_email, displayName: r.updated_by_display_name },
      revisionId: currentPageRevision(revisions)!.id,
      versions: pageVersionStatus(revisions),
    };
  }
}

/** Seconde barrière : parente d'une autre initiative, ou rangement sous soi-même. */
function translateTreeError(error: unknown): never {
  if (isConstraintViolation(error, 'page_parent_fkey')) throw pageRefusal('unknownPage');
  if (isConstraintViolation(error, 'page_under_itself')) throw pageRefusal('pageUnderItself');
  throw error;
}

/** Seconde barrière des enregistrements : mêmes refus que les règles de @app/shared. */
const REVISION_CONSTRAINTS: Record<string, PageRevisionRefusal> = {
  page_revision_last: 'lastPageRevision',
  page_revision_deleted: 'pageRevisionDeleted',
  page_version_not_after_last: 'pageVersionNotAfterLast',
  page_version_permanent: 'alreadyPageVersion',
  page_revision_note_on_version: 'notPageVersion',
};

function translateRevisionError(error: unknown): never {
  for (const [constraint, refusal] of Object.entries(REVISION_CONSTRAINTS)) {
    if (isConstraintViolation(error, constraint)) throw revisionRefusal(refusal);
  }
  throw error;
}

export const revisionRefusal = (refusal: PageRevisionRefusal) => new ConflictException({ statusCode: 409, refusal });

export function pageRefusal(refusal: PageRefusal) {
  return refusal === 'pageHasSubpages'
    ? new ConflictException({ statusCode: 409, refusal })
    : new BadRequestException({ statusCode: 400, refusal });
}
