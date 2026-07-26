import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CaseStatus as PrismaCaseStatus,
  Prisma,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import {
  DisputeCaseResponse,
  serializeDisputeCase,
  serializeTimelineEvent,
  TimelineEventResponse,
} from './disputes.serializer';

@Injectable()
export class DisputesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async createForCardMember(
    cardMemberId: string,
    createDisputeDto: CreateDisputeDto,
  ): Promise<DisputeCaseResponse> {
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        id: createDisputeDto.transactionId,
        cardMemberId,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const activeDispute = await this.prisma.disputeCase.findFirst({
      where: {
        transactionId: transaction.id,
        status: { not: PrismaCaseStatus.CLOSED },
      },
    });

    if (activeDispute) {
      throw new ConflictException('An active dispute already exists for this transaction');
    }

    const responseDeadline = this.buildResponseDeadline();

    try {
      const disputeCase = await this.prisma.$transaction(async (tx) => {
        const createdCase = await tx.disputeCase.create({
          data: {
            transactionId: transaction.id,
            cardMemberId,
            merchantId: transaction.merchantId,
            reasonCode: createDisputeDto.reasonCode,
            cardMemberStatement: createDisputeDto.cardMemberStatement,
            status: PrismaCaseStatus.AWAITING_MERCHANT,
            responseDeadline,
          },
        });

        await tx.timelineEvent.create({
          data: {
            caseId: createdCase.id,
            eventType: 'CASE_SUBMITTED',
            description: 'Card member submitted the dispute.',
            performedBy: cardMemberId,
            metadata: {
              status: PrismaCaseStatus.SUBMITTED,
              reasonCode: createDisputeDto.reasonCode,
            },
          },
        });

        await tx.timelineEvent.create({
          data: {
            caseId: createdCase.id,
            eventType: 'AWAITING_MERCHANT_RESPONSE',
            description: 'ResolveX requested merchant evidence for the dispute.',
            performedBy: null,
            metadata: {
              status: PrismaCaseStatus.AWAITING_MERCHANT,
              responseDeadline: responseDeadline.toISOString(),
            },
          },
        });

        return tx.disputeCase.findUniqueOrThrow({
          where: { id: createdCase.id },
          include: { transaction: true },
        });
      });

      return serializeDisputeCase(disputeCase);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('An active dispute already exists for this transaction');
      }

      throw error;
    }
  }

  async findForCardMember(cardMemberId: string): Promise<DisputeCaseResponse[]> {
    const disputeCases = await this.prisma.disputeCase.findMany({
      where: { cardMemberId },
      include: { transaction: true },
      orderBy: { createdAt: 'desc' },
    });

    return disputeCases.map(serializeDisputeCase);
  }

  async findOneForCardMember(caseId: string, cardMemberId: string): Promise<DisputeCaseResponse> {
    const disputeCase = await this.prisma.disputeCase.findFirst({
      where: {
        id: caseId,
        cardMemberId,
      },
      include: { transaction: true },
    });

    if (!disputeCase) {
      throw new NotFoundException('Dispute case not found');
    }

    return serializeDisputeCase(disputeCase);
  }

  async findTimelineForCardMember(
    caseId: string,
    cardMemberId: string,
  ): Promise<TimelineEventResponse[]> {
    const disputeCase = await this.prisma.disputeCase.findFirst({
      where: {
        id: caseId,
        cardMemberId,
      },
      select: { id: true },
    });

    if (!disputeCase) {
      throw new NotFoundException('Dispute case not found');
    }

    const timelineEvents = await this.prisma.timelineEvent.findMany({
      where: { caseId },
      orderBy: { createdAt: 'asc' },
    });

    return timelineEvents.map(serializeTimelineEvent);
  }

  private buildResponseDeadline(): Date {
    const responseDays = this.configService.get<number>('DISPUTE_MERCHANT_RESPONSE_DAYS', 7);
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + responseDays);
    return deadline;
  }
}
