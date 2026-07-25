import { apiClient } from './client';
import type { Transaction } from '../types/domain';

export async function listTransactions(): Promise<Transaction[]> {
  const response = await apiClient.get<Transaction[]>('/transactions');
  return response.data;
}

export async function getTransaction(transactionId: string): Promise<Transaction> {
  const response = await apiClient.get<Transaction>(`/transactions/${transactionId}`);
  return response.data;
}
