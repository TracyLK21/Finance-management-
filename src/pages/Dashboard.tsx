import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useFinance } from '../store/FinanceContext'
import {
  budgetProgress,
  monthlySummaries,
  spendingByCategory,
  summaryForMonth,
  totalNetWorth,
} from '../store/selectors'
import { currentMonthKey } from '../utils/date'
import { formatCompactCurrency, formatCurrency } from '../utils/format'
import { formatMonthLabel } from '../utils/format'
import TransactionModal from '../components/TransactionModal'
import TransactionRow from '../components/TransactionRow'

export default function Dashboard() {
  const { state } = useFinance()
  const [adding, setAdding] = useState(false)
  const month = currentMonthKey()

  const netWorth = useMemo(() => totalNetWorth(state), [state])
  const thisMonth = useMemo(() => summaryForMonth(state, month), [state, month])
  const months = useMemo(() => monthlySummaries(state, 6), [state])
  const categorySpend = useMemo(() => spendingByCategory(state, month), [state, month])
  const budgets = useMemo(() => budgetProgress(state, month), [state, month])

  const recent = useMemo(
    () =>
      [...state.transactions]
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
        .slice(0, 6),
    [state.transactions],
  )

  const totalBudget = budgets.reduce((s, b) => s + b.budgeted, 0)
  const totalSpentOnBudget = budgets.reduce((s, b) => s + b.spent, 0)
  const savingsRate =
    thisMonth.income > 0 ? Math.max(0, (thisMonth.net / thisMonth.income) * 100) : 0

  // Net worth trend: opening + cumulative monthly net.
  const netWorthTrend = useMemo(() => {
    const base = state.accounts.reduce((s, a) => s + a.openingBalance, 0)
    let running = base
    // start from earliest months net; transfers cancel out so net is income-expense
    return months.map((m) => {
      running += m.net
      return { label: formatMonthLabel(m.monthKey), value: running }
    })
  }, [months, state.accounts])

  const barData = months.map((m) => ({
    label: formatMonthLabel(m.monthKey),
    Income: Math.round(m.income),
    Expenses: Math.round(m.expense),
  }))

  const pieData = categorySpend.slice(0, 7).map((c) => ({
    name: c.category.name,
    value: Math.round(c.spent),
    color: c.category.color,
  }))

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Your financial overview for this month</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          + Add transaction
        </button>
      </div>

      <div className="grid grid-stats" style={{ marginBottom: 18 }}>
        <div className="stat">
          <div className="stat-label">💼 Net worth</div>
          <div className={`stat-value ${netWorth >= 0 ? '' : 'neg'}`}>
            {formatCurrency(netWorth)}
          </div>
          <div className="stat-meta">Across {state.accounts.length} accounts</div>
        </div>
        <div className="stat">
          <div className="stat-label">📈 Income (this month)</div>
          <div className="stat-value pos">{formatCurrency(thisMonth.income)}</div>
          <div className="stat-meta">Money in</div>
        </div>
        <div className="stat">
          <div className="stat-label">📉 Expenses (this month)</div>
          <div className="stat-value neg">{formatCurrency(thisMonth.expense)}</div>
          <div className="stat-meta">Money out</div>
        </div>
        <div className="stat">
          <div className="stat-label">🐖 Savings rate</div>
          <div className={`stat-value ${thisMonth.net >= 0 ? 'pos' : 'neg'}`}>
            {Math.round(savingsRate)}%
          </div>
          <div className="stat-meta">Net {formatCurrency(thisMonth.net)} this month</div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 18 }}>
        <div className="card">
          <h3 className="card-title">Income vs Expenses</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={barData} barGap={6}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3a" vertical={false} />
              <XAxis dataKey="label" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatCompactCurrency(v)}
                width={48}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: number) => formatCurrency(v)}
                cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              />
              <Bar dataKey="Income" fill="#10b981" radius={[5, 5, 0, 0]} />
              <Bar dataKey="Expenses" fill="#ef4444" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="card-title">Net worth trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={netWorthTrend}>
              <defs>
                <linearGradient id="nw" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3a" vertical={false} />
              <XAxis dataKey="label" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis
                stroke="#6b7280"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatCompactCurrency(v)}
                width={48}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#10b981"
                strokeWidth={2.5}
                fill="url(#nw)"
                name="Net worth"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3 className="card-title">Spending by category</h3>
          {pieData.length === 0 ? (
            <div className="empty">No expenses recorded this month.</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
              <ResponsiveContainer width={170} height={170}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    innerRadius={48}
                    outerRadius={80}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {pieData.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="legend" style={{ flex: 1, minWidth: 150 }}>
                {pieData.map((d) => (
                  <div className="legend-item" key={d.name}>
                    <div className="legend-left">
                      <span className="dot" style={{ background: d.color }} />
                      {d.name}
                    </div>
                    <span className="muted">{formatCurrency(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="card-title">
            Budget health
            <Link to="/budgets" className="btn btn-ghost btn-sm">
              Manage
            </Link>
          </h3>
          {budgets.length === 0 ? (
            <div className="empty">No budgets set yet.</div>
          ) : (
            <>
              <div className="row-between" style={{ marginBottom: 14 }}>
                <span className="muted">Overall</span>
                <span>
                  {formatCurrency(totalSpentOnBudget)}{' '}
                  <span className="muted">/ {formatCurrency(totalBudget)}</span>
                </span>
              </div>
              {budgets.slice(0, 4).map((b) => {
                const pct = Math.min(100, Math.round(b.ratio * 100))
                const over = b.ratio > 1
                return (
                  <div className="budget-item" key={b.budgetId}>
                    <div className="budget-head">
                      <span>
                        {b.category.icon} {b.category.name}
                      </span>
                      <span className={over ? 'neg' : 'muted'} style={{ fontSize: 13 }}>
                        {formatCurrency(b.spent)} / {formatCurrency(b.budgeted)}
                      </span>
                    </div>
                    <div className="progress">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${pct}%`,
                          background: over ? 'var(--danger)' : b.category.color,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h3 className="card-title">
          Recent transactions
          <Link to="/transactions" className="btn btn-ghost btn-sm">
            View all
          </Link>
        </h3>
        {recent.length === 0 ? (
          <div className="empty">No transactions yet. Add your first one above.</div>
        ) : (
          <div className="txn-list">
            {recent.map((t) => (
              <TransactionRow key={t.id} txn={t} />
            ))}
          </div>
        )}
      </div>

      {adding && <TransactionModal onClose={() => setAdding(false)} />}
    </>
  )
}

const tooltipStyle: React.CSSProperties = {
  background: '#1f232c',
  border: '1px solid #2a2f3a',
  borderRadius: 10,
  color: '#e6e9ef',
  fontSize: 13,
}
