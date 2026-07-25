import { apiClient } from './client';
import type { DisputeCase, ReasonCode, TimelineEvent } from '../types/domain';

export interface CreateDisputePayload {
  transactionId: string;
  reasonCode: ReasonCode;
  cardMemberStatement: string;
}

export async function listDisputes(): Promise<DisputeCase[]> {
  const response = await apiClient.get<DisputeCase[]>('/disputes');
  return response.data;
}

export async function getDispute(caseId: string): Promise<DisputeCase> {
  const response = await apiClient.get<DisputeCase>(`/disputes/${caseId}`);
  return response.data;
}

export async function getDisputeTimeline(caseId: string): Promise<TimelineEvent[]> {
  const response = await apiClient.get<TimelineEvent[]>(`/disputes/${caseId}/timeline`);
  return response.data;
}

export async function createDispute(payload: CreateDisputePayload): Promise<DisputeCase> {
  const response = await apiClient.post<DisputeCase>('/disputes', payload);
  return response.data;
}
