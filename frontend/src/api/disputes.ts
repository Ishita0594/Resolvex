import { apiClient } from './client';
import type { AuditLogEntry, DisputeCase, ReasonCode, TimelineEvent } from '../types/domain';

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

/** Unlike /timeline (card-member only), /audit-log is readable by card members, merchants, and analysts. */
export async function getCaseAuditLog(caseId: string): Promise<AuditLogEntry[]> {
  const response = await apiClient.get<AuditLogEntry[]>(`/disputes/${caseId}/audit-log`);
  return response.data;
}

export async function createDispute(payload: CreateDisputePayload): Promise<DisputeCase> {
  const response = await apiClient.post<DisputeCase>('/disputes', payload);
  return response.data;
}
