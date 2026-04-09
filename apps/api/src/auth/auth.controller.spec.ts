import { Test } from '@nestjs/testing';
import { INestApplication, CanActivate, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards';

describe('AuthController (HTTP)', () => {
  let app: INestApplication;
  const authService = {
    register: jest.fn(),
    login: jest.fn(),
    refreshToken: jest.fn(),
    logout: jest.fn(),
    getCurrentUser: jest.fn(),
    updateProfile: jest.fn(),
    changePassword: jest.fn(),
  };

  const allowGuard: CanActivate = {
    canActivate: (context) => {
      const req = context.switchToHttp().getRequest();
      req.user = { userId: 'user-1' };
      return true;
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(allowGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /api/v1/auth/register forwards body', async () => {
    const res = { accessToken: 'a', refreshToken: 'r' };
    authService.register.mockResolvedValue(res);

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'a@b.com', password: 'x', displayName: 'A' })
      .expect(201)
      .expect(res);

    expect(authService.register).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'x',
      displayName: 'A',
    });
  });

  it('POST /api/v1/auth/login forwards body', async () => {
    authService.login.mockResolvedValue({ accessToken: 'a' });

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'a@b.com', password: 'secret' })
      .expect(201);

    expect(authService.login).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'secret',
    });
  });

  it('POST /api/v1/auth/refresh forwards body', async () => {
    authService.refreshToken.mockResolvedValue({ accessToken: 'new' });

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'old' })
      .expect(201);

    expect(authService.refreshToken).toHaveBeenCalledWith({ refreshToken: 'old' });
  });

  it('POST /api/v1/auth/logout calls service with user id', async () => {
    authService.logout.mockResolvedValue(undefined);

    await request(app.getHttpServer()).post('/api/v1/auth/logout').expect(201);

    expect(authService.logout).toHaveBeenCalledWith('user-1');
  });

  it('GET /api/v1/auth/me returns user when found', async () => {
    authService.getCurrentUser.mockResolvedValue({
      id: 'user-1',
      email: 'a@b.com',
      displayName: 'A',
    });

    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(200);
    expect(authService.getCurrentUser).toHaveBeenCalledWith('user-1');
  });

  it('PATCH /api/v1/auth/me forwards body to updateProfile', async () => {
    authService.updateProfile.mockResolvedValue({
      id: 'user-1',
      email: 'a@b.com',
      displayName: 'Renamed',
      isAgent: false,
      timezone: 'UTC',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await request(app.getHttpServer())
      .patch('/api/v1/auth/me')
      .send({ displayName: 'Renamed' })
      .expect(200);

    expect(authService.updateProfile).toHaveBeenCalledWith('user-1', {
      displayName: 'Renamed',
    });
  });

  it('POST /api/v1/auth/me/password forwards to changePassword', async () => {
    authService.changePassword.mockResolvedValue({ success: true });

    await request(app.getHttpServer())
      .post('/api/v1/auth/me/password')
      .send({ currentPassword: 'old', newPassword: 'newpass1234' })
      .expect(201);

    expect(authService.changePassword).toHaveBeenCalledWith(
      'user-1',
      'old',
      'newpass1234',
    );
  });

  it('POST /api/v1/auth/me/password returns 400 when new password too short', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/me/password')
      .send({ currentPassword: 'old', newPassword: 'short' })
      .expect(400);

    expect(authService.changePassword).not.toHaveBeenCalled();
  });
});
