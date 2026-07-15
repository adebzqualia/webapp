import type {
  Anomaly,
  ConsolidationResult,
  Country,
  CountryFile,
  SheetDefinition,
  TemplateSummary,
} from './types'

const NOW = '2026-07-15T08:42:00.000Z'

function makeCells(sheet: string): string[][] {
  const rows = Array.from({ length: 28 }, () => Array.from({ length: 12 }, () => ''))

  if (sheet === 'Financial KPIs') {
    rows[1][1] = 'POPS — Performance financière 2026'
    rows[3][1] = 'Périmètre : France | Devise : EUR'
    rows[6][1] = 'Catégorie'
    rows[6][2] = 'Indicateur'
    rows[6][3] = 'Réalisé 2025'
    rows[6][4] = 'Budget 2026'
    rows[6][5] = 'Réalisé YTD'
    rows[6][6] = 'Atterrissage'
    rows[6][7] = 'Écart %'
    const values = [
      ['Revenus', 'Chiffre d’affaires', '12 840', '14 200', '6 720', '13 960', '=IFERROR((G8-E8)/E8,0)'],
      ['Revenus', 'Marge brute', '5 910', '6 520', '3 080', '6 330', '=IFERROR((G9-E9)/E9,0)'],
      ['Coûts', 'OPEX', '3 450', '3 680', '1 820', '3 700', '=IFERROR((G10-E10)/E10,0)'],
      ['Résultat', 'EBITDA', '2 460', '2 840', '1 260', '2 630', '=IFERROR((G11-E11)/E11,0)'],
      ['Trésorerie', 'Cash-flow libre', '1 620', '1 980', '890', '1 870', '=IFERROR((G12-E12)/E12,0)'],
    ]
    values.forEach((line, index) => line.forEach((value, column) => (rows[7 + index][1 + column] = value)))
    rows[12][1] = 'TOTAL'
    rows[12][3] = '=SUM(D8:D12)'
    rows[12][4] = '=SUM(E8:E12)'
    rows[12][5] = '=SUM(F8:F12)'
    rows[12][6] = '=SUM(G8:G12)'
    rows[17][1] = 'Investissements'
    rows[18][1] = 'Projet'
    rows[18][2] = 'Responsable'
    rows[18][3] = 'Budget'
    rows[18][4] = 'Engagé'
    rows[18][5] = 'Statut'
    ;[
      ['ERP Wave 2', 'S. Martin', '420', '305', 'En cours'],
      ['Data platform', 'L. Bernard', '280', '190', 'En cours'],
      ['Modernisation sites', 'A. Petit', '150', '148', 'Terminé'],
    ].forEach((line, index) => line.forEach((value, column) => (rows[19 + index][1 + column] = value)))
  } else if (sheet === 'Operational KPIs') {
    rows[1][1] = 'Indicateurs opérationnels'
    rows[5][1] = 'Processus'
    rows[5][2] = 'KPI'
    rows[5][3] = 'Unité'
    rows[5][4] = 'Cible'
    rows[5][5] = 'Réalisé'
    rows[5][6] = 'Tendance'
    ;[
      ['Service client', 'NPS', 'pts', '55', '58', '↗'],
      ['Logistique', 'Livraisons à l’heure', '%', '96%', '94,8%', '↘'],
      ['Qualité', 'Taux de défaut', '%', '< 1,5%', '1,2%', '↗'],
      ['RH', 'Absentéisme', '%', '< 3%', '2,8%', '→'],
      ['Production', 'Utilisation capacité', '%', '88%', '90,1%', '↗'],
    ].forEach((line, index) => line.forEach((value, column) => (rows[6 + index][1 + column] = value)))
  } else if (sheet === 'Workforce') {
    rows[1][1] = 'Effectifs et mouvements'
    rows[5][1] = 'Département'
    rows[5][2] = 'ETP début'
    rows[5][3] = 'Entrées'
    rows[5][4] = 'Sorties'
    rows[5][5] = 'ETP fin'
    rows[5][6] = 'Budget ETP'
    ;[
      ['Ventes', '62', '5', '3', '64', '65'],
      ['Opérations', '118', '9', '6', '121', '124'],
      ['Finance', '24', '1', '2', '23', '25'],
      ['Technologie', '47', '7', '2', '52', '54'],
    ].forEach((line, index) => line.forEach((value, column) => (rows[6 + index][1 + column] = value)))
  } else {
    rows[1][1] = sheet
    rows[4][1] = 'Cette feuille contient des notes de présentation et aucune donnée à consolider.'
  }

  return rows
}

