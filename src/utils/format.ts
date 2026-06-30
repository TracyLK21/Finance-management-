// Formatting helpers shared across the app.

const currencyFormatter = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const compactCurrencyFormatter = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value)
}

export function formatCompactCurrency(value: number): string {
  return compactCurrencyFormatter.format(value)
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatMonthLabel(monthKey: string): string {
  // monthKey is yyyy-mm
  const [year, month] = monthKey.split('-').map(Number)
  const d = new Date(year, month - 1, 1)
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}
