import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  checkPageMove,
  type CreatePageInput,
  type MovePageInput,
  movePage,
  nextPagePosition,
  type PageDto,
  type PageRefusal,
  type PageRow,
  type UpdatePageInput,
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

  /** Titre et contenu : seuls les champs fournis changent. */
  update(userId: string, initiativeId: string, pageId: string, input: UpdatePageInput): Promise<PageDto> {
    return this.database.asUser(userId, async (tx) => {
      const current = await this.loadPage(tx, initiativeId, pageId);
      if (input.title === undefined && input.content === undefined) return current;
      await tx
        .updateTable('page')
        .set({
          title: input.title,
          content: input.content === undefined ? undefined : input.content && JSON.stringify(input.content),
        })
        .where('id', '=', pageId)
        .where('initiative_id', '=', initiativeId)
        .execute();
      return this.loadPage(tx, initiativeId, pageId);
    });
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
    };
  }
}

/** Seconde barrière : parente d'une autre initiative, ou rangement sous soi-même. */
function translateTreeError(error: unknown): never {
  if (isConstraintViolation(error, 'page_parent_fkey')) throw pageRefusal('unknownPage');
  if (isConstraintViolation(error, 'page_under_itself')) throw pageRefusal('pageUnderItself');
  throw error;
}

export function pageRefusal(refusal: PageRefusal) {
  return refusal === 'pageHasSubpages'
    ? new ConflictException({ statusCode: 409, refusal })
    : new BadRequestException({ statusCode: 400, refusal });
}
