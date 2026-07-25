const SENSITIVE_KEY_PATTERN =
  /(password|passcode|secret|token|authorization|cookie|card(number)?|cvv|cvc|ssn|access[_-]?key|session)/i;

export function maskSensitiveValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => maskSensitiveValue(item));
  }

  if (!isPlainRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key)
        ? '[REDACTED]'
        : maskSensitiveValue(nestedValue),
    ]),
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
