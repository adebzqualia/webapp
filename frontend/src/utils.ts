import type { AnomalyStatus, CountryStatus, Severity, TemplateStatus } from './types'

export function formatDate(value?: string): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 o'
  const units = ['o', 'Ko', 'Mo', 'Go']
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** unit).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} ${units[unit]}`
}

export function columnLabel(index: number): string {
  let label = ''
  let value = index + 1
  while (value > 0) {
    const remainder = (value - 1) % 26
    label = String.fromCharCode(65 + remainder) + label
    value = Math.floor((value - 1) / 26)
  }
  return label
}

export function cellAddress(row: number, column: number): string {
  return `${columnLabel(column)}${row + 1}`
}

export function rangeAddress(start: { row: number; column: number }, end: { row: number; column: number }): string {
  const minRow = Math.min(start.row, end.row)
  const maxRow = Math.max(start.row, end.row)
  const minColumn = Math.min(start.column, end.column)
  const maxColumn = Math.max(start.column, end.column)
  return `${cellAddress(minRow, minColumn)}:${cellAddress(maxRow, maxColumn)}`
}

export function isCellInRange(
  cell: { row: number; column: number },
  start: { row: number; column: number },
  end: { row: number; column: number },
): boolean {
  return (
    cell.row >= Math.min(start.row, end.row) &&
    cell.row <= Math.max(start.row, end.row) &&
    cell.column >= Math.min(start.column, end.column) &&
    cell.column <= Math.max(start.column, end.column)
  )
}

export const countryStatusLabels: Record<CountryStatus, string> = {
  NO_FILE: 'Aucun fichier',
  IMPORTED: 'Importé',
  ANALYZING: 'Analyse en cours',
  COMPLIANT: 'Conforme',
  COMPLIANT_WITH_WARNINGS: 'Avec avertissements',
  NON_COMPLIANT: 'Non conforme',
  READ_ERROR: 'Erreur de lecture',
}

export const templateStatusLabels: Record<TemplateStatus, string> = {
  DRAFT: 'Brouillon',
  MAPPING: 'Cartographie en cours',
  READY: 'Prêt',
}

export const severityLabels: Record<Severity, string> = {
  BLOCKING: 'Bloquant',
  ERROR: 'Erreur',
  WARNING: 'Avertissement',
  INFO: 'Information',
}

export const anomalyStatusLabels: Record<AnomalyStatus, string> = {
  NEW: 'Nouveau',
  CONFIRMED: 'Confirmé',
  FALSE_POSITIVE: 'Faux positif',
  ACCEPTED_EXCEPTION: 'Accepté exceptionnellement',
  FIXED: 'Corrigé',
}

export function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}
