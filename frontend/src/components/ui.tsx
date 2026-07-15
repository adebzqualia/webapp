import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  CircleHelp,
  Combine,
  FileSpreadsheet,
  Globe2,
  LoaderCircle,
  Menu,
  RefreshCcw,
  Settings2,
  ShieldCheck,
  X,
} from 'lucide-react'
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { getDevIdentity, setDevIdentity, USE_MOCKS } from '../api'
import {
  anomalyStatusLabels,
  countryStatusLabels,
  severityLabels,
  templateStatusLabels,
} from '../utils'
import type { AnomalyStatus, CountryStatus, Severity, TemplateStatus } from '../types'

type StatusValue = CountryStatus | TemplateStatus | Severity | AnomalyStatus | string

const labels: Record<string, string> = {
  ...countryStatusLabels,
  ...templateStatusLabels,
  ...severityLabels,
  ...anomalyStatusLabels,
}

function statusTone(status: StatusValue): string {
  if (['COMPLIANT', 'READY', 'FIXED'].includes(status)) return 'success'
  if (['WARNING', 'COMPLIANT_WITH_WARNINGS', 'MAPPING', 'ACCEPTED_EXCEPTION'].includes(status)) return 'warning'
  if (['NON_COMPLIANT', 'ERROR', 'CONFIRMED'].includes(status)) return 'danger'
  if (['BLOCKING', 'READ_ERROR'].includes(status)) return 'critical'
  if (['ANALYZING', 'IMPORTED'].includes(status)) return 'progress'
  if (['NEW'].includes(status)) return 'new'
  return 'neutral'
}

export function StatusBadge({ status, label }: { status: StatusValue; label?: string }) {
  return <span className={`status-badge status-${statusTone(status)}`}>{label || labels[status] || status}</span>
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  )
}

export function LoadingState({ label = 'Chargement des données…' }: { label?: string }) {
  return (
    <div className="state-panel loading-state" role="status">
      <LoaderCircle className="spin" size={26} />
      <strong>{label}</strong>
      <span>Cette opération ne prend généralement que quelques secondes.</span>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state-panel error-state" role="alert">
      <span className="state-icon"><AlertTriangle size={22} /></span>
      <div>
        <strong>Impossible de charger ces informations</strong>
        <span>{message}</span>
      </div>
      {onRetry && (
        <button className="button secondary small" onClick={onRetry}>
          <RefreshCcw size={15} /> Réessayer
        </button>
      )}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="state-panel empty-state">
      <span className="empty-icon">{icon || <FileSpreadsheet size={26} />}</span>
      <strong>{title}</strong>
      <span>{description}</span>
      {action}
    </div>
  )
}

export function StatCard({
  label,
  value,
  detail,
  icon,
  tone = 'blue',
}: {
  label: string
  value: string | number
  detail?: string
  icon: ReactNode
  tone?: 'blue' | 'green' | 'amber' | 'red' | 'violet'
}) {
  return (
    <article className="stat-card">
      <span className={`stat-icon tone-${tone}`}>{icon}</span>
      <div>
        <span className="stat-label">{label}</span>
        <strong>{value}</strong>
        {detail && <small>{detail}</small>}
      </div>
    </article>
  )
}

