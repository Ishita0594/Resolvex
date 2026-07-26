import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import { getLatestEvaluation } from '../api/evaluation';
import type { ErrorStateVariant } from '../components/common/ErrorState';
import type { DecisionRecord } from '../types/domain';
import { resolveApiError } from '../utils/apiError';

export interface UseCaseEvaluationResult {
  evaluation: DecisionRecord | null;
  isLoading: boolean;
  error: { message: string; variant: ErrorStateVariant } | null;
  reload: () => void;
}

/** A 404 here means "not evaluated yet", not an error, so it resolves to a null evaluation instead of surfacing an error state. */
export function useCaseEvaluation(caseId: string | undefined): UseCaseEvaluationResult {
  const [evaluation, setEvaluation] = useState<DecisionRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<{ message: string; variant: ErrorStateVariant } | null>(null);

  const load = useCallback(() => {
    if (!caseId) {
      return;
    }
    setIsLoading(true);
    setError(null);
    getLatestEvaluation(caseId)
      .then((data) => setEvaluation(data))
      .catch((err) => {
        if (err instanceof ApiError && err.statusCode === 404) {
          setEvaluation(null);
          return;
        }
        setError(resolveApiError(err, 'Unable to load the decision for this case right now.'));
      })
      .finally(() => setIsLoading(false));
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  return { evaluation, isLoading, error, reload: load };
}