export const demoTemplates: TemplateSummary[] = [
  {
    id: 'tpl-pops-2026',
    name: 'POPS Groupe 2026',
    originalFilename: 'POPS_Template_Group_2026_v3.xlsx',
    version: 3,
    importedAt: '2026-07-14T14:32:00Z',
    workbookHash: '8ae91cc7d1f72c47a421799c84dd…a19e',
    sheetCount: 8,
    configuredSheets: 5,
    tableCount: 12,
    status: 'MAPPING',
  },
  {
    id: 'tpl-pops-2025',
    name: 'POPS Groupe 2025',
    originalFilename: 'POPS_Template_Group_2025_final.xlsx',
    version: 5,
    importedAt: '2025-12-03T09:18:00Z',
    workbookHash: 'f2c91aa55de0b236097f8af2e520…7dd4',
    sheetCount: 7,
    configuredSheets: 7,
    tableCount: 11,
    status: 'READY',
  },
  {
    id: 'tpl-pilot',
    name: 'Template pilote APAC',
    originalFilename: 'POPS_APAC_Pilot.xlsx',
    version: 1,
    importedAt: '2026-06-21T16:05:00Z',
    workbookHash: '4b71f5c2092fb6885e44ac0f4421…cb91',
    sheetCount: 6,
    configuredSheets: 1,
    tableCount: 2,
    status: 'DRAFT',
  },
]