export function ProgressBar({ value, label, compact = false }: { value: number; label?: string; compact?: boolean }) {
  const bounded = Math.max(0, Math.min(100, value))
  return (
    <div className={`progress-wrap ${compact ? 'compact' : ''}`}>
      {label && (
        <div className="progress-label">
          <span>{label}</span>
          <strong>{Math.round(bounded)} %</strong>
        </div>
      )}
      <div className="progress-track" role="progressbar" aria-valuenow={bounded} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${bounded}%` }} />
      </div>
    </div>
  )
}

export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div className="skeleton-list" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div className="skeleton-row" key={index}>
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  )
}

interface Toast {
  id: number
  message: string
  tone: 'success' | 'error' | 'info'
}

interface ToastContextValue {
  notify: (message: string, tone?: Toast['tone']) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const value = useMemo<ToastContextValue>(
    () => ({
      notify(message, tone = 'success') {
        const id = Date.now() + Math.random()
        setToasts((current) => [...current, { id, message, tone }])
        window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4200)
      },
    }),
    [],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" aria-live="polite">
        {toasts.map((toast) => (
          <div className={`toast toast-${toast.tone}`} key={toast.id}>
            {toast.tone === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{toast.message}</span>
            <button aria-label="Fermer" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}>
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast doit être utilisé dans ToastProvider')
  return context
}

function IdentityMenu() {
  const initialIdentity = getDevIdentity()
  const [organizationId, setOrganizationId] = useState(initialIdentity.organizationId)
  const [userId, setUserId] = useState(initialIdentity.userId)
  const [saved, setSaved] = useState(false)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setDevIdentity({ organizationId, userId })
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }

  return (
    <details className="identity-menu">
      <summary className="icon-button" aria-label="Configurer l’identité API">
        <Settings2 size={18} />
      </summary>
      <form className="identity-popover" onSubmit={handleSubmit}>
        <div className="popover-heading">
          <span className="stat-icon tone-blue"><ShieldCheck size={17} /></span>
          <div>
            <strong>Identité API</strong>
            <small>En-têtes utilisés en développement</small>
          </div>
        </div>
        <label>
          Organisation
          <input value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} />
        </label>
        <label>
          Utilisateur
          <input value={userId} onChange={(event) => setUserId(event.target.value)} />
        </label>
        <button className="button primary small" type="submit">
          {saved ? <CheckCircle2 size={15} /> : <Settings2 size={15} />}
          {saved ? 'Enregistré' : 'Enregistrer'}
        </button>
      </form>
    </details>
  )
}

const navigation = [
  { label: 'Templates', path: '/templates', icon: FileSpreadsheet },
  { label: 'Pays & fichiers', path: '/countries', icon: Globe2 },
  { label: 'Consolidation', path: '/consolidation', icon: Combine },
]

function routeTitle(pathname: string): string {
  if (pathname.includes('/mapping')) return 'Cartographie du template'
  if (pathname.includes('/anomalies')) return 'Analyse des anomalies'
  if (pathname.includes('/files')) return 'Fichiers pays'
  if (pathname.startsWith('/countries')) return 'Pays & fichiers'
  if (pathname.startsWith('/consolidation')) return 'Consolidation'
  return 'Templates POPS'
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  useEffect(() => setMobileOpen(false), [location.pathname])

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="brand">
          <span className="brand-mark"><FileSpreadsheet size={23} strokeWidth={2.2} /></span>
          <div><strong>POPS</strong><span>Control Center</span></div>
        </div>
        <nav className="main-nav" aria-label="Navigation principale">
          <span className="nav-section">Espace de travail</span>
          {navigation.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="security-card">
          <ShieldCheck size={20} />
          <div><strong>Traitement sécurisé</strong><span>Les formules et macros ne sont jamais exécutées.</span></div>
        </div>
        <div className="sidebar-profile">
          <span className="avatar">MD</span>
          <div><strong>Marie Dupont</strong><span>Administratrice</span></div>
          <Settings2 size={16} />
        </div>
      </aside>
      {mobileOpen && <button className="sidebar-backdrop" onClick={() => setMobileOpen(false)} aria-label="Fermer la navigation" />}
      <div className="main-column">
        <header className="topbar">
          <button className="mobile-menu icon-button" onClick={() => setMobileOpen((open) => !open)} aria-label="Ouvrir la navigation">
            <Menu size={20} />
          </button>
          <div className="topbar-title">
            <span>Espace Groupe</span>
            <strong>{routeTitle(location.pathname)}</strong>
          </div>
          <div className="topbar-actions">
            <span className={`environment-pill ${USE_MOCKS ? 'demo' : 'api'}`}>
              <span /> {USE_MOCKS ? 'Données démo' : 'API connectée'}
            </span>
            <button className="icon-button" aria-label="Aide"><CircleHelp size={18} /></button>
            <button className="icon-button notification-button" aria-label="Notifications"><Bell size={18} /><span /></button>
            <IdentityMenu />
            <span className="avatar compact">MD</span>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  )
}
