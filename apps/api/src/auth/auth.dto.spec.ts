import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateProfileDto, ChangePasswordDto } from './auth.dto';

describe('Auth DTOs (validation)', () => {
  it('ChangePasswordDto rejects new password shorter than 8 chars', async () => {
    const dto = plainToInstance(ChangePasswordDto, {
      currentPassword: 'current',
      newPassword: 'short',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'newPassword')).toBe(true);
  });

  it('ChangePasswordDto accepts valid passwords', async () => {
    const dto = plainToInstance(ChangePasswordDto, {
      currentPassword: 'current',
      newPassword: 'validpass123',
    });
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('UpdateProfileDto allows empty object (optional fields)', async () => {
    const dto = plainToInstance(UpdateProfileDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('UpdateProfileDto rejects empty displayName when provided', async () => {
    const dto = plainToInstance(UpdateProfileDto, { displayName: '' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'displayName')).toBe(true);
  });
});
