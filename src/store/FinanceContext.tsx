import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import type {
  Account,
  Category,
  FinanceState,
  Goal,
  Transaction,
} from '../types'
import { buildSeedState } from '../data/seed'
import { accountDelta } from './selectors'

const STORAGE_KEY = 'fin.state.v1'
const uid = () => crypto.randomUUID()
const now = () => new Date().toISOString()

type Action =
  | { type: 'ADD_TRANSACTION'; payload: Omit<Transaction, 'id' | 'createdAt'> }
  | { type: 'ADD_TRANSACTIONS'; payload: Omit<Transaction, 'id' | 'createdAt'>[] }
  | {
      type: 'IMPORT_TRANSACTIONS'
      payload: {
        items: (Omit<Transaction, 'id' | 'createdAt'> & { categoryName?: string })[]
        /** When set, adjust the account's opening balance so its computed
         * balance equals targetBalance (reconciles to the bank's figure). */
        reconcile?: { accountId: string; targetBalance: number }
      }
    }
  | { type: 'UPDATE_TRANSACTION'; payload: Transaction }
  | { type: 'DELETE_TRANSACTION'; payload: { id: string } }
  | { type: 'ADD_ACCOUNT'; payload: Omit<Account, 'id' | 'createdAt'> }
  | { type: 'UPDATE_ACCOUNT'; payload: Account }
  | { type: 'DELETE_ACCOUNT'; payload: { id: string } }
  | { type: 'ADD_CATEGORY'; payload: Omit<Category, 'id'> }
  | { type: 'UPDATE_CATEGORY'; payload: Category }
  | { type: 'DELETE_CATEGORY'; payload: { id: string } }
  | { type: 'UPSERT_BUDGET'; payload: { categoryId: string; amount: number } }
  | { type: 'DELETE_BUDGET'; payload: { id: string } }
  | { type: 'ADD_GOAL'; payload: Omit<Goal, 'id' | 'createdAt'> }
  | { type: 'UPDATE_GOAL'; payload: Goal }
  | { type: 'DELETE_GOAL'; payload: { id: string } }
  | { type: 'CONTRIBUTE_GOAL'; payload: { id: string; amount: number } }
  | {
      type: 'CATEGORISE_TRANSACTIONS'
      payload: {
        ids: string[]
        categoryId?: string
        scope?: 'personal' | 'business'
        /** When set, remember this as a rule for future imports. */
        saveRuleMatch?: string
      }
    }
  | { type: 'DELETE_RULE'; payload: { id: string } }
  | { type: 'RESET'; payload: FinanceState }

