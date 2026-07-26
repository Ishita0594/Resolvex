import type { CaseEventName, CaseEventPayload, UserRole } from '../types/domain';
import type { ToastInput, ToastTone } from '../components/common/ToastProvider';

/**
 * Card members and merchants only ever see neutral, simplified copy about their own case -
 * never the internal event name, policy engine internals, or analyst-facing operational detail.
 */
const SIMPLIFIED_MESSAGE_BY_EVENT: Record<CaseEventName, string> = {
  'case.status.updated': 'Your case status was updated.',
  'evidence.processing.completed': 'Your submitted evidence finished processing.',
  'merchant.response.received': 'A response was received for your case.',
  'decision.generated': 'A recommendation is now available for your case.',
  'information.requested': 'More information was requested for your case.',
  'analyst.review.required': 'Your case is now waiting on analyst review.',
};

const ANALYST_TITLE_BY_EVENT: Record<CaseEventName, string> = {
  'case.status.updated': 'Case status updated',
  'evidence.processing.completed': 'Evidence processing completed',
  'merchant.response.received': 'Merchant response received',
  'analyst.review.required': 'Case needs review',
  'decision.generated': 'Decision generated',
  'information.requested': 'Information requested',
};

const WARNING_EVENTS: ReadonlySet<CaseEventName> = new Set(['analyst.review.required']);

function toneForEvent(eventName: CaseEventName): ToastTone {
  return WARNING_EVENTS.has(eventName) ? 'warning' : 'info';
}

export function toastCopyForCaseEvent(eventName: CaseEventName, payload: CaseEventPayload, role: UserRole): ToastInput {
  if (role === 'ANALYST') {
    return {
      title: ANALYST_TITLE_BY_EVENT[eventName],
      message: `Case ${payload.caseId.slice(0, 8)}…`,
      tone: toneForEvent(eventName),
    };
  }

  return {
    title: 'Case update',
    message: SIMPLIFIED_MESSAGE_BY_EVENT[eventName],
    tone: 'info',
  };
}
