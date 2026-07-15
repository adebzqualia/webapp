# Contrats API

## 1. Conventions générales

### 1.1 Base, formats et noms

- préfixe : `/api` ;
- transport : HTTPS hors poste local ;
- JSON : `application/json; charset=utf-8` ;
- uploads : `multipart/form-data` ;
- téléchargements : MIME OOXML `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` ;
- noms des champs publics : `camelCase` ;
- identifiants : UUID sous forme de chaîne ;
- dates : ISO 8601 UTC, par exemple `2026-07-15T13:45:12Z` ;
- coordonnées Excel : notation A1 sans `$`, par exemple `B7:H24` ;
- valeurs d’enum : majuscules, par exemple `SEMI_DYNAMIC`.

Les exemples omettent certains champs de lecture pour rester lisibles. Les réponses réelles peuvent ajouter des champs, mais ne doivent pas modifier le sens ou le type d’un champ existant sans version d’API.

### 1.2 Authentification MVP — limite connue

En développement/démonstration :

```http
X-Organization-Id: demo
X-User-Id: demo-user
X-API-Key: <valeur configurée, si AUTH_API_KEY est définie>
```

`X-Organization-Id` et `X-User-Id` permettent l’auto-provisionnement du principal. Ils ne constituent pas une authentification forte. `X-API-Key` est un secret partagé optionnel, pas une autorisation utilisateur. Ce mécanisme doit être remplacé par OIDC/SSO avant toute exposition publique.

Le client ne transmet jamais `organizationId` dans les payloads métier. L’organisation est imposée par le principal. Une ressource hors tenant répond `404`.

### 1.3 Réponses de liste

Le MVP retourne des tableaux JSON pour les listes bornées. Les filtres documentés sont facultatifs. Avant une volumétrie importante, les mêmes routes évolueront vers :

```json
{
  "items": [],
  "nextCursor": null,
  "total": 0
}
```

Cette pagination constitue une évolution de contrat et devra être activée sous une version ou un paramètre explicite ; un client MVP ne doit pas supposer qu’une liste non bornée restera disponible.

### 1.4 Erreurs

Les erreurs métier du MVP suivent :

```json
{
  "code": "TABLE_NOT_FOUND",
  "message": "Le tableau demandé est introuvable.",
  "details": {
    "tableId": "0aa4c399-cf17-42e3-b4e5-6cbf531ad2b8"
  }
}
```

`details` est facultatif et ne contient ni trace Python, ni chemin serveur, ni secret. Les erreurs de validation Pydantic peuvent encore utiliser le format FastAPI `422`; leur unification dans la même enveloppe est recommandée avant production. Un `traceId` corrélable sera ajouté sans exposer la stack technique.

| HTTP | Usage |
|---:|---|
| `400` | requête métier incohérente ; |
| `401` | API key manquante ou invalide ; |
| `403` | principal authentifié sans permission, avec RBAC futur ; |
| `404` | ressource absente ou appartenant à une autre organisation ; |
| `409` | conflit d’état, version ou consolidation non éligible ; |
| `413` | fichier au-dessus de la limite ; |
| `415` | extension, signature ou contenu actif non autorisé ; |
| `422` | payload ou classeur corrompu/inexploitable ; |
| `500` | erreur interne masquée ; |
| `503` | dépendance indisponible ou capacité temporairement saturée. |

Codes fichier principaux : `UNSUPPORTED_FORMAT`, `EMPTY_FILE`, `FILE_TOO_LARGE`, `INVALID_FILE_SIGNATURE`, `INVALID_XLSX_PACKAGE`, `FILE_CORRUPTED`, `ENCRYPTED_WORKBOOK_UNSUPPORTED`, `MACROS_NOT_ALLOWED`, `MALICIOUS_ZIP_PATH`, `ZIP_BOMB_DETECTED`.

### 1.5 Jobs : immédiat et asynchrone compatible

