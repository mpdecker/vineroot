import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards';
import {
  LoginRequest,
  RegisterRequest,
  RefreshTokenRequest,
  AuthResponse,
  AuthUser,
} from '@vineroot/shared-types';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() req: RegisterRequest): Promise<AuthResponse> {
    return this.authService.register(req);
  }

  @Post('login')
  async login(@Body() req: LoginRequest): Promise<AuthResponse> {
    return this.authService.login(req);
  }

  @Post('refresh')
  async refresh(@Body() req: RefreshTokenRequest): Promise<AuthResponse> {
    return this.authService.refreshToken(req);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Request() req: any): Promise<{ success: boolean }> {
    await this.authService.logout(req.user.userId);
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@Request() req: any): Promise<AuthUser> {
    const user = await this.authService.getCurrentUser(req.user.userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }
}
