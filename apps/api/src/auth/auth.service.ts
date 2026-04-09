import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma.service';
import {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  UserDto,
  RefreshTokenRequest,
  AuthUser,
  WorkspaceRole,
  ActorTier,
} from '@vineroot/shared-types';
import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(req: RegisterRequest): Promise<AuthResponse> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: req.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(req.password, 10);
    const workspaceSlug = (req.workspaceName || req.email.split('@')[0])
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-');

    const user = await this.prisma.user.create({
      data: {
        email: req.email,
        passwordHash: hashedPassword,
        displayName: req.displayName,
      },
    });

    const workspace = await this.prisma.workspace.create({
      data: {
        name: req.workspaceName || `${req.displayName}'s Workspace`,
        slug: `${workspaceSlug}-${randomBytes(4).toString('hex')}`,
        members: {
          create: {
            userId: user.id,
            role: 'OWNER',
          },
        },
      },
    });

    return this.generateAuthResponse(user, workspace.id);
  }

  async login(req: LoginRequest): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: req.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(req.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const membership = await this.prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      include: { workspace: true },
    });

    if (!membership) {
      throw new UnauthorizedException('User has no workspace membership');
    }

    return this.generateAuthResponse(user, membership.workspaceId);
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<UserDto | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return null;
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      return null;
    }

    return this.userToDto(user);
  }

  async refreshToken(req: RefreshTokenRequest): Promise<AuthResponse> {
    try {
      const payload = this.jwtService.verify(req.refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
      });

      const refreshToken = await this.prisma.refreshToken.findUnique({
        where: { token: req.refreshToken },
        include: { user: true },
      });

      if (!refreshToken || refreshToken.expiresAt < new Date()) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      const user = refreshToken.user;
      const membership = await this.prisma.workspaceMember.findFirst({
        where: { userId: user.id },
      });

      if (!membership) {
        throw new UnauthorizedException('User has no workspace membership');
      }

      return this.generateAuthResponse(user, membership.workspaceId);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  async updateProfile(
    userId: string,
    req: {
      displayName?: string;
      timezone?: string;
      workCalendarId?: string | null;
      resourceStandardRatePerHour?: number | null;
      resourceOvertimeRatePerHour?: number | null;
    },
  ): Promise<UserDto> {
    const data: {
      displayName?: string;
      timezone?: string;
      workCalendarId?: string | null;
      resourceStandardRatePerHour?: Prisma.Decimal | null;
      resourceOvertimeRatePerHour?: Prisma.Decimal | null;
    } = {};
    if (req.displayName !== undefined) data.displayName = req.displayName.trim();
    if (req.timezone !== undefined) data.timezone = req.timezone.trim();

    if (req.workCalendarId !== undefined) {
      if (req.workCalendarId === null) {
        data.workCalendarId = null;
      } else {
        const cal = await this.prisma.workCalendar.findFirst({
          where: {
            id: req.workCalendarId,
            workspace: { members: { some: { userId } } },
          },
        });
        if (!cal) {
          throw new BadRequestException(
            'workCalendarId must be a calendar in a workspace you belong to',
          );
        }
        data.workCalendarId = cal.id;
      }
    }

    if (req.resourceStandardRatePerHour !== undefined) {
      data.resourceStandardRatePerHour =
        req.resourceStandardRatePerHour === null
          ? null
          : new Prisma.Decimal(req.resourceStandardRatePerHour);
    }
    if (req.resourceOvertimeRatePerHour !== undefined) {
      data.resourceOvertimeRatePerHour =
        req.resourceOvertimeRatePerHour === null
          ? null
          : new Prisma.Decimal(req.resourceOvertimeRatePerHour);
    }

    if (Object.keys(data).length === 0) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new UnauthorizedException();
      return this.userToDto(user);
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
    });
    return this.userToDto(user);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new UnauthorizedException();
    }

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashed },
    });

    return { success: true };
  }

  async getCurrentUser(userId: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        workspaceMembers: {
          include: { workspace: true },
          take: 1,
        },
      },
    });

    if (!user || user.workspaceMembers.length === 0) {
      return null;
    }

    const membership = user.workspaceMembers[0];

    return {
      userId: user.id,
      workspaceId: membership.workspaceId,
      email: user.email,
      displayName: user.displayName,
      role: membership.role as unknown as WorkspaceRole,
      isAgent: user.isAgent,
      agentTier: user.agentTier as unknown as ActorTier | undefined,
    };
  }

  private async generateAuthResponse(
    user: any,
    workspaceId: string,
  ): Promise<AuthResponse> {
    const payload = {
      userId: user.id,
      email: user.email,
      workspaceId,
    };

    const accessToken = this.jwtService.sign(payload);

    const refreshTokenString = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(
      expiresAt.getDate() +
        parseInt(process.env.JWT_REFRESH_EXPIRY || '7' || '7'),
    );

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshTokenString,
        expiresAt,
      },
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
      expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d',
    });

    return {
      accessToken,
      refreshToken,
      user: this.userToDto(user),
    };
  }

  private userToDto(user: any): UserDto {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      isAgent: user.isAgent,
      agentTier: user.agentTier,
      timezone: user.timezone,
      workCalendarId: user.workCalendarId ?? null,
      resourceStandardRatePerHour:
        user.resourceStandardRatePerHour != null
          ? Number(user.resourceStandardRatePerHour)
          : null,
      resourceOvertimeRatePerHour:
        user.resourceOvertimeRatePerHour != null
          ? Number(user.resourceOvertimeRatePerHour)
          : null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
