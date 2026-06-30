// CSV parsing and bank-statement import helpers.
import type { Category, CategoryRule } from '../types'

/**
 * Derives a stable "merchant" key from a messy bank description so similar
 * transactions group together. Strips dates, card prefixes and reference
 * numbers, then keeps the first few meaningful words.
 */
export function merchantKey(description: string): string {
  let s = (description || '').toLowerCase()
  s = s.replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, ' ') // dates like 16/02
  s = s.replace(/\b[a-z]?\d{4,}\b/g, ' ') // long reference / card numbers
  s = s.replace(/\bv\d+\b/g, ' ') // card prefixes like v5137
  s = s.replace(/[_]/g, ' ')
  s = s.replace(/[^a-z0-9.&/ ]/g, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  const tokens = s.split(' ').filter(Boolean).slice(0, 3)
  return tokens.join(' ').trim()
}

/** Returns the first rule whose match is a substring of the description. */
export function matchRule(description: string, rules: CategoryRule[]): CategoryRule | undefined {
  const text = (description || '').toLowerCase()
  return rules.find((r) => r.match && text.includes(r.match.toLowerCase()))
}

/**
 * Detect the field delimiter (comma, tab, semicolon or pipe) by counting
 * candidates on the first non-empty line.
 */
export function detectDelimiter(text: string): string {
  const firstLine = text.replace(/^﻿/, '').split(/\r?\n/).find((l) => l.trim() !== '') ?? ''
  const candidates = ['\t', ',', ';', '|']
  let best = ','
  let bestCount = 0
  for (const d of candidates) {
    const count = firstLine.split(d).length - 1
    if (count > bestCount) {
      best = d
      bestCount = count
    }
  }
  return bestCount === 0 ? ',' : best
}

/** Parse delimited text (CSV/TSV) into rows of string cells. Handles quoted fields. */
export function parseCSV(text: string, delimiter?: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  // Normalise line endings and strip a leading BOM.
  const src = text.replace(/^﻿/, '')
  const sep = delimiter ?? detectDelimiter(src)

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
    } else if (ch === sep) {
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

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

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

  // Month-name dates: 15-May-26, 3 Feb 2026, 15/Jan/2026
  const named = v.match(/^(\d{1,2})[-/ ]([A-Za-z]{3,9})[-/ ](\d{2,4})$/)
  if (named) {
    const [, d, mon, y] = named
    const m = MONTHS[mon.slice(0, 3).toLowerCase()]
    if (m) {
      let year = +y
      if (y.length <= 2) year += year < 70 ? 2000 : 1900
      return toISO(year, m, +d)
    }
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

// Maps common bank-supplied category labels to canonical category names so we
// reuse existing categories instead of creating near-duplicates.
const CATEGORY_SYNONYMS: Record<string, string> = {
  'eating out': 'Dining', restaurants: 'Dining', restaurant: 'Dining', cafes: 'Dining',
  cafe: 'Dining', takeaway: 'Dining', 'food & drink': 'Dining', 'food and drink': 'Dining',
  dining: 'Dining',
  groceries: 'Groceries', supermarkets: 'Groceries', supermarket: 'Groceries',
  fuel: 'Transport', petrol: 'Transport', transport: 'Transport', car: 'Transport',
  automotive: 'Transport', 'public transport': 'Transport', travel: 'Transport',
  utilities: 'Utilities', bills: 'Utilities', 'bills & utilities': 'Utilities',
  phone: 'Utilities', internet: 'Utilities', electricity: 'Utilities', gas: 'Utilities',
  water: 'Utilities',
  rent: 'Rent', mortgage: 'Rent', housing: 'Rent', home: 'Rent',
  health: 'Health', medical: 'Health', pharmacy: 'Health', fitness: 'Health',
  'health & fitness': 'Health',
  entertainment: 'Entertainment', subscriptions: 'Entertainment', streaming: 'Entertainment',
  media: 'Entertainment',
  shopping: 'Shopping', retail: 'Shopping', clothing: 'Shopping', 'general retail': 'Shopping',
  salary: 'Salary', income: 'Salary', wages: 'Salary', pay: 'Salary',
}

// Bank categories that carry no useful classification — leave these uncategorised.
const CATEGORY_SKIP = new Set([
  'transfers out', 'transfers in', 'transfer', 'transfers', 'uncategorised',
  'uncategorized', 'other', 'miscellaneous', 'misc', 'payment', 'payments',
])

/**
 * Normalises a bank-supplied category label to a category name we should use,
 * or '' if it should be skipped (left uncategorised).
 */
export function canonicalCategory(raw: string): string {
  const v = raw.trim()
  if (!v) return ''
  const key = v.toLowerCase()
  if (CATEGORY_SKIP.has(key)) return ''
  return CATEGORY_SYNONYMS[key] ?? v
}

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