export const demoSheets: SheetDefinition[] = [
  {
    id: 'sheet-financial',
    name: 'Financial KPIs',
    originalIndex: 0,
    visibility: 'VISIBLE',
    dimensions: 'A1:L28',
    configured: true,
    ignored: false,
    formulaCount: 14,
    mergedCellCount: 2,
    cells: makeCells('Financial KPIs'),
    mergedRanges: ['B2:H2', 'B4:D4'],
    candidates: [
      {
        id: 'candidate-revenue',
        sheetName: 'Financial KPIs',
        range: 'B7:H13',
        confidence: 0.94,
        reasons: ['En-têtes en gras détectés', 'Zone rectangulaire dense', 'Formules répétées en colonne H'],
        preview: [
          ['Catégorie', 'Indicateur', 'Réalisé 2025', 'Budget 2026'],
          ['Revenus', 'Chiffre d’affaires', '12 840', '14 200'],
          ['Revenus', 'Marge brute', '5 910', '6 520'],
        ],
      },
      {
        id: 'candidate-capex',
        sheetName: 'Financial KPIs',
        range: 'B19:F22',
        confidence: 0.87,
        reasons: ['Bordures homogènes', 'Ligne d’en-tête distincte', 'Types de données cohérents'],
        preview: [
          ['Projet', 'Responsable', 'Budget', 'Engagé'],
          ['ERP Wave 2', 'S. Martin', '420', '305'],
          ['Data platform', 'L. Bernard', '280', '190'],
        ],
      },
    ],
    tables: [
      {
        id: 'table-revenue',
        name: 'Performance financière',
        range: 'B7:H13',
        headerRows: [7],
        dataStartRow: 8,
        dataEndRow: 12,
        keyColumns: ['B', 'C'],
        valueColumns: ['D', 'E', 'F', 'G', 'H'],
        totalRows: [13],
        structureMode: 'STRICT',
        required: true,
        status: 'VALIDATED',
      },
    ],
  },
  {
    id: 'sheet-operational',
    name: 'Operational KPIs',
    originalIndex: 1,
    visibility: 'VISIBLE',
    dimensions: 'A1:L21',
    configured: true,
    ignored: false,
    formulaCount: 5,
    mergedCellCount: 1,
    cells: makeCells('Operational KPIs'),
    mergedRanges: ['B2:G2'],
    candidates: [
      {
        id: 'candidate-ops',
        sheetName: 'Operational KPIs',
        range: 'B6:G11',
        confidence: 0.91,
        reasons: ['Densité de cellules élevée', 'Styles d’en-tête similaires', 'Colonne clé textuelle stable'],
        preview: [
          ['Processus', 'KPI', 'Unité', 'Cible'],
          ['Service client', 'NPS', 'pts', '55'],
          ['Logistique', 'Livraisons à l’heure', '%', '96%'],
        ],
      },
    ],
    tables: [
      {
        id: 'table-ops',
        name: 'Indicateurs opérationnels',
        range: 'B6:G11',
        headerRows: [6],
        dataStartRow: 7,
        dataEndRow: 11,
        keyColumns: ['B', 'C'],
        valueColumns: ['D', 'E', 'F', 'G'],
        totalRows: [],
        structureMode: 'SEMI_DYNAMIC',
        required: true,
        status: 'VALIDATED',
      },
    ],
  },
  {
    id: 'sheet-workforce',
    name: 'Workforce',
    originalIndex: 2,
    visibility: 'VISIBLE',
    dimensions: 'A1:J18',
    configured: false,
    ignored: false,
    formulaCount: 4,
    mergedCellCount: 1,
    cells: makeCells('Workforce'),
    mergedRanges: ['B2:G2'],
    candidates: [
      {
        id: 'candidate-workforce',
        sheetName: 'Workforce',
        range: 'B6:G10',
        confidence: 0.89,
        reasons: ['Séparation par lignes vides', 'En-tête coloré', 'Valeurs numériques alignées'],
        preview: [
          ['Département', 'ETP début', 'Entrées', 'Sorties'],
          ['Ventes', '62', '5', '3'],
          ['Opérations', '118', '9', '6'],
        ],
      },
    ],
    tables: [],
  },
  {
    id: 'sheet-assumptions',
    name: 'Assumptions',
    originalIndex: 3,
    visibility: 'VISIBLE',
    dimensions: 'A1:H22',
    configured: false,
    ignored: false,
    formulaCount: 2,
    mergedCellCount: 3,
    cells: makeCells('Assumptions'),
    mergedRanges: ['B2:F2', 'B5:F5', 'B9:F9'],
    candidates: [],
    tables: [],
  },
  {
    id: 'sheet-readme',
    name: 'Read me',
    originalIndex: 4,
    visibility: 'VISIBLE',
    dimensions: 'A1:H16',
    configured: true,
    ignored: true,
    formulaCount: 0,
    mergedCellCount: 4,
    cells: makeCells('Read me'),
    mergedRanges: ['B2:G2'],
    candidates: [],
    tables: [],
  },
  {
    id: 'sheet-lookups',
    name: '_Lookups',
    originalIndex: 5,
    visibility: 'HIDDEN',
    dimensions: 'A1:E48',
    configured: true,
    ignored: false,
    formulaCount: 0,
    mergedCellCount: 0,
    cells: makeCells('_Lookups'),
    mergedRanges: [],
    candidates: [],
    tables: [],
  },
  {
    id: 'sheet-control',
    name: '_Control',
    originalIndex: 6,
    visibility: 'VERY_HIDDEN',
    dimensions: 'A1:D12',
    configured: false,
    ignored: false,
    formulaCount: 8,
    mergedCellCount: 0,
    cells: makeCells('_Control'),
    mergedRanges: [],
    candidates: [],
    tables: [],
  },
  {
    id: 'sheet-cover',
    name: 'Cover',
    originalIndex: 7,
    visibility: 'VISIBLE',
    dimensions: 'A1:H20',
    configured: true,
    ignored: true,
    formulaCount: 0,
    mergedCellCount: 6,
    cells: makeCells('Cover'),
    mergedRanges: ['B2:G4'],
    candidates: [],
    tables: [],
  },
]

