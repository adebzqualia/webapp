import { CheckCircle2, FileSpreadsheet, LoaderCircle, UploadCloud, X } from 'lucide-react'
import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { formatBytes } from '../utils'

const MAX_FILE_SIZE = 25 * 1024 * 1024

interface FileDropzoneProps {
  onFile: (file: File) => Promise<void> | void
  busy?: boolean
  title?: string
  description?: string
  compact?: boolean
}

export function FileDropzone({
  onFile,
  busy = false,
  title = 'Déposez votre classeur ici',
  description = 'ou sélectionnez un fichier depuis votre ordinateur',
  compact = false,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)

  async function acceptFile(nextFile?: File) {
    setError(null)
    if (!nextFile) return
    if (!nextFile.name.toLowerCase().endsWith('.xlsx')) {
      setError('Format non supporté. Sélectionnez un fichier Excel .xlsx.')
      return
    }
    if (nextFile.size > MAX_FILE_SIZE) {
      setError(`Ce fichier dépasse la limite autorisée de ${formatBytes(MAX_FILE_SIZE)}.`)
      return
    }
    if (nextFile.size === 0) {
      setError('Le fichier sélectionné est vide.')
      return
    }
    setFile(nextFile)
    await onFile(nextFile)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    void acceptFile(event.dataTransfer.files[0])
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    void acceptFile(event.target.files?.[0])
    event.target.value = ''
  }

  return (
    <div className={`dropzone-wrap ${compact ? 'compact' : ''}`}>
      <div
        className={`dropzone ${dragging ? 'dragging' : ''} ${error ? 'invalid' : ''}`}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false) }}
        onDrop={handleDrop}
        onClick={() => !busy && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click() }}
        aria-label="Sélectionner un fichier Excel"
      >
        <input ref={inputRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={handleChange} />
        <span className="dropzone-icon">
          {busy ? <LoaderCircle className="spin" size={28} /> : file && !error ? <FileSpreadsheet size={28} /> : <UploadCloud size={28} />}
        </span>
        <div className="dropzone-copy">
          <strong>{busy ? `Import de ${file?.name || 'votre fichier'}…` : title}</strong>
          <span>{busy ? 'Contrôle de l’intégrité et inspection du classeur' : description}</span>
          {!compact && <small>.xlsx uniquement · 25 Mo maximum · aucune macro ni formule exécutée</small>}
        </div>
        {!busy && <button className="button secondary small" type="button">Parcourir</button>}
      </div>
      {file && !error && !busy && (
        <div className="file-ready">
          <CheckCircle2 size={17} />
          <span><strong>{file.name}</strong> · {formatBytes(file.size)}</span>
          <button aria-label="Retirer le fichier" onClick={() => setFile(null)}><X size={15} /></button>
        </div>
      )}
      {error && <div className="field-error" role="alert">{error}</div>}
    </div>
  )
}
