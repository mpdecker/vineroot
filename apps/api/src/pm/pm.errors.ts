import { HttpException, HttpStatus } from '@nestjs/common';

export function pmHttpError(
  message: string,
  code: string,
  status: number = HttpStatus.BAD_REQUEST,
): HttpException {
  return new HttpException({ error: message, code }, status);
}