Le même objet de job est utilisé dans les deux modes :

```json
{
  "id": "fbab8e16-934b-44a1-815e-0478e3d2f66f",
  "status": "COMPLETED",
  "progress": 100,
  "report": {},
  "errorLog": [],
  "createdAt": "2026-07-15T13:45:12Z",
  "startedAt": "2026-07-15T13:45:12Z",
  "completedAt": "2026-07-15T13:45:14Z"
}
```

États MVP : `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`.

- exécution immédiate MVP : la création retourne généralement `201 Created` avec état terminal ;
- exécution par worker : la création peut retourner `202 Accepted`, `Location: /api/.../{jobId}` et `Retry-After` ;
- le frontend poll tant que l’état n’est pas terminal ;
- une réponse `202` confirme l’acceptation, pas le succès du traitement.

## 2. Schémas partagés

### 2.1 Table et colonnes

Entrée de colonne :

```json
{
  "excelColumn": "B",
  "name": "Business Unit",
  "dataType": "string",
  "role": "KEY",
  "ordinal": 0,
  "required": true
}
```

Entrée de table :

```json
{
  "sheetId": "acb57273-bbb5-4ae3-aa76-305f53bd1a52",
  "name": "Revenue Budget",
  "rangeRef": "B7:H24",
  "headerRows": [7, 8],
  "dataStartRow": 9,
  "dataEndRow": 22,
  "dataEndRule": null,
  "keyColumns": ["B", "C"],
  "valueColumns": ["D", "E", "F", "G", "H"],
  "totalRows": [23, 24],
  "computedColumns": ["H"],
  "structureMode": "STRICT",
  "required": true,
  "variableRows": [],
  "variableColumns": [],
  "ignoredRows": [],
  "ignoredColumns": [],
  "requiredCells": [{"coordinate": "B7", "value": "Revenue"}],
  "requiredFormulas": [{"coordinate": "H23", "formula": "=SUM(H9:H22)"}],
  "tolerateBlankRowsColumns": false,
  "orientation": "ROWS",
  "columns": []
}
```

Règles : `rangeRef` est rectangulaire ; `headerRows` n’est pas vide ; une fin fixe ou une règle est obligatoire ; les en-têtes précèdent les données ; les colonnes sont des lettres Excel de 1 à 3 caractères.

### 2.2 Anomalie

```json
{
  "id": "a2f0e39b-2ce9-4b97-8651-14337129f788",
  "analysisJobId": "fbab8e16-934b-44a1-815e-0478e3d2f66f",
  "countryId": "8a274b30-8c44-48f8-a799-eab0a2737947",
  "fileVersionId": "db224669-e72f-44f4-8c45-a40497db18fc",
  "sheetName": "Financial KPIs",
  "tableDefinitionId": "0aa4c399-cf17-42e3-b4e5-6cbf531ad2b8",
  "tableName": "Revenue Budget",
  "category": "TABLE_MOVED",
  "severity": "WARNING",
  "description": "Le tableau a été retrouvé à une autre position.",
  "expected": {"range": "B7:H24"},
  "actual": {"range": "B9:H26"},
  "expectedCoordinates": "B7:H24",
  "actualCoordinates": "B9:H26",
  "suggestion": "Vérifier le déplacement puis confirmer l’anomalie.",
  "status": "NEW",
  "confidence": 0.93,
  "matchReasons": ["en-têtes identiques", "7 colonnes", "proximité géométrique"],
  "candidates": [],
  "expectedPreview": {},
  "actualPreview": {},
  "createdAt": "2026-07-15T13:45:14Z",
  "updatedAt": "2026-07-15T13:45:14Z"
}
```

## 3. Templates et cartographie

### 3.1 Importer un template

`POST /api/templates`

Multipart :

| Partie | Type | Obligatoire | Description |
|---|---|---:|---|
| `name` | texte | oui | nom fonctionnel du template ; |
| `file` | binaire `.xlsx` | oui | source de référence. |

