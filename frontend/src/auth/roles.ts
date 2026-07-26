import type { UserRole } from '../types/domain';

export const DASHBOARD_PATH_BY_ROLE: Record<UserRole, string> = {
  CARD_MEMBER: '/member/dashboard',
  MERCHANT: '/merchant/dashboard',
  ANALYST: '/analyst/dashboard',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  CARD_MEMBER: 'Card Member',
  MERCHANT: 'Merchant',
  ANALYST: 'Analyst',
};
