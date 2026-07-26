import { Link } from 'react-router-dom';
import type { DisputeCase } from '../../types/domain';
import { REASON_CODE_LABELS } from '../../types/domain';
import { CaseStatusBadge } from '../common/StatusBadge';
import { CurrencyDisplay } from '../common/CurrencyDisplay';
import { DeadlineBadge } from '../common/DeadlineBadge';
import { formatDate } from '../../utils/format';
import { canSubmitMerchantResponse } from '../../utils/merchantCase';
import { useIsMobileViewport } from '../../hooks/useMediaQuery';

export function MerchantCaseTable({ disputes }: { disputes: DisputeCase[] }) {
  const isMobile = useIsMobileViewport();

  if (isMobile) {
    return (
      <div className="rx-card p-3">
        {disputes.map((dispute) => (
          <MerchantCaseCard key={dispute.id} dispute={dispute} />
        ))}
      </div>
    );
  }

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

function MerchantCaseCard({ dispute }: { dispute: DisputeCase }) {
  const canRespond = canSubmitMerchantResponse(dispute);

  return (
    <div className="rx-table-card">
      <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-2">
        <span className="small font-monospace text-muted">{dispute.id}</span>
        <CaseStatusBadge status={dispute.status} />
      </div>
      <p className="mb-2 small">{dispute.cardMemberStatement}</p>
      <dl className="mb-0">
        <div className="rx-table-card-row">
          <dt>Category</dt>
          <dd>{REASON_CODE_LABELS[dispute.reasonCode]}</dd>
        </div>
        <div className="rx-table-card-row">
          <dt>Amount</dt>
          <dd>
            <CurrencyDisplay amount={dispute.transaction.amount} currency={dispute.transaction.currency} />
          </dd>
        </div>
        <div className="rx-table-card-row">
          <dt>Received</dt>
          <dd>{formatDate(dispute.createdAt)}</dd>
        </div>
        <div className="rx-table-card-row">
          <dt>Response deadline</dt>
          <dd>
            <div>{formatDate(dispute.responseDeadline)}</div>
            <DeadlineBadge dispute={dispute} />
          </dd>
        </div>
      </dl>
      <Link
        to={`/merchant/disputes/${dispute.id}`}
        className={`btn btn-sm w-100 mt-3 ${canRespond ? 'btn-primary' : 'btn-outline-primary'}`}
      >
        {canRespond ? 'Respond' : 'View'}
      </Link>
    </div>
  );
}
