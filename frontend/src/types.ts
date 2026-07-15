export type TemplateStatus = 'DRAFT' | 'MAPPING' | 'READY'
export type CountryStatus =
  | 'NO_FILE'
  | 'IMPORTED'
  | 'ANALYZING'
  | 'COMPLIANT'
  | 'COMPLIANT_WITH_WARNINGS'
  | 'NON_COMPLIANT'
  | 'READ_ERROR'
export type Severity = 'BLOCKING' | 'ERROR' | 'WARNING' | 'INFO'
export type AnomalyStatus = 'NEW' | 'CONFIRMED' | 'FALSE_POSITIVE' | 'ACCEPTED_EXCEPTION' | 'FIXED'
export type StructureMode = 'STRICT' | 'SEMI_DYNAMIC'

export interface TemplateSummary {
  id: string
  name: string
  originalFilename: string
  version: number
  importedAt: string
  workbookHash: string
  sheetCount: number
  configuredSheets: number
  tableCount: number
  status: TemplateStatus
}

export interface TableCandidate {
  id: string
  sheetName: string
  range: string
  confidence: number
  reasons: string[]
  preview: string[][]
}

export interface TableDefinition {
  id: string
  name: string
  range: string
  headerRows: number[]
  dataStartRow: number
  dataEndRow?: number
  keyColumns: string[]
  valueColumns: string[]
  totalRows: number[]
  structureMode: StructureMode
  required: boolean
  status: 'DRAFT' | 'VALIDATED'
}

export interface SheetDefinition {
  id: string
  name: string
  originalIndex: number
  visibility: 'VISIBLE' | 'HIDDEN' | 'VERY_HIDDEN'
  dimensions: string
  configured: boolean
  ignored: boolean
  formulaCount: number
  mergedCellCount: number
  cells: string[][]
  mergedRanges: string[]
  candidates: TableCandidate[]
  tables: TableDefinition[]
}

export interface Country {
  id: string
  name: string
  code?: string
  createdAt: string
  templateId: string
  templateName: string
  currentFile?: string
  currentVersion?: number
  lastImportedAt?: string
  status: CountryStatus
  anomalyCount: number
  blockingCount: number
}

export interface CountryFile {
  id: string
  /** Identifiant stable de l'agrégat CountryFile, utilisé pour lancer l'analyse. */
  aggregateId?: string
  countryId: string
  filename: string
  version: number
  importedAt: string
  importedBy: string
  hash: string
  size: number
  status: CountryStatus
  progress?: number
  anomalies: number
}

export interface StructureColumn {
  name: string
  coordinate: string
  state?: 'UNCHANGED' | 'ADDED' | 'REMOVED' | 'MOVED' | 'CHANGED'
}

export interface Anomaly {
  id: string
  countryId: string
  countryName: string
  fileVersion: number
  sheet?: string
  table?: string
  category: string
  severity: Severity
  description: string
  expected: string
  observed: string
  expectedCoordinates?: string
  observedCoordinates?: string
  suggestion: string
  status: AnomalyStatus
  confidence?: number
  expectedColumns?: StructureColumn[]
  observedColumns?: StructureColumn[]
}

export interface ConsolidationOptions {
  countryIds: string[]
  latestOnly: boolean
  compliantOnly: boolean
  includeAcceptedWarnings: boolean
  includeAcceptedBlocking?: boolean
}

export interface ConsolidationResult {
  id: string
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED'
  progress: number
  filename?: string
  countryCount: number
  copiedSheets: number
  skippedSheets: number
  warnings: string[]
  createdAt: string
  mappings: Array<{
    country: string
    originalSheetName: string
    consolidatedSheetName: string
  }>
}

export interface ApiErrorPayload {
  message?: string
  detail?: string
  errors?: Record<string, string[]>
}
