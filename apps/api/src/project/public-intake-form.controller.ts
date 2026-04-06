import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type {
  PublicProjectIntakeFormDto,
  SubmitProjectIntakeFormRequest,
} from '@vineroot/shared-types';
import { ProjectIntakeFormService } from './project-intake-form.service';

/** Unauthenticated intake form (token in URL). */
@Controller('api/v1/public/intake-forms')
@UseGuards(ThrottlerGuard)
export class PublicIntakeFormController {
  constructor(private intakeFormService: ProjectIntakeFormService) {}

  @Get(':token')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async getForm(@Param('token') token: string): Promise<PublicProjectIntakeFormDto> {
    return this.intakeFormService.getPublicByToken(token.trim());
  }

  @Post(':token/submit')
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @HttpCode(201)
  async submit(
    @Param('token') token: string,
    @Body() body: SubmitProjectIntakeFormRequest,
  ): Promise<{ success: true }> {
    if (!body || typeof body.values !== 'object' || body.values === null) {
      throw new BadRequestException('values object is required');
    }
    const values: Record<string, string> = {};
    for (const [k, v] of Object.entries(body.values)) {
      values[k] = v == null ? '' : String(v);
    }
    const captchaToken =
      typeof body.captchaToken === 'string' ? body.captchaToken : undefined;
    return this.intakeFormService.submitPublic(token.trim(), values, captchaToken);
  }
}
