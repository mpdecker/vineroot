import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Optional Google reCAPTCHA verification for public intake submit. */
@Injectable()
export class IntakeRecaptchaService {
  constructor(private readonly config: ConfigService) {}

  /** Public site key returned on GET form (safe to expose). */
  siteKey(): string | undefined {
    const k = this.config.get<string>('INTAKE_RECAPTCHA_SITE_KEY')?.trim();
    return k || undefined;
  }

  private secret(): string | undefined {
    const k = this.config.get<string>('INTAKE_RECAPTCHA_SECRET')?.trim();
    return k || undefined;
  }

  isVerificationRequired(): boolean {
    return Boolean(this.secret());
  }

  /**
   * No-op when secret unset. With secret set, requires a token and calls Google's siteverify.
   * Supports v2 (success only) and v3 (score ≥ 0.5 when score present).
   */
  async verifyOptional(token: string | undefined): Promise<void> {
    const secret = this.secret();
    if (!secret) return;

    const t = token?.trim();
    if (!t) {
      throw new BadRequestException('Captcha verification required');
    }

    const body = new URLSearchParams({ secret, response: t });
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(10000),
    });

    const data = (await res.json()) as {
      success?: boolean;
      score?: number;
      'error-codes'?: string[];
    };

    if (!data.success) {
      throw new BadRequestException('Captcha verification failed');
    }

    if (typeof data.score === 'number' && data.score < 0.5) {
      throw new BadRequestException('Captcha verification failed');
    }
  }
}
