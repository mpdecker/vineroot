import { HttpStatus } from '@nestjs/common';
import { pmHttpError } from './pm.errors';

describe('pmHttpError', () => {
  it('creates HttpException with error and code in body', () => {
    const e = pmHttpError('Bad', 'BAD_CODE', HttpStatus.BAD_REQUEST);
    expect(e.getStatus()).toBe(400);
    expect(e.getResponse()).toEqual({ error: 'Bad', code: 'BAD_CODE' });
  });

  it('defaults to 400 when status omitted', () => {
    const e = pmHttpError('x', 'Y');
    expect(e.getStatus()).toBe(400);
  });
});
