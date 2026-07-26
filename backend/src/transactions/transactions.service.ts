import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { serializeTransaction, TransactionResponse } from './transactions.serializer';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findForCardMember(cardMemberId: string): Promise<TransactionResponse[]> {
    const transactions = await this.prisma.transaction.findMany({
      where: { cardMemberId },
      orderBy: { transactionDate: 'desc' },
    });

    return transactions.map(serializeTransaction);
  }

  async findOneForCardMember(transactionId: string, cardMemberId: string): Promise<TransactionResponse> {
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        id: transactionId,
        cardMemberId,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return serializeTransaction(transaction);
  }
}
