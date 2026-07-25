import { formatCurrency } from '../../utils/format';

export function CurrencyDisplay({ amount, currency, className }: { amount: string; currency: string; className?: string }) {
  return <span className={className}>{formatCurrency(amount, currency)}</span>;
}
