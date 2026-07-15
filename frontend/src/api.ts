import { cloneDemo, demoAnomalies, demoConsolidation, demoCountries, demoFiles, demoSheets, demoTemplates } from './demo'
import type {
  Anomaly,
  AnomalyStatus,
  ApiErrorPayload,
  ConsolidationOptions,
  ConsolidationResult,
  Country,
  CountryFile,
  CountryStatus,
  Severity,
  SheetDefinition,
  StructureColumn,
  TableCandidate,
  TableDefinition,
  TemplateSummary,
} from './types'
import { columnLabel, joinUrl } from './utils'

const API_URL = import.meta.env.VITE_API_URL || '/api'
export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true'
const ORGANIZATION_KEY = 'pops.organizationId'
const USER_KEY = 'pops.userId'
const MAX_GRID_ROWS = 120
const MAX_GRID_COLUMNS = 40

type JsonRecord = Record<string, unknown>

export interface DevIdentity {
  organizationId: string
  userId: string
}

export function getDevIdentity(): DevIdentity {
  return {
    organizationId: localStorage.getItem(ORGANIZATION_KEY) || 'demo-organization',
    userId: localStorage.getItem(USER_KEY) || 'demo-user',
  }
}

export function setDevIdentity(identity: DevIdentity): void {
  localStorage.setItem(ORGANIZATION_KEY, identity.organizationId.trim() || 'demo-organization')
  localStorage.setItem(USER_KEY, identity.userId.trim() || 'demo-user')
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload?: ApiErrorPayload,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function asRecord(value: unknown): JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return fallback
}

function asNumber(value: unknown, fallback = 0): number {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : fallback
}

function unwrapList<T = unknown>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[]
  const object = asRecord(payload)
  for (const key of ['items', 'data', 'results']) {
    if (Array.isArray(object[key])) return object[key] as T[]
  }
  return []
}

function errorMessage(payload: unknown, status: number): string {
  const object = asRecord(payload)
  const nested = asRecord(object.error)
  return asString(object.message) || asString(object.detail) || asString(nested.message) || `La requête a échoué (${status}).`
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const identity = getDevIdentity()
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  headers.set('X-Organization-Id', identity.organizationId)
  headers.set('X-User-Id', identity.userId)
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')

  let response: Response
  try {
    response = await fetch(joinUrl(API_URL, path), { ...init, headers })
  } catch {
    throw new ApiError('Le service est actuellement injoignable. Vérifiez la configuration de l’API.', 0)
  }

  if (!response.ok) {
    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      payload = undefined
    }
    throw new ApiError(errorMessage(payload, response.status), response.status, payload as ApiErrorPayload | undefined)
  }
  if (response.status === 204) return undefined as T
  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

async function requestBlob(path: string): Promise<Blob> {
  const identity = getDevIdentity()
  const response = await fetch(joinUrl(API_URL, path), {
    headers: {
      Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'X-Organization-Id': identity.organizationId,
      'X-User-Id': identity.userId,
    },
  })
  if (!response.ok) throw new ApiError(`Le téléchargement a échoué (${response.status}).`, response.status)
  return response.blob()
}

const pause = (milliseconds = 320) => new Promise((resolve) => window.setTimeout(resolve, milliseconds))

