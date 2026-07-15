import {
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Columns3,
  FileWarning,
  Filter,
  Info,
  MoveHorizontal,
  Search,
  ShieldAlert,
  Table2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { ErrorState, LoadingState, StatCard, StatusBadge, useToast } from '../components/ui'
import type { Anomaly, AnomalyStatus, Severity, StructureColumn } from '../types'
import { anomalyStatusLabels, formatDate, severityLabels } from '../utils'

const categoryLabels: Record<string, string> = {
  SHEET_MISSING: 'Feuille manquante', SHEET_ADDED: 'Feuille ajoutée', SHEET_RENAMED: 'Feuille renommée',
  SHEET_ORDER_CHANGED: 'Ordre des feuilles', SHEET_VISIBILITY_CHANGED: 'Visibilité modifiée', TABLE_MISSING: 'Tableau manquant',
  TABLE_MOVED: 'Tableau déplacé', TABLE_RANGE_CHANGED: 'Plage modifiée', COLUMN_ADDED: 'Colonne ajoutée',
  COLUMN_REMOVED: 'Colonne supprimée', COLUMN_RENAMED: 'Colonne renommée', COLUMN_ORDER_CHANGED: 'Ordre des colonnes',
  ROW_ADDED: 'Ligne ajoutée', ROW_REMOVED: 'Ligne supprimée', ROW_ORDER_CHANGED: 'Ordre des lignes',
  HEADER_CHANGED: 'En-tête modifié', KEY_CELL_CHANGED: 'Cellule clé modifiée', FORMULA_MISSING: 'Formule manquante',
  FORMULA_CHANGED: 'Formule modifiée', MERGED_CELL_CHANGED: 'Fusion modifiée', AMBIGUOUS_TABLE_MATCH: 'Rapprochement ambigu',
}

export function AnomaliesPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<{ countries: Awaited<ReturnType<typeof api.listCountries>>; anomalies: Anomaly[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [severity, setSeverity] = useState<'ALL' | Severity>('ALL')
  const [status, setStatus] = useState<'ALL' | AnomalyStatus>('ALL')
  const [sheet, setSheet] = useState('ALL')
  const [category, setCategory] = useState('ALL')
  const [updating, setUpdating] = useState(false)
  const { notify } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [countries, anomalies] = await Promise.all([api.listCountries(), api.listAnomalies(id)])
      setData({ countries, anomalies })
      setSelectedId((current) => current && anomalies.some((item) => item.id === current) ? current : anomalies[0]?.id || null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de charger le rapport d’anomalies.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  const anomalies = data?.anomalies || []
  const country = data?.countries.find((item) => item.id === id)
  const sheets = [...new Set(anomalies.map((item) => item.sheet).filter(Boolean))] as string[]
  const categories = [...new Set(anomalies.map((item) => item.category))]
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fr')
    return anomalies.filter((anomaly) => {
      const text = `${anomaly.description} ${anomaly.sheet || ''} ${anomaly.table || ''} ${anomaly.category}`.toLocaleLowerCase('fr')
      return (!query || text.includes(query)) && (severity === 'ALL' || anomaly.severity === severity) &&
        (status === 'ALL' || anomaly.status === status) && (sheet === 'ALL' || anomaly.sheet === sheet) &&
        (category === 'ALL' || anomaly.category === category)
    })
  }, [anomalies, category, search, severity, sheet, status])
  const selected = anomalies.find((item) => item.id === selectedId) || filtered[0]

  async function decide(nextStatus: AnomalyStatus) {
    if (!selected) return
    setUpdating(true)
    try {
      const updated = await api.updateAnomaly(selected.id, nextStatus)
      setData((current) => current && ({ ...current, anomalies: current.anomalies.map((item) => item.id === selected.id ? { ...item, status: updated.status } : item) }))
      notify(`Décision enregistrée : ${anomalyStatusLabels[nextStatus].toLocaleLowerCase('fr')}.`)
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : 'La décision n’a pas pu être enregistrée.', 'error')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) return <div className="page-container"><LoadingState label="Construction du rapport d’anomalies…" /></div>
  if (error || !data || !country) return <div className="page-container"><ErrorState message={error || 'Pays introuvable.'} onRetry={() => void load()} /></div>

  return (
    <div className="page-container anomalies-page">
      <div className="detail-header anomalies-header">
        <div>
          <Link to={`/countries/${country.id}/files`} className="back-link"><ArrowLeft size={16} /> Fichiers de {country.name}</Link>
          <div className="detail-title"><span className="country-code large">{country.code || country.name.slice(0, 2).toUpperCase()}</span><div><div><h1>Rapport d’anomalies — {country.name}</h1><StatusBadge status={country.status} /></div><p>Version {country.currentVersion || '—'} · analysée le {formatDate(country.lastImportedAt)}</p></div></div>
        </div>
        <Link to={`/countries/${country.id}/files`} className="button secondary">Historique des fichiers <ArrowRight size={17} /></Link>
      </div>

      <section className="stats-grid five">
        <StatCard icon={<FileWarning size={20} />} label="Total anomalies" value={anomalies.length} detail={`${new Set(anomalies.map((item) => item.sheet)).size} feuille(s) concernée(s)`} />
        <StatCard icon={<ShieldAlert size={20} />} label="Bloquantes" value={anomalies.filter((item) => item.severity === 'BLOCKING').length} detail="excluent la consolidation" tone="red" />
        <StatCard icon={<AlertOctagon size={20} />} label="Erreurs" value={anomalies.filter((item) => item.severity === 'ERROR').length} detail="correction recommandée" tone="violet" />
        <StatCard icon={<AlertTriangle size={20} />} label="Avertissements" value={anomalies.filter((item) => item.severity === 'WARNING').length} detail="décision requise" tone="amber" />
        <StatCard icon={<CheckCircle2 size={20} />} label="Traitées" value={anomalies.filter((item) => !['NEW', 'CONFIRMED'].includes(item.status)).length} detail={`sur ${anomalies.length} au total`} tone="green" />
      </section>

      <section className="card anomaly-filter-card">
        <div className="filter-heading"><span><Filter size={17} /><strong>Filtres du rapport</strong></span><button className="text-button" onClick={() => { setSearch(''); setSeverity('ALL'); setStatus('ALL'); setSheet('ALL'); setCategory('ALL') }}>Réinitialiser</button></div>
        <div className="anomaly-filters">
          <label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher dans les anomalies…" /></label>
          <select value={id} onChange={(event) => navigate(`/countries/${event.target.value}/anomalies`)}>{data.countries.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>
          <select value={sheet} onChange={(event) => setSheet(event.target.value)}><option value="ALL">Toutes les feuilles</option>{sheets.map((item) => <option key={item}>{item}</option>)}</select>
          <select value={category} onChange={(event) => setCategory(event.target.value)}><option value="ALL">Toutes les catégories</option>{categories.map((item) => <option value={item} key={item}>{categoryLabels[item] || item}</option>)}</select>
          <select value={severity} onChange={(event) => setSeverity(event.target.value as 'ALL' | Severity)}><option value="ALL">Toutes les sévérités</option>{Object.entries(severityLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
          <select value={status} onChange={(event) => setStatus(event.target.value as 'ALL' | AnomalyStatus)}><option value="ALL">Tous les statuts</option>{Object.entries(anomalyStatusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
        </div>
      </section>

      <div className="anomaly-workspace">
        <section className="card anomaly-list-card">
          <div className="panel-title"><div><span>Anomalies détectées</span><strong>{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</strong></div></div>
          <div className="anomaly-list">
            {filtered.map((anomaly) => (
              <button key={anomaly.id} className={selected?.id === anomaly.id ? 'active' : ''} onClick={() => setSelectedId(anomaly.id)}>
                <span className={`severity-icon severity-${anomaly.severity.toLowerCase()}`}>{anomaly.severity === 'BLOCKING' ? <ShieldAlert size={17} /> : anomaly.severity === 'ERROR' ? <AlertOctagon size={17} /> : anomaly.severity === 'WARNING' ? <AlertTriangle size={17} /> : <Info size={17} />}</span>
                <span className="anomaly-list-copy"><span><StatusBadge status={anomaly.severity} /><small>#{anomaly.id.split('-').slice(-1)[0]}</small></span><strong>{categoryLabels[anomaly.category] || anomaly.category}</strong><span>{anomaly.description}</span><small>{anomaly.sheet || 'Classeur'}{anomaly.table ? ` · ${anomaly.table}` : ''}</small></span>
                <ChevronRight size={16} />
              </button>
            ))}
            {filtered.length === 0 && <div className="mini-empty tall"><Search size={20} /><span>Aucune anomalie ne correspond à ces filtres.</span></div>}
          </div>
        </section>

        <section className="card anomaly-detail-card">
          {selected ? (
            <>
              <div className="anomaly-detail-header">
                <div><div><StatusBadge status={selected.severity} /><StatusBadge status={selected.status} /></div><h2>{categoryLabels[selected.category] || selected.category}</h2><p>{selected.description}</p></div>
                {selected.confidence && <span className="match-confidence"><MoveHorizontal size={16} /><strong>{Math.round(selected.confidence * 100)} %</strong><small>confiance</small></span>}
              </div>
              <div className="anomaly-context">
                <span><small>Feuille</small><strong>{selected.sheet || 'Classeur'}</strong></span>
                <span><small>Tableau</small><strong>{selected.table || '—'}</strong></span>
                <span><small>Coordonnée attendue</small><strong>{selected.expectedCoordinates || '—'}</strong></span>
                <span><small>Coordonnée constatée</small><strong>{selected.observedCoordinates || '—'}</strong></span>
              </div>
              <div className="comparison-heading"><span><Columns3 size={17} /><strong>Comparaison de la structure</strong></span><span className="comparison-legend"><i className="removed" /> Manquant <i className="moved" /> Déplacé <i className="unchanged" /> Identique</span></div>
              <div className="structure-comparison">
                <StructureView title="Structure attendue" subtitle="Template de référence" value={selected.expected} columns={selected.expectedColumns} expected />
                <span className="comparison-arrow"><ArrowRight size={19} /></span>
                <StructureView title="Structure constatée" subtitle={`Fichier ${country.name} · v${selected.fileVersion}`} value={selected.observed} columns={selected.observedColumns} />
              </div>
              <div className="suggestion-box"><span><CircleHelp size={19} /></span><div><strong>Action suggérée</strong><p>{selected.suggestion}</p></div></div>
              <div className="decision-panel">
                <div><strong>Décision de traitement</strong><span>Cette action est historisée dans le journal d’audit.</span></div>
                <div>
                  <button className="button secondary small" disabled={updating} onClick={() => void decide('FALSE_POSITIVE')}><X size={15} /> Faux positif</button>
                  <button className="button secondary small" disabled={updating} onClick={() => void decide('ACCEPTED_EXCEPTION')}><Check size={15} /> Accepter</button>
                  <button className="button primary small" disabled={updating} onClick={() => void decide('FIXED')}><CheckCircle2 size={15} /> Marquer corrigée</button>
                </div>
              </div>
            </>
          ) : <div className="state-panel empty-state"><span className="empty-icon"><CheckCircle2 size={26} /></span><strong>Aucune anomalie sélectionnée</strong><span>Sélectionnez une ligne du rapport pour afficher la comparaison.</span></div>}
        </section>
      </div>
    </div>
  )
}

function StructureView({ title, subtitle, value, columns, expected = false }: { title: string; subtitle: string; value: string; columns?: StructureColumn[]; expected?: boolean }) {
  return (
    <article className={`structure-view ${expected ? 'expected' : 'observed'}`}>
      <div className="structure-title"><span className="mini-file-icon"><Table2 size={17} /></span><span><strong>{title}</strong><small>{subtitle}</small></span></div>
      {columns?.length ? <div className="structure-columns">{columns.map((column, index) => <div className={`structure-column state-${(column.state || 'UNCHANGED').toLowerCase()}`} key={`${column.name}-${index}`}><span>{column.coordinate}</span><strong>{column.name}</strong>{column.state && column.state !== 'UNCHANGED' && <small>{column.state === 'REMOVED' ? 'manquante' : column.state === 'MOVED' ? 'déplacée' : 'modifiée'}</small>}</div>)}</div> : <div className="structure-value"><code>{value}</code></div>}
      <div className="structure-summary">{value}</div>
    </article>
  )
}
