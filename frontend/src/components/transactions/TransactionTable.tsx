import { Link } from 'react-router-dom';
import type { DisputeCase, Transaction } from '../../types/domain';
import { CaseStatusBadge, TransactionStatusBadge } from '../common/StatusBadge';
import { CurrencyDisplay } from '../common/CurrencyDisplay';
import { formatDate } from '../../utils/format';
import { useIsMobileViewport } from '../../hooks/useMediaQuery';

export function TransactionTable({
  transactions,
  disputeByTransactionId,
}: {
  transactions: Transaction[];
  disputeByTransactionId: Map<string, DisputeCase>;
}) {
  const isMobile = useIsMobileViewport();

  if (isMobile) {
    return (
      <div className="rx-card p-3">
        {transactions.map((transaction) => (
          <TransactionCard
            key={transaction.id}
            transaction={transaction}
            dispute={disputeByTransactionId.get(transaction.id)}
          />
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
              <th scope="col">Merchant</th>
              <th scope="col">Date</th>
              <th scope="col">Card</th>
              <th scope="col">Amount</th>
              <th scope="col">Transaction status</th>
              <th scope="col">Dispute status</th>
              <th scope="col" className="text-end">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => {
              const dispute = disputeByTransactionId.get(transaction.id);
              return (
                <tr key={transaction.id}>
                  <td>
                    <Link to={`/member/transactions/${transaction.id}`} className="fw-semibold text-decoration-none">
                      {transaction.merchantName}
                    </Link>
                  </td>
                  <td>{formatDate(transaction.transactionDate)}</td>
                  <td>&bull;&bull;&bull;&bull; {transaction.maskedCardLast4}</td>
                  <td>
                    <CurrencyDisplay amount={transaction.amount} currency={transaction.currency} />
                  </td>
                  <td>
                    <TransactionStatusBadge status={transaction.status} />
                  </td>
                  <td>
                    {dispute ? <CaseStatusBadge status={dispute.status} /> : <span className="text-muted small">No dispute</span>}
                  </td>
                  <td className="text-end">
                    {dispute ? (
                      <Link to={`/member/disputes/${dispute.id}`} className="btn btn-sm btn-outline-primary">
                        View dispute
                      </Link>
                    ) : (
                      <Link to={`/member/transactions/${transaction.id}/dispute`} className="btn btn-sm btn-primary">
                        Dispute this transaction
                      </Link>
                    )}
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

function TransactionCard({ transaction, dispute }: { transaction: Transaction; dispute?: DisputeCase }) {
  return (
    <div className="rx-table-card">
      <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-2">
        <Link to={`/member/transactions/${transaction.id}`} className="fw-semibold text-decoration-none">
          {transaction.merchantName}
        </Link>
        <TransactionStatusBadge status={transaction.status} />
      </div>
      <dl className="mb-0">
        <div className="rx-table-card-row">
          <dt>Date</dt>
          <dd>{formatDate(transaction.transactionDate)}</dd>
        </div>
        <div className="rx-table-card-row">
          <dt>Card</dt>
          <dd>&bull;&bull;&bull;&bull; {transaction.maskedCardLast4}</dd>
        </div>
        <div className="rx-table-card-row">
          <dt>Amount</dt>
          <dd>
            <CurrencyDisplay amount={transaction.amount} currency={transaction.currency} />
          </dd>
        </div>
        <div className="rx-table-card-row">
          <dt>Dispute status</dt>
          <dd>{dispute ? <CaseStatusBadge status={dispute.status} /> : <span className="text-muted small">No dispute</span>}</dd>
        </div>
      </dl>
      {dispute ? (
        <Link to={`/member/disputes/${dispute.id}`} className="btn btn-sm btn-outline-primary w-100 mt-3">
          View dispute
        </Link>
      ) : (
        <Link to={`/member/transactions/${transaction.id}/dispute`} className="btn btn-sm btn-primary w-100 mt-3">
          Dispute this transaction
        </Link>
      )}
    </div>
  );
}