function normalizeTemplate(payload: unknown): TemplateSummary {
  const raw = asRecord(payload)
  const versions = asArray(raw.versions).map(asRecord)
  const latestVersion = asNumber(raw.latestVersion, Math.max(1, ...versions.map((version) => asNumber(version.version))))
  const latest = versions.find((version) => asNumber(version.version) === latestVersion) || versions[versions.length - 1] || {}
  const sheets = asArray(latest.sheets).map(asRecord)
  const sheetCount = asNumber(raw.sheetCount, asNumber(latest.sheetCount, sheets.length))
  const configuredSheets = asNumber(
    raw.configuredSheets,
    sheets.filter((sheet) => asString(sheet.mappingStatus).toUpperCase() === 'CONFIGURED').length,
  )
  const tableCount = asNumber(
    raw.tableCount,
    sheets.reduce((sum, sheet) => sum + asArray(sheet.tables).length, 0),
  )
  const status = sheetCount > 0 && configuredSheets >= sheetCount ? 'READY' : configuredSheets > 0 || tableCount > 0 ? 'MAPPING' : 'DRAFT'
  return {
    id: asString(raw.id),
    name: asString(raw.name, 'Template POPS'),
    originalFilename: asString(raw.originalFilename, asString(latest.originalFilename, `${asString(raw.name, 'Template_POPS')}.xlsx`)),
    version: latestVersion,
    importedAt: asString(raw.importedAt, asString(latest.importedAt, asString(raw.updatedAt, asString(raw.createdAt, new Date().toISOString())))),
    workbookHash: asString(raw.workbookHash, asString(raw.sha256, asString(latest.sha256, 'empreinte indisponible'))),
    sheetCount,
    configuredSheets,
    tableCount,
    status,
  }
}

function normalizeTable(payload: unknown): TableDefinition {
  const raw = asRecord(payload)
  return {
    id: asString(raw.id),
    name: asString(raw.name, 'Tableau sans nom'),
    range: asString(raw.rangeRef, asString(raw.range)),
    headerRows: asArray(raw.headerRows).map((value) => asNumber(value)).filter(Boolean),
    dataStartRow: asNumber(raw.dataStartRow, 1),
    dataEndRow: raw.dataEndRow == null ? undefined : asNumber(raw.dataEndRow),
    keyColumns: asArray(raw.keyColumns).map((value) => asString(value)).filter(Boolean),
    valueColumns: asArray(raw.valueColumns).map((value) => asString(value)).filter(Boolean),
    totalRows: asArray(raw.totalRows).map((value) => asNumber(value)).filter(Boolean),
    structureMode: asString(raw.structureMode).toUpperCase() === 'SEMI_DYNAMIC' ? 'SEMI_DYNAMIC' : 'STRICT',
    required: raw.required !== false,
    status: asString(raw.status).toUpperCase() === 'VALIDATED' ? 'VALIDATED' : 'DRAFT',
  }
}

function normalizeCandidate(payload: unknown): TableCandidate {
  const raw = asRecord(payload)
  const preview = asRecord(raw.preview)
  const headers = asArray(preview.headers).map((value) => asString(value))
  const rows = asArray(preview.rows).map((row) => asArray(row).map((value) => displayValue(value)))
  return {
    id: asString(raw.id, `candidate-${Math.random().toString(36).slice(2)}`),
    sheetName: asString(raw.sheetName),
    range: asString(raw.rangeRef, asString(raw.range)),
    confidence: asNumber(raw.confidence),
    reasons: asArray(raw.reasons).map((value) => asString(value)).filter(Boolean),
    preview: headers.length ? [headers, ...rows] : rows,
  }
}

