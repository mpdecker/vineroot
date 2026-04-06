import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';

function flattenErrors(errs: ValidationError[]): ValidationError[] {
  return errs.flatMap((e) => [e, ...(e.children ? flattenErrors(e.children) : [])]);
}
import {
  PmCreateProjectDto,
  PmPatchTaskStatusDto,
  PmTasksBatchDto,
  PmCreateHumanGateDto,
  PmResolveHumanGateDto,
  PmAppendAuditDto,
} from './dto/pm.dto';

describe('Pm DTOs (class-validator)', () => {
  it('PmCreateProjectDto rejects missing slug', async () => {
    const o = plainToInstance(PmCreateProjectDto, { name: 'N' });
    const errs = await validate(o);
    expect(errs.some((e) => e.property === 'slug')).toBe(true);
  });

  it('PmCreateProjectDto accepts valid payload', async () => {
    const o = plainToInstance(PmCreateProjectDto, { slug: 'my-app', name: 'My App' });
    const errs = await validate(o);
    expect(errs).toHaveLength(0);
  });

  it('PmPatchTaskStatusDto requires status', async () => {
    const o = plainToInstance(PmPatchTaskStatusDto, {});
    const errs = await validate(o);
    expect(errs.some((e) => e.property === 'status')).toBe(true);
  });

  it('PmTasksBatchDto rejects invalid project_id uuid', async () => {
    const o = plainToInstance(PmTasksBatchDto, {
      project_id: 'not-a-uuid',
      tasks: [],
      dependencies: [],
    });
    const errs = await validate(o);
    expect(errs.some((e) => e.property === 'project_id')).toBe(true);
  });

  it('PmTasksBatchDto accepts minimal valid batch', async () => {
    const o = plainToInstance(PmTasksBatchDto, {
      project_id: '11111111-1111-4111-8111-111111111111',
      tasks: [
        {
          id: 'p-a-1',
          phase: 0,
          title: 'T',
          description: 'D',
          actor_tier: 'HUMAN',
          domain: 'PLANNING',
          complexity: 'LOW',
        },
      ],
      dependencies: [],
    });
    const errs = await validate(o);
    expect(errs).toHaveLength(0);
  });

  it('PmCreateHumanGateDto requires decision_options array', async () => {
    const o = plainToInstance(PmCreateHumanGateDto, {
      project_id: '11111111-1111-4111-8111-111111111111',
      gate_type: 'GENERAL',
      context_summary: 'Hi',
    });
    const errs = await validate(o);
    expect(errs.some((e) => e.property === 'decision_options')).toBe(true);
  });

  it('PmResolveHumanGateDto requires decision', async () => {
    const o = plainToInstance(PmResolveHumanGateDto, {});
    const errs = await validate(o);
    expect(errs.some((e) => e.property === 'decision')).toBe(true);
  });

  it('PmAppendAuditDto requires event_type', async () => {
    const o = plainToInstance(PmAppendAuditDto, {});
    const errs = await validate(o);
    expect(errs.some((e) => e.property === 'event_type')).toBe(true);
  });

  it('PmTasksBatchDto rejects phase out of 0–8 range', async () => {
    const o = plainToInstance(PmTasksBatchDto, {
      project_id: '11111111-1111-4111-8111-111111111111',
      tasks: [
        {
          id: 'x',
          phase: 9,
          title: 't',
          description: 'd',
          actor_tier: 'HUMAN',
          domain: 'PLANNING',
          complexity: 'LOW',
        },
      ],
      dependencies: [],
    });
    const errs = flattenErrors(await validate(o));
    expect(errs.some((e) => e.property === 'phase')).toBe(true);
  });
});
