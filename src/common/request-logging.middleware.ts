import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

type AuthedRequest = Request & {
  requestId?: string;
  user?: { id?: string };
};

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: AuthedRequest, res: Response, next: NextFunction) {
    const incoming = req.headers['x-request-id'];
    const requestId =
      (typeof incoming === 'string' && incoming.trim()) || randomUUID();

    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    const started = Date.now();
    res.on('finish', () => {
      const userId = req.user?.id ?? null;
      this.logger.log(
        JSON.stringify({
          requestId,
          method: req.method,
          path: req.originalUrl || req.url,
          statusCode: res.statusCode,
          durationMs: Date.now() - started,
          userId,
        }),
      );
    });

    next();
  }
}
