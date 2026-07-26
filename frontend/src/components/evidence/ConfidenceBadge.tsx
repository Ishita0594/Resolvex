export type ConfidenceLevel = 'high' | 'medium' | 'low';

const HIGH_CONFIDENCE_MIN = 85;
const MEDIUM_CONFIDENCE_MIN = 60;

export function getConfidenceLevel(confidence: number): ConfidenceLevel {
  const percent = Math.round(confidence * 100);
  if (percent >= HIGH_CONFIDENCE_MIN) return 'high';
  if (percent >= MEDIUM_CONFIDENCE_MIN) return 'medium';
  return 'low';
}

const CONFIDENCE_TONE: Record<ConfidenceLevel, 'resolved' | 'processing' | 'failed'> = {
  high: 'resolved',
  medium: 'processing',
  low: 'failed',
};

const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
};

export function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  if (confidence === null) {
    return <span className="rx-badge rx-badge--neutral">Not scored</span>;
  }

  const percent = Math.round(confidence * 100);
  const level = getConfidenceLevel(confidence);

  return <span className={`rx-badge rx-badge--${CONFIDENCE_TONE[level]}`}>{CONFIDENCE_LABEL[level]} ({percent}%)</span>;
}
