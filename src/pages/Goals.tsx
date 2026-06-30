import { useState } from 'react'
import { useFinance } from '../store/FinanceContext'
import type { Goal } from '../types'
import Modal from '../components/Modal'
import { formatCurrency, formatDate } from '../utils/format'

const PALETTE = ['#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#14b8a6', '#ef4444']

export default function Goals() {
  const { state } = useFinance()
  const [editing, setEditing] = useState<Goal | null>(null)
  const [creating, setCreating] = useState(false)

  const totalTarget = state.goals.reduce((s, g) => s + g.targetAmount, 0)
  const totalSaved = state.goals.reduce((s, g) => s + g.savedAmount, 0)

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Savings Goals</h1>
          <p className="page-subtitle">
            {formatCurrency(totalSaved)} saved toward {formatCurrency(totalTarget)}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + New goal
        </button>
      </div>

      {state.goals.length === 0 ? (
        <div className="card">
          <div className="empty">No goals yet. Create one to start tracking your progress.</div>
        </div>
      ) : (
        <div className="grid grid-2">
          {state.goals.map((g) => (
            <GoalCard key={g.id} goal={g} onEdit={() => setEditing(g)} />
          ))}
        </div>
      )}

      {creating && <GoalModal onClose={() => setCreating(false)} />}
      {editing && <GoalModal existing={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function GoalCard({ goal, onEdit }: { goal: Goal; onEdit: () => void }) {
  const { dispatch } = useFinance()
  const ratio = goal.targetAmount > 0 ? goal.savedAmount / goal.targetAmount : 0
  const pct = Math.min(100, Math.round(ratio * 100))
  const complete = goal.savedAmount >= goal.targetAmount
  const remaining = Math.max(0, goal.targetAmount - goal.savedAmount)

  // Donut ring via conic-gradient.
  const ringStyle: React.CSSProperties = {
    background: `conic-gradient(${goal.color} ${pct * 3.6}deg, var(--surface-3) 0deg)`,
    borderRadius: '50%',
    width: 90,
    height: 90,
    display: 'grid',
    placeItems: 'center',
  }

  return (
    <div className="goal-card">
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <div style={ringStyle}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'var(--surface)',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            {pct}%
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div className="row-between">
            <strong style={{ fontSize: 16 }}>{goal.name}</strong>
            <button className="btn btn-ghost btn-sm" onClick={onEdit}>
              ✏️
            </button>
          </div>
          <div style={{ marginTop: 4 }}>
            {formatCurrency(goal.savedAmount)}{' '}
            <span className="muted">of {formatCurrency(goal.targetAmount)}</span>
          </div>
          {complete ? (
            <div className="pos" style={{ fontSize: 13, marginTop: 4 }}>
              🎉 Goal reached!
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              {formatCurrency(remaining)} to go
              {goal.targetDate ? ` · by ${formatDate(goal.targetDate)}` : ''}
            </div>
          )}
        </div>
      </div>

      <div className="chip-row">
        <button
          className="btn btn-sm"
          onClick={() => dispatch({ type: 'CONTRIBUTE_GOAL', payload: { id: goal.id, amount: 50 } })}
        >
          +$50
        </button>
        <button
          className="btn btn-sm"
          onClick={() => dispatch({ type: 'CONTRIBUTE_GOAL', payload: { id: goal.id, amount: 100 } })}
        >
          +$100
        </button>
        <button
          className="btn btn-sm"
          onClick={() => {
            const v = prompt('Contribution amount (use a negative number to withdraw):')
            if (v == null) return
            const num = parseFloat(v)
            if (!isNaN(num) && num !== 0)
              dispatch({ type: 'CONTRIBUTE_GOAL', payload: { id: goal.id, amount: num } })
          }}
        >
          Custom…
        </button>
        <button
          className="btn btn-sm btn-danger"
          style={{ marginLeft: 'auto' }}
          onClick={() => dispatch({ type: 'DELETE_GOAL', payload: { id: goal.id } })}
        >
          Delete
        </button>
      </div>
    </div>
  )
}

function GoalModal({ existing, onClose }: { existing?: Goal; onClose: () => void }) {
  const { dispatch } = useFinance()
  const [name, setName] = useState(existing?.name ?? '')
  const [target, setTarget] = useState(existing ? String(existing.targetAmount) : '')
  const [saved, setSaved] = useState(existing ? String(existing.savedAmount) : '0')
  const [targetDate, setTargetDate] = useState(existing?.targetDate ?? '')
  const [color, setColor] = useState(existing?.color ?? PALETTE[0])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const targetAmount = parseFloat(target)
    const savedAmount = parseFloat(saved) || 0
    if (!name.trim() || !targetAmount || targetAmount <= 0) return

    if (existing) {
      dispatch({
        type: 'UPDATE_GOAL',
        payload: {
          ...existing,
          name: name.trim(),
          targetAmount,
          savedAmount,
          targetDate: targetDate || undefined,
          color,
        },
      })
    } else {
      dispatch({
        type: 'ADD_GOAL',
        payload: {
          name: name.trim(),
          targetAmount,
          savedAmount,
          targetDate: targetDate || undefined,
          color,
        },
      })
    }
    onClose()
  }

  return (
    <Modal title={existing ? 'Edit goal' : 'New savings goal'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Goal name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Emergency Fund"
            autoFocus
            required
          />
        </div>
        <div className="form-row">
          <div className="field">
            <label>Target amount</label>
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Already saved</label>
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={saved}
              onChange={(e) => setSaved(e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label>Target date (optional)</label>
          <input
            className="input"
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Color</label>
          <div className="chip-row">
            {PALETTE.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: c,
                  border: color === c ? '2px solid #fff' : '2px solid transparent',
                }}
              />
            ))}
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            {existing ? 'Save' : 'Create goal'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