Réponse immédiate `201` :

```json
{
  "id": "851cb197-33ad-4f6e-ae03-d7e4c6178297",
  "name": "POPS 2026",
  "latestVersion": 1,
  "createdAt": "2026-07-15T13:40:00Z",
  "updatedAt": "2026-07-15T13:40:00Z",
  "versions": [{
    "id": "8ee17843-a615-42de-a7f4-93a6edfc99bf",
    "version": 1,
    "mappingVersion": 1,
    "originalFilename": "POPS_template.xlsx",
    "sha256": "8f98...64-hex-characters...b712",
    "sizeBytes": 842121,
    "sheetCount": 8,
    "status": "IMPORTED",
    "workbookMetadata": {},
    "importedAt": "2026-07-15T13:40:00Z",
    "sheets": []
  }]
}
```

Erreurs : `409` nom déjà utilisé si la route ne crée pas une nouvelle version ; `413`; `415`; `422` fichier illisible.

### 3.2 Lister et consulter

| Méthode et route | Réponse `200` | Erreurs |
|---|---|---|
| `GET /api/templates` | `TemplateSummary[]` | `401` |
| `GET /api/templates/{templateId}` | template, versions et définitions | `404` |
| `GET /api/templates/{templateId}/sheets` | feuilles de la dernière version, ordre d’origine | `404` |

Résumé :

```json
{
  "id": "851cb197-33ad-4f6e-ae03-d7e4c6178297",
  "name": "POPS 2026",
  "latestVersion": 1,
  "createdAt": "2026-07-15T13:40:00Z",
  "updatedAt": "2026-07-15T13:40:00Z"
}
```

### 3.3 Fenêtre de grille — route support UI

`GET /api/templates/{templateId}/sheets/{sheetId}/grid?rangeRef=A1:Z50`

Réponse `200` :

```json
{
  "sheetId": "acb57273-bbb5-4ae3-aa76-305f53bd1a52",
  "sheetName": "Financial KPIs",
  "rangeRef": "A1:Z50",
  "minRow": 1,
  "maxRow": 50,
  "minColumn": 1,
  "maxColumn": 26,
  "cells": [{
    "coordinate": "B7",
    "row": 7,
    "column": 2,
    "value": "Revenue",
    "formula": null,
    "dataType": "s",
    "numberFormat": "General",
    "style": {"bold": true},
    "mergedRange": null
  }],
  "mergedRanges": ["B2:H2"]
}
```

La plage est bornée par `MAX_GRID_CELLS` (5 000 par défaut). Dépassement : `400 GRID_WINDOW_TOO_LARGE`.

### 3.4 Progression — route support UI

`GET /api/templates/{templateId}/mapping/progress`

```json
{
  "detectedSheets": 8,
  "configuredSheets": 5,
  "remainingSheets": 3,
  "validatedTables": 12,
  "percent": 63
}
```

### 3.5 Détecter les candidats

`POST /api/templates/{templateId}/tables/detect`

```json
{
  "sheetId": "acb57273-bbb5-4ae3-aa76-305f53bd1a52",
  "minimumConfidence": 0.35
}
```

Réponse `200` :

```json
[
  {
    "id": "candidate:acb57273:B7:H24",
    "sheetId": "acb57273-bbb5-4ae3-aa76-305f53bd1a52",
    "sheetName": "Financial KPIs",
    "rangeRef": "B7:H24",
    "confidence": 0.91,
    "reasons": ["zone dense", "en-tête en gras", "bordures cohérentes"],
    "source": "HEURISTIC",
    "preview": {
      "headers": ["Business Unit", "Budget"],
      "rows": [["North", 1200]]
    }
  }
]
```

Cette route ne valide ni ne persiste automatiquement une table.

### 3.6 Prévisualiser une plage — route support UI

`POST /api/templates/{templateId}/tables/preview`

