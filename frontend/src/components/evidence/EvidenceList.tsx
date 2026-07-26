import { useState } from 'react';
import { deleteEvidence } from '../../api/evidence';
import { ErrorAlert } from '../common/ErrorAlert';
import { ErrorState, type ErrorStateVariant } from '../common/ErrorState';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { ROLE_LABELS } from '../../auth/roles';
import type { CaseStatus, EvidenceItem, UserRole } from '../../types/domain';
import { canDeleteEvidence, evidenceDeleteBlockedReason } from '../../utils/evidence';
import { resolveApiError } from '../../utils/apiError';
import { EvidenceCard } from './EvidenceCard';

interface EvidenceListProps {
  evidence: EvidenceItem[];
  isLoading: boolean;
  error?: { message: string; variant: ErrorStateVariant } | null;
  onRetryLoad?: () => void;
  currentUserId: string;
  currentUserRole: UserRole;
  caseStatus: CaseStatus;
  onDeleted: (evidenceId: string) => void;
}

function submittedByLabel(item: EvidenceItem, currentUserId: string, currentUserRole: UserRole): string {
  if (item.submittedByUserId === currentUserId && item.submittedByRole === currentUserRole) {
    return 'You';
  }
  return ROLE_LABELS[item.submittedByRole];
}

function byNewestFirst(a: EvidenceItem, b: EvidenceItem): number {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

export function EvidenceList({
  evidence,
  isLoading,
  error,
  onRetryLoad,
  currentUserId,
  currentUserRole,
  caseStatus,
  onDeleted,
}: EvidenceListProps) {
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete(evidenceId: string) {
    setDeleteError(null);
    setDeletingIds((current) => new Set(current).add(evidenceId));
    try {
      await deleteEvidence(evidenceId);
      onDeleted(evidenceId);
    } catch (err) {
      setDeleteError(resolveApiError(err, 'Unable to delete this evidence item right now.').message);
    } finally {
      setDeletingIds((current) => {
        const next = new Set(current);
        next.delete(evidenceId);
        return next;
      });
    }
  }

  if (isLoading) {
    return <LoadingSkeleton variant="card" rows={3} label="Loading evidence" />;
  }

  if (error) {
    return <ErrorState message={error.message} variant={error.variant} onRetry={onRetryLoad} />;
  }

  const cardMemberEvidence = evidence.filter((item) => item.submittedByRole === 'CARD_MEMBER').sort(byNewestFirst);
  const merchantEvidence = evidence.filter((item) => item.submittedByRole === 'MERCHANT').sort(byNewestFirst);

  function renderGroup(title: string, items: EvidenceItem[], emptyMessage: string) {
    return (
      <div className="mb-4">
        <h3 className="h6 text-uppercase text-muted mb-2" style={{ letterSpacing: '0.06em' }}>
          {title} ({items.length})
        </h3>
        {items.length === 0 ? (
          <p className="text-muted small mb-0">{emptyMessage}</p>
        ) : (
          items.map((item) => (
            <EvidenceCard
              key={item.id}
              evidence={item}
              submittedByLabel={submittedByLabel(item, currentUserId, currentUserRole)}
              canDelete={canDeleteEvidence(item, currentUserId, currentUserRole, caseStatus)}
              deleteBlockedReason={evidenceDeleteBlockedReason(item, currentUserId, currentUserRole, caseStatus)}
              isDeleting={deletingIds.has(item.id)}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    );
  }

  return (
    <div>
      {deleteError ? <ErrorAlert message={deleteError} /> : null}

      {evidence.length === 0 ? (
        <p className="text-muted small mb-0">No evidence has been uploaded for this case yet.</p>
      ) : (
        <>
          {renderGroup('Card-member evidence', cardMemberEvidence, 'No evidence submitted by the card member yet.')}
          {renderGroup('Merchant evidence', merchantEvidence, 'No evidence submitted by the merchant yet.')}
        </>
      )}
    </div>
  );
}
