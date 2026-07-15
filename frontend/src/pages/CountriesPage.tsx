import {
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  Globe2,
  MapPin,
  Plus,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { ErrorState, LoadingState, PageHeader, StatCard, StatusBadge, useToast } from '../components/ui'
import { useAsyncResource } from '../hooks'
import type { CountryStatus } from '../types'
import { countryStatusLabels, formatDate } from '../utils'

type CountryFilter = 'ALL' | CountryStatus

export function CountriesPage() {
  const resource = useAsyncResource(async () => {
    const [countries, templates] = await Promise.all([api.listCountries(), api.listTemplates()])
    return { countries, templates }
  }, [])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<CountryFilter>('ALL')
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [creating, setCreating] = useState(false)
  const { notify } = useToast()

  const countries = resource.data?.countries || []
  const templates = resource.data?.templates || []
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fr')
    return countries.filter((country) => {
      const text = `${country.name} ${country.code || ''}`.toLocaleLowerCase('fr')
      return (status === 'ALL' || country.status === status) && (!query || text.includes(query))
    })
  }, [countries, search, status])

  async function createCountry(event: FormEvent) {
    event.preventDefault()
    const selectedTemplate = templateId || templates[0]?.id
    if (!name.trim() || !selectedTemplate) {
      notify('Le nom du pays et le template sont obligatoires.', 'error')
      return
    }
    setCreating(true)
    try {
      const country = await api.createCountry({ name: name.trim(), code: code.trim().toUpperCase() || undefined, templateId: selectedTemplate })
      resource.setData((current) => current && ({ ...current, countries: [country, ...current.countries] }))
      setName('')
      setCode('')
      setShowCreate(false)
      notify(`${country.name} a été ajouté à la campagne POPS.`)
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : 'La création a échoué.', 'error')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Campagne de collecte"
        title="Pays & fichiers POPS"
        description="Suivez les imports, les contrôles structurels et le niveau de conformité de chaque pays."
        actions={<button className="button primary" onClick={() => setShowCreate(true)}><Plus size={18} /> Ajouter un pays</button>}
      />

      <section className="stats-grid five">
        <StatCard icon={<Globe2 size={20} />} label="Pays suivis" value={countries.length} detail={`${countries.filter((item) => item.currentFile).length} avec un fichier`} />
        <StatCard icon={<CheckCircle2 size={20} />} label="Conformes" value={countries.filter((item) => item.status === 'COMPLIANT').length} detail="prêts à consolider" tone="green" />
        <StatCard icon={<AlertTriangle size={20} />} label="Avertissements" value={countries.filter((item) => item.status === 'COMPLIANT_WITH_WARNINGS').length} detail="validation possible" tone="amber" />
        <StatCard icon={<AlertOctagon size={20} />} label="Non conformes" value={countries.filter((item) => item.status === 'NON_COMPLIANT').length} detail="correction requise" tone="red" />
        <StatCard icon={<ShieldAlert size={20} />} label="Anomalies bloquantes" value={countries.reduce((sum, item) => sum + item.blockingCount, 0)} detail={`${countries.reduce((sum, item) => sum + item.anomalyCount, 0)} anomalies au total`} tone="violet" />
      </section>

      {showCreate && (
        <section className="card create-panel">
          <div className="section-heading compact-heading">
            <div><span className="section-kicker">Nouveau périmètre</span><h2>Ajouter un pays</h2><p>Associez le pays au template de référence utilisé pour ses prochains imports.</p></div>
            <button className="icon-button" onClick={() => setShowCreate(false)} aria-label="Fermer"><X size={18} /></button>
          </div>
          <form className="inline-create-form" onSubmit={createCountry}>
            <label>Nom du pays <span>*</span><div className="input-with-icon"><MapPin size={16} /><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex. Belgique" autoFocus /></div></label>
            <label>Code pays<input value={code} onChange={(event) => setCode(event.target.value.slice(0, 3))} placeholder="BE" /></label>
            <label>Template associé <span>*</span><select value={templateId || templates[0]?.id || ''} onChange={(event) => setTemplateId(event.target.value)}>{templates.map((template) => <option value={template.id} key={template.id}>{template.name} · v{template.version}</option>)}</select></label>
            <button className="button primary" type="submit" disabled={creating}>{creating ? <span className="button-loader" /> : <Plus size={17} />} Créer le pays</button>
          </form>
        </section>
      )}

      <section className="card data-section">
        <div className="section-heading list-heading">
          <div><h2>Suivi des pays</h2><p>Dernière version importée et résultat du contrôle structurel</p></div>
          <div className="toolbar">
            <label className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un pays…" /></label>
            <select className="filter-select" value={status} onChange={(event) => setStatus(event.target.value as CountryFilter)}>
              <option value="ALL">Tous les statuts</option>
              {Object.entries(countryStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
        </div>

        {resource.loading ? <LoadingState label="Chargement des pays…" /> : resource.error ? <ErrorState message={resource.error} onRetry={() => void resource.reload()} /> : (
          <div className="table-scroll">
            <table className="data-table countries-table">
              <thead><tr><th>Pays</th><th>Template</th><th>Dernier fichier</th><th>Dernier import</th><th>Contrôle</th><th>Anomalies</th><th aria-label="Actions" /></tr></thead>
              <tbody>
                {filtered.map((country) => (
                  <tr key={country.id}>
                    <td><div className="country-cell"><span className="country-code">{country.code || country.name.slice(0, 2).toUpperCase()}</span><span><strong>{country.name}</strong><small>Ajouté le {formatDate(country.createdAt)}</small></span></div></td>
                    <td><span className="template-reference"><FileSpreadsheet size={15} /><span>{country.templateName}<small>Référentiel actif</small></span></span></td>
                    <td>{country.currentFile ? <span className="file-cell"><strong>{country.currentFile}</strong><small>Version {country.currentVersion}</small></span> : <span className="muted-text">Aucun fichier importé</span>}</td>
                    <td>{formatDate(country.lastImportedAt)}</td>
                    <td><StatusBadge status={country.status} /></td>
                    <td>{country.anomalyCount ? <Link className={`anomaly-count ${country.blockingCount ? 'blocking' : ''}`} to={`/countries/${country.id}/anomalies`}><strong>{country.anomalyCount}</strong><span>{country.blockingCount ? `${country.blockingCount} bloquante(s)` : 'à examiner'}</span></Link> : <span className="clean-indicator"><CheckCircle2 size={16} /> Aucune</span>}</td>
                    <td><Link className="row-action" to={`/countries/${country.id}/files`}>Ouvrir <ArrowRight size={15} /></Link></td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={7}><div className="table-empty">Aucun pays ne correspond à ces critères.</div></td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
