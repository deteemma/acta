import { randomUUID } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AddMemberInput,
  CreateProjectInput,
  ProjectDto,
  ProjectMemberDto,
  UpdateProjectInput,
} from '@app/shared';
import { sql } from 'kysely';
import { DatabaseService, type Tx } from '../db/database.service.js';

@Injectable()
export class ProjectsService {
  constructor(private readonly database: DatabaseService) {}

  /** Projets visibles par l'utilisateur : la RLS filtre, la jointure donne son rôle. */
  list(userId: string): Promise<ProjectDto[]> {
    return this.database.asUser(userId, async (tx) => {
      const rows = await this.selectProjects(tx, userId).orderBy('p.created_at', 'desc').execute();
      return rows.map(toDto);
    });
  }

  get(userId: string, projectId: string): Promise<ProjectDto> {
    return this.database.asUser(userId, async (tx) => {
      const row = await this.selectProjects(tx, userId).where('p.id', '=', projectId).executeTakeFirst();
      if (!row) throw new NotFoundException();
      return toDto(row);
    });
  }

  create(userId: string, input: CreateProjectInput): Promise<ProjectDto> {
    // L'identifiant est généré ici : le créateur ne devient membre (déclencheur)
    // qu'à la fin de l'INSERT, la relecture se fait donc dans une 2ᵉ requête.
    const id = input.id ?? randomUUID();
    return this.database.asUser(userId, async (tx) => {
      await tx.insertInto('project').values({ id, name: input.name }).execute();
      const row = await this.selectProjects(tx, userId).where('p.id', '=', id).executeTakeFirstOrThrow();
      return toDto(row);
    });
  }

  update(userId: string, projectId: string, input: UpdateProjectInput): Promise<ProjectDto> {
    return this.database.asUser(userId, async (tx) => {
      await tx
        .updateTable('project')
        .set({ name: input.name, updated_at: sql`now()` })
        .where('id', '=', projectId)
        .execute();
      const row = await this.selectProjects(tx, userId).where('p.id', '=', projectId).executeTakeFirst();
      if (!row) throw new NotFoundException();
      return toDto(row);
    });
  }

  async remove(userId: string, projectId: string): Promise<void> {
    await this.database.asUser(userId, (tx) =>
      tx.deleteFrom('project').where('id', '=', projectId).execute(),
    );
  }

  listMembers(userId: string, projectId: string): Promise<ProjectMemberDto[]> {
    return this.database.asUser(userId, async (tx) => {
      const rows = await tx
        .selectFrom('project_member as m')
        .leftJoin('app_user as u', 'u.id', 'm.user_id')
        .select(['m.user_id', 'm.role', 'u.email', 'u.display_name'])
        .where('m.project_id', '=', projectId)
        .orderBy('m.created_at')
        .execute();
      return rows.map((r) => ({
        userId: r.user_id,
        email: r.email,
        displayName: r.display_name,
        role: r.role,
      }));
    });
  }

  addMember(userId: string, projectId: string, input: AddMemberInput): Promise<void> {
    return this.database.asUser(userId, async (tx) => {
      const { rows } = await sql<{ id: string | null }>`
        SELECT find_user_id_by_email(${input.email}) AS id`.execute(tx);
      const memberId = rows[0]?.id;
      // L'invité doit s'être connecté au moins une fois à l'application.
      if (!memberId) throw new NotFoundException('Aucun utilisateur avec cet e-mail');
      const inserted = await tx
        .insertInto('project_member')
        .values({ project_id: projectId, user_id: memberId, role: input.role })
        .onConflict((oc) => oc.columns(['project_id', 'user_id']).doNothing())
        .executeTakeFirst();
      if (inserted.numInsertedOrUpdatedRows === 0n) {
        throw new ConflictException('Cet utilisateur est déjà membre du projet');
      }
    });
  }

  private selectProjects(tx: Tx, userId: string) {
    return tx
      .selectFrom('project as p')
      .innerJoin('project_member as m', (join) =>
        join.onRef('m.project_id', '=', 'p.id').on('m.user_id', '=', userId),
      )
      .select(['p.id', 'p.name', 'p.created_at', 'm.role']);
  }
}

function toDto(row: { id: string; name: string; created_at: Date; role: ProjectDto['myRole'] }): ProjectDto {
  return { id: row.id, name: row.name, createdAt: row.created_at.toISOString(), myRole: row.role };
}
