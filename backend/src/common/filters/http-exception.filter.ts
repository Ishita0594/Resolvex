import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

type ErrorResponseBody = {
  error?: string;
  message?: string | string[];
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;

    const body =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as ErrorResponseBody)
        : undefined;

    response.status(statusCode).json({
      statusCode,
      error: body?.error ?? this.toErrorLabel(statusCode),
      message:
        body?.message ??
        (typeof exceptionResponse === 'string'
          ? exceptionResponse
          : 'Internal server error'),
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId: request.requestId,
    });
  }

  private toErrorLabel(statusCode: number): string {
    const statusName = HttpStatus[statusCode];

    if (!statusName) {
      return 'Error';
    }

    return statusName
      .toLowerCase()
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
