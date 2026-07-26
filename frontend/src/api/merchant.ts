import { apiClient } from './client';
import type { DisputeCase, PolicyRequirement } from '../types/domain';

export interface MerchantResponseEvidencePayload {
  requirementKey: string;
  evidenceType: string;
  value?: string;
  metadata?: Record<string, unknown>;
}

export interface MerchantResponsePayload {
  merchantStatement: string;
  evidence: MerchantResponseEvidencePayload[];
}

export async function listMerchantDisputes(): Promise<DisputeCase[]> {
  const response = await apiClient.get<DisputeCase[]>('/merchant/disputes');
  return response.data;
}

export async function getMerchantDispute(caseId: string): Promise<DisputeCase> {
  const response = await apiClient.get<DisputeCase>(`/merchant/disputes/${caseId}`);
  return response.data;
}

export async function getPolicyRequirements(caseId: string): Promise<PolicyRequirement[]> {
  const response = await apiClient.get<PolicyRequirement[]>(`/disputes/${caseId}/requirements`);
  return response.data;
}

export async function submitMerchantResponse(
  caseId: string,
  payload: MerchantResponsePayload,
): Promise<DisputeCase> {
  const response = await apiClient.post<DisputeCase>(`/disputes/${caseId}/merchant-response`, payload);
  return response.data;
}
