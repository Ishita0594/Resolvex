import { describe, expect, it } from 'vitest';
import {
  ageInDays,
  decisionAlignsWithRecommendation,
  getAnalystPriority,
  isApproachingDeadline,
  isDeadlinePassed,
  statusForAnalystDecision,
} from './analystQueue';
import type { AnalystQueueCase } from '../types/domain';

const NOW = new Date('2026-07-26T00:00:00.000Z');

function buildCase(overrides: Partial<AnalystQueueCase> = {}): AnalystQueueCase {
  return {
    id: 'case-1',
    reasonCode: 'GOODS_NOT_RECEIVED',
    status: 'HUMAN_REVIEW',
    cardMemberId: 'member-1',
    merchantId: 'merchant-1',
    merchantName: 'Northstar Electronics',
    amount: '249.99',
    currency: 'USD',
    latestRecommendation: 'HUMAN_REVIEW_REQUIRED',
    latestConfidence: 80,
    latestDecisionMargin: 30,
    latestEscalationReason: null,
    responseDeadline: '2026-08-05T00:00:00.000Z',
    createdAt: '2026-07-20T00:00:00.000Z',
    ...overrides,
  };
}

describe('isDeadlinePassed / isApproachingDeadline', () => {
  it('treats a deadline within 2 days as approaching but not passed', () => {
    expect(isApproachingDeadline('2026-07-27T00:00:00.000Z', NOW)).toBe(true);
    expect(isDeadlinePassed('2026-07-27T00:00:00.000Z', NOW)).toBe(false);
  });

  it('treats a past deadline as passed but not approaching', () => {
    expect(isDeadlinePassed('2026-07-01T00:00:00.000Z', NOW)).toBe(true);
    expect(isApproachingDeadline('2026-07-01T00:00:00.000Z', NOW)).toBe(false);
  });

  it('treats a far-future deadline as neither', () => {
    expect(isApproachingDeadline('2026-09-01T00:00:00.000Z', NOW)).toBe(false);
    expect(isDeadlinePassed('2026-09-01T00:00:00.000Z', NOW)).toBe(false);
  });
});

describe('ageInDays', () => {
  it('computes whole days elapsed since creation', () => {
    expect(ageInDays('2026-07-20T00:00:00.000Z', NOW)).toBe(6);
  });
});

describe('getAnalystPriority', () => {
  it('is HIGH when confidence is low', () => {
    expect(getAnalystPriority(buildCase({ latestConfidence: 40 }), NOW)).toBe('HIGH');
  });

  it('is HIGH when the decision margin is thin', () => {
    expect(getAnalystPriority(buildCase({ latestDecisionMargin: 5 }), NOW)).toBe('HIGH');
  });

  it('is HIGH when the deadline is approaching or passed', () => {
    expect(getAnalystPriority(buildCase({ responseDeadline: '2026-07-27T00:00:00.000Z' }), NOW)).toBe('HIGH');
    expect(getAnalystPriority(buildCase({ responseDeadline: '2026-07-01T00:00:00.000Z' }), NOW)).toBe('HIGH');
  });

  it('is STANDARD when confidence is strong, margin is wide, and the deadline is far off', () => {
    expect(
      getAnalystPriority(buildCase({ latestConfidence: 85, latestDecisionMargin: 40, responseDeadline: '2026-09-01T00:00:00.000Z' }), NOW),
    ).toBe('STANDARD');
  });
});

describe('decisionAlignsWithRecommendation', () => {
  it('mirrors the backend rule for card-member and merchant recommendations', () => {
    expect(decisionAlignsWithRecommendation('SUPPORT_CARD_MEMBER', 'CARD_MEMBER_SUPPORTED')).toBe(true);
    expect(decisionAlignsWithRecommendation('SUPPORT_MERCHANT', 'CARD_MEMBER_SUPPORTED')).toBe(false);
    expect(decisionAlignsWithRecommendation('SUPPORT_MERCHANT', 'MERCHANT_SUPPORTED')).toBe(true);
    expect(decisionAlignsWithRecommendation('SUPPORT_CARD_MEMBER', 'MERCHANT_SUPPORTED')).toBe(false);
  });

  it('treats REQUEST_MORE_INFORMATION and ESCALATE as aligned when review was required (or no recommendation exists)', () => {
    expect(decisionAlignsWithRecommendation('REQUEST_MORE_INFORMATION', 'HUMAN_REVIEW_REQUIRED')).toBe(true);
    expect(decisionAlignsWithRecommendation('ESCALATE', 'HUMAN_REVIEW_REQUIRED')).toBe(true);
    expect(decisionAlignsWithRecommendation('REQUEST_MORE_INFORMATION', null)).toBe(true);
    expect(decisionAlignsWithRecommendation('SUPPORT_CARD_MEMBER', 'HUMAN_REVIEW_REQUIRED')).toBe(false);
  });
});

describe('statusForAnalystDecision', () => {
  it('maps support decisions to RESOLVED and everything else to HUMAN_REVIEW', () => {
    expect(statusForAnalystDecision('SUPPORT_CARD_MEMBER')).toBe('RESOLVED');
    expect(statusForAnalystDecision('SUPPORT_MERCHANT')).toBe('RESOLVED');
    expect(statusForAnalystDecision('REQUEST_MORE_INFORMATION')).toBe('HUMAN_REVIEW');
    expect(statusForAnalystDecision('ESCALATE')).toBe('HUMAN_REVIEW');
  });
});
