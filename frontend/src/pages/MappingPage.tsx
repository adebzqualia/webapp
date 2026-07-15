import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Columns3,
  Eye,
  EyeOff,
  Sigma,
  Grid3X3,
  Info,
  Layers3,
  LockKeyhole,
  Maximize2,
  Merge,
  Plus,
  Save,
  Sheet,
  Sparkles,
  Table2,
  Trash2,
  WandSparkles,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { ExcelGrid } from '../components/ExcelGrid'
import { ErrorState, LoadingState, ProgressBar, StatusBadge, useToast } from '../components/ui'
import type { SheetDefinition, StructureMode, TableCandidate, TableDefinition, TemplateSummary } from '../types'

interface MappingData {
  template: TemplateSummary
  sheets: SheetDefinition[]
}

interface TableForm {
  name: string
  range: string
  headerRows: string
  dataStartRow: string
  dataEndRow: string
  keyColumns: string
  valueColumns: string
  totalRows: string
  structureMode: StructureMode
  required: boolean
}

const EMPTY_FORM: TableForm = {
  name: '',
  range: '',
  headerRows: '1',
  dataStartRow: '2',
  dataEndRow: '',
  keyColumns: '',
  valueColumns: '',
  totalRows: '',
  structureMode: 'STRICT',
  required: true,
}

function numberList(value: string): number[] {
  return value.split(',').map((item) => Number(item.trim())).filter((item) => Number.isFinite(item) && item > 0)
}

function columnList(value: string): string[] {
  return value.split(',').map((item) => item.trim().toUpperCase()).filter(Boolean)
}

function firstAndLastRows(range: string): { start: number; end: number } | null {
  const match = /^[A-Z]+(\d+):[A-Z]+(\d+)$/i.exec(range)
  return match ? { start: Number(match[1]), end: Number(match[2]) } : null
}

function previewFromRange(sheet: SheetDefinition, range: string): string[][] {
  const match = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(range)
  if (!match) return []
  const toColumn = (letters: string) => letters.toUpperCase().split('').reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1
  const startColumn = toColumn(match[1])
  const endColumn = toColumn(match[3])
  const startRow = Number(match[2]) - 1
  const endRow = Math.min(Number(match[4]) - 1, startRow + 4)
  return sheet.cells.slice(startRow, endRow + 1).map((row) => row.slice(startColumn, endColumn + 1))
}

