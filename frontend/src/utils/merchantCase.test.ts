import { describe, expect, it } from 'vitest';
import {
  canSubmitMerchantResponse,
  formatCountdown,
  isApproachingDeadline,
  isAwaitingMerchantResponse,
  isDeadlineExpired,
  isOpenCase,
} from './merchantCase';
import type { DisputeCase } from '../types/domain';

const NOW = new Date('2026-07-26T00:00:00.000Z');

function buildDispute(overrides: Partial<DisputeCase> = {}): DisputeCase {
  return {
    id: 'case-1',
    transactionId: 'txn-1',
    cardMemberId: 'member-1',
    merchantId: 'merchant-1',
    reasonCode: 'GOODS_NOT_RECEIVED',
    cardMemberStatement: 'Never arrived.',
    merchantStatement: null,
    merchantResponseDate: null,
    merchantResponseStatus: 'PENDING',
    status: 'AWAITING_MERCHANT',
    responseDeadline: '2026-07-31T00:00:00.000Z',
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    resolvedAt: null,
    transaction: {
      id: 'txn-1',
      merchantName: 'Northstar Electronics',
      amount: '249.99',
      currency: 'USD',
      maskedCardLast4: '4242',
    },
    ...overrides,
  };
}

describe('isOpenCase', () => {
  it('treats RESOLVED and CLOSED as not open', () => {
    expect(isOpenCase(buildDispute({ status: 'RESOLVED' }))).toBe(false);
    expect(isOpenCase(buildDispute({ status: 'CLOSED' }))).toBe(false);
  });

  it('treats every other status as open', () => {
    expect(isOpenCase(buildDispute({ status: 'AWAITING_MERCHANT' }))).toBe(true);
    expect(isOpenCase(buildDispute({ status: 'HUMAN_REVIEW' }))).toBe(true);
  });
});

describe('isAwaitingMerchantResponse', () => {
  it('is true only when status is AWAITING_MERCHANT and no final response was submitted', () => {
    expect(isAwaitingMerchantResponse(buildDispute())).toBe(true);
    expect(
      isAwaitingMerchantResponse(buildDispute({ merchantResponseStatus: 'SUBMITTED' })),
    ).toBe(false);
    expect(isAwaitingMerchantResponse(buildDispute({ status: 'EVIDENCE_PROCESSING' }))).toBe(false);
  });
});

describe('isDeadlineExpired', () => {
  it('is true once the deadline has passed', () => {
    expect(isDeadlineExpired(buildDispute({ responseDeadline: '2026-07-01T00:00:00.000Z' }), NOW)).toBe(true);
  });

  it('is false before the deadline', () => {
    expect(isDeadlineExpired(buildDispute({ responseDeadline: '2026-08-01T00:00:00.000Z' }), NOW)).toBe(false);
  });

  it('is never expired once a case is REOPENED, regardless of the stored deadline', () => {
    expect(
      isDeadlineExpired(
        buildDispute({ responseDeadline: '2026-07-01T00:00:00.000Z', merchantResponseStatus: 'REOPENED' }),
        NOW,
      ),
    ).toBe(false);
  });
});

describe('isApproachingDeadline', () => {
  it('is true within the 2-day warning window', () => {
    expect(isApproachingDeadline(buildDispute({ responseDeadline: '2026-07-27T00:00:00.000Z' }), NOW)).toBe(true);
  });

  it('is false with more than 2 days remaining', () => {
    expect(isApproachingDeadline(buildDispute({ responseDeadline: '2026-08-01T00:00:00.000Z' }), NOW)).toBe(false);
  });

  it('is false once already expired', () => {
    expect(isApproachingDeadline(buildDispute({ responseDeadline: '2026-07-01T00:00:00.000Z' }), NOW)).toBe(false);
  });
});

describe('canSubmitMerchantResponse', () => {
  it('allows submission while AWAITING_MERCHANT and before the deadline', () => {
    expect(canSubmitMerchantResponse(buildDispute(), NOW)).toBe(true);
  });

  it('blocks submission once a final response was already submitted', () => {
    expect(canSubmitMerchantResponse(buildDispute({ merchantResponseStatus: 'SUBMITTED' }), NOW)).toBe(false);
  });

  it('blocks submission when the case has moved past AWAITING_MERCHANT', () => {
    expect(canSubmitMerchantResponse(buildDispute({ status: 'EVIDENCE_PROCESSING' }), NOW)).toBe(false);
  });

  it('blocks submission once the deadline has passed', () => {
    expect(
      canSubmitMerchantResponse(buildDispute({ responseDeadline: '2026-07-01T00:00:00.000Z' }), NOW),
    ).toBe(false);
  });

  it('allows submission past the deadline when the case has been reopened', () => {
    expect(
      canSubmitMerchantResponse(
        buildDispute({ responseDeadline: '2026-07-01T00:00:00.000Z', merchantResponseStatus: 'REOPENED' }),
        NOW,
      ),
    ).toBe(true);
  });
});

describe('formatCountdown', () => {
  it('describes remaining time before the deadline', () => {
    expect(formatCountdown('2026-07-29T00:00:00.000Z', NOW)).toBe('3 days left');
  });

  it('describes elapsed time after the deadline', () => {
    expect(formatCountdown('2026-07-24T00:00:00.000Z', NOW)).toBe('Deadline passed 2 days ago');
  });
});
