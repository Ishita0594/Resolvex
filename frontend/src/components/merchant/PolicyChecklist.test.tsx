import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PolicyChecklist } from './PolicyChecklist';
import type { PolicyRequirement } from '../../types/domain';

const REQUIREMENTS: PolicyRequirement[] = [
  {
    id: 'req-1',
    reasonCode: 'GOODS_NOT_RECEIVED',
    requirementKey: 'delivery_confirmation',
    requirementName: 'Delivery confirmation',
    description: 'Merchant provides carrier delivery confirmation or tracking proof.',
    acceptedEvidenceTypes: ['delivery_confirmation', 'tracking_record'],
    weight: 25,
    isMandatory: true,
    policyVersion: 'prototype-v1',
    active: true,
    createdAt: '2026-07-24T00:00:00.000Z',
    updatedAt: '2026-07-24T00:00:00.000Z',
  },
  {
    id: 'req-2',
    reasonCode: 'GOODS_NOT_RECEIVED',
    requirementKey: 'verified_delivery_location',
    requirementName: 'Verified delivery location',
    description: 'Merchant provides address match or geolocation record.',
    acceptedEvidenceTypes: ['address_match', 'geolocation_record'],
    weight: 15,
    isMandatory: false,
    policyVersion: 'prototype-v1',
    active: true,
    createdAt: '2026-07-24T00:00:00.000Z',
    updatedAt: '2026-07-24T00:00:00.000Z',
  },
];

describe('PolicyChecklist', () => {
  it('renders each requirement dynamically from the API data, with mandatory/optional and accepted types', () => {
    render(<PolicyChecklist requirements={REQUIREMENTS} values={{}} onChange={() => {}} />);

    expect(screen.getByText('Delivery confirmation')).toBeInTheDocument();
    expect(screen.getByText('Merchant provides carrier delivery confirmation or tracking proof.')).toBeInTheDocument();
    expect(screen.getByText('Mandatory')).toBeInTheDocument();
    expect(screen.getByText('Verified delivery location')).toBeInTheDocument();
    expect(screen.getByText('Optional')).toBeInTheDocument();
    expect(screen.getAllByText(/Tracking Record/).length).toBeGreaterThan(0);
  });

  it('shows a "Needed" status for incomplete mandatory items and "Complete" once evidence is entered', () => {
    render(<PolicyChecklist requirements={REQUIREMENTS} values={{}} onChange={() => {}} />);
    expect(screen.getByText('Needed')).toBeInTheDocument();

    render(
      <PolicyChecklist
        requirements={REQUIREMENTS}
        values={{ delivery_confirmation: { evidenceType: 'tracking_record', value: 'Delivered on 2026-07-02.' } }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('Complete')).toBeInTheDocument();
  });

  it('reports completion status changes back to the parent via onChange', async () => {
    const onChange = vi.fn();
    render(<PolicyChecklist requirements={REQUIREMENTS} values={{}} onChange={onChange} />);
    const user = userEvent.setup();

    await user.selectOptions(
      screen.getByLabelText('Evidence type for Delivery confirmation'),
      'tracking_record',
    );

    expect(onChange).toHaveBeenCalledWith('delivery_confirmation', { evidenceType: 'tracking_record', value: '' });
  });

  it('hides input controls and shows a submitted indicator in read-only/submitted mode', () => {
    render(<PolicyChecklist requirements={REQUIREMENTS} values={{}} readOnly submitted />);

    expect(screen.queryByLabelText('Evidence type for Delivery confirmation')).not.toBeInTheDocument();
    expect(screen.getAllByText('Submitted').length).toBeGreaterThan(0);
  });
});
