import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const WIDGET_TYPES = [
  'TASKS_BY_STATUS',
  'PROJECT_SUMMARY',
  'PROJECT_CFD',
  'PROJECT_EVM',
  'PORTFOLIO_ACTIVE_SPRINTS',
  'PORTFOLIO_SPRINT_VELOCITY',
  'NUMBER_METRIC',
  'AGENT_SLOT',
  'TEXT_NOTE',
] as const;

export class CreateDashboardFromTemplateBodyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  templateId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;
}

export class DuplicateDashboardBodyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;
}

export class ApplyDashboardLayoutPresetBodyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  presetId!: string;
}

export class CreateDashboardWidgetBodyDto {
  @IsString()
  @IsIn([...WIDGET_TYPES])
  type!: (typeof WIDGET_TYPES)[number];

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(11)
  gridX?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(99)
  gridY?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  gridW?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  gridH?: number;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class UpdateDashboardWidgetBodyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(11)
  gridX?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(99)
  gridY?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  gridW?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  gridH?: number;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
