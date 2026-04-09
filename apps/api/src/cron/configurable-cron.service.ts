import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { AttachmentRetentionService } from '../attachment/attachment-retention.service';
import { GoalMetricComputeService } from '../goal/goal-metric-compute.service';
import { PmCrewService } from '../pm/pm-crew.service';
import { resolveCronExpression } from './cron-schedule.util';

@Injectable()
export class ConfigurableCronService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(ConfigurableCronService.name);
  private registeredJobNames: string[] = [];

  constructor(
    private readonly config: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly goalMetricCompute: GoalMetricComputeService,
    private readonly attachmentRetention: AttachmentRetentionService,
    private readonly pmCrew: PmCrewService,
  ) {}

  onModuleInit(): void {
    if (this.config.get<string>('CRON_JOBS_ENABLED') === 'false') {
      this.log.warn(
        'CRON_JOBS_ENABLED=false; skipping configurable cron registrations',
      );
      return;
    }

    const goalExpr = resolveCronExpression(
      this.config.get<string>('CRON_GOAL_METRICS'),
      null,
    );
    if (goalExpr) {
      this.safeRegister('goal-metrics', goalExpr, () =>
        this.goalMetricCompute.recomputeAllWorkspaces(),
      );
    }

    const attachmentExpr = resolveCronExpression(
      this.config.get<string>('CRON_ATTACHMENT_RETENTION'),
      '0 3 * * *',
    );
    if (attachmentExpr) {
      this.safeRegister('attachment-retention', attachmentExpr, () =>
        this.attachmentRetention.purgeExpiredLocalFiles(),
      );
    }

    const pmHb = resolveCronExpression(
      this.config.get<string>('CRON_PM_CREW_HEARTBEAT'),
      '*/5 * * * *',
    );
    if (pmHb) {
      this.safeRegister('pm-crew-heartbeat', pmHb, () =>
        this.pmCrew.heartbeat(),
      );
    }

    const pmProgress = resolveCronExpression(
      this.config.get<string>('CRON_PM_CREW_PROGRESS'),
      '0 * * * *',
    );
    if (pmProgress) {
      this.safeRegister('pm-crew-progress', pmProgress, () =>
        this.pmCrew.progressReport(),
      );
    }
  }

  onModuleDestroy(): void {
    for (const name of this.registeredJobNames) {
      try {
        this.schedulerRegistry.deleteCronJob(name);
      } catch {
        /* not registered */
      }
    }
    this.registeredJobNames = [];
  }

  private safeRegister(
    name: string,
    expression: string,
    handler: () => void | Promise<void>,
  ): void {
    try {
      const job = new CronJob(expression, () => {
        void Promise.resolve(handler()).catch((e: unknown) =>
          this.log.error(`[${name}] ${String(e)}`),
        );
      });
      this.schedulerRegistry.addCronJob(name, job);
      job.start();
      this.registeredJobNames.push(name);
      this.log.log(`Cron registered: ${name} (${expression})`);
    } catch (e: unknown) {
      this.log.error(
        `Failed to register cron "${name}" with expression "${expression}": ${String(e)}`,
      );
    }
  }
}
