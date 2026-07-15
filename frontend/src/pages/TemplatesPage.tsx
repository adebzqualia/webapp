import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  FilePlus2,
  FileSpreadsheet,
  Fingerprint,
  Layers3,
  Search,
  Sheet,
  UploadCloud,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { FileDropzone } from '../components/FileDropzone'
import {
  ErrorState,
  LoadingState,
  PageHeader,
  ProgressBar,
  StatCard,
  StatusBadge,
  useToast,
} from '../components/ui'
import { useAsyncResource } from '../hooks'
import type { TemplateStatus, TemplateSummary } from '../types'
import { formatDate } from '../utils'

type Filter = 'ALL' | TemplateStatus

export function TemplatesPage() {
  const resource = useAsyncResource(() => api.listTemplates(), [])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('ALL')
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const { notify } = useToast()

  const templates = resource.data || []
  const filteredTemplates = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fr')
    return templates.filter((template) => {
      const matchesStatus = filter === 'ALL' || template.status === filter
      const matchesQuery = !query || `${template.name} ${template.originalFilename}`.toLocaleLowerCase('fr').includes(query)
      return matchesStatus && matchesQuery
    })
  }, [filter, search, templates])

  async function uploadTemplate(file: File) {
    setUploading(true)
    try {
      const created = await api.uploadTemplate(file)
      resource.setData((current) => [created, ...(current || [])])
      notify('Template importé. La cartographie peut commencer.')
      setShowUpload(false)
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : 'L’import a échoué.', 'error')
    } finally {
      setUploading(false)
    }
  }

  const configuredSheets = templates.reduce((sum, template) => sum + template.configuredSheets, 0)
  const totalSheets = templates.reduce((sum, template) => sum + template.sheetCount, 0)

  return (
    <div className="page-container">
      <PageHeader
        eyebrow="Référentiels Excel"
        title="Templates POPS"
        description="Importez vos classeurs de référence, cartographiez leur structure et maîtrisez chaque version."
        actions={
          <button className="button primary" onClick={() => setShowUpload((visible) => !visible)}>
            <UploadCloud size={18} /> Importer un template
          </button>
        }
      />

      {showUpload && (
        <section className="card upload-panel">
          <div className="section-heading compact-heading">
            <div>
              <span className="section-kicker">Nouveau référentiel</span>
              <h2>Importer un template Excel</h2>
              <p>Le classeur sera inspecté sans exécuter ses formules, liens ou macros.</p>
            </div>
            <button className="text-button" onClick={() => setShowUpload(false)}>Fermer</button>
          </div>
          <FileDropzone onFile={uploadTemplate} busy={uploading} />
        </section>
      )}

      <section className="stats-grid four">
        <StatCard icon={<FileSpreadsheet size={20} />} label="Templates" value={templates.length} detail="référentiels enregistrés" />
        <StatCard icon={<CheckCircle2 size={20} />} label="Prêts à l’emploi" value={templates.filter((item) => item.status === 'READY').length} detail="cartographie validée" tone="green" />
        <StatCard icon={<Sheet size={20} />} label="Feuilles configurées" value={`${configuredSheets}/${totalSheets || 0}`} detail="tous templates confondus" tone="violet" />
        <StatCard icon={<Layers3 size={20} />} label="Tables cartographiées" value={templates.reduce((sum, item) => sum + item.tableCount, 0)} detail="définitions versionnées" tone="amber" />
      </section>

      <section className="card data-section">
        <div className="section-heading list-heading">
          <div>
            <h2>Bibliothèque des templates</h2>
            <p>{templates.length} version{templates.length > 1 ? 's' : ''} de classeur disponible{templates.length > 1 ? 's' : ''}</p>
          </div>
          <div className="toolbar">
            <label className="search-field">
              <Search size={17} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un template…" />
            </label>
            <div className="segmented-filter" aria-label="Filtrer les templates">
              {([
                ['ALL', 'Tous'],
                ['MAPPING', 'À cartographier'],
                ['READY', 'Prêts'],
              ] as const).map(([value, label]) => (
                <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>
              ))}
            </div>
          </div>
        </div>

        {resource.loading ? (
          <LoadingState label="Chargement des templates…" />
        ) : resource.error ? (
          <ErrorState message={resource.error} onRetry={() => void resource.reload()} />
        ) : filteredTemplates.length === 0 ? (
          <div className="state-panel empty-state">
            <span className="empty-icon"><FilePlus2 size={26} /></span>
            <strong>Aucun template ne correspond</strong>
            <span>Modifiez les filtres ou importez un nouveau classeur de référence.</span>
          </div>
        ) : (
          <div className="template-grid">
            {filteredTemplates.map((template) => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function TemplateCard({ template }: { template: TemplateSummary }) {
  const progress = template.sheetCount ? Math.round((template.configuredSheets / template.sheetCount) * 100) : 0
  return (
    <article className="template-card">
      <div className="template-card-top">
        <span className="document-icon"><FileSpreadsheet size={23} /></span>
        <div className="template-title">
          <div><h3>{template.name}</h3><span className="version-chip">v{template.version}</span></div>
          <span>{template.originalFilename}</span>
        </div>
        <StatusBadge status={template.status} />
      </div>
      <div className="template-meta">
        <span><CalendarDays size={15} /> Importé le {formatDate(template.importedAt)}</span>
        <span><Fingerprint size={15} /> SHA-256&nbsp; {template.workbookHash}</span>
      </div>
      <div className="template-numbers">
        <div><strong>{template.sheetCount}</strong><span>feuilles</span></div>
        <div><strong>{template.tableCount}</strong><span>tableaux</span></div>
        <div><strong>{template.configuredSheets}</strong><span>configurées</span></div>
      </div>
      <ProgressBar value={progress} label="Avancement de la cartographie" compact />
      <div className="template-card-actions">
        <span>{template.status === 'READY' ? 'Cartographie validée' : `${template.sheetCount - template.configuredSheets} feuille(s) à traiter`}</span>
        <Link className="button secondary small" to={`/templates/${template.id}/mapping`}>
          {template.status === 'READY' ? 'Consulter' : 'Continuer'} <ArrowRight size={15} />
        </Link>
      </div>
    </article>
  )
}