function displayValue(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function buildGrid(payload: unknown, fallbackRows: number, fallbackColumns: number): string[][] {
  const raw = asRecord(payload)
  const rows = Math.max(1, Math.min(MAX_GRID_ROWS, asNumber(raw.maxRow, fallbackRows)))
  const columns = Math.max(1, Math.min(MAX_GRID_COLUMNS, asNumber(raw.maxColumn, fallbackColumns)))
  const cells = Array.from({ length: rows }, () => Array.from({ length: columns }, () => ''))
  for (const value of asArray(raw.cells)) {
    const cell = asRecord(value)
    const row = asNumber(cell.row) - 1
    const column = asNumber(cell.column) - 1
    if (row < 0 || row >= rows || column < 0 || column >= columns) continue
    const formula = asString(cell.formula)
    cells[row][column] = formula ? (formula.startsWith('=') ? formula : `=${formula}`) : displayValue(cell.value)
  }
  return cells
}

function normalizeVisibility(value: unknown): SheetDefinition['visibility'] {
  const visibility = asString(value, 'VISIBLE').replace(/\s+/g, '_').toUpperCase()
  if (visibility === 'VERYHIDDEN' || visibility === 'VERY_HIDDEN') return 'VERY_HIDDEN'
  return visibility === 'HIDDEN' ? 'HIDDEN' : 'VISIBLE'
}

function normalizeCountryStatus(value: unknown): CountryStatus {
  const status = asString(value, 'NO_FILE').toUpperCase()
  if (status === 'WARNING') return 'COMPLIANT_WITH_WARNINGS'
  const known: CountryStatus[] = ['NO_FILE', 'IMPORTED', 'ANALYZING', 'COMPLIANT', 'COMPLIANT_WITH_WARNINGS', 'NON_COMPLIANT', 'READ_ERROR']
  return known.includes(status as CountryStatus) ? status as CountryStatus : 'NO_FILE'
}

function flattenCountryFiles(payload: unknown): CountryFile[] {
  const aggregates = unwrapList<unknown>(payload)
  return aggregates.flatMap((aggregatePayload) => {
    const aggregate = asRecord(aggregatePayload)
    return asArray(aggregate.versions).map((versionPayload) => {
      const version = asRecord(versionPayload)
      return {
        id: asString(version.id, asString(aggregate.id)),
        aggregateId: asString(aggregate.id),
        countryId: asString(aggregate.countryId),
        filename: asString(version.originalFilename, 'classeur.xlsx'),
        version: asNumber(version.version, asNumber(aggregate.latestVersion, 1)),
        importedAt: asString(version.importedAt, asString(aggregate.createdAt, new Date().toISOString())),
        importedBy: asString(version.importedBy, asString(version.importedByName, 'Utilisateur API')),
        hash: asString(version.sha256, 'empreinte indisponible'),
        size: asNumber(version.sizeBytes),
        status: normalizeCountryStatus(version.status),
        progress: version.progress == null ? undefined : asNumber(version.progress),
        anomalies: asNumber(version.anomalyCount),
      } satisfies CountryFile
    })
  }).sort((left, right) => right.version - left.version)
}

function normalizeSeverity(value: unknown): Severity {
  const severity = asString(value, 'INFO').toUpperCase()
  return ['BLOCKING', 'ERROR', 'WARNING', 'INFO'].includes(severity) ? severity as Severity : 'INFO'
}

function normalizeAnomalyStatus(value: unknown): AnomalyStatus {
  const status = asString(value, 'NEW').toUpperCase()
  if (status === 'ACCEPTED') return 'ACCEPTED_EXCEPTION'
  if (status === 'RESOLVED') return 'FIXED'
  const known: AnomalyStatus[] = ['NEW', 'CONFIRMED', 'FALSE_POSITIVE', 'ACCEPTED_EXCEPTION', 'FIXED']
  return known.includes(status as AnomalyStatus) ? status as AnomalyStatus : 'NEW'
}

function headersFrom(value: unknown): string[] {
  const record = asRecord(value)
  const direct = asArray(record.headers).map((item) => displayValue(item)).filter(Boolean)
  if (direct.length) return direct
  return asArray(record.columns).map((item) => {
    const column = asRecord(item)
    return asString(column.name, displayValue(item))
  }).filter(Boolean)
}

function comparisonColumns(expectedValue: unknown, actualValue: unknown): { expected?: StructureColumn[]; actual?: StructureColumn[] } {
  const expectedHeaders = headersFrom(expectedValue)
  const actualHeaders = headersFrom(actualValue)
  if (!expectedHeaders.length && !actualHeaders.length) return {}
  return {
    expected: expectedHeaders.map((name, index) => ({
      name,
      coordinate: columnLabel(index),
      state: !actualHeaders.includes(name) ? 'REMOVED' : actualHeaders.indexOf(name) !== index ? 'MOVED' : 'UNCHANGED',
    })),
    actual: actualHeaders.map((name, index) => ({
      name,
      coordinate: columnLabel(index),
      state: !expectedHeaders.includes(name) ? 'ADDED' : expectedHeaders.indexOf(name) !== index ? 'MOVED' : 'UNCHANGED',
    })),
  }
}

function normalizeAnomaly(payload: unknown): Anomaly {
  const raw = asRecord(payload)
  const expectedSource = raw.expectedPreview || raw.expected
  const actualSource = raw.actualPreview || raw.actual || raw.observed
  const columns = comparisonColumns(expectedSource, actualSource)
  return {
    id: asString(raw.id),
    countryId: asString(raw.countryId),
    countryName: asString(raw.countryName),
    fileVersion: asNumber(raw.fileVersion, 0),
    sheet: asString(raw.sheetName, asString(raw.sheet)) || undefined,
    table: asString(raw.tableName, asString(raw.table)) || undefined,
    category: asString(raw.category, 'EXTRACTION_FAILED'),
    severity: normalizeSeverity(raw.severity),
    description: asString(raw.description, 'Anomalie structurelle détectée.'),
    expected: displayValue(raw.expected),
    observed: displayValue(raw.actual ?? raw.observed),
    expectedCoordinates: asString(raw.expectedCoordinates) || undefined,
    observedCoordinates: asString(raw.actualCoordinates, asString(raw.observedCoordinates)) || undefined,
    suggestion: asString(raw.suggestion, 'Examiner la différence avant de prendre une décision.'),
    status: normalizeAnomalyStatus(raw.status),
    confidence: raw.confidence == null ? undefined : asNumber(raw.confidence),
    expectedColumns: columns.expected,
    observedColumns: columns.actual,
  }
}

function normalizeConsolidation(payload: unknown): ConsolidationResult {
  const raw = asRecord(payload)
  const report = asRecord(raw.report)
  const workbook = asRecord(raw.workbook)
  const rawStatus = asString(raw.status, 'PENDING').toUpperCase()
  const status: ConsolidationResult['status'] = rawStatus === 'COMPLETED' ? 'COMPLETED' : rawStatus === 'FAILED' ? 'FAILED' : rawStatus === 'RUNNING' ? 'RUNNING' : 'QUEUED'
  const countriesIncluded = asArray(report.countriesIncluded)
  const sheetsCopied = asArray(report.sheetsCopied)
  const sheetsIgnored = asArray(report.sheetsIgnored)
  const mappings = asArray(report.nameMappings).map((item) => {
    const mapping = asRecord(item)
    return {
      country: asString(mapping.country),
      originalSheetName: asString(mapping.originalSheetName),
      consolidatedSheetName: asString(mapping.consolidatedSheetName),
    }
  })
  const warnings = asArray(report.warnings).map((item) => {
    const warning = asRecord(item)
    return asString(warning.message, displayValue(item))
  }).filter(Boolean)
  return {
    id: asString(raw.id),
    status,
    progress: asNumber(raw.progress),
    filename: asString(workbook.filename, asString(raw.filename)) || undefined,
    countryCount: asNumber(raw.countryCount, countriesIncluded.length),
    copiedSheets: asNumber(raw.copiedSheets, sheetsCopied.length || asNumber(asRecord(report.output).sheetCount)),
    skippedSheets: asNumber(raw.skippedSheets, sheetsIgnored.length),
    warnings,
    createdAt: asString(raw.createdAt, new Date().toISOString()),
    mappings,
  }
}

export const api = {
  async listTemplates(): Promise<TemplateSummary[]> {
    if (USE_MOCKS) {
      await pause()
      return cloneDemo(demoTemplates)
    }
    return unwrapList<unknown>(await request<unknown>('/templates')).map(normalizeTemplate)
  },

  async getTemplate(templateId: string): Promise<TemplateSummary> {
    if (USE_MOCKS) {
      await pause(180)
      return cloneDemo(demoTemplates.find((template) => template.id === templateId) || demoTemplates[0])
    }
    return normalizeTemplate(await request<unknown>(`/templates/${templateId}`))
  },

  async uploadTemplate(file: File): Promise<TemplateSummary> {
    if (USE_MOCKS) {
      await pause(650)
      return {
        ...cloneDemo(demoTemplates[0]),
        id: `tpl-${Date.now()}`,
        name: file.name.replace(/\.xlsx$/i, ''),
        originalFilename: file.name,
        version: 1,
        importedAt: new Date().toISOString(),
        configuredSheets: 0,
        tableCount: 0,
        status: 'DRAFT',
      }
    }
    const body = new FormData()
    body.append('file', file)
    return normalizeTemplate(await request<unknown>('/templates', { method: 'POST', body }))
  },

  async listSheets(templateId: string): Promise<SheetDefinition[]> {
    if (USE_MOCKS) {
      await pause(360)
      return cloneDemo(demoSheets)
    }
    const rawSheets = unwrapList<unknown>(await request<unknown>(`/templates/${templateId}/sheets`)).map(asRecord)
    const candidatesPromise = request<unknown>(`/templates/${templateId}/tables/detect`, {
      method: 'POST',
      body: JSON.stringify({ minimumConfidence: 0.35 }),
    }).then((payload) => unwrapList<unknown>(payload).map((candidate) => ({ raw: asRecord(candidate), normalized: normalizeCandidate(candidate) })))
      .catch(() => [] as Array<{ raw: JsonRecord; normalized: TableCandidate }>)
    const gridsPromise = Promise.all(rawSheets.map((sheet) => {
      const maxRow = Math.max(1, Math.min(MAX_GRID_ROWS, asNumber(sheet.maxRow, 1)))
      const maxColumn = Math.max(1, Math.min(MAX_GRID_COLUMNS, asNumber(sheet.maxColumn, 1)))
      const range = `A1:${columnLabel(maxColumn - 1)}${maxRow}`
      return request<unknown>(`/templates/${templateId}/sheets/${asString(sheet.id)}/grid?range=${encodeURIComponent(range)}`)
    }))
    const [candidates, grids] = await Promise.all([candidatesPromise, gridsPromise])
    return rawSheets.map((sheet, index) => {
      const maxRow = Math.max(1, asNumber(sheet.maxRow, 1))
      const maxColumn = Math.max(1, asNumber(sheet.maxColumn, 1))
      const mappingStatus = asString(sheet.mappingStatus, 'PENDING').toUpperCase()
      return {
        id: asString(sheet.id),
        name: asString(sheet.name),
        originalIndex: asNumber(sheet.originalIndex, index),
        visibility: normalizeVisibility(sheet.visibility),
        dimensions: `A1:${columnLabel(maxColumn - 1)}${maxRow}`,
        configured: mappingStatus !== 'PENDING',
        ignored: sheet.ignored === true,
        formulaCount: asArray(sheet.formulaCells).length,
        mergedCellCount: asArray(sheet.mergedRanges).length,
        cells: buildGrid(grids[index], Math.min(maxRow, MAX_GRID_ROWS), Math.min(maxColumn, MAX_GRID_COLUMNS)),
        mergedRanges: asArray(sheet.mergedRanges).map((value) => asString(value)).filter(Boolean),
        candidates: candidates.filter((candidate) => asString(candidate.raw.sheetId) === asString(sheet.id)).map((candidate) => candidate.normalized),
        tables: asArray(sheet.tables).map(normalizeTable),
      }
    })
  },

  async saveTable(
    templateId: string,
    sheetId: string,
    definition: Omit<TableDefinition, 'id' | 'status'>,
  ): Promise<TableDefinition> {
    if (USE_MOCKS) {
      await pause(420)
      return { ...definition, id: `table-${Date.now()}`, status: 'VALIDATED' }
    }
    const { range, ...fields } = definition
    const created = asRecord(await request<unknown>(`/templates/${templateId}/tables`, {
      method: 'POST',
      body: JSON.stringify({
        ...fields,
        sheetId,
        rangeRef: range,
        dataEndRule: definition.dataEndRow ? undefined : { type: 'LAST_NON_EMPTY_ROW' },
      }),
    }))
    const validated = await request<unknown>(`/templates/${templateId}/tables/${asString(created.id)}/validate`, { method: 'POST' })
    return normalizeTable(validated)
  },

  async ignoreSheet(templateId: string, sheetId: string, ignored = true): Promise<void> {
    if (USE_MOCKS) {
      await pause(220)
      return
    }
    await request<unknown>(`/templates/${templateId}/sheets/${sheetId}`, {
      method: 'PATCH',
      body: JSON.stringify({ ignored }),
    })
  },

  async listCountries(): Promise<Country[]> {
    if (USE_MOCKS) {
      await pause()
      return cloneDemo(demoCountries)
    }
    const [countryPayload, templatePayload] = await Promise.all([
      request<unknown>('/countries'),
      request<unknown>('/templates').catch(() => []),
    ])
    const templateNames = new Map(unwrapList<unknown>(templatePayload).map((item) => {
      const template = asRecord(item)
      return [asString(template.id), asString(template.name)] as const
    }))
    return Promise.all(unwrapList<unknown>(countryPayload).map(async (value) => {
      const raw = asRecord(value)
      const currentFile = asRecord(raw.currentFile)
      const currentFileVersion = asRecord(currentFile.currentVersion)
      let files: CountryFile[] = []
      let rawAnomalies: unknown[] = []
      if (!raw.currentFile || raw.anomalyCount == null) {
        const [filesPayload, anomaliesPayload] = await Promise.all([
          request<unknown>(`/countries/${asString(raw.id)}/files`).catch(() => []),
          request<unknown>(`/countries/${asString(raw.id)}/anomalies`).catch(() => []),
        ])
        files = flattenCountryFiles(filesPayload)
        rawAnomalies = unwrapList<unknown>(anomaliesPayload)
      }
      const latest = files[0]
      const currentFilename = asString(
        currentFile.originalFilename,
        asString(currentFileVersion.originalFilename, latest?.filename),
      )
      const activeAnomalies = rawAnomalies.map(normalizeAnomaly).filter((anomaly) => !['FALSE_POSITIVE', 'FIXED', 'ACCEPTED_EXCEPTION'].includes(anomaly.status))
      return {
        id: asString(raw.id),
        name: asString(raw.name),
        code: asString(raw.code) || undefined,
        createdAt: asString(raw.createdAt, new Date().toISOString()),
        templateId: asString(raw.templateId),
        templateName: asString(raw.templateName, templateNames.get(asString(raw.templateId)) || 'Template POPS'),
        currentFile: currentFilename || undefined,
        currentVersion: raw.currentVersion == null ? latest?.version : asNumber(raw.currentVersion),
        lastImportedAt: asString(raw.lastImportedAt, latest?.importedAt) || undefined,
        status: normalizeCountryStatus(raw.status),
        anomalyCount: asNumber(raw.anomalyCount, activeAnomalies.length),
        blockingCount: asNumber(raw.blockingCount, activeAnomalies.filter((anomaly) => anomaly.severity === 'BLOCKING').length),
      } satisfies Country
    }))
  },

  async createCountry(input: { name: string; code?: string; templateId: string }): Promise<Country> {
    if (USE_MOCKS) {
      await pause(450)
      return {
        id: `country-${Date.now()}`,
        name: input.name,
        code: input.code,
        createdAt: new Date().toISOString(),
        templateId: input.templateId,
        templateName: demoTemplates.find((template) => template.id === input.templateId)?.name || 'Template POPS',
        status: 'NO_FILE',
        anomalyCount: 0,
        blockingCount: 0,
      }
    }
    const raw = asRecord(await request<unknown>('/countries', { method: 'POST', body: JSON.stringify(input) }))
    return {
      id: asString(raw.id), name: asString(raw.name), code: asString(raw.code) || undefined,
      createdAt: asString(raw.createdAt, new Date().toISOString()), templateId: asString(raw.templateId),
      templateName: 'Template POPS', status: normalizeCountryStatus(raw.status), anomalyCount: 0, blockingCount: 0,
    }
  },

  async listCountryFiles(countryId: string): Promise<CountryFile[]> {
    if (USE_MOCKS) {
      await pause()
      return cloneDemo(demoFiles.filter((file) => file.countryId === countryId))
    }
    return flattenCountryFiles(await request<unknown>(`/countries/${countryId}/files`))
  },

  async uploadCountryFile(countryId: string, file: File): Promise<CountryFile> {
    if (USE_MOCKS) {
      await pause(800)
      const currentVersions = demoFiles.filter((item) => item.countryId === countryId).map((item) => item.version)
      return {
        id: `file-${Date.now()}`, countryId, filename: file.name, version: Math.max(0, ...currentVersions) + 1,
        importedAt: new Date().toISOString(), importedBy: 'Utilisateur démo', hash: 'calculé à l’import',
        size: file.size, status: 'IMPORTED', anomalies: 0,
      }
    }
    const body = new FormData()
    body.append('file', file)
    body.append('autoAnalyze', 'false')
    const files = flattenCountryFiles([await request<unknown>(`/countries/${countryId}/files`, { method: 'POST', body })])
    if (!files.length) throw new ApiError('Le serveur n’a renvoyé aucune version après l’import.', 500)
    return files[0]
  },

  async analyzeCountryFile(fileId: string): Promise<{ jobId: string; status: string }> {
    if (USE_MOCKS) {
      await pause(500)
      return { jobId: `job-${Date.now()}`, status: 'RUNNING' }
    }
    const raw = asRecord(await request<unknown>(`/country-files/${fileId}/analyze`, { method: 'POST' }))
    return { jobId: asString(raw.id), status: asString(raw.status) }
  },

  async listAnomalies(countryId: string): Promise<Anomaly[]> {
    if (USE_MOCKS) {
      await pause(360)
      return cloneDemo(demoAnomalies.filter((anomaly) => anomaly.countryId === countryId))
    }
    const [anomalyPayload, countryPayload, filePayload] = await Promise.all([
      request<unknown>(`/countries/${countryId}/anomalies`),
      request<unknown>(`/countries/${countryId}`).catch(() => ({})),
      request<unknown>(`/countries/${countryId}/files`).catch(() => []),
    ])
    const country = asRecord(countryPayload)
    const currentVersion = flattenCountryFiles(filePayload)[0]?.version ?? 0
    return unwrapList<unknown>(anomalyPayload).map((item) => {
      const anomaly = normalizeAnomaly(item)
      return {
        ...anomaly,
        countryName: anomaly.countryName || asString(country.name),
        fileVersion: anomaly.fileVersion || currentVersion,
      }
    })
  },

  async updateAnomaly(anomalyId: string, status: AnomalyStatus): Promise<Anomaly> {
    if (USE_MOCKS) {
      await pause(260)
      const anomaly = cloneDemo(demoAnomalies.find((item) => item.id === anomalyId) || demoAnomalies[0])
      return { ...anomaly, status }
    }
    return normalizeAnomaly(await request<unknown>(`/anomalies/${anomalyId}`, { method: 'PATCH', body: JSON.stringify({ status }) }))
  },

  async createConsolidation(options: ConsolidationOptions): Promise<ConsolidationResult> {
    if (USE_MOCKS) {
      await pause(550)
      return {
        ...cloneDemo(demoConsolidation), id: `cons-${Date.now()}`, status: 'RUNNING', progress: 8,
        countryCount: options.countryIds.length, copiedSheets: 0, createdAt: new Date().toISOString(),
      }
    }
    return normalizeConsolidation(await request<unknown>('/consolidations', {
      method: 'POST',
      body: JSON.stringify({
        countryIds: options.countryIds,
        latestVersionsOnly: options.latestOnly,
        onlyCompliant: options.compliantOnly,
        includeWarnings: options.includeAcceptedWarnings,
        includeAcceptedBlocking: options.includeAcceptedBlocking ?? false,
      }),
    }))
  },

  async getConsolidation(jobId: string): Promise<ConsolidationResult> {
    if (USE_MOCKS) {
      await pause(160)
      return { ...cloneDemo(demoConsolidation), id: jobId }
    }
    return normalizeConsolidation(await request<unknown>(`/consolidations/${jobId}`))
  },

  async downloadConsolidation(jobId: string): Promise<Blob> {
    if (USE_MOCKS) {
      return new Blob(['Démonstration POPS — le backend produira ici le classeur XLSX consolidé.'], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
    }
    return requestBlob(`/consolidations/${jobId}/download`)
  },
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
