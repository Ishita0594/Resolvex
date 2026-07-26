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

const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB'];

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < FILE_SIZE_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${FILE_SIZE_UNITS[unitIndex]}`;
}
