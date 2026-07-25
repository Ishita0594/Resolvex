import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

export function requestIdMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const existingRequestId = request.header(REQUEST_ID_HEADER);
  const requestId =
    existingRequestId && isSafeRequestId(existingRequestId)
      ? existingRequestId
      : randomUUID();

  request.requestId = requestId;
  response.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}

function isSafeRequestId(value: string): boolean {
  return /^[A-Za-z0-9._:-]{8,100}$/.test(value);
}
