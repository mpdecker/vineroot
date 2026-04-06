import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import type {
  SearchProjectHitDto,
  SearchResponseDto,
  SearchSectionHitDto,
  SearchTagHitDto,
  SearchTaskHitDto,
  SearchTaskMatchKind,
} from '@vineroot/shared-types';

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  projectId: string | null;
  sectionId: string | null;
  updatedAt: Date;
  project: { name: string } | null;
  section: { name: string } | null;
};

type MergedTask = SearchTaskHitDto & { rank: number; updatedAt: Date };

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  private async assertWorkspaceMember(userId: string, workspaceId: string): Promise<void> {
    const m = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!m) {
      throw new ForbiddenException('User does not have access to this workspace');
    }
  }

  /** Projects the user can see (creator or project member), optionally linked to a workspace. */
  private accessibleProjectWhere(userId: string, workspaceId?: string) {
    return {
      deletedAt: null,
      isTemplate: false,
      OR: [{ createdById: userId }, { members: { some: { userId } } }],
      ...(workspaceId ? { workspaceLinks: { some: { workspaceId } } } : {}),
    };
  }

  private tokens(raw: string): string[] {
    return raw
      .trim()
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }

  private classifyDirectMatch(
    title: string,
    description: string | null,
    tokens: string[],
    fullQ: string,
  ): SearchTaskMatchKind {
    const tl = title.toLowerCase();
    const dl = (description ?? '').toLowerCase();
    const ql = fullQ.trim().toLowerCase();
    if (ql.length > 0 && tl.includes(ql)) return 'TITLE';
    if (tokens.length > 0 && tokens.every((t) => tl.includes(t.toLowerCase()))) return 'TITLE';
    return 'DESCRIPTION';
  }

  /** Lower rank sorts first (more relevant). */
  private taskRank(
    title: string,
    description: string | null,
    tokens: string[],
    fullQ: string,
    fromComment: boolean,
  ): number {
    if (fromComment) return 50;
    const tl = title.toLowerCase();
    const dl = (description ?? '').toLowerCase();
    const ql = fullQ.trim().toLowerCase();
    if (ql.length > 0 && tl.includes(ql)) return 0;
    if (tokens.length > 0 && tokens.every((t) => tl.includes(t.toLowerCase()))) return 2;
    if (tokens.some((t) => tl.includes(t.toLowerCase()))) return 8;
    if (tokens.length > 0 && tokens.every((t) => dl.includes(t.toLowerCase()))) return 20;
    return 25;
  }

  private snippetFromBody(body: string, maxLen = 140): string {
    const t = body.replace(/\s+/g, ' ').trim();
    if (t.length <= maxLen) return t;
    return `${t.slice(0, maxLen - 1)}…`;
  }

  private mapTaskRow(
    t: TaskRow,
    matchKind: SearchTaskMatchKind,
    snippet: string | null,
    rank: number,
  ): MergedTask {
    return {
      id: t.id,
      title: t.title,
      status: t.status,
      projectId: t.projectId,
      projectName: t.project?.name ?? null,
      sectionId: t.sectionId,
      sectionName: t.section?.name ?? null,
      matchKind,
      snippet,
      rank,
      updatedAt: t.updatedAt,
    };
  }

  async search(
    userId: string,
    rawQ: string,
    workspaceId?: string,
    limit = 20,
  ): Promise<SearchResponseDto> {
    const q = rawQ.trim();
    if (q.length < 2) {
      return { tasks: [], projects: [], sections: [], tags: [] };
    }

    if (workspaceId) {
      await this.assertWorkspaceMember(userId, workspaceId);
    }

    const tokens = this.tokens(q);
    if (tokens.length === 0) {
      return { tasks: [], projects: [], sections: [], tags: [] };
    }

    const takeTasks = Math.min(Math.max(1, limit), 30);
    const takeProjects = Math.min(10, Math.max(6, Math.ceil(takeTasks / 2)));
    const takeSections = Math.min(10, Math.max(6, Math.ceil(takeTasks / 2)));
    const takeTags = Math.min(10, Math.max(6, Math.ceil(takeTasks / 2)));
    const takeDirectTasks = Math.min(40, takeTasks + 15);
    const takeCommentScan = Math.min(60, takeTasks * 3);

    const taskVisible = {
      OR: [
        { assignees: { some: { userId } } },
        { project: this.accessibleProjectWhere(userId, workspaceId) },
        { createdById: userId, projectId: null },
      ],
    };

    const tokenAndTaskText = {
      AND: tokens.map((tok) => ({
        OR: [
          { title: { contains: tok, mode: 'insensitive' as const } },
          { description: { contains: tok, mode: 'insensitive' as const } },
        ],
      })),
    };

    const tokenAndProjectText = {
      AND: tokens.map((tok) => ({
        OR: [
          { name: { contains: tok, mode: 'insensitive' as const } },
          { description: { contains: tok, mode: 'insensitive' as const } },
        ],
      })),
    };

    const tokenAndSectionName = {
      AND: tokens.map((tok) => ({
        name: { contains: tok, mode: 'insensitive' as const },
      })),
    };

    const tokenAndTagName = {
      AND: tokens.map((tok) => ({
        name: { contains: tok, mode: 'insensitive' as const },
      })),
    };

    const tokenAndCommentBody = {
      AND: tokens.map((tok) => ({
        body: { contains: tok, mode: 'insensitive' as const },
      })),
    };

    const taskHitSelect = {
      id: true,
      title: true,
      description: true,
      status: true,
      projectId: true,
      sectionId: true,
      updatedAt: true,
      project: { select: { name: true } },
      section: { select: { name: true } },
    } as const;

    const accessibleProjects = this.accessibleProjectWhere(userId, workspaceId);

    const tagWorkspaceFilter = workspaceId
      ? { workspaceId }
      : { workspace: { members: { some: { userId } } } };

    const [taskRows, commentRows, projectRows, sectionRows, tagRows] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          deletedAt: null,
          isTemplate: false,
          AND: [tokenAndTaskText, taskVisible],
        },
        take: takeDirectTasks,
        orderBy: { updatedAt: 'desc' },
        select: taskHitSelect,
      }),
      this.prisma.comment.findMany({
        where: {
          deletedAt: null,
          AND: [tokenAndCommentBody, { task: { deletedAt: null, isTemplate: false, AND: [taskVisible] } }],
        },
        take: takeCommentScan,
        orderBy: { updatedAt: 'desc' },
        select: {
          body: true,
          task: { select: taskHitSelect },
        },
      }),
      this.prisma.project.findMany({
        where: {
          AND: [tokenAndProjectText, accessibleProjects],
        },
        take: takeProjects,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          workspaceLinks: { select: { workspaceId: true } },
        },
      }),
      this.prisma.section.findMany({
        where: {
          AND: [tokenAndSectionName, { project: accessibleProjects }],
        },
        take: takeSections,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          projectId: true,
          project: { select: { name: true } },
        },
      }),
      this.prisma.tag.findMany({
        where: {
          AND: [tokenAndTagName, tagWorkspaceFilter],
        },
        take: takeTags,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          workspaceId: true,
          color: true,
        },
      }),
    ]);

    const merged = new Map<string, MergedTask>();

    for (const t of taskRows) {
      const matchKind = this.classifyDirectMatch(t.title, t.description, tokens, q);
      const rank = this.taskRank(t.title, t.description, tokens, q, false);
      merged.set(t.id, this.mapTaskRow(t, matchKind, null, rank));
    }

    const seenCommentTask = new Set<string>();
    for (const row of commentRows) {
      const tid = row.task.id;
      if (seenCommentTask.has(tid)) continue;
      seenCommentTask.add(tid);

      const t = row.task;
      const commentRank = this.taskRank(t.title, t.description, tokens, q, true);
      const snippet = this.snippetFromBody(row.body);
      const existing = merged.get(tid);
      if (!existing) {
        merged.set(tid, this.mapTaskRow(t, 'COMMENT', snippet, commentRank));
      } else if (!existing.snippet) {
        merged.set(tid, { ...existing, snippet });
      }
    }

    const tasks: SearchTaskHitDto[] = [...merged.values()]
      .sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        return b.updatedAt.getTime() - a.updatedAt.getTime();
      })
      .slice(0, takeTasks)
      .map(({ rank: _r, updatedAt: _u, ...hit }) => hit);

    const projects: SearchProjectHitDto[] = projectRows.map((p) => ({
      id: p.id,
      name: p.name,
      workspaceIds: p.workspaceLinks.map((l) => l.workspaceId),
    }));

    const sections: SearchSectionHitDto[] = sectionRows.map((s) => ({
      id: s.id,
      name: s.name,
      projectId: s.projectId,
      projectName: s.project.name,
    }));

    const tags: SearchTagHitDto[] = tagRows.map((g) => ({
      id: g.id,
      name: g.name,
      workspaceId: g.workspaceId,
      color: g.color,
    }));

    return { tasks, projects, sections, tags };
  }
}