export function MappingPage() {
  const { id = '' } = useParams()
  const [data, setData] = useState<MappingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeSheetId, setActiveSheetId] = useState('')
  const [zoom, setZoom] = useState(1)
  const [selectedRange, setSelectedRange] = useState('')
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null)
  const [rejectedCandidates, setRejectedCandidates] = useState<string[]>([])
  const [form, setForm] = useState<TableForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const { notify } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [template, sheets] = await Promise.all([api.getTemplate(id), api.listSheets(id)])
      setData({ template, sheets })
      setActiveSheetId((current) => current || sheets[0]?.id || '')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de charger la cartographie.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  const activeSheet = data?.sheets.find((sheet) => sheet.id === activeSheetId) || data?.sheets[0]
  const configuredCount = data?.sheets.filter((sheet) => sheet.configured).length || 0
  const totalTables = data?.sheets.reduce((sum, sheet) => sum + sheet.tables.length, 0) || 0
  const progress = data?.sheets.length ? Math.round((configuredCount / data.sheets.length) * 100) : 0
  const preview = activeSheet && selectedRange ? previewFromRange(activeSheet, selectedRange) : []

  const visibleCandidates = useMemo(
    () => activeSheet?.candidates.filter((candidate) => !rejectedCandidates.includes(candidate.id)) || [],
    [activeSheet, rejectedCandidates],
  )

  function selectSheet(sheet: SheetDefinition) {
    setActiveSheetId(sheet.id)
    setSelectedRange('')
    setSelectedCandidate(null)
    setForm(EMPTY_FORM)
  }

  function updateForm<Key extends keyof TableForm>(key: Key, value: TableForm[Key]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function applyRange(range: string) {
    setSelectedRange(range)
    const rows = firstAndLastRows(range)
    setForm((current) => ({
      ...current,
      range,
      headerRows: rows ? String(rows.start) : current.headerRows,
      dataStartRow: rows ? String(rows.start + 1) : current.dataStartRow,
      dataEndRow: rows ? String(rows.end) : current.dataEndRow,
    }))
  }

  function acceptCandidate(candidate: TableCandidate) {
    setSelectedCandidate(candidate.id)
    applyRange(candidate.range)
    setForm((current) => ({
      ...current,
      name: current.name || candidate.preview[0]?.[0] || `Tableau ${candidate.range}`,
    }))
    notify(`Proposition ${candidate.range} chargée. Vérifiez sa configuration.`)
  }

  function editTable(table: TableDefinition) {
    setSelectedCandidate(null)
    setSelectedRange(table.range)
    setForm({
      name: table.name,
      range: table.range,
      headerRows: table.headerRows.join(', '),
      dataStartRow: String(table.dataStartRow),
      dataEndRow: table.dataEndRow ? String(table.dataEndRow) : '',
      keyColumns: table.keyColumns.join(', '),
      valueColumns: table.valueColumns.join(', '),
      totalRows: table.totalRows.join(', '),
      structureMode: table.structureMode,
      required: table.required,
    })
  }

  async function validateTable(event: FormEvent) {
    event.preventDefault()
    if (!activeSheet || !form.name.trim() || !form.range.trim()) {
      notify('Renseignez un nom et sélectionnez une plage avant de valider.', 'error')
      return
    }
    setSaving(true)
    try {
      const table = await api.saveTable(id, activeSheet.id, {
        name: form.name.trim(),
        range: form.range.toUpperCase(),
        headerRows: numberList(form.headerRows),
        dataStartRow: Number(form.dataStartRow),
        dataEndRow: form.dataEndRow ? Number(form.dataEndRow) : undefined,
        keyColumns: columnList(form.keyColumns),
        valueColumns: columnList(form.valueColumns),
        totalRows: numberList(form.totalRows),
        structureMode: form.structureMode,
        required: form.required,
      })
      setData((current) => current && ({
        ...current,
        sheets: current.sheets.map((sheet) => sheet.id === activeSheet.id
          ? { ...sheet, configured: true, tables: [...sheet.tables.filter((item) => item.range !== table.range), table] }
          : sheet),
      }))
      notify('Tableau validé et ajouté à la cartographie.')
      setForm(EMPTY_FORM)
      setSelectedRange('')
      setSelectedCandidate(null)
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : 'La validation a échoué.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function ignoreActiveSheet() {
    if (!activeSheet) return
    try {
      await api.ignoreSheet(id, activeSheet.id, true)
      setData((current) => current && ({
        ...current,
        sheets: current.sheets.map((sheet) => sheet.id === activeSheet.id ? { ...sheet, ignored: true, configured: true } : sheet),
      }))
      notify(`La feuille « ${activeSheet.name} » est marquée sans tableau utile.`)
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : 'La feuille n’a pas pu être ignorée.', 'error')
    }
  }

  if (loading) return <div className="page-container"><LoadingState label="Ouverture du classeur et de sa cartographie…" /></div>
  if (error || !data || !activeSheet) return <div className="page-container"><ErrorState message={error || 'Aucune feuille détectée.'} onRetry={() => void load()} /></div>

  return (
    <div className="mapping-page">
      <div className="mapping-topline">
        <div className="mapping-title-block">
          <Link to="/templates" className="back-link"><ArrowLeft size={16} /> Templates</Link>
          <div>
            <span className="document-icon small"><Grid3X3 size={19} /></span>
            <div>
              <div className="mapping-title-row"><h1>{data.template.name}</h1><span className="version-chip">v{data.template.version}</span><StatusBadge status={data.template.status} /></div>
              <span>{data.template.originalFilename}</span>
            </div>
          </div>
        </div>
        <div className="mapping-progress-card">
          <div><strong>{progress} %</strong><span>de la cartographie</span></div>
          <ProgressBar value={progress} compact />
          <div className="mapping-progress-metrics">
            <span><strong>{configuredCount}</strong> / {data.sheets.length} feuilles</span>
            <span><strong>{totalTables}</strong> tableaux validés</span>
          </div>
        </div>
        <button className="button secondary"><Save size={17} /> Enregistrer</button>
      </div>

      <div className="mapping-workspace">
        <aside className="sheet-sidebar">
          <div className="panel-title">
            <div><span>Feuilles</span><strong>{data.sheets.length}</strong></div>
            <button className="icon-button subtle" title="Réduire"><ChevronDown size={16} /></button>
          </div>
          <div className="sheet-list">
            {data.sheets.map((sheet) => (
              <button key={sheet.id} className={sheet.id === activeSheet.id ? 'active' : ''} onClick={() => selectSheet(sheet)}>
                <span className={`sheet-status ${sheet.configured ? 'done' : ''}`}>{sheet.configured ? <Check size={13} /> : sheet.originalIndex + 1}</span>
                <span className="sheet-name"><strong>{sheet.name}</strong><small>{sheet.dimensions}</small></span>
                {sheet.visibility !== 'VISIBLE' && <EyeOff size={14} className="muted-icon" />}
                {sheet.ignored && <span className="ignored-chip">ignorée</span>}
                {!sheet.ignored && sheet.tables.length > 0 && <span className="count-chip">{sheet.tables.length}</span>}
                <ChevronRight size={14} />
              </button>
            ))}
          </div>
          <div className="sheet-legend">
            <span><i className="legend-dot done" /> Configurée</span>
            <span><i className="legend-dot" /> À traiter</span>
          </div>
        </aside>

        <section className="grid-panel">
          <div className="grid-toolbar">
            <div className="sheet-context">
              <Sheet size={17} />
              <div><strong>{activeSheet.name}</strong><span>Feuille {activeSheet.originalIndex + 1} · {activeSheet.dimensions}</span></div>
              {activeSheet.visibility !== 'VISIBLE' && <StatusBadge status="INFO" label={activeSheet.visibility === 'HIDDEN' ? 'Masquée' : 'Très masquée'} />}
            </div>
            <div className="sheet-insights">
              <span title="Formules détectées"><Sigma size={15} /> {activeSheet.formulaCount} formules</span>
              <span title="Cellules fusionnées"><Merge size={15} /> {activeSheet.mergedCellCount} fusions</span>
            </div>
            <div className="zoom-controls">
              <button onClick={() => setZoom((value) => Math.max(0.65, value - 0.1))} aria-label="Dézoomer"><ZoomOut size={16} /></button>
              <span>{Math.round(zoom * 100)} %</span>
              <button onClick={() => setZoom((value) => Math.min(1.45, value + 0.1))} aria-label="Zoomer"><ZoomIn size={16} /></button>
              <button onClick={() => setZoom(1)} aria-label="Réinitialiser le zoom"><Maximize2 size={15} /></button>
            </div>
          </div>
          <div className="grid-guidance">
            <Info size={15} /> Cliquez puis faites glisser pour sélectionner une plage. Les zones bleues sont des propositions du moteur.
          </div>
          <ExcelGrid
            cells={activeSheet.cells}
            zoom={zoom}
            mergedRanges={activeSheet.mergedRanges}
            candidateRanges={visibleCandidates.map((candidate) => candidate.range)}
            activeRange={selectedRange}
            onRangeSelected={applyRange}
          />
          {preview.length > 0 && (
            <div className="structured-preview">
              <div className="preview-heading">
                <div><Table2 size={17} /><span><strong>Aperçu structuré</strong><small>{selectedRange} · {preview.length - 1} ligne(s) affichée(s)</small></span></div>
                <button className="text-button" onClick={() => setSelectedRange('')}>Modifier la sélection</button>
              </div>
              <div className="preview-table-wrap">
                <table>
                  <thead><tr>{preview[0].map((cell, index) => <th key={index}>{cell || `Colonne ${index + 1}`}<small>{/^[-+]?\d/.test(preview[1]?.[index] || '') ? 'Nombre' : 'Texte'}</small></th>)}</tr></thead>
                  <tbody>{preview.slice(1).map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, index) => <td key={index}>{cell || <span className="empty-value">vide</span>}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <aside className="mapping-inspector">
          <div className="panel-title inspector-title">
            <div><span>Configuration</span><strong>{activeSheet.tables.length} tableau{activeSheet.tables.length > 1 ? 'x' : ''}</strong></div>
            <button className="icon-button subtle"><Columns3 size={16} /></button>
          </div>
          <div className="inspector-scroll">
            {activeSheet.tables.length > 0 && (
              <section className="validated-tables">
                <div className="subsection-title"><CheckCircle2 size={16} /><strong>Tableaux validés</strong></div>
                {activeSheet.tables.map((table) => (
                  <button key={table.id} onClick={() => editTable(table)}>
                    <span className="table-check"><Check size={13} /></span>
                    <span><strong>{table.name}</strong><small>{table.range} · {table.structureMode === 'STRICT' ? 'Strict' : 'Semi-dynamique'}</small></span>
                    <ChevronRight size={14} />
                  </button>
                ))}
              </section>
            )}

            <section className="candidate-section">
              <div className="subsection-title split-title">
                <span><WandSparkles size={16} /><strong>Propositions</strong></span>
                <span className="count-chip">{visibleCandidates.length}</span>
              </div>
              {visibleCandidates.length === 0 ? (
                <div className="mini-empty"><Sparkles size={18} /><span>Aucune zone supplémentaire détectée sur cette feuille.</span></div>
              ) : visibleCandidates.map((candidate) => (
                <article className={`candidate-card ${selectedCandidate === candidate.id ? 'selected' : ''}`} key={candidate.id}>
                  <div className="candidate-top">
                    <span className="range-chip">{candidate.range}</span>
                    <span className={`confidence ${candidate.confidence >= 0.9 ? 'high' : ''}`}>{Math.round(candidate.confidence * 100)} %</span>
                  </div>
                  <strong>{candidate.preview[0]?.slice(0, 3).join(' · ')}</strong>
                  <ul>{candidate.reasons.slice(0, 2).map((reason) => <li key={reason}>{reason}</li>)}</ul>
                  <div className="candidate-actions">
                    <button className="button primary tiny" onClick={() => acceptCandidate(candidate)}><Check size={14} /> Utiliser</button>
                    <button className="button ghost tiny" onClick={() => setRejectedCandidates((items) => [...items, candidate.id])}><Trash2 size={14} /> Rejeter</button>
                  </div>
                </article>
              ))}
            </section>

            <form className="table-form" onSubmit={validateTable}>
              <div className="subsection-title split-title">
                <span><Table2 size={16} /><strong>Définition du tableau</strong></span>
                <button type="button" className="text-button" onClick={() => { setForm(EMPTY_FORM); setSelectedRange('') }}><Plus size={14} /> Nouveau</button>
              </div>
              <label>Nom fonctionnel <span>*</span><input value={form.name} onChange={(event) => updateForm('name', event.target.value)} placeholder="Ex. Performance financière" /></label>
              <label>Plage Excel <span>*</span><div className="input-with-icon"><Grid3X3 size={15} /><input value={form.range} onChange={(event) => { updateForm('range', event.target.value.toUpperCase()); setSelectedRange(event.target.value.toUpperCase()) }} placeholder="B7:H24" /></div></label>
              <div className="form-row three">
                <label>En-tête(s)<input value={form.headerRows} onChange={(event) => updateForm('headerRows', event.target.value)} placeholder="7, 8" /></label>
                <label>1re donnée<input type="number" min="1" value={form.dataStartRow} onChange={(event) => updateForm('dataStartRow', event.target.value)} /></label>
                <label>Dernière<input type="number" min="1" value={form.dataEndRow} onChange={(event) => updateForm('dataEndRow', event.target.value)} placeholder="Auto" /></label>
              </div>
              <div className="form-row">
                <label>Colonnes clés<input value={form.keyColumns} onChange={(event) => updateForm('keyColumns', event.target.value)} placeholder="B, C" /></label>
                <label>Colonnes valeurs<input value={form.valueColumns} onChange={(event) => updateForm('valueColumns', event.target.value)} placeholder="D, E, F" /></label>
              </div>
              <label>Lignes de total<input value={form.totalRows} onChange={(event) => updateForm('totalRows', event.target.value)} placeholder="23, 24 (facultatif)" /></label>
              <fieldset>
                <legend>Mode de contrôle structurel</legend>
                <label className={`mode-choice ${form.structureMode === 'STRICT' ? 'selected' : ''}`}>
                  <input type="radio" name="mode" checked={form.structureMode === 'STRICT'} onChange={() => updateForm('structureMode', 'STRICT')} />
                  <LockKeyhole size={16} /><span><strong>Strict</strong><small>Positions, ordre et dimensions identiques</small></span>
                </label>
                <label className={`mode-choice ${form.structureMode === 'SEMI_DYNAMIC' ? 'selected' : ''}`}>
                  <input type="radio" name="mode" checked={form.structureMode === 'SEMI_DYNAMIC'} onChange={() => updateForm('structureMode', 'SEMI_DYNAMIC')} />
                  <Layers3 size={16} /><span><strong>Semi-dynamique</strong><small>Lignes variables, colonnes stables</small></span>
                </label>
              </fieldset>
              <label className="toggle-row">
                <span><strong>Tableau obligatoire</strong><small>Son absence sera bloquante</small></span>
                <input type="checkbox" checked={form.required} onChange={(event) => updateForm('required', event.target.checked)} />
              </label>
              <button className="button primary wide" type="submit" disabled={saving}>
                {saving ? <span className="button-loader" /> : <CheckCircle2 size={17} />} Valider le tableau
              </button>
              <button className="button ghost wide" type="button" onClick={ignoreActiveSheet}><EyeOff size={16} /> Marquer la feuille sans tableau utile</button>
            </form>
          </div>
        </aside>
      </div>
    </div>
  )
}
