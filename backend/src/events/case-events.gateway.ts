import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

export type CaseEventName =
  | 'case.status.updated'
  | 'evidence.processing.completed'
  | 'merchant.response.received'
  | 'analyst.review.required'
  | 'decision.generated'
  | 'information.requested';

export type SafeCaseEventPayload = {
  caseId: string;
  newStatus?: string;
  title?: string;
  message?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

type SocketAuthPayload = {
  sub?: string;
};

@Injectable()
@WebSocketGateway({
  namespace: 'case-events',
  cors: { origin: '*' },
})
export class CaseEventsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CaseEventsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      const payload =
        await this.jwtService.verifyAsync<SocketAuthPayload>(token);

      if (!payload.sub) {
        throw new UnauthorizedException('Invalid socket token');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, role: true },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid socket user');
      }

      client.data.user = user;
      await client.join(userRoom(user.id));
    } catch (error) {
      this.logger.warn(
        `Rejected websocket connection: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      client.disconnect(true);
    }
  }

  @SubscribeMessage('case.subscribe')
  async subscribeToCase(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { caseId?: string },
  ) {
    const user = client.data.user as { id: string; role: Role } | undefined;
    if (!user || !body.caseId) {
      throw new WsException('Unauthorized');
    }

    if (!(await this.canAccessCase(body.caseId, user))) {
      throw new WsException('Case not found');
    }

    await client.join(caseUserRoom(body.caseId, user.id));
    return { caseId: body.caseId, subscribed: true };
  }

  async emitCaseEvent(
    caseId: string,
    eventName: CaseEventName,
    payload: SafeCaseEventPayload,
  ): Promise<string[]> {
    try {
      if (!this.server) {
        return [];
      }

      const recipients = await this.caseRecipientUserIds(caseId);
      const safePayload = this.safePayload(caseId, payload);

      for (const userId of recipients) {
        this.server.to(userRoom(userId)).emit(eventName, safePayload);
        this.server.to(caseUserRoom(caseId, userId)).emit(eventName, safePayload);
      }

      return recipients;
    } catch (error) {
      this.logger.warn(
        `Failed to emit ${eventName} for case ${caseId}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return [];
    }
  }

  private async caseRecipientUserIds(caseId: string): Promise<string[]> {
    const disputeCase = await this.prisma.disputeCase.findUnique({
      where: { id: caseId },
      select: {
        cardMemberId: true,
        merchantId: true,
      },
    });

    if (!disputeCase) {
      return [];
    }

    const analysts = await this.prisma.user.findMany({
      where: { role: Role.ANALYST },
      select: { id: true },
    });

    return Array.from(
      new Set([
        disputeCase.cardMemberId,
        disputeCase.merchantId,
        ...analysts.map((user) => user.id),
      ]),
    );
  }

  private async canAccessCase(
    caseId: string,
    user: { id: string; role: Role },
  ): Promise<boolean> {
    const disputeCase = await this.prisma.disputeCase.findFirst({
      where: {
        id: caseId,
        OR:
          user.role === Role.ANALYST
            ? undefined
            : [{ cardMemberId: user.id }, { merchantId: user.id }],
      },
      select: { id: true },
    });

    return Boolean(disputeCase);
  }

  private safePayload(
    caseId: string,
    payload: SafeCaseEventPayload,
  ): SafeCaseEventPayload {
    return {
      caseId,
      newStatus: payload.newStatus,
      title: payload.title,
      message: payload.message,
      metadata: payload.metadata,
    };
  }

  private extractToken(client: Socket): string {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken;
    }

    const authorization = client.handshake.headers.authorization;
    if (
      typeof authorization === 'string' &&
      authorization.startsWith('Bearer ')
    ) {
      return authorization.slice('Bearer '.length);
    }

    throw new UnauthorizedException('Missing socket token');
  }
}

function userRoom(userId: string): string {
  return `user:${userId}`;
}

function caseUserRoom(caseId: string, userId: string): string {
  return `case:${caseId}:user:${userId}`;
}
