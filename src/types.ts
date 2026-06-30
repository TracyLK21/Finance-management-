// Core domain types for the finance management app.

export type AccountType = 'checking' | 'savings' | 'credit' | 'cash' | 'investment'

export interface Account {
  id: string
  name: string
  type: AccountType
  /** Opening balance when the account was added to the app. */
  openingBalance: number
  createdAt: string
}

export type TransactionType = 'income' | 'expense' | 'transfer'

export interface Transaction {
  id: string
  /** ISO date string (yyyy-mm-dd). */
  date: string
  type: TransactionType
  /** Always stored as a positive number; `type` determines the sign. */
  amount: number
  accountId: string
  /** Destination account for transfers. */
  toAccountId?: string
  categoryId?: string
  note?: string
  createdAt: string
}

export interface Category {
  id: string
  name: string
  /** 'income' categories are excluded from expense budgets. */
  kind: 'income' | 'expense'
  color: string
  icon?: string
}

export interface Budget {
  id: string
  categoryId: string
  /** Monthly budgeted amount. */
  amount: number
}

export interface Goal {
  id: string
  name: string
  targetAmount: number
  savedAmount: number
  /** Optional target date (ISO). */
  targetDate?: string
  color: string
  createdAt: string
}

export interface FinanceState {
  accounts: Account[]
  transactions: Transaction[]
  categories: Category[]
  budgets: Budget[]
  goals: Goal[]
}
