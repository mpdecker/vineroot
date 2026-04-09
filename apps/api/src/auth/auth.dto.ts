import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  /** Must belong to a workspace the user is a member of; null clears. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  workCalendarId?: string | null;

  /** Hourly rate for EVM / cost roll-up when assigned to tasks; null clears. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  resourceStandardRatePerHour?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  resourceOvertimeRatePerHour?: number | null;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
