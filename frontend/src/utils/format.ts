export function formatCurrency(amount: string, currency: string): string {
  const value = Number.parseFloat(amount);
  if (Number.isNaN(value)) {
    return `${amount} ${currency}`;
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
}

export function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(isoDate));
}

export function formatDateTime(isoDate: string): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(isoDate));
}

/** Transaction.status is a free-form backend string (e.g. "REFUND_PENDING"), not a fixed enum. */
export function humanizeLabel(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function toDateInputValue(isoDate: string): string {
  return isoDate.slice(0, 10);
}