```json
{
  "sheetId": "acb57273-bbb5-4ae3-aa76-305f53bd1a52",
  "rangeRef": "B7:H24",
  "headerRows": [7, 8],
  "dataStartRow": 9,
  "dataEndRow": 22,
  "keyColumns": ["B", "C"]
}
```

Réponse `200` :

```json
{
  "sheetName": "Financial KPIs",
  "rangeRef": "B7:H24",
  "headers": ["Business Unit", "Label", "Jan", "Feb", "Mar", "Q1", "Total"],
  "estimatedTypes": ["string", "string", "number", "number", "number", "number", "formula"],
  "rows": [{"Business Unit": "North", "Jan": 100}],
  "coordinates": [["B9", "C9", "D9"]],
  "formulaCells": [{"coordinate": "H9", "formula": "=SUM(D9:G9)"}],
  "emptyCells": [],
  "duplicateKeys": [],
  "detectedTotalRows": [23, 24]
}
```

### 3.7 Créer, modifier et valider une table

| Méthode et route | Corps | Succès | Erreurs principales |
|---|---|---:|---|
| `POST /api/templates/{templateId}/tables` | `TableDefinitionCreate` | `201` + table | `404`, `409`, `422` |
| `PUT /api/templates/{templateId}/tables/{tableId}` | champs de table modifiables | `200` + table | `404`, `409`, `422` |
| `POST /api/templates/{templateId}/tables/{tableId}/validate` | aucun | `200` + table `VALIDATED` | `404`, `409 TABLE_INCOMPLETE` |

Chaque mutation incrémente `TemplateVersion.mapping_version`. La cible de production exigera un prérequis optimiste (`expectedMappingVersion` ou `If-Match`) et retournera `409 MAPPING_VERSION_CONFLICT`; cette protection n’est pas garantie par le modèle MVP seul.

### 3.8 Ignorer une feuille — route support UI

`PATCH /api/templates/{templateId}/sheets/{sheetId}`

```json
{"ignored": true}
```

Réponse `200` : feuille mise à jour. Une feuille ignorée ne peut pas conserver de tables `VALIDATED` sans confirmation explicite ; le service doit refuser une transition incohérente avec `409`.

### 3.9 Exporter la cartographie — route support UI

`GET /api/templates/{templateId}/mapping`

Réponse `200` :

```json
{
  "templateId": "851cb197-33ad-4f6e-ae03-d7e4c6178297",
  "templateVersion": 1,
  "mappingVersion": 7,
  "workbookHash": "8f98...b712",
  "sheets": []
}
```

**Limite MVP :** cet export est l’état courant. Une ancienne valeur de `mappingVersion` n’est pas récupérable tant que `MappingRevision`/snapshot immuable n’est pas implémenté.

## 4. Pays et fichiers

### 4.1 Créer et lister les pays

`POST /api/countries`

```json
{
  "name": "France",
  "code": "FR",
  "templateId": "851cb197-33ad-4f6e-ae03-d7e4c6178297"
}
```

Réponse `201` :

```json
{
  "id": "8a274b30-8c44-48f8-a799-eab0a2737947",
  "name": "France",
  "code": "FR",
  "templateId": "851cb197-33ad-4f6e-ae03-d7e4c6178297",
  "status": "NO_FILE",
  "createdAt": "2026-07-15T14:00:00Z",
  "updatedAt": "2026-07-15T14:00:00Z"
}
```

`GET /api/countries?status=NON_COMPLIANT&templateId={uuid}` retourne `200 Country[]`.

Erreurs : `404 TEMPLATE_NOT_FOUND`; `409 COUNTRY_NAME_ALREADY_EXISTS`; `422` validation.

### 4.2 Importer une version pays

`POST /api/countries/{countryId}/files`

Multipart : `file` obligatoire, `.xlsx`.

Réponse immédiate `201` :

