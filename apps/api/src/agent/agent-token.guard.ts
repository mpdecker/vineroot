import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AgentService } from './agent.service';

@Injectable()
export class AgentTokenGuard implements CanActivate {
  constructor(private agentService: AgentService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);

    try {
      const agentToken = await this.agentService.validateToken(token);
      request.agentToken = agentToken;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid agent token');
    }
  }
}
