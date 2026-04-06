import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientValidationError,
)
export class PrismaClientExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaClientExceptionFilter.name);

  catch(
    exception:
      | Prisma.PrismaClientKnownRequestError
      | Prisma.PrismaClientValidationError,
    host: ArgumentsHost,
  ) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<{ url?: string }>();

    if (exception instanceof Prisma.PrismaClientValidationError) {
      this.logger.warn(
        `${req.url ?? ''} PrismaClientValidationError: ${exception.message}`,
      );
      return res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Invalid request data for database operation',
        ...(process.env.NODE_ENV !== 'production' && {
          details: exception.message,
        }),
      });
    }

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Database error';

    switch (exception.code) {
      case 'P2002':
        status = HttpStatus.CONFLICT;
        message = 'A record with this value already exists';
        break;
      case 'P2003':
        status = HttpStatus.BAD_REQUEST;
        message = 'Invalid reference (foreign key constraint failed)';
        break;
      case 'P2021':
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message =
          'Database schema is out of date (missing table). Run: npx prisma migrate deploy';
        break;
      case 'P2022':
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message =
          'Database schema is out of date (missing column). Run: npx prisma migrate deploy';
        break;
      default:
        this.logger.warn(
          `${req.url ?? ''} ${exception.code}: ${exception.message}`,
        );
    }

    return res.status(status).json({
      statusCode: status,
      message,
      code: exception.code,
      ...(process.env.NODE_ENV !== 'production' && {
        prismaMessage: exception.message,
        meta: exception.meta,
      }),
    });
  }
}
