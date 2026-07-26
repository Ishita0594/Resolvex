import { apiClient } from './client';
import type { Notification } from '../types/domain';

export async function listNotifications(): Promise<Notification[]> {
  const response = await apiClient.get<Notification[]>('/notifications');
  return response.data;
}

export async function markNotificationRead(notificationId: string): Promise<Notification> {
  const response = await apiClient.patch<Notification>(`/notifications/${notificationId}/read`);
  return response.data;
}

export async function markAllNotificationsRead(): Promise<{ updatedCount: number }> {
  const response = await apiClient.patch<{ updatedCount: number }>('/notifications/read-all');
  return response.data;
}