```json
{
  "id": "db224669-e72f-44f4-8c45-a40497db18fc",
  "countryFileId": "f5a66fa3-9500-443e-a3cc-75041e2acfd6",
  "version": 3,
  "originalFilename": "POPS_FRANCE.xlsx",
  "sha256": "21ab...64-hex-characters...8c10",
  "sizeBytes": 915222,
  "status": "COMPLIANT_WITH_WARNINGS",
  "workbookMetadata": {},
  "importedAt": "2026-07-15T14:10:00Z"
}
```

L’import crée toujours une version immuable et, lorsque `ANALYSIS_AUTO_RUN=true`, crée/lance son analyse. Le client récupère le job via les routes suivantes. En mode queue, l’API peut retourner `202` avec la même version et l’URL du job dans `Location`.

### 4.3 Convention `{fileId}`

Dans les routes historiques imposées par le cahier des charges, `{fileId}` désigne **`CountryFileVersion.id`**, c’est-à-dire le binaire précis à analyser. L’agrégat `CountryFile.id` est exposé comme `countryFileId`. Une évolution pourra ajouter l’alias plus explicite `/api/country-file-versions/{versionId}` sans changer ce comportement.

### 4.4 Lancer ou relancer l’analyse

`POST /api/country-files/{fileId}/analyze`

Corps facultatif :

```json
{"force": false}
```

- `201` : nouveau job créé et terminé immédiatement ;
- `202` : job créé/en file, avec `Location` ;
- `409 ANALYSIS_ALREADY_RUNNING` : job actif pour cette version ;
- `409 MAPPING_INCOMPLETE` : cartographie non exploitable ;
- `404` : version ou template absent.

La relance crée un nouveau `AnalysisJob`; elle ne réécrit pas le rapport précédent.

### 4.5 Consulter l’analyse

`GET /api/country-files/{fileId}/analysis`

Retourne le dernier job de cette version avec anomalies et extractions :

```json
{
  "job": {
    "id": "fbab8e16-934b-44a1-815e-0478e3d2f66f",
    "fileVersionId": "db224669-e72f-44f4-8c45-a40497db18fc",
    "status": "COMPLETED",
    "progress": 100,
    "report": {
      "templateVersionId": "8ee17843-a615-42de-a7f4-93a6edfc99bf",
      "mappingVersion": 7,
      "workbookHash": "8f98...b712"
    },
    "errorLog": [],
    "createdAt": "2026-07-15T14:10:00Z",
    "startedAt": "2026-07-15T14:10:00Z",
    "completedAt": "2026-07-15T14:10:03Z"
  },
  "anomalies": [],
  "extractedTables": []
}
```

`404 ANALYSIS_NOT_FOUND` si aucune analyse n’existe. La cible asynchrone peut aussi proposer `GET /api/analysis-jobs/{jobId}` ; le polling par version reste supporté.

### 4.6 Lister les anomalies d’une version

`GET /api/country-files/{fileId}/anomalies`

Filtres facultatifs : `sheet`, `tableId`, `category`, `severity`, `status`.

Réponse `200` : `Anomaly[]`, tri recommandé par sévérité décroissante puis feuille/table/coordonnée.

## 5. Anomalies

### 5.1 Dashboard

Route support UI : `GET /api/anomalies/dashboard?templateId={uuid}`

```json
{
  "countries": 12,
  "compliantCountries": 7,
  "warningCountries": 3,
  "nonCompliantCountries": 2,
  "totalAnomalies": 41,
  "blockingAnomalies": 2,
  "bySeverity": {"BLOCKING": 2, "ERROR": 5, "WARNING": 29, "INFO": 5},
  "byStatus": {"NEW": 30, "CONFIRMED": 6, "ACCEPTED_EXCEPTION": 5}
}
```

### 5.2 Qualifier une anomalie

`PATCH /api/anomalies/{anomalyId}`

