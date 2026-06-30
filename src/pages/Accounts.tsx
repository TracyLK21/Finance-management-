import { useMemo, useState } from 'react'
import { useFinance, STORAGE_KEY, buildSeedState } from '../store/FinanceContext'
import { accountBalance } from '../store/selectors'
import type { Account, AccountType, Category } from '../types'
import Modal from '../components/Modal'
import { formatCurrency } from '../utils/format'

const ACCOUNT_TYPES: AccountType[] = ['checking', 'savings', 'credit', 'cash', 'investment']
const TYPE_ICON: Record<AccountType, string> = {
  checking: '🏦',
  savings: '🐖',
  credit: '💳',
  cash: '💵',
  investment: '📈',
}
const PALETTE = ['#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#14b8a6', '#ef4444', '#6366f1']

export default function Accounts() {
  const { state, dispatch } = useFinance()
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [creatingAccount, setCreatingAccount] = useState(false)
  const [managingCategories, setManagingCategories] = useState(false)

  const balances = useMemo(
    () => state.accounts.map((a) => ({ account: a, balance: accountBalance(state, a) })),
    [state],
  )

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'fin-data.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function resetData() {
    if (!confirm('Reset all data to the sample dataset? This cannot be undone.')) return
    dispatch({ type: 'RESET', payload: buildSeedState() })
  }

  function clearData() {
    if (
      !confirm(
        'Start fresh? This removes all sample accounts, transactions, budgets and goals so you can enter your own. Your categories are kept so importing still auto-sorts. This cannot be undone.',
      )
    )
      return
    localStorage.removeItem(STORAGE_KEY)
    dispatch({
      type: 'RESET',
      payload: { accounts: [], transactions: [], categories: state.categories, budgets: [], goals: [] },
    })
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Accounts</h1>
          <p className="page-subtitle">Manage accounts, categories, and your data</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreatingAccount(true)}>
          + Add account
        </button>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 18 }}>
        {balances.map(({ account, balance }) => (
          <div className="card" key={account.id}>
            <div className="row-between">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="txn-icon" style={{ fontSize: 20 }}>
                  {TYPE_ICON[account.type]}
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{account.name}</div>
                  <div className="muted" style={{ fontSize: 12.5, textTransform: 'capitalize' }}>
                    {account.type}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className={`stat-value ${balance < 0 ? 'neg' : ''}`} style={{ fontSize: 21, marginTop: 0 }}>
                  {formatCurrency(balance)}
                </div>
              </div>
            </div>
            <div className="chip-row" style={{ marginTop: 14 }}>
              <button className="btn btn-sm btn-ghost" onClick={() => setEditingAccount(account)}>
                Edit
              </button>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => {
                  if (confirm(`Delete "${account.name}" and its transactions?`))
                    dispatch({ type: 'DELETE_ACCOUNT', payload: { id: account.id } })
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {balances.length === 0 && (
          <div className="card">
            <div className="empty">No accounts yet. Add one to get started.</div>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 className="card-title">
          Categories
          <button className="btn btn-ghost btn-sm" onClick={() => setManagingCategories(true)}>
            Manage
          </button>
        </h3>
        <div className="chip-row">
          {state.categories.map((c) => (
            <span className="tag" key={c.id}>
              <span className="dot" style={{ background: c.color }} />
              {c.icon} {c.name}
            </span>
          ))}
          {state.categories.length === 0 && <span className="muted">No categories.</span>}
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Data</h3>
        <p className="muted" style={{ fontSize: 13, marginTop: -8 }}>
          Everything is stored locally in your browser. Export a backup or reset anytime.
        </p>
        <div className="chip-row" style={{ marginTop: 6 }}>
          <button className="btn btn-sm" onClick={exportData}>
            ⬇️ Export JSON
          </button>
          <button className="btn btn-sm" onClick={resetData}>
            ♻️ Load sample data
          </button>
          <button className="btn btn-sm btn-danger" onClick={clearData}>
            🌱 Start fresh (keep categories)
          </button>
        </div>
      </div>

      {creatingAccount && <AccountModal onClose={() => setCreatingAccount(false)} />}
      {editingAccount && (
        <AccountModal existing={editingAccount} onClose={() => setEditingAccount(null)} />
      )}
      {managingCategories && <CategoryManager onClose={() => setManagingCategories(false)} />}
    </>
  )
}

function AccountModal({ existing, onClose }: { existing?: Account; onClose: () => void }) {
  const { dispatch } = useFinance()
  const [name, setName] = useState(existing?.name ?? '')
  const [type, setType] = useState<AccountType>(existing?.type ?? 'checking')
  const [opening, setOpening] = useState(existing ? String(existing.openingBalance) : '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const openingBalance = parseFloat(opening) || 0
    if (!name.trim()) return
    if (existing) {
      dispatch({ type: 'UPDATE_ACCOUNT', payload: { ...existing, name: name.trim(), type, openingBalance } })
    } else {
      dispatch({ type: 'ADD_ACCOUNT', payload: { name: name.trim(), type, openingBalance } })
    }
    onClose()
  }

  return (
    <Modal title={existing ? 'Edit account' : 'Add account'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Account name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Everyday Checking"
            autoFocus
            required
          />
        </div>
        <div className="field">
          <label>Type</label>
          <select className="select" value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_ICON[t]} {t[0].toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Opening / current balance</label>
          <input
            className="input"
            type="number"
            step="0.01"
            value={opening}
            onChange={(e) => setOpening(e.target.value)}
            placeholder="0.00"
          />
          <span className="muted" style={{ fontSize: 12 }}>
            Use a negative number for credit card debt.
          </span>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            {existing ? 'Save' : 'Add account'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function CategoryManager({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useFinance()
  const [name, setName] = useState('')
  const [kind, setKind] = useState<Category['kind']>('expense')
  const [group, setGroup] = useState<NonNullable<Category['group']>>('need')
  const [icon, setIcon] = useState('🏷️')
  const [color, setColor] = useState(PALETTE[0])

  function addCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    dispatch({
      type: 'ADD_CATEGORY',
      payload: {
        name: name.trim(),
        kind,
        group: kind === 'expense' ? group : undefined,
        color,
        icon: icon.trim() || undefined,
      },
    })
    setName('')
    setIcon('🏷️')
  }

  const groupLabel = (g?: Category['group']) =>
    g === 'need' ? 'need' : g === 'want' ? 'want' : g === 'savings' ? 'savings' : ''

  return (
    <Modal title="Manage categories" onClose={onClose}>
      <div style={{ maxHeight: 240, overflowY: 'auto', marginBottom: 16 }}>
        {state.categories.map((c) => (
          <div className="row-between" key={c.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span className="dot" style={{ background: c.color }} />
              {c.icon} {c.name}
              <span className="muted" style={{ fontSize: 12 }}>
                · {c.kind}
                {c.kind === 'expense' && c.group ? ` · ${groupLabel(c.group)}` : ''}
              </span>
            </span>
            <button
              className="btn btn-ghost btn-sm btn-danger"
              onClick={() => dispatch({ type: 'DELETE_CATEGORY', payload: { id: c.id } })}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={addCategory}>
        <div className="form-row">
          <div className="field">
            <label>Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="New category" />
          </div>
          <div className="field">
            <label>Icon</label>
            <input className="input" value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={2} />
          </div>
        </div>
        <div className="field">
          <label>Kind</label>
          <div className="segmented">
            <button type="button" className={kind === 'expense' ? 'active' : ''} onClick={() => setKind('expense')}>
              Expense
            </button>
            <button type="button" className={kind === 'income' ? 'active' : ''} onClick={() => setKind('income')}>
              Income
            </button>
          </div>
        </div>
        {kind === 'expense' && (
          <div className="field">
            <label>Need or want?</label>
            <div className="segmented">
              <button type="button" className={group === 'need' ? 'active' : ''} onClick={() => setGroup('need')}>
                Need
              </button>
              <button type="button" className={group === 'want' ? 'active' : ''} onClick={() => setGroup('want')}>
                Want
              </button>
              <button type="button" className={group === 'savings' ? 'active' : ''} onClick={() => setGroup('savings')}>
                Savings
              </button>
            </div>
          </div>
        )}
        <div className="field">
          <label>Color</label>
          <div className="chip-row">
            {PALETTE.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  background: c,
                  border: color === c ? '2px solid #fff' : '2px solid transparent',
                }}
              />
            ))}
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <button type="submit" className="btn btn-primary">
            Add category
          </button>
        </div>
      </form>
    </Modal>
  )
}
