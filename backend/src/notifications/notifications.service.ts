import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PublicUser } from '../users/public-user.type';

export type NotificationResponse = {
  id: string;
  userId: string;
  caseId: string | null;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(user: PublicUser): Promise<NotificationResponse[]> {
    const notifications = await this.prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    return notifications.map(serializeNotification);
  }

  async markRead(
    notificationId: string,
    user: PublicUser,
  ): Promise<NotificationResponse> {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId: user.id,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    const updated = await this.prisma.notification.update({
      where: { id: notification.id },
      data: { isRead: true },
    });

    return serializeNotification(updated);
  }

  async markAllRead(user: PublicUser): Promise<{ updatedCount: number }> {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId: user.id,
        isRead: false,
      },
      data: { isRead: true },
    });

    return { updatedCount: result.count };
  }

  async createForUsers(
    userIds: string[],
    data: {
      caseId?: string | null;
      title: string;
      message: string;
      type: string;
    },
  ): Promise<void> {
    const uniqueUserIds = Array.from(new Set(userIds));

    if (uniqueUserIds.length === 0) {
      return;
    }

    await this.prisma.notification.createMany({
      data: uniqueUserIds.map((userId) => ({
        userId,
        caseId: data.caseId ?? null,
        title: data.title,
        message: data.message,
        type: data.type,
      })),
    });
  }
}

function serializeNotification(notification: {
  id: string;
  userId: string;
  caseId: string | null;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: Date;
}): NotificationResponse {
  return {
    id: notification.id,
    userId: notification.userId,
    caseId: notification.caseId,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    isRead: notification.isRead,
    createdAt: notification.createdAt.toISOString(),
  };
}
