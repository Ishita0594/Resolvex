import { apiClient } from './client';
import type { AuthResponse, PublicUser, UserRole } from '../types/domain';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/auth/login', payload);
  return response.data;
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/auth/register', payload);
  return response.data;
}

export async function fetchProfile(): Promise<PublicUser> {
  const response = await apiClient.get<PublicUser>('/auth/profile');
  return response.data;
}
