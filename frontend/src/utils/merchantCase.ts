import type { DisputeCase } from '../types/domain';

const APPROACHING_DEADLINE_THRESHOLD_MS = 2 * 24 * 60 * 60 * 1000;

export function isOpenCase(dispute: DisputeCase): boolean {
  return dispute.status !== 'RESOLVED' && dispute.status !== 'CLOSED';
}

export function isAwaitingMerchantResponse(dispute: DisputeCase): boolean {
  return dispute.status === 'AWAITING_MERCHANT' && dispute.merchantResponseStatus !== 'SUBMITTED';
}

export function isDeadlineExpired(dispute: DisputeCase, now: Date = new Date()): boolean {
  if (dispute.merchantResponseStatus === 'REOPENED') {
    return false;
  }
  return new Date(dispute.responseDeadline).getTime() <= now.getTime();
}

export function isApproachingDeadline(dispute: DisputeCase, now: Date = new Date()): boolean {
  if (!isAwaitingMerchantResponse(dispute) || isDeadlineExpired(dispute, now)) {
    return false;
  }
  const remainingMs = new Date(dispute.responseDeadline).getTime() - now.getTime();
  return remainingMs <= APPROACHING_DEADLINE_THRESHOLD_MS;
}

/** Mirrors the backend's case-status.service.ts assertMerchantResponseAllowed rules. */
export function canSubmitMerchantResponse(dispute: DisputeCase, now: Date = new Date()): boolean {
  if (dispute.merchantResponseStatus === 'SUBMITTED') {
    return false;
  }
  if (dispute.status !== 'AWAITING_MERCHANT') {
    return false;
  }
  if (dispute.merchantResponseStatus === 'REOPENED') {
    return true;
  }
  return new Date(dispute.responseDeadline).getTime() > now.getTime();
}

export function formatCountdown(deadline: string, now: Date = new Date()): string {
  const diffMs = new Date(deadline).getTime() - now.getTime();
  const absMs = Math.abs(diffMs);
  const days = Math.floor(absMs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((absMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

  if (diffMs <= 0) {
    if (days > 0) return `Deadline passed ${days} day${days === 1 ? '' : 's'} ago`;
    if (hours > 0) return `Deadline passed ${hours} hour${hours === 1 ? '' : 's'} ago`;
    return 'Deadline just passed';
  }

  if (days > 0) return `${days} day${days === 1 ? '' : 's'} left`;
  if (hours > 0) return `${hours} hour${hours === 1 ? '' : 's'} left`;
  return 'Due within the hour';
}