export const demoCountries: Country[] = [
  {
    id: 'country-fr',
    name: 'France',
    code: 'FR',
    createdAt: '2026-05-12T10:00:00Z',
    templateId: 'tpl-pops-2026',
    templateName: 'POPS Groupe 2026',
    currentFile: 'POPS_FRANCE_Juin_2026.xlsx',
    currentVersion: 4,
    lastImportedAt: '2026-07-15T07:24:00Z',
    status: 'COMPLIANT',
    anomalyCount: 0,
    blockingCount: 0,
  },
  {
    id: 'country-de',
    name: 'Allemagne',
    code: 'DE',
    createdAt: '2026-05-12T10:02:00Z',
    templateId: 'tpl-pops-2026',
    templateName: 'POPS Groupe 2026',
    currentFile: 'POPS_DE_June_2026.xlsx',
    currentVersion: 3,
    lastImportedAt: '2026-07-14T13:16:00Z',
    status: 'COMPLIANT_WITH_WARNINGS',
    anomalyCount: 4,
    blockingCount: 0,
  },
  {
    id: 'country-es',
    name: 'Espagne',
    code: 'ES',
    createdAt: '2026-05-13T09:40:00Z',
    templateId: 'tpl-pops-2026',
    templateName: 'POPS Groupe 2026',
    currentFile: 'POPS_ES_Junio_v2.xlsx',
    currentVersion: 2,
    lastImportedAt: '2026-07-13T15:52:00Z',
    status: 'NON_COMPLIANT',
    anomalyCount: 9,
    blockingCount: 2,
  },
  {
    id: 'country-uk',
    name: 'Royaume-Uni',
    code: 'UK',
    createdAt: '2026-05-14T14:18:00Z',
    templateId: 'tpl-pops-2026',
    templateName: 'POPS Groupe 2026',
    currentFile: 'UK_POPS_2026_06.xlsx',
    currentVersion: 3,
    lastImportedAt: '2026-07-15T06:48:00Z',
    status: 'ANALYZING',
    anomalyCount: 0,
    blockingCount: 0,
  },
  {
    id: 'country-it',
    name: 'Italie',
    code: 'IT',
    createdAt: '2026-06-02T11:30:00Z',
    templateId: 'tpl-pops-2026',
    templateName: 'POPS Groupe 2026',
    currentFile: 'POPS_Italy_June.xlsx',
    currentVersion: 1,
    lastImportedAt: '2026-07-11T08:14:00Z',
    status: 'IMPORTED',
    anomalyCount: 0,
    blockingCount: 0,
  },
  {
    id: 'country-pl',
    name: 'Pologne',
    code: 'PL',
    createdAt: '2026-06-08T10:42:00Z',
    templateId: 'tpl-pops-2026',
    templateName: 'POPS Groupe 2026',
    status: 'NO_FILE',
    anomalyCount: 0,
    blockingCount: 0,
  },
]

