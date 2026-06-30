import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useFinance } from '../store/FinanceContext'
import {
  monthlySummaries,
  periodSummary,
  spendingByCategoryRange,
  uncategorisedCount,
} from '../store/selectors'
import { monthKey, recentMonthKeys } from '../utils/date'
import { formatCompactCurrency, formatCurrency, formatMonthLabel } from '../utils/format'

const tooltipStyle: React.CSSProperties = {
  background: '#1f232c',
  border: '1px solid #2a2f3a',
  borderRadius: 10,
  color: '#e6e9ef',
  fontSize: 13,
}

export default function Insights() {
  const { state } = useFinance()
  const [months, setMonths] = useState(12)

  const summary = useMemo(() => periodSummary(state, months), [state, months])
  const monthly = useMemo(() => monthlySummaries(state, months), [state, months])
  const byCategory = useMemo(() => spendingByCategoryRange(state, months), [state, months])
  const needCategorising = useMemo(() => uncategorisedCount(state, months), [state, months])

  // Business vs personal split across the period.
  const bizPersonal = useMemo(() => {
    const keys = new Set(recentMonthKeys(months))
    let business = 0
    let personal = 0
    for (const t of state.transactions) {
      if (t.type !== 'expense' || !keys.has(monthKey(t.date))) continue
      const biz = Math.min(t.businessAmount ?? 0, t.amount)
      business += biz
      personal += t.amount - biz
    }
    return { business, personal }
  }, [state, months])

  const barData = monthly.map((m) => ({
    label: formatMonthLabel(m.monthKey),
    Income: Math.round(m.income),
    Spending: Math.round(m.expense),
  }))

  const deficit = summary.net < 0
  const incomeForRatio = summary.income || 1
  const needsPct = Math.round((summary.needs / incomeForRatio) * 100)
  const wantsPct = Math.round((summary.wants / incomeForRatio) * 100)
  const savingsPct = Math.max(0, Math.round((summary.avgNet > 0 ? summary.net : 0) / incomeForRatio * 100))

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Insights</h1>
          <p className="page-subtitle">Understand where your money goes</p>
        </div>
        <div className="segmented">
          {[3, 6, 12].map((m) => (
            <button key={m} className={months === m ? 'active' : ''} onClick={() => setMonths(m)}>
              {m} months
            </button>
          ))}
        </div>
      </div>

      {state.transactions.length === 0 && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="empty">
            No data yet. <Link to="/import" style={{ color: 'var(--primary)' }}>Import a bank statement</Link>{' '}
            to see your breakdown.
          </div>
        </div>
      )}

      {needCategorising > 0 && (
        <div className="card" style={{ marginBottom: 18, borderColor: 'var(--warning)' }}>
          <strong style={{ color: 'var(--warning)' }}>⚠️ {needCategorising} transactions need a category.</strong>{' '}
          <span className="muted">
            Your breakdown gets sharper once they're sorted —{' '}
            <Link to="/transactions" style={{ color: 'var(--primary)' }}>review them here</Link>.
          </span>
        </div>
      )}

      {/* Headline numbers */}
      <div className="grid grid-stats" style={{ marginBottom: 18 }}>
        <div className="stat">
          <div className="stat-label">📈 Avg income / month</div>
          <div className="stat-value pos">{formatCurrency(summary.avgIncome)}</div>
          <div className="stat-meta">{formatCurrency(summary.income)} over {months} months</div>
        </div>
        <div className="stat">
          <div className="stat-label">📉 Avg spending / month</div>
          <div className="stat-value neg">{formatCurrency(summary.avgExpense)}</div>
          <div className="stat-meta">{formatCurrency(summary.expense)} over {months} months</div>
        </div>
        <div className="stat">
          <div className="stat-label">{deficit ? '⚠️ Avg shortfall / month' : '✅ Avg surplus / month'}</div>
          <div className={`stat-value ${deficit ? 'neg' : 'pos'}`}>
            {formatCurrency(Math.abs(summary.avgNet))}
          </div>
          <div className="stat-meta">
            {deficit ? 'Spending more than you earn' : 'Living within your means'}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">💼 Business expenses</div>
          <div className="stat-value">{formatCurrency(bizPersonal.business)}</div>
          <div className="stat-meta">Potentially tax-deductible</div>
        </div>
      </div>

      {deficit && (
        <div className="card" style={{ marginBottom: 18, borderColor: 'var(--danger)' }}>
          <strong className="neg">You're spending more than you earn.</strong>{' '}
          <span className="muted">
            Over the last {months} months you spent {formatCurrency(Math.abs(summary.net))} more than
            you earned. The “Wants” and category breakdowns below show where to look first.
          </span>
        </div>
      )}

      <div className="grid grid-2" style={{ marginBottom: 18 }}>
        {/* Monthly income vs spending */}
        <div className="card">
          <h3 className="card-title">Income vs spending by month</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3a" vertical={false} />
              <XAxis dataKey="label" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => formatCompactCurrency(v)} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatCurrency(v)} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Spending" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Business vs personal */}
        <div className="card">
          <h3 className="card-title">Business vs personal spending</h3>
          <Split
            label="💼 Business"
            value={bizPersonal.business}
            total={bizPersonal.business + bizPersonal.personal}
            color="#3b82f6"
          />
          <Split
            label="🏠 Personal"
            value={bizPersonal.personal}
            total={bizPersonal.business + bizPersonal.personal}
            color="#10b981"
          />
          <p className="muted" style={{ fontSize: 12.5, marginTop: 14 }}>
            Tag each transaction as business, personal, or a split on the Transactions page. The
            business total is a guide for your records — confirm deductions with your accountant.
          </p>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 18 }}>
        {/* Needs vs Wants — 50/30/20 */}
        <div className="card">
          <h3 className="card-title">Needs vs Wants (personal)</h3>
          <FiftyThirtyTwenty
            label="🧷 Needs (non-discretionary)"
            actualPct={needsPct}
            targetPct={50}
            amount={summary.needs}
            color="#6366f1"
          />
          <FiftyThirtyTwenty
            label="🎈 Wants (discretionary)"
            actualPct={wantsPct}
            targetPct={30}
            amount={summary.wants}
            color="#ec4899"
          />
          <FiftyThirtyTwenty
            label="🐖 Left to save / pay debt"
            actualPct={savingsPct}
            targetPct={20}
            amount={summary.net > 0 ? summary.net : 0}
            color="#10b981"
          />
          {summary.unclassified > 0 && (
            <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>
              {formatCurrency(summary.unclassified)} of spending isn't classified as a need or want
              yet — set each category's type on the Accounts page.
            </p>
          )}
          <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>
            A common guide is <strong>50% needs / 30% wants / 20% saving</strong>. The bars compare
            your actual % of income to that target.
          </p>
        </div>

        {/* Top categories */}
        <div className="card">
          <h3 className="card-title">Where it goes — top categories</h3>
          {byCategory.length === 0 ? (
            <div className="empty">No categorised spending yet.</div>
          ) : (
            byCategory.slice(0, 8).map((c) => {
              const top = byCategory[0].spent || 1
              const pct = Math.round((c.spent / top) * 100)
              return (
                <div className="budget-item" key={c.category.id}>
                  <div className="budget-head">
                    <span>
                      {c.category.icon} {c.category.name}
                      {c.category.group && (
                        <span className="muted" style={{ fontSize: 12 }}>
                          {' '}· {c.category.group === 'need' ? 'need' : c.category.group === 'want' ? 'want' : 'savings'}
                        </span>
                      )}
                    </span>
                    <span style={{ fontSize: 13.5 }}>{formatCurrency(c.spent)}</span>
                  </div>
                  <div className="progress">
                    <div className="progress-fill" style={{ width: `${pct}%`, background: c.category.color }} />
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}

function Split({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="budget-item">
      <div className="budget-head">
        <span>{label}</span>
        <span style={{ fontSize: 13.5 }}>
          {formatCurrency(value)} <span className="muted">· {pct}%</span>
        </span>
      </div>
      <div className="progress">
        <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

function FiftyThirtyTwenty({
  label,
  actualPct,
  targetPct,
  amount,
  color,
}: {
  label: string
  actualPct: number
  targetPct: number
  amount: number
  color: string
}) {
  const over = actualPct > targetPct
  return (
    <div className="budget-item">
      <div className="budget-head">
        <span>{label}</span>
        <span style={{ fontSize: 13.5 }}>
          {formatCurrency(amount)}{' '}
          <span className={over ? 'neg' : 'muted'}>· {actualPct}% (target {targetPct}%)</span>
        </span>
      </div>
      <div className="progress" style={{ position: 'relative' }}>
        <div className="progress-fill" style={{ width: `${Math.min(100, actualPct)}%`, background: color }} />
        {/* Target marker */}
        <div
          style={{
            position: 'absolute',
            top: -2,
            bottom: -2,
            left: `${Math.min(100, targetPct)}%`,
            width: 2,
            background: '#e6e9ef',
            opacity: 0.6,
          }}
          title={`Target ${targetPct}%`}
        />
      </div>
    </div>
  )
}
