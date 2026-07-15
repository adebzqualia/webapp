import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileSpreadsheet,
  Fingerprint,
  History,
  Play,
  RefreshCcw,
  SearchCheck,
  UploadCloud,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { FileDropzone } from '../components/FileDropzone'
import { ErrorState, LoadingState, ProgressBar, StatCard, StatusBadge, useToast } from '../components/ui'
import type { CountryFile } from '../types'
import { formatBytes, formatDate } from '../utils'

export function CountryFilesPage() {
  const { id = '' } = useParams()
  const [data, setData] = useState<{ country: Awaited<ReturnType<typeof api.listCountries>>[number]; files: CountryFile[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const { notify } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [countries, files] = await Promise.all([api.listCountries(), api.listCountryFiles(id)])
      const country = countries.find((item) => item.id === id)
      if (!country) throw new Error('Ce pays est introuvable ou vous n’y avez pas accès.')
      setData({ country, files: files.sort((left, right) => right.version - left.version) })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de charger les fichiers pays.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  async function uploadFile(file: File) {
    setUploading(true)
    try {
      const uploaded = await api.uploadCountryFile(id, file)
      setData((current) => current && ({ ...current, files: [uploaded, ...current.files] }))
      notify(`Version ${uploaded.version} importée. Vous pouvez lancer son analyse.`)
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : 'L’import a échoué.', 'error')
    } finally {
      setUploading(false)
    }
  }

  async function analyze(file: CountryFile) {
    setAnalyzingId(file.id)
    setData((current) => current && ({
      ...current,
      files: current.files.map((item) => item.id === file.id ? { ...item, status: 'ANALYZING', progress: 12 } : item),
    }))
    try {
      await api.analyzeCountryFile(file.aggregateId || file.id)
      for (const progress of [32, 58, 79]) {
        await new Promise((resolve) => window.setTimeout(resolve, 280))
        setData((current) => current && ({
          ...current,
          files: current.files.map((item) => item.id === file.id
            ? { ...item, status: 'ANALYZING', progress }
            : item),
        }))
      }
      const refreshedFiles = await api.listCountryFiles(id)
      setData((current) => current && ({ ...current, files: refreshedFiles }))
      notify('Analyse terminée. Le rapport structurel est disponible.')
    } catch (reason) {
      setData((current) => current && ({ ...current, files: current.files.map((item) => item.id === file.id ? { ...item, status: 'READ_ERROR' } : item) }))
      notify(reason instanceof Error ? reason.message : 'L’analyse a échoué.', 'error')
    } finally {
      setAnalyzingId(null)
    }
  }

  if (loading) return <div className="page-container"><LoadingState label="Chargement de l’historique des imports…" /></div>
  if (error || !data) return <div className="page-container"><ErrorState message={error || 'Pays introuvable.'} onRetry={() => void load()} /></div>

  const { country, files } = data
  const latest = files[0]
  return (
    <div className="page-container">
      <div className="detail-header">
        <div>
          <Link to="/countries" className="back-link"><ArrowLeft size={16} /> Tous les pays</Link>
          <div className="detail-title"><span className="country-code large">{country.code || country.name.slice(0, 2).toUpperCase()}</span><div><div><h1>{country.name}</h1><StatusBadge status={country.status} /></div><p>Fichiers POPS · {country.templateName}</p></div></div>
        </div>
        <Link to={`/countries/${country.id}/anomalies`} className="button secondary">Voir les anomalies <ArrowRight size={17} /></Link>
      </div>

      <section className="stats-grid four">
        <StatCard icon={<History size={20} />} label="Versions importées" value={files.length} detail={latest ? `dernière : v${latest.version}` : 'aucune version'} />
        <StatCard icon={<FileCheck2 size={20} />} label="Dernier contrôle" value={latest ? (latest.status === 'ANALYZING' ? `${latest.progress || 0} %` : 'Terminé') : '—'} detail={latest ? formatDate(latest.importedAt) : 'en attente du fichier'} tone="green" />
        <StatCard icon={<AlertTriangle size={20} />} label="Anomalies" value={latest?.anomalies || 0} detail="sur la dernière version" tone="amber" />
        <StatCard icon={<Clock3 size={20} />} label="Dernier import" value={latest ? `v${latest.version}` : '—'} detail={latest?.importedBy || 'aucun importeur'} tone="violet" />
      </section>

      <section className="files-layout">
        <article className="card country-upload-card">
          <div className="section-heading compact-heading"><div><span className="section-kicker">Nouvelle version</span><h2>Importer un fichier pays</h2><p>Le fichier original est conservé intact et une nouvelle version est créée.</p></div><span className="step-pill">Étape 1/2</span></div>
          <FileDropzone onFile={uploadFile} busy={uploading} title={`Déposer le fichier POPS — ${country.name}`} description="Sélectionnez la version complétée par le pays" />
          <div className="security-inline"><CheckCircle2 size={16} /><span>Contrôle du format, de la signature et des risques ZIP à la réception.</span></div>
        </article>
        <article className="card analysis-flow-card">
          <div className="section-heading compact-heading"><div><span className="section-kicker">Contrôle structurel</span><h2>Processus d’analyse</h2><p>Chaque exécution produit un rapport indépendant et traçable.</p></div><span className="step-pill">Étape 2/2</span></div>
          <ol className="analysis-steps">
            <li className="done"><span><CheckCircle2 size={15} /></span><div><strong>Lecture sécurisée</strong><small>Métadonnées, feuilles et dimensions</small></div></li>
            <li><span>2</span><div><strong>Rapprochement</strong><small>Signatures et tables cartographiées</small></div></li>
            <li><span>3</span><div><strong>Comparaison</strong><small>Colonnes, lignes, formules et fusions</small></div></li>
            <li><span>4</span><div><strong>Rapport</strong><small>Anomalies qualifiables et extraction</small></div></li>
          </ol>
        </article>
      </section>

      <section className="card data-section">
        <div className="section-heading list-heading"><div><h2>Historique des versions</h2><p>Tous les fichiers reçus sont conservés, horodatés et identifiés par empreinte.</p></div><button className="button ghost small" onClick={() => void load()}><RefreshCcw size={15} /> Actualiser</button></div>
        {files.length === 0 ? (
          <div className="state-panel empty-state"><span className="empty-icon"><UploadCloud size={26} /></span><strong>Aucun fichier importé</strong><span>Déposez le premier classeur POPS de ce pays pour commencer.</span></div>
        ) : (
          <div className="table-scroll">
            <table className="data-table files-table">
              <thead><tr><th>Version</th><th>Fichier original</th><th>Import</th><th>Empreinte</th><th>Statut du contrôle</th><th>Anomalies</th><th aria-label="Actions" /></tr></thead>
              <tbody>{files.map((file, index) => (
                <tr key={file.id}>
                  <td><span className="version-number">v{file.version}</span>{index === 0 && <span className="latest-chip">dernière</span>}</td>
                  <td><div className="file-name-cell"><span className="mini-file-icon"><FileSpreadsheet size={17} /></span><span><strong>{file.filename}</strong><small>{formatBytes(file.size)}</small></span></div></td>
                  <td><span className="file-cell"><strong>{formatDate(file.importedAt)}</strong><small>par {file.importedBy}</small></span></td>
                  <td><span className="hash-value"><Fingerprint size={14} />{file.hash}</span></td>
                  <td>{file.status === 'ANALYZING' ? <div className="analysis-progress"><span><SearchCheck size={15} /> Analyse en cours · {file.progress || 0} %</span><ProgressBar value={file.progress || 0} compact /></div> : <StatusBadge status={file.status} />}</td>
                  <td>{file.anomalies ? <strong className="anomaly-number">{file.anomalies}</strong> : <span className="clean-indicator"><CheckCircle2 size={15} /> 0</span>}</td>
                  <td>{file.status === 'IMPORTED' || file.status === 'READ_ERROR' ? <button className="button secondary tiny" onClick={() => void analyze(file)} disabled={analyzingId === file.id}><Play size={14} /> Analyser</button> : file.anomalies ? <Link className="row-action" to={`/countries/${country.id}/anomalies`}>Rapport <ArrowRight size={14} /></Link> : <button className="button ghost tiny" onClick={() => void analyze(file)}><RefreshCcw size={14} /> Relancer</button>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
