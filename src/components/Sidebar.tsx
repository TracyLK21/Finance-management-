import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Dashboard', icon: '📊', end: true },
  { to: '/insights', label: 'Insights', icon: '🔍', end: false },
  { to: '/transactions', label: 'Transactions', icon: '💸', end: false },
  { to: '/review', label: 'Review & sort', icon: '🗂️', end: false },
  { to: '/import', label: 'Import statement', icon: '📥', end: false },
  { to: '/budgets', label: 'Budgets', icon: '🎯', end: false },
  { to: '/goals', label: 'Goals', icon: '🏆', end: false },
  { to: '/accounts', label: 'Accounts', icon: '🏦', end: false },
]

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-logo">F</div>
        <div>
          <div className="brand-name">Fin</div>
          <div className="brand-sub">Budget &amp; Finance</div>
        </div>
      </div>

      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          <span className="icon">{l.icon}</span>
          {l.label}
        </NavLink>
      ))}

      <div className="sidebar-footer">
        Data is stored locally in your browser.
      </div>
    </aside>
  )
}