export const demoFiles: CountryFile[] = [
  {
    id: 'file-fr-4',
    countryId: 'country-fr',
    filename: 'POPS_FRANCE_Juin_2026.xlsx',
    version: 4,
    importedAt: '2026-07-15T07:24:00Z',
    importedBy: 'Marie Dupont',
    hash: 'f8210aa3…d9c2',
    size: 4_821_114,
    status: 'COMPLIANT',
    anomalies: 0,
  },
  {
    id: 'file-fr-3',
    countryId: 'country-fr',
    filename: 'POPS_FRANCE_Mai_2026.xlsx',
    version: 3,
    importedAt: '2026-06-15T08:02:00Z',
    importedBy: 'Marie Dupont',
    hash: 'cc16fc20…3f72',
    size: 4_716_203,
    status: 'COMPLIANT_WITH_WARNINGS',
    anomalies: 2,
  },
  {
    id: 'file-de-3',
    countryId: 'country-de',
    filename: 'POPS_DE_June_2026.xlsx',
    version: 3,
    importedAt: '2026-07-14T13:16:00Z',
    importedBy: 'Jonas Weber',
    hash: '08bf7832…e802',
    size: 5_104_008,
    status: 'COMPLIANT_WITH_WARNINGS',
    anomalies: 4,
  },
  {
    id: 'file-es-2',
    countryId: 'country-es',
    filename: 'POPS_ES_Junio_v2.xlsx',
    version: 2,
    importedAt: '2026-07-13T15:52:00Z',
    importedBy: 'Elena García',
    hash: '171c6fa1…09bc',
    size: 4_998_240,
    status: 'NON_COMPLIANT',
    anomalies: 9,
  },
  {
    id: 'file-uk-3',
    countryId: 'country-uk',
    filename: 'UK_POPS_2026_06.xlsx',
    version: 3,
    importedAt: '2026-07-15T06:48:00Z',
    importedBy: 'Oliver Smith',
    hash: 'e3a2c180…8421',
    size: 5_414_090,
    status: 'ANALYZING',
    progress: 68,
    anomalies: 0,
  },
]

