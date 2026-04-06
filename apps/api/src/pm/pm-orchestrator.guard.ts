import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class PmOrchestratorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const secret = process.env.PM_ORCHESTRATOR_SECRET;
    if (!secret) {
      throw new UnauthorizedException({
        error: 'PM orchestrator is not configured',
        code: 'PM_NOT_CONFIGURED',
      });
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization as string | undefined;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        error: 'Missing or invalid authorization header',
        code: 'UNAUTHORIZED',
      });
    }

    const token = authHeader.substring(7);
    if (token !== secret) {
      throw new UnauthorizedException({
        error: 'Invalid orchestrator token',
        code: 'UNAUTHORIZED',
      });
    }

    return true;
  }
}
