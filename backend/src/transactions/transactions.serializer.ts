import { Transaction } from '@prisma/client';

export type TransactionResponse = {
  id: string;
  merchantId: string;
  merchantName: string;
  amount: string;
  currency: string;
  transactionDate: string;
  status: string;
  maskedCardLast4: string;
  createdAt: string;
  updatedAt: string;
};

export function serializeTransaction(transaction: Transaction): TransactionResponse {
  return {
    id: transaction.id,
    merchantId: transaction.merchantId,
    merchantName: transaction.merchantName,
    amount: transaction.amount.toString(),
    currency: transaction.currency,
    transactionDate: transaction.transactionDate.toISOString(),
    status: transaction.status,
    maskedCardLast4: transaction.maskedCardLast4,
    createdAt: transaction.createdAt.toISOString(),
    updatedAt: transaction.updatedAt.toISOString(),
  };
}
