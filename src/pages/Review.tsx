import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFinance } from '../store/FinanceContext'
import { accountById } from '../store/selectors'
import type { Transaction } from '../types'
import { merchantKey } from '../utils/csv'
import { formatCurrency } from '../utils/format'

type Filter = 'uncategorised' | 'all'

interface Group {
  key: string
  label: string
  txns: Transaction[]
  total: number
  isIncome: boolean
}

export default function Review() {
  const { state, dispatch } = useFinance()
  const [filter, setFilter] = useState<Filter>('uncategorised')
  const [accountFilter, setAccountFilter] = useState('')

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>()
    for (const t of state.transactions) {
      if (t.type === 'transfer') continue
      if (filter === 'uncategorised' && t.categoryId) continue
      if (accountFilter && t.accountId !== accountFilter) continue
      const key = (t.type === 'income' ? 'in:' : 'ex:') + (merchantKey(t.note ?? '') || '(no description)')
      let g = map.get(key)
      if (!g) {
        g = {
          key,
          label: merchantKey(t.note ?? '') || t.note || '(no description)',
          txns: [],
          total: 0,
          isIncome: t.type === 'income',
        }
        map.set(key, g)
      }
      g.txns.push(t)
      g.total += t.amount
    }
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [state.transactions, filter, accountFilter])

  const uncategorisedCount = useMemo(
    () => state.transactions.filter((t) => t.type !== 'transfer' && !t.categoryId).length,
    [state.transactions],
  )

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Review &amp; categorise</h1>
          <p className="page-subtitle">
            Group similar transactions and categorise them in one go
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="segmented">
            <button
              className={filter === 'uncategorised' ? 'active' : ''}
              onClick={() => setFilter('uncategorised')}
            >
              Needs a category ({uncategorisedCount})
            </button>
            <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
              All
            </button>
          </div>
          <select
            className="select"
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            style={{ width: 220 }}
          >
            <option value="">All accounts</option>
            {state.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {state.rules.length > 0 && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h3 className="card-title">Saved rules ({state.rules.length})</h3>
          <p className="muted" style={{ fontSize: 12.5, marginTop: -8 }}>
            These auto-categorise matching transactions on future imports.
          </p>
          <div className="chip-row">
            {state.rules.map((r) => {
              const cat = state.categories.find((c) => c.id === r.categoryId)
              return (
                <span className="tag" key={r.id}>
                  “{r.match}” → {cat?.icon} {cat?.name ?? 'category'}
                  {r.scope ? ` · ${r.scope}` : ''}
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '0 4px' }}
                    onClick={() => dispatch({ type: 'DELETE_RULE', payload: { id: r.id } })}
                    title="Remove rule"
                  >
                    ✕
                  </button>
                </span>
              )
            })}
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="card">
          <div className="empty">
            {filter === 'uncategorised' ? (
              <>
                🎉 Nothing left to categorise! Head to{' '}
                <Link to="/insights" style={{ color: 'var(--primary)' }}>Insights</Link> to see your
                breakdown.
              </>
            ) : (
              <>
                No transactions yet.{' '}
                <Link to="/import" style={{ color: 'var(--primary)' }}>Import a statement</Link> to
                get started.
              </>
            )}
          </div>
        </div>
      ) : (
        groups.map((g) => <GroupCard key={g.key} group={g} />)
      )}
    </>
  )
}

function GroupCard({ group }: { group: Group }) {
  const { state, dispatch } = useFinance()
  const [categoryId, setCategoryId] = useState('')
  const [scope, setScope] = useState<'' | 'personal' | 'business'>('')
  const [remember, setRemember] = useState(true)
  const [done, setDone] = useState(false)

  const relevant = state.categories.filter((c) =>
    group.isIncome ? c.kind === 'income' : c.kind === 'expense',
  )

  function apply() {
    if (!categoryId && !scope) return
    dispatch({
      type: 'CATEGORISE_TRANSACTIONS',
      payload: {
        ids: group.txns.map((t) => t.id),
        categoryId: categoryId || undefined,
        scope: scope || undefined,
        saveRuleMatch: remember && categoryId ? group.label : undefined,
      },
    })
    setDone(true)
  }

  return (
    <div className="card" style={{ marginBottom: 14, opacity: done ? 0.55 : 1 }}>
      <div className="row-between" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div style={{ minWidth: 200, flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>
            {group.label}
            {done && <span className="pos" style={{ fontSize: 13 }}> ✓ done</span>}
          </div>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
            {group.txns.length} {group.txns.length === 1 ? 'transaction' : 'transactions'} ·{' '}
            {group.isIncome ? '+' : '−'}
            {formatCurrency(group.total)}
            {' · '}
            {accountById(state, group.txns[0]?.accountId)?.name}
          </div>
        </div>

        {!done && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              className="select"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              style={{ width: 170 }}
            >
              <option value="">Choose category…</option>
              {relevant.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon ? `${c.icon} ` : ''}
                  {c.name}
                </option>
              ))}
            </select>
            {!group.isIncome && (
              <div className="segmented">
                <button className={scope === 'personal' ? 'active' : ''} onClick={() => setScope('personal')}>
                  Personal
                </button>
                <button className={scope === 'business' ? 'active' : ''} onClick={() => setScope('business')}>
                  Business
                </button>
              </div>
            )}
            <button className="btn btn-primary btn-sm" onClick={apply}>
              Apply to {group.txns.length}
            </button>
          </div>
        )}
      </div>

      {!done && categoryId && (
        <label className="tag" style={{ cursor: 'pointer', marginTop: 12 }}>
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Remember “{group.label}” for next time
        </label>
      )}

      {/* A peek at what's in this group */}
      <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
        e.g. {group.txns.slice(0, 3).map((t) => t.note).filter(Boolean).join(' · ') || '—'}
      </div>
    </div>
  )
}