```json
{
  "status": "ACCEPTED_EXCEPTION",
  "comment": "Décalage validé pour la clôture de juillet."
}
```

Réponse `200` : anomalie mise à jour. Le service ajoute simultanément une `AnomalyDecision` et un `AuditLog`.

Erreurs : `404`; `409 INVALID_ANOMALY_TRANSITION`; `422` statut/commentaire invalide. Pour `FALSE_POSITIVE` et `ACCEPTED_EXCEPTION`, un commentaire peut être rendu obligatoire par politique.

## 6. Consolidations

### 6.1 Lancer une consolidation

`POST /api/consolidations`

```json
{
  "countryIds": [
    "8a274b30-8c44-48f8-a799-eab0a2737947",
    "2d32f13f-3097-422f-a2b8-a62593f0ee6b"
  ],
  "latestVersionsOnly": true,
  "onlyCompliant": false,
  "includeWarnings": true,
  "includeAcceptedBlocking": false
}
```

Sémantique :

- `countryIds=[]` sélectionne tous les pays du tenant ;
- `latestVersionsOnly=true` résout la dernière version au lancement ;
- `onlyCompliant=true` exclut tout statut autre que `COMPLIANT` ;
- `includeWarnings=true` autorise `COMPLIANT_WITH_WARNINGS` selon les décisions ;
- `includeAcceptedBlocking=false` exclut par défaut toute version avec anomalie bloquante, même acceptée ;
- les sources réellement retenues sont figées dans `requestOptions` et `report`.

Réponse `201` immédiate ou `202` en file :

```json
{
  "id": "23f6f90e-97b7-4d78-9971-969e85777db7",
  "status": "COMPLETED",
  "progress": 100,
  "requestOptions": {
    "latestVersionsOnly": true,
    "resolvedFileVersionIds": ["db224669-e72f-44f4-8c45-a40497db18fc"]
  },
  "report": {
    "includedCountries": ["France"],
    "excludedSources": [],
    "copiedSheets": 8,
    "ignoredSheets": 0,
    "sheetNameMappings": [{
      "country": "FRANCE",
      "originalSheetName": "Operational Performance Summary",
      "consolidatedSheetName": "Operational_Performanc_FR"
    }],
    "warnings": [],
    "copyErrors": []
  },
  "errorMessage": null,
  "createdAt": "2026-07-15T15:00:00Z",
  "startedAt": "2026-07-15T15:00:00Z",
  "completedAt": "2026-07-15T15:00:08Z",
  "workbook": {
    "id": "03cc8ba3-258f-4140-8ce0-73ff9e110387",
    "filename": "POPS_consolidated_20260715.xlsx",
    "sha256": "09ae...64-hex-characters...f1d4",
    "sizeBytes": 1835241,
    "createdAt": "2026-07-15T15:00:08Z"
  }
}
```

Erreurs : `400 EMPTY_SELECTION`; `404 COUNTRY_NOT_FOUND`; `409 NO_ELIGIBLE_SOURCE`; `409 BLOCKING_ANOMALIES`; `422 SOURCE_UNREADABLE`.

### 6.2 Suivre un job

`GET /api/consolidations/{jobId}`

Réponse `200` : même objet `ConsolidationJob`. `404` si absent/hors tenant.

### 6.3 Télécharger

`GET /api/consolidations/{jobId}/download`

Succès `200` : flux binaire avec :

```http
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="POPS_consolidated_20260715.xlsx"
ETag: "<sha256>"
X-Content-Type-Options: nosniff
```

Erreurs : `404`; `409 CONSOLIDATION_NOT_COMPLETED`; `410 ARTIFACT_EXPIRED`; `500 ARTIFACT_INTEGRITY_ERROR`. Chaque téléchargement réussi écrit `CONSOLIDATION_DOWNLOADED` dans l’audit.

## 7. Santé

`GET /api/health`

```json
{
  "status": "ok",
  "version": "0.1.0",
  "database": "ok"
}
```

