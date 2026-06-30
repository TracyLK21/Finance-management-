import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useFinance } from '../store/FinanceContext'
import { categoryById } from '../store/selectors'
import type { Transaction } from '../types'
import {
  autoCategorise,
  canonicalCategory,
  matchRule,
  parseAmount,
  parseCSV,
  parseDate,
  type DateFormat,
} from '../utils/csv'
import { formatCurrency, formatDate } from '../utils/format'

type Draft = Omit<Transaction, 'id' | 'createdAt'> & { categoryName?: string }

const colLabel = (i: number) => `Column ${i + 1}`

export default function Import() {
  const { state, dispatch } = useFinance()
  const [rows, setRows] = useState<string[][]>([])
  const [fileName, setFileName] = useState('')
  const [hasHeader, setHasHeader] = useState(true)
  const [headers, setHeaders] = useState<string[]>([])

  const [dateCol, setDateCol] = useState(-1)
  const [descCol, setDescCol] = useState(-1)
  const [amountMode, setAmountMode] = useState<'single' | 'debitcredit'>('single')
  const [amountCol, setAmountCol] = useState(-1)
  const [debitCol, setDebitCol] = useState(-1)
  const [creditCol, setCreditCol] = useState(-1)
  const [categoryCol, setCategoryCol] = useState(-1)
  const [balanceCol, setBalanceCol] = useState(-1)
  const [expensesNegative, setExpensesNegative] = useState(true)
  const [dateFormat, setDateFormat] = useState<DateFormat>('DMY')

  const [accountId, setAccountId] = useState(state.accounts[0]?.id ?? '')
  const [defaultScope, setDefaultScope] = useState<'personal' | 'business'>('personal')
  const [imported, setImported] = useState<number | null>(null)

  function autoGuess(hdrs: string[]) {
    const find = (...keys: string[]) =>
      hdrs.findIndex((h) => keys.some((k) => h.toLowerCase().includes(k)))
    setDateCol(find('date'))
    // Prefer a specific "details/narrative/merchant" column over a generic
    // "transaction type" column.
    let desc = find('details', 'narrative', 'description', 'particulars', 'memo')
    if (desc < 0) desc = find('merchant')
    if (desc < 0) desc = find('reference', 'transaction')
    setDescCol(desc)
    setCategoryCol(find('category'))
    setBalanceCol(find('balance'))
    const amt = find('amount')
    const deb = find('debit', 'withdrawal')
    const cred = find('credit', 'deposit')
    if (deb >= 0 && cred >= 0) {
      setAmountMode('debitcredit')
      setDebitCol(deb)
      setCreditCol(cred)
    } else {
      setAmountMode('single')
      setAmountCol(amt >= 0 ? amt : 1)
    }
  }

  function handleFile(file: File) {
    setImported(null)
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const parsed = parseCSV(String(reader.result ?? ''))
      if (parsed.length === 0) return
      setRows(parsed)
      // Decide header: if first row has no parseable number anywhere, treat as header.
      const firstHasNumber = parsed[0].some((c) => parseAmount(c) != null && /\d/.test(c))
      const headerRow = !firstHasNumber
      setHasHeader(headerRow)
      const hdrs = headerRow ? parsed[0] : parsed[0].map((_, i) => colLabel(i))
      setHeaders(hdrs)
      autoGuess(headerRow ? hdrs : parsed[0].map((_, i) => colLabel(i)))
    }
    reader.readAsText(file)
  }

  const dataRows = useMemo(
    () => (hasHeader ? rows.slice(1) : rows),
    [rows, hasHeader],
  )

  const drafts = useMemo<Draft[]>(() => {
    if (!accountId || dateCol < 0 || descCol < 0) return []
    const out: Draft[] = []
    for (const row of dataRows) {
      const iso = parseDate(row[dateCol] ?? '', dateFormat)
      const desc = (row[descCol] ?? '').trim()
      if (!iso) continue

      let amount = 0
      let isIncome = false
      if (amountMode === 'single') {
        const val = parseAmount(row[amountCol] ?? '')
        if (val == null || val === 0) continue
        isIncome = expensesNegative ? val > 0 : val < 0
        amount = Math.abs(val)
      } else {
        const debit = parseAmount(row[debitCol] ?? '') ?? 0
        const credit = parseAmount(row[creditCol] ?? '') ?? 0
        if (Math.abs(credit) > 0) {
          isIncome = true
          amount = Math.abs(credit)
        } else if (Math.abs(debit) > 0) {
          isIncome = false
          amount = Math.abs(debit)
        } else {
          continue
        }
      }

      const type = isIncome ? 'income' : 'expense'

      // Priority: your saved rules → the bank's category column → keyword guess.
      let categoryId: string | undefined
      let categoryName: string | undefined
      let scope: 'personal' | 'business' | undefined
      const rule = matchRule(desc, state.rules)
      if (rule) {
        categoryId = rule.categoryId
        scope = rule.scope
      } else if (categoryCol >= 0) {
        const canon = canonicalCategory(row[categoryCol] ?? '')
        if (canon) categoryName = canon
      }
      if (!categoryId && !categoryName) categoryId = autoCategorise(desc, state.categories, isIncome)

      const business =
        scope === 'business' || (scope === undefined && !isIncome && defaultScope === 'business')
      out.push({
        date: iso,
        type,
        amount,
        accountId,
        categoryId,
        categoryName,
        businessAmount: !isIncome && business ? amount : undefined,
        note: desc || undefined,
      })
    }
    return out
  }, [
    dataRows, accountId, dateCol, descCol, amountMode, amountCol, debitCol, creditCol,
    categoryCol, expensesNegative, dateFormat, defaultScope, state.categories, state.rules,
  ])

  // Skip rows that already exist (same account, date, type, amount, note) so
  // re-importing a statement doesn't double-count anything.
  const { uniqueDrafts, duplicatesSkipped } = useMemo(() => {
    const key = (accId: string, date: string, type: string, amount: number, note?: string) =>
      `${accId}|${date}|${type}|${amount}|${(note ?? '').trim()}`
    const existing = new Set(
      state.transactions.map((t) => key(t.accountId, t.date, t.type, t.amount, t.note)),
    )
    const unique: Draft[] = []
    const seen = new Set<string>()
    let dup = 0
    for (const d of drafts) {
      const k = key(d.accountId, d.date, d.type, d.amount, d.note)
      if (existing.has(k) || seen.has(k)) {
        dup++
        continue
      }
      seen.add(k)
      unique.push(d)
    }
    return { uniqueDrafts: unique, duplicatesSkipped: dup }
  }, [drafts, state.transactions])

  const matched = uniqueDrafts.filter((d) => d.categoryId || d.categoryName).length

  // Balance after the most recent dated row — used to reconcile the account
  // so its balance matches the bank exactly.
  const targetBalance = useMemo(() => {
    if (balanceCol < 0 || dateCol < 0) return null
    let bestDate = ''
    let bal: number | null = null
    for (const row of dataRows) {
      const iso = parseDate(row[dateCol] ?? '', dateFormat)
      const b = parseAmount(row[balanceCol] ?? '')
      if (!iso || b == null) continue
      if (iso > bestDate) {
        bestDate = iso
        bal = b
      }
    }
    return bal
  }, [dataRows, balanceCol, dateCol, dateFormat])

  function doImport() {
    if (uniqueDrafts.length === 0) return
    const reconcile =
      balanceCol >= 0 && targetBalance != null && accountId
        ? { accountId, targetBalance }
        : undefined
    dispatch({ type: 'IMPORT_TRANSACTIONS', payload: { items: uniqueDrafts, reconcile } })
    setImported(uniqueDrafts.length)
    setRows([])
    setHeaders([])
    setFileName('')
  }

  const columnOptions = headers.map((h, i) => (
    <option key={i} value={i}>
      {h || colLabel(i)}
    </option>
  ))

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Import bank statement</h1>
          <p className="page-subtitle">
            Upload a CSV exported from your bank — we'll sort and categorise it for you
          </p>
        </div>
      </div>

      {state.accounts.length === 0 && (
        <div className="card" style={{ marginBottom: 18, borderColor: 'var(--warning)' }}>
          <strong style={{ color: 'var(--warning)' }}>Add an account first.</strong>{' '}
          <span className="muted">
            Imported transactions need somewhere to live —{' '}
            <Link to="/accounts" style={{ color: 'var(--primary)' }}>add your account(s)</Link>{' '}
            (e.g. your business and personal accounts), then come back here.
          </span>
        </div>
      )}

      {imported != null && (
        <div className="card" style={{ marginBottom: 18, borderColor: 'var(--primary)' }}>
          <strong className="pos">✅ Imported {imported} transactions.</strong>{' '}
          <span className="muted">
            Review them on the Transactions page, then check the Insights page for your breakdown.
          </span>
        </div>
      )}

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 className="card-title">1. Choose your CSV file</h3>
        <p className="muted" style={{ fontSize: 13, marginTop: -8 }}>
          In your online banking, look for “Export”, “Download transactions”, or “Statements” and
          choose <strong>CSV</strong>. Then pick the file here.
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
          }}
          className="input"
          style={{ padding: 9 }}
        />
        {fileName && (
          <div className="muted" style={{ fontSize: 13, marginTop: 8 }}>
            Loaded <strong>{fileName}</strong> · {Math.max(0, rows.length - (hasHeader ? 1 : 0))} rows
          </div>
        )}
      </div>

      {rows.length > 0 && (
        <>
          <div className="card" style={{ marginBottom: 18 }}>
            <h3 className="card-title">2. Tell us which columns are which</h3>

            <label className="tag" style={{ cursor: 'pointer', marginBottom: 14 }}>
              <input
                type="checkbox"
                checked={hasHeader}
                onChange={(e) => setHasHeader(e.target.checked)}
              />
              First row is a header (column names)
            </label>

            <div className="form-row">
              <div className="field">
                <label>Date column</label>
                <select className="select" value={dateCol} onChange={(e) => setDateCol(+e.target.value)}>
                  <option value={-1}>Select…</option>
                  {columnOptions}
                </select>
              </div>
              <div className="field">
                <label>Date format</label>
                <select className="select" value={dateFormat} onChange={(e) => setDateFormat(e.target.value as DateFormat)}>
                  <option value="DMY">Day/Month/Year (Australian)</option>
                  <option value="MDY">Month/Day/Year (US)</option>
                  <option value="YMD">Year-Month-Day</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label>Description column</label>
              <select className="select" value={descCol} onChange={(e) => setDescCol(+e.target.value)}>
                <option value={-1}>Select…</option>
                {columnOptions}
              </select>
            </div>

            <div className="field">
              <label>Category column (optional — if your statement has one)</label>
              <select className="select" value={categoryCol} onChange={(e) => setCategoryCol(+e.target.value)}>
                <option value={-1}>None — sort automatically</option>
                {columnOptions}
              </select>
              {categoryCol >= 0 && (
                <span className="muted" style={{ fontSize: 12 }}>
                  We'll use your bank's labels and create any categories you don't have yet (you can
                  re-tag them as need/want later).
                </span>
              )}
            </div>

            <div className="field">
              <label>How are amounts shown?</label>
              <div className="segmented">
                <button
                  type="button"
                  className={amountMode === 'single' ? 'active' : ''}
                  onClick={() => setAmountMode('single')}
                >
                  One amount column
                </button>
                <button
                  type="button"
                  className={amountMode === 'debitcredit' ? 'active' : ''}
                  onClick={() => setAmountMode('debitcredit')}
                >
                  Separate debit/credit
                </button>
              </div>
            </div>

            {amountMode === 'single' ? (
              <>
                <div className="field">
                  <label>Amount column</label>
                  <select className="select" value={amountCol} onChange={(e) => setAmountCol(+e.target.value)}>
                    <option value={-1}>Select…</option>
                    {columnOptions}
                  </select>
                </div>
                <label className="tag" style={{ cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={expensesNegative}
                    onChange={(e) => setExpensesNegative(e.target.checked)}
                  />
                  Money spent shows as a negative number (most banks)
                </label>
              </>
            ) : (
              <div className="form-row">
                <div className="field">
                  <label>Debit (spent) column</label>
                  <select className="select" value={debitCol} onChange={(e) => setDebitCol(+e.target.value)}>
                    <option value={-1}>Select…</option>
                    {columnOptions}
                  </select>
                </div>
                <div className="field">
                  <label>Credit (received) column</label>
                  <select className="select" value={creditCol} onChange={(e) => setCreditCol(+e.target.value)}>
                    <option value={-1}>Select…</option>
                    {columnOptions}
                  </select>
                </div>
              </div>
            )}

            <div className="field" style={{ marginTop: 14 }}>
              <label>Balance column (optional — recommended)</label>
              <select className="select" value={balanceCol} onChange={(e) => setBalanceCol(+e.target.value)}>
                <option value={-1}>None</option>
                {columnOptions}
              </select>
              {balanceCol >= 0 && targetBalance != null && (
                <span className="muted" style={{ fontSize: 12 }}>
                  ✅ We'll set this account to match your bank: {formatCurrency(targetBalance)}.
                </span>
              )}
              {balanceCol < 0 && (
                <span className="muted" style={{ fontSize: 12 }}>
                  If your statement has a running balance column, choosing it makes the account
                  balance match your bank exactly.
                </span>
              )}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 18 }}>
            <h3 className="card-title">3. Where do these belong?</h3>
            <div className="form-row">
              <div className="field">
                <label>Import into account</label>
                <select className="select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  {state.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Tag expenses as</label>
                <div className="segmented">
                  <button
                    type="button"
                    className={defaultScope === 'personal' ? 'active' : ''}
                    onClick={() => setDefaultScope('personal')}
                  >
                    Personal
                  </button>
                  <button
                    type="button"
                    className={defaultScope === 'business' ? 'active' : ''}
                    onClick={() => setDefaultScope('business')}
                  >
                    Business
                  </button>
                </div>
              </div>
            </div>
            <p className="muted" style={{ fontSize: 12.5 }}>
              This is just a starting point — you can re-tag any transaction (including marking it a
              split of business + personal) afterwards on the Transactions page.
            </p>
          </div>

          <div className="card">
            <h3 className="card-title">
              4. Preview
              <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>
                {uniqueDrafts.length} ready · {matched} auto-categorised
                {duplicatesSkipped > 0 ? ` · ${duplicatesSkipped} duplicates skipped` : ''}
              </span>
            </h3>
            {uniqueDrafts.length === 0 ? (
              <div className="empty">
                {duplicatesSkipped > 0
                  ? `All ${duplicatesSkipped} rows are already imported — nothing new to add.`
                  : 'Select the Date, Description and Amount columns above to see a preview.'}
              </div>
            ) : (
              <>
                {duplicatesSkipped > 0 && (
                  <p className="muted" style={{ fontSize: 12.5, marginTop: -6, marginBottom: 12 }}>
                    Skipping {duplicatesSkipped} row{duplicatesSkipped === 1 ? '' : 's'} already in
                    this account.
                  </p>
                )}
                <div className="txn-list">
                  {uniqueDrafts.slice(0, 8).map((d, i) => {
                    const cat = categoryById(state, d.categoryId)
                    const catLabel = d.categoryName ?? cat?.name ?? 'Uncategorised'
                    return (
                      <div className="txn-row" key={i}>
                        <div className="txn-icon">{d.type === 'income' ? '💰' : cat?.icon ?? '🏷️'}</div>
                        <div>
                          <div className="txn-note">{d.note || '(no description)'}</div>
                          <div className="txn-sub">
                            {catLabel} · {d.businessAmount ? 'Business' : 'Personal'}
                          </div>
                        </div>
                        <div className="txn-col-hide muted" style={{ fontSize: 13 }}>
                          {formatDate(d.date)}
                        </div>
                        <div className={`txn-amount ${d.type === 'income' ? 'pos' : 'neg'}`}>
                          {d.type === 'income' ? '+' : '−'}
                          {formatCurrency(d.amount)}
                        </div>
                        <div />
                      </div>
                    )
                  })}
                </div>
                {uniqueDrafts.length > 8 && (
                  <div className="muted" style={{ fontSize: 13, marginTop: 10 }}>
                    …and {uniqueDrafts.length - 8} more.
                  </div>
                )}
                <div style={{ marginTop: 18 }}>
                  <button className="btn btn-primary" onClick={doImport}>
                    Import {uniqueDrafts.length} transactions
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  )
}
