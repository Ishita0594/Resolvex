import { apiClient } from './client';
import type { AnalystCaseDetail, AnalystDecisionPayload, AnalystDecisionResult, AnalystQueueCase } from '../types/domain';

export async function listAnalystQueue(): Promise<AnalystQueueCase[]> {
  const response = await apiClient.get<AnalystQueueCase[]>('/analyst/cases');
  return response.data;
}

export async function listRecentlyResolvedCases(): Promise<AnalystQueueCase[]> {
  const response = await apiClient.get<AnalystQueueCase[]>('/analyst/cases/resolved');
  return response.data;
}

export async function getAnalystCase(caseId: string): Promise<AnalystCaseDetail> {
  const response = await apiClient.get<AnalystCaseDetail>(`/analyst/cases/${caseId}`);
  return response.data;
}

export async function submitAnalystDecision(caseId: string, payload: AnalystDecisionPayload): Promise<AnalystDecisionResult> {
  const response = await apiClient.post<AnalystDecisionResult>(`/analyst/cases/${caseId}/decision`, payload);
  return response.data;
}
