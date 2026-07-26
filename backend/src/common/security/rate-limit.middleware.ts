import { HttpStatus } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

type RateLimitRule = {
  name: string;
  pathPattern: RegExp;
  windowMs: number;
  maxRequests: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

export function createRateLimitMiddleware(rules: RateLimitRule[]) {
  const buckets = new Map<string, RateLimitBucket>();

  return (request: Request, response: Response, next: NextFunction) => {
    const rule = rules.find((candidate) =>
      candidate.pathPattern.test(request.path),
    );
    if (!rule) {
      next();
      return;
    }

    const now = Date.now();
    const key = `${rule.name}:${clientKey(request)}`;
    const existing = buckets.get(key);
    const bucket =
      existing && existing.resetAt > now
        ? existing
        : { count: 0, resetAt: now + rule.windowMs };

    bucket.count += 1;
    buckets.set(key, bucket);

    response.setHeader('X-RateLimit-Limit', String(rule.maxRequests));
    response.setHeader(
      'X-RateLimit-Remaining',
      String(Math.max(0, rule.maxRequests - bucket.count)),
    );
    response.setHeader(
      'X-RateLimit-Reset',
      String(Math.ceil(bucket.resetAt / 1000)),
    );

    if (bucket.count > rule.maxRequests) {
      response.status(HttpStatus.TOO_MANY_REQUESTS).json({
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message: 'Too many requests. Please retry later.',
        timestamp: new Date().toISOString(),
        path: request.url,
        requestId: request.requestId,
      });
      return;
    }

    next();
  };
}

export function buildDefaultRateLimitRules(input: {
  windowMs: number;
  authMax: number;
  uploadMax: number;
}): RateLimitRule[] {
  return [
    {
      name: 'auth',
      pathPattern: /^\/api\/auth\/(?:login|register)$/,
      windowMs: input.windowMs,
      maxRequests: input.authMax,
    },
    {
      name: 'uploads',
      pathPattern:
        /^\/api\/(?:disputes\/[^/]+\/evidence\/(?:upload-target|confirm)|evidence\/[^/]+\/(?:local-upload|process|retry))$/,
      windowMs: input.windowMs,
      maxRequests: input.uploadMax,
    },
  ];
}

function clientKey(request: Request): string {
  const user = request.user;
  if (
    user &&
    typeof user === 'object' &&
    'id' in user &&
    typeof user.id === 'string'
  ) {
    return user.id;
  }

  return request.ip ?? 'unknown';
}