function reducer(state: FinanceState, action: Action): FinanceState {
  switch (action.type) {
    case 'ADD_TRANSACTION':
      return {
        ...state,
        transactions: [
          { ...action.payload, id: uid(), createdAt: now() },
          ...state.transactions,
        ],
      }
    case 'ADD_TRANSACTIONS': {
      const created = action.payload.map((t) => ({ ...t, id: uid(), createdAt: now() }))
      return { ...state, transactions: [...created, ...state.transactions] }
    }
    case 'IMPORT_TRANSACTIONS': {
      // Resolve each row's category by name, creating categories the user
      // doesn't have yet so the bank's own labels carry through.
      const palette = [
        '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
        '#14b8a6', '#ef4444', '#6366f1', '#f97316', '#22c55e',
      ]
      const categories = [...state.categories]
      const findOrCreate = (name: string, kind: 'income' | 'expense'): string => {
        const existing = categories.find(
          (c) => c.name.toLowerCase() === name.toLowerCase() && c.kind === kind,
        )
        if (existing) return existing.id
        const created: Category = {
          id: uid(),
          name,
          kind,
          group: kind === 'expense' ? 'want' : undefined,
          color: palette[categories.length % palette.length],
          icon: '🏷️',
        }
        categories.push(created)
        return created.id
      }

      const imported = action.payload.items.map((item) => {
        const { categoryName, ...draft } = item
        let categoryId = draft.categoryId
        if (!categoryId && categoryName && draft.type !== 'transfer') {
          categoryId = findOrCreate(categoryName, draft.type === 'income' ? 'income' : 'expense')
        }
        return { ...draft, categoryId, id: uid(), createdAt: now() }
      })

      const allTransactions = [...imported, ...state.transactions]

      // Reconcile the target account's opening balance to the bank's figure.
      let accounts = state.accounts
      const reconcile = action.payload.reconcile
      if (reconcile) {
        const delta = allTransactions.reduce(
          (sum, t) => sum + accountDelta(t, reconcile.accountId),
          0,
        )
        accounts = state.accounts.map((a) =>
          a.id === reconcile.accountId
            ? { ...a, openingBalance: reconcile.targetBalance - delta }
            : a,
        )
      }

      return { ...state, accounts, categories, transactions: allTransactions }
    }
    case 'UPDATE_TRANSACTION':
      return {
        ...state,
        transactions: state.transactions.map((t) =>
          t.id === action.payload.id ? action.payload : t,
        ),
      }
    case 'DELETE_TRANSACTION':
      return {
        ...state,
        transactions: state.transactions.filter((t) => t.id !== action.payload.id),
      }
    case 'ADD_ACCOUNT':
      return {
        ...state,
        accounts: [...state.accounts, { ...action.payload, id: uid(), createdAt: now() }],
      }
    case 'UPDATE_ACCOUNT':
      return {
        ...state,
        accounts: state.accounts.map((a) => (a.id === action.payload.id ? action.payload : a)),
      }
    case 'DELETE_ACCOUNT':
      return {
        ...state,
        accounts: state.accounts.filter((a) => a.id !== action.payload.id),
        transactions: state.transactions.filter(
          (t) => t.accountId !== action.payload.id && t.toAccountId !== action.payload.id,
        ),
      }
    case 'ADD_CATEGORY':
      return { ...state, categories: [...state.categories, { ...action.payload, id: uid() }] }
    case 'UPDATE_CATEGORY':
      return {
        ...state,
        categories: state.categories.map((c) =>
          c.id === action.payload.id ? action.payload : c,
        ),
      }
    case 'DELETE_CATEGORY':
      return {
        ...state,
        categories: state.categories.filter((c) => c.id !== action.payload.id),
        budgets: state.budgets.filter((b) => b.categoryId !== action.payload.id),
        transactions: state.transactions.map((t) =>
          t.categoryId === action.payload.id ? { ...t, categoryId: undefined } : t,
        ),
      }
    case 'UPSERT_BUDGET': {
      const existing = state.budgets.find((b) => b.categoryId === action.payload.categoryId)
      if (existing) {
        return {
          ...state,
          budgets: state.budgets.map((b) =>
            b.categoryId === action.payload.categoryId
              ? { ...b, amount: action.payload.amount }
              : b,
          ),
        }
      }
      return {
        ...state,
        budgets: [
          ...state.budgets,
          { id: uid(), categoryId: action.payload.categoryId, amount: action.payload.amount },
        ],
      }
    }
    case 'DELETE_BUDGET':
      return { ...state, budgets: state.budgets.filter((b) => b.id !== action.payload.id) }
    case 'ADD_GOAL':
      return {
        ...state,
        goals: [...state.goals, { ...action.payload, id: uid(), createdAt: now() }],
      }
    case 'UPDATE_GOAL':
      return {
        ...state,
        goals: state.goals.map((g) => (g.id === action.payload.id ? action.payload : g)),
      }
    case 'DELETE_GOAL':
      return { ...state, goals: state.goals.filter((g) => g.id !== action.payload.id) }
    case 'CONTRIBUTE_GOAL':
      return {
        ...state,
        goals: state.goals.map((g) =>
          g.id === action.payload.id
            ? { ...g, savedAmount: Math.max(0, g.savedAmount + action.payload.amount) }
            : g,
        ),
      }
    case 'CATEGORISE_TRANSACTIONS': {
      const ids = new Set(action.payload.ids)
      const { categoryId, scope } = action.payload
      const transactions = state.transactions.map((t) => {
        if (!ids.has(t.id)) return t
        const next = { ...t }
        if (categoryId !== undefined) next.categoryId = categoryId || undefined
        if (scope === 'business') next.businessAmount = t.amount
        else if (scope === 'personal') next.businessAmount = undefined
        return next
      })

      let rules = state.rules
      if (action.payload.saveRuleMatch && categoryId) {
        const match = action.payload.saveRuleMatch.toLowerCase().trim()
        // Replace any existing rule with the same match.
        rules = [
          ...state.rules.filter((r) => r.match.toLowerCase() !== match),
          { id: uid(), match, categoryId, scope },
        ]
      }
      return { ...state, transactions, rules }
    }
    case 'DELETE_RULE':
      return { ...state, rules: state.rules.filter((r) => r.id !== action.payload.id) }
    case 'RESET':
      return action.payload
    default:
      return state
  }
}

function loadInitialState(): FinanceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as FinanceState
      // Minimal shape validation.
      if (parsed && Array.isArray(parsed.transactions) && Array.isArray(parsed.accounts)) {
        // Backfill fields added in later versions.
        if (!Array.isArray(parsed.rules)) parsed.rules = []
        return parsed
      }
    }
  } catch {
    // fall through to seed
  }
  return buildSeedState()
}

interface FinanceContextValue {
  state: FinanceState
  dispatch: React.Dispatch<Action>
}

const FinanceContext = createContext<FinanceContextValue | null>(null)

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // storage might be full or unavailable; ignore
    }
  }, [state])

  const value = useMemo(() => ({ state, dispatch }), [state])
  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
}

export function useFinance(): FinanceContextValue {
  const ctx = useContext(FinanceContext)
  if (!ctx) throw new Error('useFinance must be used within a FinanceProvider')
  return ctx
}

export { STORAGE_KEY, buildSeedState }
