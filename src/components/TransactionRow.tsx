import { useFinance } from '../store/FinanceContext'
import { accountById, categoryById } from '../store/selectors'
import type { Transaction } from '../types'
import { formatCurrency, formatDate } from '../utils/format'

interface Props {
  txn: Transaction
  onEdit?: (t: Transaction) => void
}

export default function TransactionRow({ txn, onEdit }: Props) {
  const { state, dispatch } = useFinance()
  const category = categoryById(state, txn.categoryId)
  const account = accountById(state, txn.accountId)
  const toAccount = accountById(state, txn.toAccountId)

  const sign = txn.type === 'income' ? '+' : txn.type === 'expense' ? '−' : ''
  const amountClass = txn.type === 'income' ? 'pos' : txn.type === 'expense' ? 'neg' : 'muted'

  const icon = txn.type === 'transfer' ? '🔁' : category?.icon ?? (txn.type === 'income' ? '💰' : '💵')
  const title =
    txn.note ||
    (txn.type === 'transfer'
      ? `Transfer to ${toAccount?.name ?? 'account'}`
      : category?.name ?? 'Uncategorized')

  const subtitle =
    txn.type === 'transfer'
      ? `${account?.name ?? ''} → ${toAccount?.name ?? ''}`
      : `${category?.name ?? 'Uncategorized'} · ${account?.name ?? ''}`

  return (
    <div className="txn-row">
      <div className="txn-icon" style={{ background: category ? `${category.color}22` : undefined }}>
        {icon}
      </div>
      <div>
        <div className="txn-note">{title}</div>
        <div className="txn-sub">{subtitle}</div>
      </div>
      <div className="txn-col-hide muted" style={{ fontSize: 13 }}>
        {formatDate(txn.date)}
      </div>
      <div className={`txn-amount ${amountClass}`}>
        {sign}
        {formatCurrency(txn.amount)}
      </div>
      <div className="row-actions">
        {onEdit && (
          <button className="btn btn-ghost btn-sm" onClick={() => onEdit(txn)} title="Edit">
            ✏️
          </button>
        )}
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => dispatch({ type: 'DELETE_TRANSACTION', payload: { id: txn.id } })}
          title="Delete"
        >
          🗑️
        </button>
      </div>
    </div>
  )
}
