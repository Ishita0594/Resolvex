import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppliedPolicyPanel } from './AppliedPolicyPanel';

describe('AppliedPolicyPanel', () => {
  it('always shows the visible "Prototype rules" label and the policy version', () => {
    render(<AppliedPolicyPanel policyVersion="prototype-v1" appliedRuleIdentifiers={[]} ruleDescriptions={[]} />);
    expect(screen.getByText('Prototype rules')).toBeInTheDocument();
    expect(screen.getByText('Policy version prototype-v1')).toBeInTheDocument();
  });

  it('renders plain-language descriptions for applied rules matched by rule id', () => {
    render(
      <AppliedPolicyPanel
        policyVersion="prototype-v1"
        appliedRuleIdentifiers={['PX-GNR-002']}
        ruleDescriptions={[
          { ruleId: 'PX-GNR-002', description: 'Delivery confirmed with a matching recipient supports the merchant.' },
          { ruleId: 'PX-GNR-003', description: 'Unused rule that was not applied.' },
        ]}
      />,
    );
    expect(screen.getByText('PX-GNR-002')).toBeInTheDocument();
    expect(screen.getByText('Delivery confirmed with a matching recipient supports the merchant.')).toBeInTheDocument();
    expect(screen.queryByText('PX-GNR-003')).not.toBeInTheDocument();
  });

  it('falls back to a humanized rule id when no description is available', () => {
    render(<AppliedPolicyPanel policyVersion="prototype-v1" appliedRuleIdentifiers={['SOME_RULE']} ruleDescriptions={[]} />);
    expect(screen.getByText('Some Rule')).toBeInTheDocument();
  });

  it('shows a clear message when no rules were applied', () => {
    render(<AppliedPolicyPanel policyVersion="prototype-v1" appliedRuleIdentifiers={[]} ruleDescriptions={[]} />);
    expect(screen.getByText('No prototype rules were applied to this case.')).toBeInTheDocument();
  });

  it('never renders raw JSON', () => {
    const { container } = render(
      <AppliedPolicyPanel
        policyVersion="prototype-v1"
        appliedRuleIdentifiers={['PX-GNR-002']}
        ruleDescriptions={[{ ruleId: 'PX-GNR-002', description: 'Plain language description.' }]}
      />,
    );
    expect(container.textContent).not.toMatch(/[{[]"\w+":/);
  });
});
