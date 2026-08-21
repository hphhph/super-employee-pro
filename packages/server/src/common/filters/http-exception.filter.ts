import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * 全局异常过滤器：
 * - HttpException（业务抛出的 4xx/5xx）→ 透出对应状态码和 message
 * - 其他异常（Prisma 错误、未捕获异常等）→ 统一 500 JSON，避免返回 HTML 错误页
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = '服务器内部错误';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : ((exceptionResponse as any).message ?? message);
    } else {
      const err = exception as any;
      // Prisma 常见错误友好提示
      if (err?.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = `数据已存在（唯一约束冲突）：${err?.meta?.target || ''}`;
      } else if (err?.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = '记录不存在或已被删除';
      } else if (err?.code === 'P2003') {
        status = HttpStatus.BAD_REQUEST;
        message = '操作失败：存在关联数据，无法完成（外键约束）';
      } else if (err instanceof SyntaxError) {
        status = HttpStatus.BAD_REQUEST;
        message = '请求格式错误';
      }
    }

    // 500 级别才记完整堆栈，4xx 只记摘要
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} - ${status} - ${String(message).slice(0, 200)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} - ${status} - ${String(message).slice(0, 200)}`);
    }

    response.status(status).json({
      code: status,
      message: Array.isArray(message) ? message[0] : message,
      data: null,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
