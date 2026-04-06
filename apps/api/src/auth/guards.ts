import {
  HttpException,
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any) {
    if (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      throw new UnauthorizedException(
        typeof err?.message === 'string' ? err.message : 'Unauthorized',
      );
    }
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}

@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const workspaceId = request.params.workspaceId;

    if (!workspaceId) {
      return true;
    }

    if (!user?.userId) {
      throw new UnauthorizedException();
    }

    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: user.userId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'User does not have access to this workspace',
      );
    }

    request.workspace = membership;
    return true;
  }
}

@Injectable()
export class ProjectGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const projectId = request.params.projectId || request.params.id;

    if (!projectId) {
      return true;
    }

    if (!user?.userId) {
      throw new UnauthorizedException();
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          where: { userId: user.userId },
        },
      },
    });

    if (!project) {
      throw new ForbiddenException('Project not found');
    }

    if (!project.isPrivate === false && project.members.length === 0) {
      throw new ForbiddenException(
        'User does not have access to this project',
      );
    }

    request.project = project;
    return true;
  }
}

@Injectable()
export class WorkspaceAdminGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const workspaceId = request.params.workspaceId;
    const userId = request.user?.userId;

    if (!workspaceId || !userId) {
      throw new ForbiddenException();
    }

    const membership = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });

    if (
      !membership ||
      (membership.role !== 'OWNER' && membership.role !== 'ADMIN')
    ) {
      throw new ForbiddenException(
        'Workspace owner or admin role required for this action',
      );
    }

    return true;
  }
}
