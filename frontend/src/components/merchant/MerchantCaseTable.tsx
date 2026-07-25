import { Link } from 'react-router-dom';
import type { DisputeCase } from '../../types/domain';
import { REASON_CODE_LABELS } from '../../types/domain';
import { CaseStatusBadge } from '../common/StatusBadge';
import { CurrencyDisplay } from '../common/CurrencyDisplay';
import { DeadlineBadge } from '../common/DeadlineBadge';
import { formatDate } from '../../utils/format';
import { canSubmitMerchantResponse } from '../../utils/merchantCase';

export function MerchantCaseTable({ disputes }: { disputes: DisputeCase[] }) {
  return (
    <div className="rx-card p-0">
      <div className="table-responsive">
        <table className="table align-middle mb-0">
          <thead>
            <tr>
              <th scope="col">Case ID</th>
              <th scope="col">Card-member claim</th>
              <th scope="col">Category</th>
              <th scope="col">Amount</th>
              <th scope="col">Received</th>
              <th scope="col">Response deadline</th>
              <th scope="col">Status</th>
              <th scope="col" className="text-end">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {disputes.map((dispute) => {
              const canRespond = canSubmitMerchantResponse(dispute);
              return (
                <tr key={dispute.id}>
                  <td>
                    <span className="small font-monospace text-muted">{dispute.id}</span>
                  </td>
                  <td>
                    <span
                      className="d-inline-block text-truncate"
                      style={{ maxWidth: 260 }}
                      title={dispute.cardMemberStatement}
                    >
                      {dispute.cardMemberStatement}
                    </span>
                  </td>
                  <td>{REASON_CODE_LABELS[dispute.reasonCode]}</td>
                  <td>
                    <CurrencyDisplay amount={dispute.transaction.amount} currency={dispute.transaction.currency} />
                  </td>
                  <td>{formatDate(dispute.createdAt)}</td>
                  <td>
                    <div className="small mb-1">{formatDate(dispute.responseDeadline)}</div>
                    <DeadlineBadge dispute={dispute} />
                  </td>
                  <td>
                    <CaseStatusBadge status={dispute.status} />
                  </td>
                  <td className="text-end">
                    <Link
                      to={`/merchant/disputes/${dispute.id}`}
                      className={`btn btn-sm ${canRespond ? 'btn-primary' : 'btn-outline-primary'}`}
                    >
                      {canRespond ? 'Respond' : 'View'}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
