import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PublicUser } from '../users/public-user.type';
import { UserRole } from '../users/user-role.enum';

export type AuditLogResponse = {
  id: string;
  caseId: string | null;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  previousValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  createdAt: string;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    caseId?: string | null;
    userId?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    previousValue?: Prisma.InputJsonValue | null;
    newValue?: Prisma.InputJsonValue | null;
    ipAddress?: string | null;
  }): Promise<AuditLogResponse> {
    const auditLog = await this.prisma.auditLog.create({
      data: {
        caseId: data.caseId ?? null,
        userId: data.userId ?? null,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        previousValue: data.previousValue ?? Prisma.JsonNull,
        newValue: data.newValue ?? Prisma.JsonNull,
        ipAddress: data.ipAddress ?? null,
      },
    });

    return serializeAuditLog(auditLog);
  }

  async findForCase(
    caseId: string,
    user: PublicUser,
  ): Promise<AuditLogResponse[]> {
    await this.assertCanReadCase(caseId, user);

    const auditLogs = await this.prisma.auditLog.findMany({
      where: { caseId },
      orderBy: { createdAt: 'asc' },
    });

    return auditLogs.map(serializeAuditLog);
  }

  private async assertCanReadCase(
    caseId: string,
    user: PublicUser,
  ): Promise<void> {
    const where: Prisma.DisputeCaseWhereInput = { id: caseId };

    if (user.role === UserRole.CARD_MEMBER) {
      where.cardMemberId = user.id;
    } else if (user.role === UserRole.MERCHANT) {
      where.merchantId = user.id;
    } else if (user.role !== UserRole.ANALYST) {
      throw new NotFoundException('Dispute case not found');
    }

    const disputeCase = await this.prisma.disputeCase.findFirst({
      where,
      select: { id: true },
    });

    if (!disputeCase) {
      throw new NotFoundException('Dispute case not found');
    }
  }
}

function serializeAuditLog(auditLog: {
  id: string;
  caseId: string | null;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  previousValue: Prisma.JsonValue | null;
  newValue: Prisma.JsonValue | null;
  ipAddress: string | null;
  createdAt: Date;
}): AuditLogResponse {
  return {
    id: auditLog.id,
    caseId: auditLog.caseId,
    userId: auditLog.userId,
    action: auditLog.action,
    entityType: auditLog.entityType,
    entityId: auditLog.entityId,
    previousValue: auditLog.previousValue,
    newValue: auditLog.newValue,
    ipAddress: auditLog.ipAddress,
    createdAt: auditLog.createdAt.toISOString(),
  };
}
