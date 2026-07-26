import { splitHumanReviewReasons } from '../../utils/decisionExplanation';

export function HumanReviewBanner({ reason }: { reason: string | null }) {
  const reasons = splitHumanReviewReasons(reason);

  return (
    <div className="alert alert-warning" role="alert">
      <div className="d-flex align-items-start gap-2">
        <i className="bi bi-people-fill mt-1" aria-hidden="true" />
        <div>
          <p className="fw-semibold mb-1">This case needs human review</p>
          <p className="mb-2 small">
            Automated evaluation stopped short of a recommendation. This does not mean either party has already won or
            lost &mdash; a ResolveX analyst will review the evidence from both sides before a decision is made.
          </p>
          {reasons.length > 0 ? (
            <>
              <p className="small fw-semibold mb-1">Why automation stopped:</p>
              <ul className="small mb-0 ps-3">
                {reasons.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
