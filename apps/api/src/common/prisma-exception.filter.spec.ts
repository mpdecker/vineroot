import { HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaClientExceptionFilter } from './prisma-exception.filter';

describe('PrismaClientExceptionFilter', () => {
  const prev = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = prev;
  });

  function mockHost() {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const res = { status };
    const req = { url: '/test' };
    return {
      res,
      json,
      status,
      host: {
        switchToHttp: () => ({
          getResponse: () => res,
          getRequest: () => req,
        }),
      },
    };
  }

  it('maps P2002 to 409', () => {
    process.env.NODE_ENV = 'production';
    const { host, status, json } = mockHost();
    const err = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 't',
    });
    new PrismaClientExceptionFilter().catch(err, host as any);
    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json.mock.calls[0][0].message).toMatch(/already exists/);
  });

  it('maps validation error to 400', () => {
    process.env.NODE_ENV = 'production';
    const { host, status } = mockHost();
    const err = new Prisma.PrismaClientValidationError('bad', { clientVersion: 't' });
    new PrismaClientExceptionFilter().catch(err, host as any);
    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
  });
});
