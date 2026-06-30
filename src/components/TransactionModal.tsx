import { useState } from 'react'
import Modal from './Modal'
import { useFinance } from '../store/FinanceContext'
import type { Transaction, TransactionType } from '../types'
import { todayISO } from '../utils/date'

interface Props {
  existing?: Transaction
  onClose: () => void
}

export default function TransactionModal({ existing, onClose }: Props) {
  const { state, dispatch } = useFinance()
  const [type, setType] = useState<TransactionType>(existing?.type ?? 'expense')
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '')
  const [date, setDate] = useState(existing?.date ?? todayISO())
  const [accountId, setAccountId] = useState(existing?.accountId ?? state.accounts[0]?.id ?? '')
  const [toAccountId, setToAccountId] = useState(
    existing?.toAccountId ?? state.accounts[1]?.id ?? '',
  )
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? '')
  const [note, setNote] = useState(existing?.note ?? '')

  const initialScope: 'personal' | 'business' | 'split' = !existing?.businessAmount
    ? 'personal'
    : existing.businessAmount >= existing.amount
      ? 'business'
      : 'split'
  const [scope, setScope] = useState<'personal' | 'business' | 'split'>(initialScope)
  const [businessAmount, setBusinessAmount] = useState(
    existing?.businessAmount && initialScope === 'split' ? String(existing.businessAmount) : '',
  )

  const relevantCategories = state.categories.filter((c) =>
    type === 'income' ? c.kind === 'income' : c.kind === 'expense',
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const numericAmount = Math.abs(parseFloat(amount))
    if (!numericAmount || !accountId) return
    if (type === 'transfer' && (!toAccountId || toAccountId === accountId)) return

    let resolvedBusiness: number | undefined
    if (type !== 'transfer') {
      if (scope === 'business') resolvedBusiness = numericAmount
      else if (scope === 'split') {
        const portion = Math.min(Math.abs(parseFloat(businessAmount)) || 0, numericAmount)
        resolvedBusiness = portion > 0 ? portion : undefined
      }
    }

    const base = {
      date,
      type,
      amount: numericAmount,
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : undefined,
      categoryId: type === 'transfer' ? undefined : categoryId || undefined,
      businessAmount: resolvedBusiness,
      note: note.trim() || undefined,
    }

    if (existing) {
      dispatch({
        type: 'UPDATE_TRANSACTION',
        payload: { ...base, id: existing.id, createdAt: existing.createdAt },
      })
    } else {
      dispatch({ type: 'ADD_TRANSACTION', payload: base })
    }
    onClose()
  }

  return (
    <Modal title={existing ? 'Edit transaction' : 'Add transaction'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Type</label>
          <div className="segmented">
            {(['expense', 'income', 'transfer'] as TransactionType[]).map((t) => (
              <button
                key={t}
                type="button"
                className={type === t ? 'active' : ''}
                onClick={() => setType(t)}
              >
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="form-row">
          <div className="field">
            <label>Amount</label>
            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="field">
            <label>Date</label>
            <input
              className="input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="field">
          <label>{type === 'transfer' ? 'From account' : 'Account'}</label>
          <select
            className="select"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            required
          >
            {state.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        {type === 'transfer' ? (
          <div className="field">
            <label>To account</label>
            <select
              className="select"
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
              required
            >
              {state.accounts
                .filter((a) => a.id !== accountId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </div>
        ) : (
          <div className="field">
            <label>Category</label>
            <select
              className="select"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Uncategorized</option>
              {relevantCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon ? `${c.icon} ` : ''}
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {type !== 'transfer' && (
          <div className="field">
            <label>{type === 'income' ? 'Business or personal income?' : 'Business or personal?'}</label>
            <div className="segmented">
              {(['personal', 'business', 'split'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={scope === s ? 'active' : ''}
                  onClick={() => setScope(s)}
                >
                  {s[0].toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            {scope === 'split' && (
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                placeholder="Business portion ($)"
                value={businessAmount}
                onChange={(e) => setBusinessAmount(e.target.value)}
                style={{ marginTop: 8 }}
              />
            )}
          </div>
        )}

        <div className="field">
          <label>Note</label>
          <input
            className="input"
            type="text"
            placeholder="Optional description"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            {existing ? 'Save changes' : 'Add transaction'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
