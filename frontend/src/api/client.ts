import axios, { AxiosError } from 'axios';
import { clearStoredToken, getStoredToken } from '../auth/tokenStorage';
import type { ApiErrorBody } from '../types/domain';

export const SESSION_EXPIRED_EVENT = 'resolvex:session-expired';

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';

export const apiClient = axios.create({
  baseURL,
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
  (response) => response,
  (error: AxiosError<ApiErrorBody>) => {
    if (error.response?.status === 401 && !isAuthEndpoint(error.config?.url)) {
      clearStoredToken();
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }
    return Promise.reject(normalizeApiError(error));
  },
);

function isAuthEndpoint(url?: string): boolean {
  return Boolean(url && /\/auth\/(login|register)$/.test(url));
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly error: string;
  readonly requestId?: string;

  constructor(body: ApiErrorBody) {
    super(Array.isArray(body.message) ? body.message.join(' ') : body.message);
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
