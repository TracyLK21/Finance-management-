import type { FinanceState } from '../types'
import { currentMonthKey, addMonths } from '../utils/date'

const uid = () => crypto.randomUUID()

// Build a date within a given month key (yyyy-mm) on a specific day.
function dayIn(monthKeyStr: string, day: number): string {
  return `${monthKeyStr}-${String(day).padStart(2, '0')}`
}

/**
 * Generates a realistic starter dataset so the dashboard looks alive on first
 * load. Spans the current month and the two prior months.
 */
export function buildSeedState(): FinanceState {
  const checking = uid()
  const savings = uid()
  const credit = uid()

  // Category ids
  const cIncome = uid()
  const cGroceries = uid()
  const cRent = uid()
  const cDining = uid()
  const cTransport = uid()
  const cUtilities = uid()
  const cEntertainment = uid()
  const cShopping = uid()
  const cHealth = uid()

  const categories = [
    { id: cIncome, name: 'Salary', kind: 'income' as const, color: '#10b981', icon: '💰' },
    { id: cRent, name: 'Rent', kind: 'expense' as const, group: 'need' as const, color: '#6366f1', icon: '🏠' },
    { id: cGroceries, name: 'Groceries', kind: 'expense' as const, group: 'need' as const, color: '#f59e0b', icon: '🛒' },
    { id: cDining, name: 'Dining', kind: 'expense' as const, group: 'want' as const, color: '#ef4444', icon: '🍽️' },
    { id: cTransport, name: 'Transport', kind: 'expense' as const, group: 'need' as const, color: '#3b82f6', icon: '🚗' },
    { id: cUtilities, name: 'Utilities', kind: 'expense' as const, group: 'need' as const, color: '#8b5cf6', icon: '💡' },
    { id: cEntertainment, name: 'Entertainment', kind: 'expense' as const, group: 'want' as const, color: '#ec4899', icon: '🎬' },
    { id: cShopping, name: 'Shopping', kind: 'expense' as const, group: 'want' as const, color: '#14b8a6', icon: '🛍️' },
    { id: cHealth, name: 'Health', kind: 'expense' as const, group: 'need' as const, color: '#f97316', icon: '🩺' },
  ]

  const accounts = [
    { id: checking, name: 'Everyday Account', type: 'transaction' as const, openingBalance: 2400, createdAt: new Date().toISOString() },
    { id: savings, name: 'High-Yield Savings', type: 'savings' as const, openingBalance: 8200, createdAt: new Date().toISOString() },
    { id: credit, name: 'Rewards Credit Card', type: 'credit' as const, openingBalance: -640, createdAt: new Date().toISOString() },
  ]

  const months = [addMonths(currentMonthKey(), -2), addMonths(currentMonthKey(), -1), currentMonthKey()]
  const transactions = []
  const now = new Date().toISOString()

  for (const m of months) {
    // Monthly income
    transactions.push({
      id: uid(), date: dayIn(m, 1), type: 'income' as const, amount: 4200,
      accountId: checking, categoryId: cIncome, note: 'Monthly paycheck', createdAt: now,
    })
    // Rent
    transactions.push({
      id: uid(), date: dayIn(m, 3), type: 'expense' as const, amount: 1450,
      accountId: checking, categoryId: cRent, note: 'Apartment rent', createdAt: now,
    })
    // Utilities
    transactions.push({
      id: uid(), date: dayIn(m, 8), type: 'expense' as const, amount: 130 + Math.round(Math.random() * 40),
      accountId: checking, categoryId: cUtilities, note: 'Electric & internet', createdAt: now,
    })
    // Groceries — a few per month
    for (const day of [5, 12, 19, 26]) {
      transactions.push({
        id: uid(), date: dayIn(m, day), type: 'expense' as const, amount: 55 + Math.round(Math.random() * 50),
        accountId: credit, categoryId: cGroceries, note: 'Grocery run', createdAt: now,
      })
    }
    // Dining
    for (const day of [7, 14, 21]) {
      transactions.push({
        id: uid(), date: dayIn(m, day), type: 'expense' as const, amount: 25 + Math.round(Math.random() * 45),
        accountId: credit, categoryId: cDining, note: 'Restaurant', createdAt: now,
      })
    }
    // Transport
    transactions.push({
      id: uid(), date: dayIn(m, 10), type: 'expense' as const, amount: 60 + Math.round(Math.random() * 40),
      accountId: credit, categoryId: cTransport, note: 'Gas & transit', createdAt: now,
    })
    // Entertainment
    transactions.push({
      id: uid(), date: dayIn(m, 17), type: 'expense' as const, amount: 30 + Math.round(Math.random() * 30),
      accountId: credit, categoryId: cEntertainment, note: 'Movies & streaming', createdAt: now,
    })
    // Shopping
    transactions.push({
      id: uid(), date: dayIn(m, 22), type: 'expense' as const, amount: 40 + Math.round(Math.random() * 80),
      accountId: credit, categoryId: cShopping, note: 'Online order', createdAt: now,
    })
    // Transfer to savings
    transactions.push({
      id: uid(), date: dayIn(m, 2), type: 'transfer' as const, amount: 500,
      accountId: checking, toAccountId: savings, note: 'Auto-save', createdAt: now,
    })
  }

  const budgets = [
    { id: uid(), categoryId: cRent, amount: 1450 },
    { id: uid(), categoryId: cGroceries, amount: 350 },
    { id: uid(), categoryId: cDining, amount: 180 },
    { id: uid(), categoryId: cTransport, amount: 120 },
    { id: uid(), categoryId: cUtilities, amount: 180 },
    { id: uid(), categoryId: cEntertainment, amount: 80 },
    { id: uid(), categoryId: cShopping, amount: 150 },
  ]

  const goals = [
    { id: uid(), name: 'Emergency Fund', targetAmount: 10000, savedAmount: 6500, color: '#10b981', createdAt: now, targetDate: addMonths(currentMonthKey(), 6) + '-01' },
    { id: uid(), name: 'Vacation', targetAmount: 3000, savedAmount: 1200, color: '#3b82f6', createdAt: now, targetDate: addMonths(currentMonthKey(), 4) + '-01' },
    { id: uid(), name: 'New Laptop', targetAmount: 1800, savedAmount: 1800, color: '#8b5cf6', createdAt: now },
  ]

  return { accounts, transactions, categories, budgets, goals }
}
