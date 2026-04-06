import {
  IsString,
  IsOptional,
  IsUUID,
  IsInt,
  IsArray,
  ValidateNested,
  Min,
  Max,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PmCreateProjectDto {
  @IsString()
  slug!: string;

  @IsString()
  name!: string;
}

export class PmPatchTaskStatusDto {
  @IsString()
  status!: string;

  @IsOptional()
  @IsString()
  actor?: string;

  @IsOptional()
  @IsString()
  detail?: string;
}

export class PmCreateTaskArtifactDto {
  @IsString()
  artifact_type!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class PmBatchTaskItemDto {
  @IsString()
  id!: string;

  @IsInt()
  @Min(0)
  @Max(8)
  phase!: number;

  @IsOptional()
  @IsString()
  implementation_phase?: string;

  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @IsString()
  actor_tier!: string;

  @IsString()
  domain!: string;

  @IsString()
  complexity!: string;

  @IsOptional()
  @IsInt()
  estimated_minutes?: number;

  @IsOptional()
  @IsInt()
  timeout_minutes?: number;

  @IsOptional()
  @IsString()
  parallel_group?: string | null;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  priority?: number;

  @IsOptional()
  @IsString()
  review_gate?: string;

  @IsOptional()
  @IsArray()
  acceptance_criteria?: unknown[];

  @IsOptional()
  @IsArray()
  context_refs?: unknown[];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class PmBatchDependencyDto {
  @IsString()
  task_id!: string;

  @IsString()
  depends_on_id!: string;
}

export class PmTasksBatchDto {
  @IsUUID()
  project_id!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PmBatchTaskItemDto)
  tasks!: PmBatchTaskItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PmBatchDependencyDto)
  dependencies!: PmBatchDependencyDto[];
}

export class PmCreateHumanGateDto {
  @IsUUID()
  project_id!: string;

  @IsString()
  gate_type!: string;

  @IsOptional()
  @IsString()
  originating_task_id?: string;

  @IsOptional()
  @IsString()
  blocking_task_id?: string;

  @IsString()
  context_summary!: string;

  @IsOptional()
  @IsArray()
  failure_history?: unknown[];

  @IsArray()
  decision_options!: unknown[];

  @IsOptional()
  @IsString()
  recommended_option?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class PmResolveHumanGateDto {
  @IsString()
  decision!: string;

  @IsOptional()
  @IsString()
  decision_notes?: string;
}

export class PmPatchProjectStatusDto {
  @IsString()
  status!: string;
}

export class PmAppendAuditDto {
  @IsOptional()
  @IsUUID()
  project_id?: string;

  @IsOptional()
  @IsString()
  task_id?: string;

  @IsOptional()
  @IsUUID()
  gate_id?: string;

  @IsString()
  event_type!: string;

  @IsOptional()
  @IsString()
  actor?: string;

  @IsOptional()
  @IsString()
  from_value?: string;

  @IsOptional()
  @IsString()
  to_value?: string;

  @IsOptional()
  @IsObject()
  detail?: Record<string, unknown>;
}
