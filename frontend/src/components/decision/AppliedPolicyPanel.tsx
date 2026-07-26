import { humanizeLabel } from '../../utils/format';
import type { PolicyRuleDescriptor } from '../../types/domain';

interface AppliedPolicyPanelProps {
  policyVersion: string;
  appliedRuleIdentifiers: string[];
  ruleDescriptions: PolicyRuleDescriptor[];
}

export function AppliedPolicyPanel({ policyVersion, appliedRuleIdentifiers, ruleDescriptions }: AppliedPolicyPanelProps) {
  const descriptionByRuleId = new Map(ruleDescriptions.map((rule) => [rule.ruleId, rule.description]));

  return (
    <div>
      <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
        <span className="rx-badge rx-badge--neutral">Prototype rules</span>
        <span className="text-muted small">Policy version {policyVersion}</span>
      </div>
      <p className="text-muted small mb-3">
        These deterministic rules are part of a prototype policy engine and are shown for transparency. They are not legal
        advice or a final legal determination.
      </p>

      {appliedRuleIdentifiers.length === 0 ? (
        <p className="text-muted small mb-0">No prototype rules were applied to this case.</p>
      ) : (
        <ul className="list-unstyled mb-0">
          {appliedRuleIdentifiers.map((ruleId) => (
            <li key={ruleId} className="mb-2">
              <span className="font-monospace small fw-semibold me-2">{ruleId}</span>
              <span className="small text-muted">{descriptionByRuleId.get(ruleId) ?? humanizeLabel(ruleId)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
