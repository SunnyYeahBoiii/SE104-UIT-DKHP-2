import {
  ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Injectable,
} from '@nestjs/common'

import type { AuthRequest } from '../auth/auth.guard'

type HttpResponse = {
  status(code: number): { json(body: unknown): void }
}

/** JSON errors with a request id (NFR-09). HttpException bodies pass through unchanged. */
@Injectable()
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp()
    const req = http.getRequest<AuthRequest>()
    const res = http.getResponse<HttpResponse>()
    const requestId = req.requestId ?? 'unknown'

    if (exception instanceof HttpException) {
      const body = exception.getResponse()
      res
        .status(exception.getStatus())
        .json(
          typeof body === 'string'
            ? { code: 'HTTP_ERROR', message: body, requestId }
            : { ...body, requestId },
        )
      return
    }

    console.error(
      JSON.stringify({
        level: 'error',
        requestId,
        message: exception instanceof Error ? exception.message : String(exception),
      }),
    )
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Đã xảy ra lỗi. Vui lòng thử lại và báo mã request nếu tiếp tục xảy ra.',
      requestId,
    })
  }
}
