import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Test } from '@nestjs/testing';
import { AttachmentRetentionService } from '../attachment/attachment-retention.service';
import { GoalMetricComputeService } from '../goal/goal-metric-compute.service';
import { PmCrewService } from '../pm/pm-crew.service';
import { ConfigurableCronService } from './configurable-cron.service';

jest.mock('cron', () => ({
  CronJob: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
  })),
}));

describe('ConfigurableCronService', () => {
  let addCronJob: jest.Mock;
  let lastService: ConfigurableCronService | undefined;

  beforeEach(() => {
    addCronJob = jest.fn();
    lastService = undefined;
  });

  afterEach(() => {
    lastService?.onModuleDestroy();
    lastService = undefined;
  });

  async function createService(env: Record<string, string | undefined>) {
    const config = {
      get: (key: string) => env[key],
    } as unknown as ConfigService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConfigurableCronService,
        { provide: ConfigService, useValue: config },
        {
          provide: SchedulerRegistry,
          useValue: { addCronJob, deleteCronJob: jest.fn() },
        },
        {
          provide: GoalMetricComputeService,
          useValue: { recomputeAllWorkspaces: jest.fn() },
        },
        {
          provide: AttachmentRetentionService,
          useValue: { purgeExpiredLocalFiles: jest.fn() },
        },
        {
          provide: PmCrewService,
          useValue: { heartbeat: jest.fn(), progressReport: jest.fn() },
        },
      ],
    }).compile();

    const svc = moduleRef.get(ConfigurableCronService);
    lastService = svc;
    svc.onModuleInit();
    return svc;
  }

  it('registers no jobs when CRON_JOBS_ENABLED=false', async () => {
    await createService({ CRON_JOBS_ENABLED: 'false' });
    expect(addCronJob).not.toHaveBeenCalled();
  });

  it('registers goal-metrics when CRON_GOAL_METRICS is set', async () => {
    await createService({ CRON_GOAL_METRICS: '0 * * * *' });
    expect(addCronJob).toHaveBeenCalledWith(
      'goal-metrics',
      expect.any(Object),
    );
  });

  it('registers attachment-retention with default when env unset', async () => {
    await createService({});
    expect(addCronJob).toHaveBeenCalledWith(
      'attachment-retention',
      expect.any(Object),
    );
  });

  it('skips attachment-retention when CRON_ATTACHMENT_RETENTION is empty', async () => {
    await createService({ CRON_ATTACHMENT_RETENTION: '' });
    expect(
      addCronJob.mock.calls.some((c) => c[0] === 'attachment-retention'),
    ).toBe(false);
  });
});
