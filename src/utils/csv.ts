// CSV parsing and bank-statement import helpers.
import type { Category } from '../types'

/** Parse CSV text into rows of string cells. Handles quoted fields and commas. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  // Normalise line endings and strip a leading BOM.
  const src = text.replace(/^﻿/, '')

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(field)
      field = ''
      // Skip fully empty lines.
      if (row.length > 1 || row[0] !== '') rows.push(row)
      row = []
    } else {
      field += ch
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    if (row.length > 1 || row[0] !== '') rows.push(row)
  }
  return rows
}

export type DateFormat = 'DMY' | 'MDY' | 'YMD'

/** Parse a date cell into an ISO yyyy-mm-dd string, or null if unparseable. */
export function parseDate(value: string, format: DateFormat): string | null {
  const v = value.trim()
  if (!v) return null

  // ISO-like yyyy-mm-dd or yyyy/mm/dd
  const iso = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)
  if (iso) {
    const [, y, m, d] = iso
    return toISO(+y, +m, +d)
  }

  const parts = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/)
  if (parts) {
    let [, a, b, c] = parts
    let year = +c
    if (c.length === 2) year += year < 70 ? 2000 : 1900
    if (format === 'DMY') return toISO(year, +b, +a)
    if (format === 'MDY') return toISO(year, +a, +b)
    return toISO(year, +a, +b)
  }

  // Fallback: let the engine try (e.g. "12 Mar 2024").
  const t = Date.parse(v)
  if (!isNaN(t)) {
    const d = new Date(t)
    return toISO(d.getFullYear(), d.getMonth() + 1, d.getDate())
  }
  return null
}

function toISO(year: number, month: number, day: number): string | null {
  if (!year || !month || !day || month > 12 || day > 31) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Parse a money cell to a number. Strips currency symbols, thousands separators, and parens. */
export function parseAmount(value: string): number | null {
  if (value == null) return null
  let v = value.trim()
  if (!v) return null
  let sign = 1
  // Accountancy negatives: (123.45)
  if (/^\(.*\)$/.test(v)) {
    sign = -1
    v = v.slice(1, -1)
  }
  if (v.includes('-')) sign = -1
  v = v.replace(/[^0-9.]/g, '')
  if (!v) return null
  const num = parseFloat(v)
  return isNaN(num) ? null : sign * num
}

// ---- Auto-categorisation ----
// Keyword rules tuned for common Australian merchants. Each rule maps to a
// category name; we then resolve that name against the user's categories.
interface Rule {
  category: string
  keywords: string[]
}

const RULES: Rule[] = [
  {
    category: 'Groceries',
    keywords: ['woolworths', 'woolies', 'coles', 'aldi', 'iga', 'foodland', 'costco', 'supabarn', 'harris farm'],
  },
  {
    category: 'Dining',
    keywords: [
      'mcdonald', 'kfc', 'hungry jack', 'domino', 'pizza', 'uber eats', 'ubereats', 'menulog',
      'deliveroo', 'doordash', 'cafe', 'restaurant', 'sushi', 'guzman', 'nando', "grill'd",
      'subway', 'starbucks', 'coffee', 'bakery', 'thai', 'noodle', 'burger',
    ],
  },
  {
    category: 'Transport',
    keywords: [
      'uber', 'didi', 'ola', 'opal', 'myki', 'go card', 'translink', 'bp ', 'caltex', 'shell',
      'ampol', '7-eleven', 'united petroleum', 'linkt', 'e-toll', 'etoll', 'parking', 'fuel',
      'metro', 'transport', 'qantas', 'jetstar', 'virgin',
    ],
  },
  {
    category: 'Utilities',
    keywords: [
      'agl', 'origin energy', 'energy australia', 'energyaustralia', 'telstra', 'optus',
      'vodafone', 'tpg', 'belong', 'aussie broadband', 'water', 'electricity', 'gas', 'internet',
    ],
  },
  {
    category: 'Entertainment',
    keywords: [
      'netflix', 'spotify', 'disney', 'stan', 'binge', 'foxtel', 'kayo', 'amazon prime',
      'prime video', 'youtube premium', 'apple music', 'cinema', 'hoyts', 'event cinema',
      'steam', 'playstation', 'xbox', 'nintendo', 'audible', 'patreon',
    ],
  },
  {
    category: 'Shopping',
    keywords: [
      'kmart', 'target', 'big w', 'bunnings', 'jb hi-fi', 'jbhifi', 'harvey norman', 'amazon',
      'ebay', 'myer', 'david jones', 'cotton on', 'uniqlo', 'asos', 'the iconic', 'officeworks',
      'rebel', 'chemist warehouse',
    ],
  },
  {
    category: 'Rent',
    keywords: ['rent', 'real estate', 'property', 'lease', 'landlord'],
  },
  {
    category: 'Health',
    keywords: [
      'pharmacy', 'chemist', 'priceline', 'terry white', 'medicare', 'dental', 'physio',
      'gym', 'fitness', 'anytime fitness', 'doctor', 'medical', 'optical', 'health',
    ],
  },
  {
    category: 'Salary',
    keywords: ['salary', 'payroll', 'wage', 'pay run', 'wages'],
  },
]

/**
 * Returns the id of the best-matching category for a transaction description,
 * or undefined if nothing matches. Only considers categories the user has.
 */
export function autoCategorise(
  description: string,
  categories: Category[],
  isIncome: boolean,
): string | undefined {
  const text = description.toLowerCase()
  for (const rule of RULES) {
    if (rule.keywords.some((kw) => text.includes(kw))) {
      const cat = categories.find(
        (c) => c.name.toLowerCase() === rule.category.toLowerCase(),
      )
      if (!cat) continue
      // Don't tag an expense with an income category or vice versa.
      if (isIncome && cat.kind !== 'income') continue
      if (!isIncome && cat.kind !== 'expense') continue
      return cat.id
    }
  }
  return undefined
}
