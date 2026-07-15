import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Combine,
  Download,
  FileOutput,
  FileSpreadsheet,
  Files,
  Info,
  LockKeyhole,
  Play,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { api, downloadBlob } from '../api'
import { ErrorState, LoadingState, PageHeader, ProgressBar, StatCard, StatusBadge, useToast } from '../components/ui'
import { useAsyncResource } from '../hooks'
import type { ConsolidationOptions, ConsolidationResult } from '../types'
import { formatDate } from '../utils'

export function ConsolidationPage() {
  const resource = useAsyncResource(() => api.listCountries(), [])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [latestOnly, setLatestOnly] = useState(true)
  const [compliantOnly, setCompliantOnly] = useState(false)
  const [includeAcceptedWarnings, setIncludeAcceptedWarnings] = useState(true)
  const [result, setResult] = useState<ConsolidationResult | null>(null)
  const [running, setRunning] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const { notify } = useToast()

  const countries = resource.data || []
  const eligible = useMemo(() => countries.filter((country) => country.currentFile && country.blockingCount === 0 && country.status !== 'ANALYZING'), [countries])

  useEffect(() => {
    if (selectedIds.length || !eligible.length) return
    setSelectedIds(eligible.filter((country) => ['COMPLIANT', 'COMPLIANT_WITH_WARNINGS'].includes(country.status)).map((country) => country.id))
  }, [eligible, selectedIds.length])

  function toggleCountry(countryId: string) {
    setSelectedIds((current) => current.includes(countryId) ? current.filter((id) => id !== countryId) : [...current, countryId])
    setResult(null)
  }

  async function consolidate() {
    if (!selectedIds.length) {
      notify('Sélectionnez au moins un pays éligible.', 'error')
      return
    }
    setRunning(true)
    setResult(null)
    const options: ConsolidationOptions = { countryIds: selectedIds, latestOnly, compliantOnly, includeAcceptedWarnings }
    try {
      let job = await api.createConsolidation(options)
      setResult(job)
      for (let attempt = 0; attempt < 60 && !['COMPLETED', 'FAILED'].includes(job.status); attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 500))
        job = await api.getConsolidation(job.id)
        setResult(job)
      }
      if (job.status === 'COMPLETED') notify('Consolidation terminée. Le classeur est prêt à être téléchargé.')
      else if (job.status === 'FAILED') notify('La consolidation a échoué. Consultez le rapport.', 'error')
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : 'La consolidation a échoué.', 'error')
    } finally {
      setRunning(false)
    }
  }

  async function download() {
    if (!result?.filename) return
    setDownloading(true)
    try {
      downloadBlob(await api.downloadConsolidation(result.id), result.filename)
      notify('Téléchargement du classeur lancé.')
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : 'Le téléchargement a échoué.', 'error')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="page-container consolidation-page">
      <PageHeader
        eyebrow="Production du classeur global"
        title="Consolidation POPS"
        description="Sélectionnez les versions pays validées, lancez la copie des feuilles et téléchargez le résultat."
        actions={result?.status === 'COMPLETED' ? <button className="button primary" onClick={() => void download()} disabled={downloading}><Download size={18} /> {downloading ? 'Préparation…' : 'Télécharger le classeur'}</button> : undefined}
      />

      <div className="consolidation-notice"><span><ShieldCheck size={19} /></span><div><strong>Consolidation non destructive</strong><p>Les fichiers pays restent inchangés. Chaque feuille est copiée dans un nouveau classeur et reçoit un suffixe pays unique.</p></div></div>

      {resource.loading ? <LoadingState label="Chargement des fichiers éligibles…" /> : resource.error ? <ErrorState message={resource.error} onRetry={() => void resource.reload()} /> : (
        <div className="consolidation-layout">
          <section className="card selection-card">
            <div className="section-heading list-heading">
              <div><span className="section-kicker">1 · Périmètre</span><h2>Sélectionner les pays</h2><p>{selectedIds.length} pays sélectionné{selectedIds.length > 1 ? 's' : ''} sur {countries.length}</p></div>
              <button className="text-button" onClick={() => setSelectedIds(selectedIds.length === eligible.length ? [] : eligible.map((country) => country.id))}>{selectedIds.length === eligible.length ? 'Tout désélectionner' : 'Sélectionner les éligibles'}</button>
            </div>
            <div className="country-selection-list">
              {countries.map((country) => {
                const blocked = !country.currentFile || country.blockingCount > 0 || country.status === 'ANALYZING'
                const selected = selectedIds.includes(country.id)
                return (
                  <label key={country.id} className={`country-selection ${selected ? 'selected' : ''} ${blocked ? 'disabled' : ''}`}>
                    <input type="checkbox" checked={selected} disabled={blocked} onChange={() => toggleCountry(country.id)} />
                    <span className="custom-checkbox">{selected && <Check size={14} />}</span>
                    <span className="country-code">{country.code || country.name.slice(0, 2).toUpperCase()}</span>
                    <span className="country-selection-copy"><strong>{country.name}</strong><small>{country.currentFile || 'Aucun fichier importé'}{country.currentVersion ? ` · v${country.currentVersion}` : ''}</small></span>
                    <StatusBadge status={country.status} />
                    {blocked && <span className="exclusion-reason">{country.blockingCount ? `${country.blockingCount} anomalie(s) bloquante(s)` : country.status === 'ANALYZING' ? 'Analyse en cours' : 'Fichier manquant'}</span>}
                  </label>
                )
              })}
            </div>
          </section>

          <aside className="consolidation-sidebar">
            <section className="card options-card">
              <div className="section-heading"><div><span className="section-kicker">2 · Règles</span><h2>Options</h2></div></div>
              <label className="option-toggle"><span className="option-icon"><RefreshCcw size={16} /></span><span><strong>Dernières versions uniquement</strong><small>Utilise la version active de chaque pays</small></span><input type="checkbox" checked={latestOnly} onChange={(event) => setLatestOnly(event.target.checked)} /></label>
              <label className="option-toggle"><span className="option-icon"><CheckCircle2 size={16} /></span><span><strong>Fichiers conformes uniquement</strong><small>Exclut aussi les avertissements</small></span><input type="checkbox" checked={compliantOnly} onChange={(event) => setCompliantOnly(event.target.checked)} /></label>
              <label className="option-toggle"><span className="option-icon"><AlertTriangle size={16} /></span><span><strong>Inclure les avertissements acceptés</strong><small>Jamais les anomalies bloquantes</small></span><input type="checkbox" checked={includeAcceptedWarnings} onChange={(event) => setIncludeAcceptedWarnings(event.target.checked)} /></label>
              <div className="naming-rule"><LockKeyhole size={16} /><div><strong>Règle de nommage</strong><code>Feuille_PAYS</code><small>31 caractères maximum, unicité garantie</small></div></div>
              <button className="button primary wide large" disabled={running || !selectedIds.length} onClick={() => void consolidate()}>{running ? <span className="button-loader" /> : <Play size={18} />} {running ? 'Consolidation en cours…' : 'Lancer la consolidation'}</button>
            </section>
          </aside>
        </div>
      )}

      {result && (
        <section className={`card consolidation-result result-${result.status.toLowerCase()}`}>
          <div className="result-header">
            <span className="result-icon">{result.status === 'COMPLETED' ? <CheckCircle2 size={26} /> : result.status === 'FAILED' ? <AlertTriangle size={26} /> : <Combine size={26} />}</span>
            <div><span className="section-kicker">3 · Résultat</span><h2>{result.status === 'COMPLETED' ? 'Classeur consolidé prêt' : result.status === 'FAILED' ? 'Consolidation interrompue' : 'Création du classeur global'}</h2><p>{result.status === 'COMPLETED' ? `${result.filename} · créé le ${formatDate(result.createdAt)}` : 'Copie des feuilles, normalisation des noms et génération du rapport…'}</p></div>
            <StatusBadge status={result.status} label={result.status === 'COMPLETED' ? 'Terminé' : result.status === 'FAILED' ? 'Échec' : 'En cours'} />
          </div>
          {result.status !== 'COMPLETED' && <ProgressBar value={result.progress} label="Progression globale" />}
          {result.status === 'COMPLETED' && (
            <>
              <div className="result-stats">
                <StatCard icon={<Files size={20} />} label="Pays inclus" value={result.countryCount} detail="dernières versions" />
                <StatCard icon={<FileSpreadsheet size={20} />} label="Feuilles copiées" value={result.copiedSheets} detail={`${result.skippedSheets} ignorée(s)`} tone="green" />
                <StatCard icon={<Sparkles size={20} />} label="Noms normalisés" value={result.mappings.length} detail="correspondances tracées" tone="violet" />
              </div>
              {result.warnings.length > 0 && <div className="result-warning"><AlertTriangle size={17} /><div><strong>{result.warnings.length} avertissement</strong>{result.warnings.map((warning) => <span key={warning}>{warning}</span>)}</div></div>}
              <div className="mapping-report">
                <div className="section-heading list-heading"><div><h3>Extrait de la table de correspondance</h3><p>Noms d’origine et noms utilisés dans le classeur global.</p></div><button className="button primary" onClick={() => void download()} disabled={downloading}><Download size={17} /> Télécharger</button></div>
                <div className="table-scroll"><table className="data-table"><thead><tr><th>Pays</th><th>Feuille d’origine</th><th /><th>Nom consolidé</th></tr></thead><tbody>{result.mappings.map((mapping, index) => <tr key={`${mapping.country}-${index}`}><td><strong>{mapping.country}</strong></td><td><code>{mapping.originalSheetName}</code></td><td><ArrowRight size={15} /></td><td><code className="success-code">{mapping.consolidatedSheetName}</code></td></tr>)}</tbody></table></div>
              </div>
            </>
          )}
        </section>
      )}

      {!result && !resource.loading && !resource.error && (
        <section className="consolidation-preview">
          <span className="preview-output-icon"><FileOutput size={24} /></span>
          <div><strong>Le rapport de consolidation apparaîtra ici</strong><span>Pays inclus, fichiers utilisés, feuilles copiées, noms transformés, avertissements et erreurs seront détaillés.</span></div>
          <Info size={19} />
        </section>
      )}
    </div>
  )
}
