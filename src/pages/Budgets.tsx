import { useMemo, useState } from 'react'
import { useFinance } from '../store/FinanceContext'
import { budgetProgress, summaryForMonth } from '../store/selectors'
import { addMonths, currentMonthKey, monthFullLabel } from '../utils/date'
import { formatCurrency } from '../utils/format'
import Modal from '../components/Modal'

export default function Budgets() {
  const { state } = useFinance()
  const [month, setMonth] = useState(currentMonthKey())
  const [editing, setEditing] = useState(false)

  const progress = useMemo(() => budgetProgress(state, month), [state, month])
  const summary = useMemo(() => summaryForMonth(state, month), [state, month])

  const totalBudget = progress.reduce((s, b) => s + b.budgeted, 0)
  const totalSpent = progress.reduce((s, b) => s + b.spent, 0)
  const remaining = totalBudget - totalSpent

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Budgets</h1>
          <p className="page-subtitle">Track spending against your monthly plan</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing(true)}>
          Edit budgets
        </button>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="row-between">
          <button className="btn btn-ghost btn-sm" onClick={() => setMonth(addMonths(month, -1))}>
            ← Prev
          </button>
          <strong>{monthFullLabel(month)}</strong>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setMonth(addMonths(month, 1))}
            disabled={month >= currentMonthKey()}
            style={{ opacity: month >= currentMonthKey() ? 0.4 : 1 }}
          >
            Next →
          </button>
        </div>
      </div>

      <div className="grid grid-stats" style={{ marginBottom: 18 }}>
        <div className="stat">
          <div className="stat-label">🎯 Budgeted</div>
          <div className="stat-value">{formatCurrency(totalBudget)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">💵 Spent</div>
          <div className="stat-value neg">{formatCurrency(totalSpent)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">{remaining >= 0 ? '✅ Remaining' : '⚠️ Over budget'}</div>
          <div className={`stat-value ${remaining >= 0 ? 'pos' : 'neg'}`}>
            {formatCurrency(Math.abs(remaining))}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">📊 Total expenses</div>
          <div className="stat-value">{formatCurrency(summary.expense)}</div>
          <div className="stat-meta">Incl. uncategorized</div>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Category budgets</h3>
        {progress.length === 0 ? (
          <div className="empty">
            No budgets yet. Click <strong>Edit budgets</strong> to set monthly limits.
          </div>
        ) : (
          progress.map((b) => {
            const pct = Math.min(100, Math.round(b.ratio * 100))
            const over = b.ratio > 1
            const near = !over && b.ratio >= 0.85
            const color = over ? 'var(--danger)' : near ? 'var(--warning)' : b.category.color
            return (
              <div className="budget-item" key={b.budgetId}>
                <div className="budget-head">
                  <span style={{ fontWeight: 600 }}>
                    {b.category.icon} {b.category.name}
                  </span>
                  <span style={{ fontSize: 13.5 }}>
                    <span className={over ? 'neg' : ''}>{formatCurrency(b.spent)}</span>
                    <span className="muted"> / {formatCurrency(b.budgeted)}</span>
                  </span>
                </div>
                <div className="progress">
                  <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
                </div>
                <div
                  className="muted"
                  style={{ fontSize: 12, marginTop: 6, display: 'flex', justifyContent: 'space-between' }}
                >
                  <span>{pct}% used</span>
                  <span className={b.remaining < 0 ? 'neg' : ''}>
                    {b.remaining >= 0
                      ? `${formatCurrency(b.remaining)} left`
                      : `${formatCurrency(-b.remaining)} over`}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {editing && <BudgetEditor onClose={() => setEditing(false)} />}
    </>
  )
}

function BudgetEditor({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useFinance()
  const expenseCategories = state.categories.filter((c) => c.kind === 'expense')

  function amountFor(categoryId: string): string {
    const b = state.budgets.find((x) => x.categoryId === categoryId)
    return b ? String(b.amount) : ''
  }

  function setAmount(categoryId: string, value: string) {
    const num = parseFloat(value)
    if (!value || isNaN(num) || num <= 0) {
      const b = state.budgets.find((x) => x.categoryId === categoryId)
      if (b) dispatch({ type: 'DELETE_BUDGET', payload: { id: b.id } })
      return
    }
    dispatch({ type: 'UPSERT_BUDGET', payload: { categoryId, amount: num } })
  }

  return (
    <Modal title="Edit monthly budgets" onClose={onClose}>
      <p className="muted" style={{ fontSize: 13, marginTop: -8, marginBottom: 18 }}>
        Set a monthly limit per category. Leave blank to remove a budget.
      </p>
      {expenseCategories.map((c) => (
        <div className="field" key={c.id}>
          <label>
            {c.icon} {c.name}
          </label>
          <input
            className="input"
            type="number"
            min="0"
            step="10"
            placeholder="No budget"
            defaultValue={amountFor(c.id)}
            onBlur={(e) => setAmount(c.id, e.target.value)}
          />
        </div>
      ))}
      <div className="modal-actions">
        <button className="btn btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  )
}
