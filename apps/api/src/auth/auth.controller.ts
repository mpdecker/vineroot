import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  UseGuards,
  Request,
  NotFoundException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards';
import {
  LoginRequest,
  RegisterRequest,
  RefreshTokenRequest,
  AuthResponse,
  AuthUser,
  UserDto,
} from '@vineroot/shared-types';
import { UpdateProfileDto, ChangePasswordDto } from './auth.dto';

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
      throw new NotFoundException('User not found');
    }
    return user;
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Request() req: any,
    @Body() body: UpdateProfileDto,
  ): Promise<UserDto> {
    return this.authService.updateProfile(req.user.userId, body);
  }

  @Post('me/password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Request() req: any,
    @Body() body: ChangePasswordDto,
  ): Promise<{ success: boolean }> {
    return this.authService.changePassword(
      req.user.userId,
      body.currentPassword,
      body.newPassword,
    );
  }
}