export const demoAnomalies: Anomaly[] = [
  {
    id: 'ano-es-1',
    countryId: 'country-es',
    countryName: 'Espagne',
    fileVersion: 2,
    sheet: 'Financial KPIs',
    table: 'Performance financière',
    category: 'COLUMN_REMOVED',
    severity: 'BLOCKING',
    description: 'La colonne obligatoire « Budget 2026 » est absente du tableau financier.',
    expected: '7 colonnes, incluant « Budget 2026 » en colonne E',
    observed: '6 colonnes ; passage direct de « Réalisé 2025 » à « Réalisé YTD »',
    expectedCoordinates: 'E7:E13',
    observedCoordinates: '—',
    suggestion: 'Réinsérer la colonne « Budget 2026 » à sa position d’origine puis relancer l’analyse.',
    status: 'NEW',
    expectedColumns: [
      { name: 'Catégorie', coordinate: 'B', state: 'UNCHANGED' },
      { name: 'Indicateur', coordinate: 'C', state: 'UNCHANGED' },
      { name: 'Réalisé 2025', coordinate: 'D', state: 'UNCHANGED' },
      { name: 'Budget 2026', coordinate: 'E', state: 'REMOVED' },
      { name: 'Réalisé YTD', coordinate: 'F', state: 'MOVED' },
      { name: 'Atterrissage', coordinate: 'G', state: 'MOVED' },
      { name: 'Écart %', coordinate: 'H', state: 'MOVED' },
    ],
    observedColumns: [
      { name: 'Catégorie', coordinate: 'B', state: 'UNCHANGED' },
      { name: 'Indicateur', coordinate: 'C', state: 'UNCHANGED' },
      { name: 'Réalisé 2025', coordinate: 'D', state: 'UNCHANGED' },
      { name: 'Réalisé YTD', coordinate: 'E', state: 'MOVED' },
      { name: 'Atterrissage', coordinate: 'F', state: 'MOVED' },
      { name: 'Écart %', coordinate: 'G', state: 'MOVED' },
    ],
  },
  {
    id: 'ano-es-2',
    countryId: 'country-es',
    countryName: 'Espagne',
    fileVersion: 2,
    sheet: 'Operational KPIs',
    table: 'Indicateurs opérationnels',
    category: 'TABLE_MOVED',
    severity: 'ERROR',
    description: 'Le tableau a été retrouvé quatre lignes sous sa position de référence.',
    expected: 'Tableau à la plage B6:G11',
    observed: 'Tableau détecté à la plage B10:G15',
    expectedCoordinates: 'B6:G11',
    observedCoordinates: 'B10:G15',
    suggestion: 'Replacer le tableau à son emplacement d’origine ou confirmer ce déplacement pour cette version.',
    status: 'CONFIRMED',
    confidence: 0.93,
  },
  {
    id: 'ano-es-3',
    countryId: 'country-es',
    countryName: 'Espagne',
    fileVersion: 2,
    sheet: 'Workforce',
    table: 'Effectifs',
    category: 'FORMULA_MISSING',
    severity: 'BLOCKING',
    description: 'La formule de total des ETP a été remplacée par une valeur fixe.',
    expected: '=SUM(F7:F10)',
    observed: '260',
    expectedCoordinates: 'F11',
    observedCoordinates: 'F11',
    suggestion: 'Restaurer la formule du template dans la cellule F11.',
    status: 'NEW',
  },
  {
    id: 'ano-de-1',
    countryId: 'country-de',
    countryName: 'Allemagne',
    fileVersion: 3,
    sheet: 'Financial KPIs',
    table: 'Performance financière',
    category: 'HEADER_CHANGED',
    severity: 'WARNING',
    description: 'Un intitulé de colonne a été traduit dans le fichier pays.',
    expected: '« Réalisé YTD »',
    observed: '« Ist YTD »',
    expectedCoordinates: 'F7',
    observedCoordinates: 'F7',
    suggestion: 'Conserver l’intitulé du template pour fiabiliser les prochains rapprochements.',
    status: 'NEW',
  },
  {
    id: 'ano-de-2',
    countryId: 'country-de',
    countryName: 'Allemagne',
    fileVersion: 3,
    sheet: 'Operational KPIs',
    table: 'Indicateurs opérationnels',
    category: 'ROW_ADDED',
    severity: 'INFO',
    description: 'Deux lignes de données ont été ajoutées dans un tableau semi-dynamique.',
    expected: '5 lignes de données',
    observed: '7 lignes de données',
    expectedCoordinates: 'B7:G11',
    observedCoordinates: 'B7:G13',
    suggestion: 'Vérifier les deux nouveaux indicateurs. La structure reste exploitable.',
    status: 'ACCEPTED_EXCEPTION',
  },
  {
    id: 'ano-de-3',
    countryId: 'country-de',
    countryName: 'Allemagne',
    fileVersion: 3,
    sheet: 'Assumptions',
    category: 'MERGED_CELL_CHANGED',
    severity: 'WARNING',
    description: 'La zone fusionnée du titre ne correspond plus au template.',
    expected: 'B2:F2 fusionnée',
    observed: 'B2:G2 fusionnée',
    expectedCoordinates: 'B2:F2',
    observedCoordinates: 'B2:G2',
    suggestion: 'Restaurer la fusion d’origine afin de conserver la signature structurelle.',
    status: 'FALSE_POSITIVE',
  },
  {
    id: 'ano-de-4',
    countryId: 'country-de',
    countryName: 'Allemagne',
    fileVersion: 3,
    sheet: '_Lookups',
    category: 'SHEET_VISIBILITY_CHANGED',
    severity: 'WARNING',
    description: 'Une feuille technique masquée est devenue visible.',
    expected: 'Feuille masquée',
    observed: 'Feuille visible',
    suggestion: 'Masquer à nouveau la feuille technique avant diffusion.',
    status: 'NEW',
  },
]

export const demoConsolidation: ConsolidationResult = {
  id: 'cons-demo',
  status: 'COMPLETED',
  progress: 100,
  filename: 'POPS_Consolidation_2026-07-15.xlsx',
  countryCount: 3,
  copiedSheets: 24,
  skippedSheets: 0,
  warnings: ['2 liens externes ont été conservés mais peuvent nécessiter une mise à jour à l’ouverture.'],
  createdAt: NOW,
  mappings: [
    { country: 'France', originalSheetName: 'Financial KPIs', consolidatedSheetName: 'Financial_KPIs_FR' },
    { country: 'Allemagne', originalSheetName: 'Financial KPIs', consolidatedSheetName: 'Financial_KPIs_DE' },
    {
      country: 'Royaume-Uni',
      originalSheetName: 'Operational Performance Summary',
      consolidatedSheetName: 'Operational_Performanc_UK',
    },
  ],
}

export function cloneDemo<T>(value: T): T {
  return structuredClone(value)
}
