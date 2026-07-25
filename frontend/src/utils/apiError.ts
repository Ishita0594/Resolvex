import { ApiError } from '../api/client';
import type { ErrorStateVariant } from '../components/common/ErrorState';

export function resolveApiError(err: unknown, fallbackMessage: string): { message: string; variant: ErrorStateVariant } {
  if (err instanceof ApiError) {
    if (err.statusCode === 404) {
      return { message: err.message, variant: 'not-found' };
    }
    if (err.statusCode === 403) {
      return { message: err.message, variant: 'unauthorized' };
    }
    return { message: err.message, variant: 'error' };
  }
  return { message: fallbackMessage, variant: 'error' };
}
