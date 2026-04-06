import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../common/prisma.service';

function isMissingPmTableError(e: unknown): boolean {
  return e instanceof PrismaClientKnownRequestError && e.code === 'P2021';
}

/**
 * PM Agent Crew heartbeat (Section 5.5) — uses DB directly (service role / Prisma).
 * Off by default: set PM_CREW_ENABLED=true after applying ModelT PM migrations.
 */
@Injectable()
export class PmCrewService {
  private readonly log = new Logger(PmCrewService.name);
  private warnedMissingPmSchema = false;

  constructor(private readonly prisma: PrismaService) {}

  /** Every 5 minutes: stuck human gates (>2h), timeout hints, large unblock alerts */
  @Cron('*/5 * * * *')
  async heartbeat(): Promise<void> {
    if (process.env.PM_CREW_ENABLED !== 'true') {
      return;
    }

    try {
      await this.runHeartbeat();
    } catch (e) {
      if (isMissingPmTableError(e)) {
        this.logMissingSchemaOnce();
        return;
      }
      this.log.error(e);
    }
  }

  private async runHeartbeat(): Promise<void> {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const stuckGates = await this.prisma.pmHumanGate.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: twoHoursAgo },
        ageAlertSent: false,
      },
    });

    for (const g of stuckGates) {
      await this.prisma.$transaction(async (tx) => {
        await tx.pmHumanGate.update({
          where: { id: g.id },
          data: { ageAlertSent: true },
        });
        await tx.pmAuditLog.create({
          data: {
            projectId: g.projectId,
            gateId: g.id,
            eventType: 'SYSTEM_ALERT',
            actor: 'pm_crew',
            detail: {
              kind: 'STUCK_HUMAN_GATE',
              gate_type: g.gateType,
              pending_since: g.createdAt.toISOString(),
            } as Prisma.InputJsonValue,
          },
        });
      });
    }

    if (stuckGates.length > 0) {
      this.log.warn(`PM crew: marked ${stuckGates.length} stuck human gate(s)`);
    }

    await this.detectLargeUnblock();
  }

  private logMissingSchemaOnce(): void {
    if (this.warnedMissingPmSchema) return;
    this.warnedMissingPmSchema = true;
    this.log.warn(
      'PM crew skipped: ModelT PM tables are missing. Run `npx prisma migrate deploy` (from repo root), then set PM_CREW_ENABLED=true.',
    );
  }

  /**
   * If a task just completed and would unblock 5+ PENDING tasks, log SYSTEM_ALERT.
   * Simplified: scan recent DONE tasks (updated in last 10m) and count newly-ready peers.
   */
  private async detectLargeUnblock(): Promise<void> {
    const since = new Date(Date.now() - 10 * 60 * 1000);
    const recentlyDone = await this.prisma.pmTask.findMany({
      where: { status: 'DONE', updatedAt: { gte: since } },
      select: { id: true, projectId: true, title: true },
    });

    for (const t of recentlyDone) {
      const unblocked = await this.prisma.pmTaskDependency.findMany({
        where: { dependsOnId: t.id },
        include: {
          task: { select: { id: true, status: true, projectId: true } },
        },
      });

      const wouldBecomeReady = unblocked.filter(
        (d) =>
          d.task.projectId === t.projectId && d.task.status === 'PENDING',
      );
      if (wouldBecomeReady.length >= 5) {
        await this.prisma.pmAuditLog.create({
          data: {
            projectId: t.projectId,
            taskId: t.id,
            eventType: 'SYSTEM_ALERT',
            actor: 'pm_crew',
            detail: {
              kind: 'LARGE_PARALLEL_UNBLOCK',
              completed_task: t.title,
              pending_now_unblocked: wouldBecomeReady.length,
            } as Prisma.InputJsonValue,
          },
        });
        this.log.log(
          `PM crew: large unblock (${wouldBecomeReady.length}) after task ${t.id}`,
        );
      }
    }
  }

  /** Hourly narrative placeholder — extend with LLM / gemma when available */
  @Cron(CronExpression.EVERY_HOUR)
  async progressReport(): Promise<void> {
    if (process.env.PM_CREW_ENABLED !== 'true') {
      return;
    }

    try {
      await this.runProgressReport();
    } catch (e) {
      if (isMissingPmTableError(e)) {
        this.logMissingSchemaOnce();
        return;
      }
      this.log.error(e);
    }
  }

  private async runProgressReport(): Promise<void> {
    const projects = await this.prisma.pmProject.findMany({
      where: {
        status: { notIn: ['CLOSED', 'DEPLOYED'] },
      },
      take: 20,
    });

    for (const p of projects) {
      const counts = await this.prisma.pmTask.groupBy({
        by: ['status'],
        where: { projectId: p.id },
        _count: { id: true },
      });
      const summary = counts
        .map((c) => `${c.status}:${c._count.id}`)
        .join(' ');
      await this.prisma.pmAuditLog.create({
        data: {
          projectId: p.id,
          eventType: 'PROGRESS_REPORT',
          actor: 'pm_crew',
          detail: {
            summary: `Hourly status for ${p.slug}: ${summary}`,
          } as Prisma.InputJsonValue,
        },
      });
    }
  }
}