Cette route ne divulgue ni URL de base, ni chemins, ni secrets. Une cible orchestrée séparera `/live` et `/ready`.

## 8. Idempotence et concurrence

### 8.1 MVP

- les fichiers sont identifiés par SHA-256 mais un réimport intentionnel peut créer une version ;
- les transitions terminées ne sont pas réécrites ;
- une relance d’analyse crée un nouveau job ;
- une mutation de table incrémente `mappingVersion`.

### 8.2 Cible de production

- accepter `Idempotency-Key` sur imports et créations de jobs, avec portée organisation/utilisateur/route et expiration ;
- exiger `If-Match` ou `expectedMappingVersion` sur les mutations de cartographie ;
- retourner `409` pour une clé réutilisée avec un payload différent ;
- garantir qu’un retry réseau retourne la création initiale au lieu de dupliquer un job.

## 9. Matrice synthétique des endpoints

| Méthode | Route | Succès MVP | Objet principal |
|---|---|---:|---|
| POST | `/api/templates` | 201 | `Template` |
| GET | `/api/templates` | 200 | `TemplateSummary[]` |
| GET | `/api/templates/{templateId}` | 200 | `Template` |
| GET | `/api/templates/{templateId}/sheets` | 200 | `Sheet[]` |
| GET | `/api/templates/{templateId}/sheets/{sheetId}/grid` | 200 | `SheetGrid` |
| GET | `/api/templates/{templateId}/mapping/progress` | 200 | `MappingProgress` |
| GET | `/api/templates/{templateId}/mapping` | 200 | `MappingExport` |
| POST | `/api/templates/{templateId}/tables/detect` | 200 | `TableCandidate[]` |
| POST | `/api/templates/{templateId}/tables/preview` | 200 | `StructuredPreview` |
| POST | `/api/templates/{templateId}/tables` | 201 | `TableDefinition` |
| PUT | `/api/templates/{templateId}/tables/{tableId}` | 200 | `TableDefinition` |
| POST | `/api/templates/{templateId}/tables/{tableId}/validate` | 200 | `TableDefinition` |
| PATCH | `/api/templates/{templateId}/sheets/{sheetId}` | 200 | `SheetDefinition` |
| POST | `/api/countries` | 201 | `Country` |
| GET | `/api/countries` | 200 | `Country[]` |
| POST | `/api/countries/{countryId}/files` | 201/202 | `CountryFileVersion` |
| POST | `/api/country-files/{fileId}/analyze` | 201/202 | `AnalysisJob` |
| GET | `/api/country-files/{fileId}/analysis` | 200 | `AnalysisDetail` |
| GET | `/api/country-files/{fileId}/anomalies` | 200 | `Anomaly[]` |
| GET | `/api/anomalies/dashboard` | 200 | `AnomalyDashboard` |
| PATCH | `/api/anomalies/{anomalyId}` | 200 | `Anomaly` |
| POST | `/api/consolidations` | 201/202 | `ConsolidationJob` |
| GET | `/api/consolidations/{jobId}` | 200 | `ConsolidationJob` |
| GET | `/api/consolidations/{jobId}/download` | 200 | flux `.xlsx` |

## 10. Garanties et limites du contrat MVP

Garanties : tenant dérivé du principal, IDs UUID, noms JSON camelCase, sources immuables, erreurs métier sans stack trace, jobs observables, téléchargement contrôlé.

Limites à ne pas masquer :

- identité par en-têtes/API key, non adaptée à la production ;
- listes non paginées ;
- erreurs de validation FastAPI pas encore uniformisées ;
- compteur `mappingVersion` sans récupération d’un snapshot historique ;
- jobs immédiats et sans reprise après panne ;
- version exacte de cartographie pas encore protégée par FK immuable dans `AnalysisJob` ;
- options/sources de consolidation stockées en JSON plutôt que dans une table de jointure.
