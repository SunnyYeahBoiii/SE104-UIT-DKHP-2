import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'

type MiddlewareRequest = {
  headers: { 'x-request-id'?: string | string[] }
  requestId?: string
}
type MiddlewareResponse = { setHeader(name: string, value: string): void }

/** NFR-09 / issue A.5: every response carries an id, including 500s. */
@Injectable()
export class RequestIdMiddleware {
  use(req: MiddlewareRequest, res: MiddlewareResponse, next: () => void): void {
    const header = req.headers['x-request-id']
    req.requestId = (Array.isArray(header) ? header[0] : header) || randomUUID()
    res.setHeader('X-Request-Id', req.requestId)
    next()
  }
}
