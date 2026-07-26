import type { UserRole } from '../types/domain';

export function caseDetailPathForRole(role: UserRole, caseId: string): string {
  if (role === 'MERCHANT') {
    return `/merchant/disputes/${caseId}`;
  }
  if (role === 'ANALYST') {
    return `/analyst/cases/${caseId}`;
  }
  return `/member/disputes/${caseId}`;
}
