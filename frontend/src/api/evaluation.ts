import { apiClient } from './client';
import type { DecisionRecord, EvidenceMatrixResponse, ExplanationData } from '../types/domain';

export async function runEvaluation(caseId: string): Promise<DecisionRecord> {
  const response = await apiClient.post<DecisionRecord>(`/disputes/${caseId}/evaluate`);
  return response.data;
}

export async function getLatestEvaluation(caseId: string): Promise<DecisionRecord> {
  const response = await apiClient.get<DecisionRecord>(`/disputes/${caseId}/evaluation`);
  return response.data;
}

export async function getEvidenceMatrix(caseId: string): Promise<EvidenceMatrixResponse> {
  const response = await apiClient.get<EvidenceMatrixResponse>(`/disputes/${caseId}/evidence-matrix`);
  return response.data;
}

export async function getExplanation(caseId: string): Promise<ExplanationData> {
  const response = await apiClient.get<ExplanationData>(`/disputes/${caseId}/explanation`);
  return response.data;
}
