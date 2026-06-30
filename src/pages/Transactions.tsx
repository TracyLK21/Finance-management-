import { useMemo, useState } from 'react'
import { useFinance } from '../store/FinanceContext'
import type { Transaction, TransactionType } from '../types'
import TransactionModal from '../components/TransactionModal'
import TransactionRow from '../components/TransactionRow'
import { formatMonthLabel } from '../utils/format'
import { monthKey } from '../utils/date'

type Filter = 'all' | TransactionType

export default function Transactions() {
  const { state } = useFinance()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return [...state.transactions]
      .filter((t) => (filter === 'all' ? true : t.type === filter))
      .filter((t) => (categoryFilter ? t.categoryId === categoryFilter : true))
      .filter((t) => {
        if (!term) return true
        const cat = state.categories.find((c) => c.id === t.categoryId)
        return (
          (t.note ?? '').toLowerCase().includes(term) ||
          (cat?.name ?? '').toLowerCase().includes(term)
        )
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  }, [state.transactions, state.categories, filter, search, categoryFilter])

  // Group by month for nicer scanning.
  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    for (const t of filtered) {
      const k = monthKey(t.date)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(t)
    }
    return [...map.entries()]
  }, [filtered])

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Transactions</h1>
          <p className="page-subtitle">
            {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          + Add transaction
        </button>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div
          style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}
        >
          <div className="segmented">
            {(['all', 'expense', 'income', 'transfer'] as Filter[]).map((f) => (
              <button
                key={f}
                className={filter === f ? 'active' : ''}
                onClick={() => setFilter(f)}
              >
                {f[0].toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <input
            className="input"
            placeholder="Search notes & categories…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 180 }}
          />
          <select
            className="select"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ width: 180 }}
          >
            <option value="">All categories</option>
            {state.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon ? `${c.icon} ` : ''}
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="card">
          <div className="empty">No transactions match your filters.</div>
        </div>
      ) : (
        groups.map(([m, txns]) => (
          <div className="card" key={m} style={{ marginBottom: 18 }}>
            <h3 className="card-title">{formatMonthLabel(m).replace("'", " '")}</h3>
            <div className="txn-list">
              {txns.map((t) => (
                <TransactionRow key={t.id} txn={t} onEdit={setEditing} />
              ))}
            </div>
          </div>
        ))
      )}

      {adding && <TransactionModal onClose={() => setAdding(false)} />}
      {editing && (
        <TransactionModal existing={editing} onClose={() => setEditing(null)} />
      )}
    </>
  )
}
