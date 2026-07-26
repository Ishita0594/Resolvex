import axios, { AxiosError } from 'axios';
import { clearStoredToken, getStoredToken } from '../auth/tokenStorage';
import { API_BASE_URL } from '../config/env';
import type { ApiErrorBody } from '../types/domain';

export const SESSION_EXPIRED_EVENT = 'resolvex:session-expired';
export const API_UNAVAILABLE_EVENT = 'resolvex:api-unavailable';
export const API_AVAILABLE_EVENT = 'resolvex:api-available';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
});

apiClient.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    window.dispatchEvent(new CustomEvent(API_AVAILABLE_EVENT));
    return response;
  },
  (error: AxiosError<ApiErrorBody>) => {
    if (error.response?.status === 401 && !isAuthEndpoint(error.config?.url)) {
      clearStoredToken();
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }
    const normalized = normalizeApiError(error);
    if (!error.response) {
      window.dispatchEvent(new CustomEvent(API_UNAVAILABLE_EVENT));
    } else {
      window.dispatchEvent(new CustomEvent(API_AVAILABLE_EVENT));
    }
    return Promise.reject(normalized);
  },
);

function isAuthEndpoint(url?: string): boolean {
  return Boolean(url && /\/auth\/(login|register)$/.test(url));
}

const MAX_MESSAGE_LENGTH = 300;

/**
 * Defends the UI against ever rendering a raw backend stack trace: only the first
 * line of whatever the server sent is shown, capped to a sane length. Legitimate
 * validation/business messages are always single short lines, so this is a no-op
 * for them.
 */
function sanitizeErrorMessage(message: string): string {
  const firstLine = message.split('\n')[0].trim();
  const safe = firstLine.length > 0 ? firstLine : 'An unexpected error occurred.';
  return safe.length > MAX_MESSAGE_LENGTH ? `${safe.slice(0, MAX_MESSAGE_LENGTH)}…` : safe;
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly error: string;
  readonly requestId?: string;

  constructor(body: ApiErrorBody) {
    super(sanitizeErrorMessage(Array.isArray(body.message) ? body.message.join(' ') : body.message));
    this.statusCode = body.statusCode;
    this.error = body.error;
    this.requestId = body.requestId;
  }
}

function normalizeApiError(error: AxiosError<ApiErrorBody>): ApiError {
  if (error.response?.data?.statusCode) {
    return new ApiError(error.response.data);
  }

  return new ApiError({
    statusCode: error.response?.status ?? 0,
    error: error.code ?? 'NETWORK_ERROR',
    message: error.message || 'Unable to reach the ResolveX server. Check your connection and try again.',
    timestamp: new Date().toISOString(),
    path: error.config?.url ?? '',
  });
}
