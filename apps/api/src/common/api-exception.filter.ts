import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : undefined;
    const detail = typeof exceptionResponse === 'object' && exceptionResponse !== null ? exceptionResponse as Record<string, unknown> : undefined;
    const rawMessage = detail?.message ?? (exception instanceof Error ? exception.message : 'Unexpected server error.');
    const message = Array.isArray(rawMessage) ? rawMessage.join(', ') : String(rawMessage);
    const code = typeof detail?.code === 'string' ? detail.code : this.statusCodeToCode(status);

    if (status >= 500) {
      this.logger.error(JSON.stringify({ requestId: request.requestId, method: request.method, path: request.url, status, message }));
    }

    response.status(status).json({
      success: false,
      error: {
        code,
        message: status >= 500 && process.env.NODE_ENV === 'production' ? 'An unexpected error occurred.' : message,
        ...(Array.isArray(rawMessage) ? { details: rawMessage } : {}),
      },
    });
  }

  private statusCodeToCode(status: number) {
    const codes: Record<number, string> = {
      400: 'VALIDATION_ERROR', 401: 'UNAUTHORIZED', 403: 'FORBIDDEN', 404: 'NOT_FOUND',
      409: 'CONFLICT', 429: 'RATE_LIMITED', 500: 'INTERNAL_SERVER_ERROR',
    };
    return codes[status] ?? `HTTP_${status}`;
  }
}
