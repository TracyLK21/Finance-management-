import type { Account, Category, FinanceState, Transaction } from '../types'
import { monthKey, recentMonthKeys } from '../utils/date'

/** Net effect of a transaction on a given account's balance. */
export function accountDelta(t: Transaction, accountId: string): number {
  if (t.type === 'income' && t.accountId === accountId) return t.amount
  if (t.type === 'expense' && t.accountId === accountId) return -t.amount
  if (t.type === 'transfer') {
    if (t.accountId === accountId) return -t.amount
    if (t.toAccountId === accountId) return t.amount
  }
  return 0
}

export function accountBalance(state: FinanceState, account: Account): number {
  return state.transactions.reduce(
    (sum, t) => sum + accountDelta(t, account.id),
    account.openingBalance,
  )
}

export function totalNetWorth(state: FinanceState): number {
  return state.accounts.reduce((sum, a) => sum + accountBalance(state, a), 0)
}

export interface MonthSummary {
  monthKey: string
  income: number
  expense: number
  net: number
}

export function monthlySummaries(state: FinanceState, monthCount: number): MonthSummary[] {
  const keys = recentMonthKeys(monthCount)
  const map = new Map<string, MonthSummary>(
    keys.map((k) => [k, { monthKey: k, income: 0, expense: 0, net: 0 }]),
  )
  for (const t of state.transactions) {
    const k = monthKey(t.date)
    const entry = map.get(k)
    if (!entry) continue
    if (t.type === 'income') entry.income += t.amount
    else if (t.type === 'expense') entry.expense += t.amount
  }
  for (const entry of map.values()) entry.net = entry.income - entry.expense
  return keys.map((k) => map.get(k)!)
}

export function summaryForMonth(state: FinanceState, monthKeyStr: string): MonthSummary {
  const entry: MonthSummary = { monthKey: monthKeyStr, income: 0, expense: 0, net: 0 }
  for (const t of state.transactions) {
    if (monthKey(t.date) !== monthKeyStr) continue
    if (t.type === 'income') entry.income += t.amount
    else if (t.type === 'expense') entry.expense += t.amount
  }
  entry.net = entry.income - entry.expense
  return entry
}

export interface CategorySpend {
  category: Category
  spent: number
}

/** Expense totals per category for a given month, sorted descending. */
export function spendingByCategory(state: FinanceState, monthKeyStr: string): CategorySpend[] {
  const totals = new Map<string, number>()
  for (const t of state.transactions) {
    if (t.type !== 'expense' || !t.categoryId) continue
    if (monthKey(t.date) !== monthKeyStr) continue
    totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amount)
  }
  const result: CategorySpend[] = []
  for (const [categoryId, spent] of totals) {
    const category = state.categories.find((c) => c.id === categoryId)
    if (category) result.push({ category, spent })
  }
  return result.sort((a, b) => b.spent - a.spent)
}

export interface BudgetProgress {
  budgetId: string
  category: Category
  budgeted: number
  spent: number
  remaining: number
  ratio: number
}

export function budgetProgress(state: FinanceState, monthKeyStr: string): BudgetProgress[] {
  const spendByCat = new Map<string, number>()
  for (const t of state.transactions) {
    if (t.type !== 'expense' || !t.categoryId) continue
    if (monthKey(t.date) !== monthKeyStr) continue
    spendByCat.set(t.categoryId, (spendByCat.get(t.categoryId) ?? 0) + t.amount)
  }
  const result: BudgetProgress[] = []
  for (const b of state.budgets) {
    const category = state.categories.find((c) => c.id === b.categoryId)
    if (!category) continue
    const spent = spendByCat.get(b.categoryId) ?? 0
    result.push({
      budgetId: b.id,
      category,
      budgeted: b.amount,
      spent,
      remaining: b.amount - spent,
      ratio: b.amount > 0 ? spent / b.amount : 0,
    })
  }
  return result.sort((a, b) => b.ratio - a.ratio)
}

export function categoryById(state: FinanceState, id?: string): Category | undefined {
  return id ? state.categories.find((c) => c.id === id) : undefined
}

export function accountById(state: FinanceState, id?: string): Account | undefined {
  return id ? state.accounts.find((a) => a.id === id) : undefined
}
