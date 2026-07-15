# Hypothèses fonctionnelles et décisions de cadrage

## 1. Objet du document

Ce document transforme le cahier des charges POPS en hypothèses vérifiables. Il sert de référence aux choix d’architecture, au modèle de données, aux contrats API et aux tests d’acceptation.

Les marqueurs suivants sont utilisés dans toute la documentation :

- **MVP** : nécessaire pour satisfaire les 20 critères d’acceptation du lot ;
- **Évolution** : prévu par les interfaces et le modèle, mais non requis pour accepter le MVP ;
- **Hors périmètre** : non développé dans ce lot.

En cas d’ambiguïté, le principe conservateur s’applique : aucune structure ambiguë n’est considérée comme conforme et aucune donnée n’est extraite silencieusement.

## 2. Hypothèses structurantes

| ID | Hypothèse ou décision | Portée | Conséquence vérifiable |
|---|---|---|---|
| H-01 | Le MVP accepte uniquement les classeurs OOXML `.xlsx` non chiffrés. Les extensions `.xls`, `.xlsb`, `.xlsm` et les fichiers protégés par mot de passe sont refusés. | MVP | L’API retourne `UNSUPPORTED_FORMAT` ou `ENCRYPTED_WORKBOOK` avant toute inspection. |
| H-02 | L’extension déclarée ne suffit pas : le fichier doit être un conteneur ZIP OOXML valide contenant au minimum `[Content_Types].xml` et `xl/workbook.xml`. | MVP | Un fichier renommé en `.xlsx` est refusé. |
| H-03 | Les macros, formules et liens externes ne sont jamais exécutés par la plateforme. Les formules sont lues et comparées comme du texte. | MVP | Aucun moteur Excel/LibreOffice n’est lancé côté serveur ; aucun lien externe n’est résolu. |
| H-04 | Un `Template` est un agrégat métier durable. Chaque nouveau binaire de référence crée une `TemplateVersion` immuable, identifiée par SHA-256. | MVP | Une analyse historique conserve exactement la version binaire utilisée. |
| H-05 | Dans le MVP livré, la cartographie appartient à `TemplateVersion` et `mapping_version` est incrémenté à chaque changement significatif. Il n’existe pas encore d’entité `MappingRevision` immuable. | MVP limité | L’export expose le numéro de cartographie ; l’historique complet des définitions est une évolution nécessaire à la reproductibilité forte. |
| H-06 | Un pays est associé à un template logique. L’analyse utilise une `TemplateVersion` et la valeur courante de `mapping_version`; le rapport doit exposer ces références. | MVP limité | Le numéro rend l’entrée identifiable, mais une cartographie ancienne n’est pas reconstructible tant qu’un snapshot immuable n’est pas ajouté. |
| H-07 | Une feuille est configurée uniquement si tous ses tableaux sont validés ou si elle est explicitement marquée comme ignorée. | MVP | Une cartographie incomplète n’atteint pas 100 % et son export signale son incomplétude. |
| H-08 | La détection de tableaux ne produit que des candidats. Un candidat n’est jamais validé automatiquement, quel que soit son score. | MVP | L’état initial d’un candidat est `PROPOSED`; une action utilisateur est requise. |
| H-09 | Les coordonnées Excel utilisent la notation A1, avec lignes et colonnes indexées à partir de 1. Les plages sont inclusives. | MVP | Les API exposent par exemple `B7:H24`; les coordonnées source sont conservées. |
| H-10 | Les comparaisons textuelles d’en-têtes appliquent une normalisation explicite (espaces en bordure, espaces multiples, Unicode NFC, casse optionnelle), tout en conservant la valeur originale. | MVP | Le rapport contient toujours `expectedRaw`, `actualRaw` et la règle de normalisation. |
| H-11 | En mode `STRICT`, lignes, colonnes, libellés, ordre et positions doivent être identiques, hors zones explicitement ignorées. | MVP | Toute divergence produit une anomalie selon la taxonomie documentée. |
| H-12 | En mode `SEMI_DYNAMIC`, seules les zones déclarées variables peuvent changer ; colonnes, en-têtes, clés, lignes structurelles et formules obligatoires restent contrôlées. | MVP | Une ligne ajoutée dans une zone variable peut être acceptée, mais pas une colonne clé supprimée. |
| H-13 | Une correspondance de feuille ou de tableau fondée sur la similarité reste une hypothèse. Sous le seuil de confiance, ou si deux candidats sont proches, l’extraction est bloquée. | MVP | Une anomalie `AMBIGUOUS_TABLE_MATCH` est créée avec la liste des candidats. |
| H-14 | Les fichiers importés sont immuables et ne sont jamais modifiés en place. Toute nouvelle soumission crée une `CountryFileVersion`. | MVP | Le SHA-256 et la taille du fichier historique ne changent jamais. |
| H-15 | Le fichier « actuellement importé » d’un pays désigne sa dernière version reçue, pas nécessairement sa dernière version conforme. | MVP | Les deux informations (`latestVersion`, `latestConformantVersion`) sont distinguées. |
| H-16 | Une consolidation est toujours déclenchée explicitement. Par défaut, toute version avec anomalie bloquante non résolue est exclue. | MVP | L’API refuse ou exclut la source selon la stratégie demandée et l’indique dans le rapport. |
| H-17 | Une anomalie acceptée exceptionnellement ne disparaît pas : une décision immuable est ajoutée et l’anomalie conserve son historique. | MVP | L’audit distingue détection, confirmation, faux positif, exception et correction. |
| H-18 | La copie de feuilles avec `openpyxl` est une reconstruction « au mieux », pas une reproduction binaire fidèle. Les pertes connues sont détectées et rapportées. | MVP | Le rapport de consolidation liste avertissements et éléments non copiés. |
| H-19 | Tous les noms de feuilles consolidées sont calculés avant la copie afin de garantir longueur, validité et unicité de manière déterministe. | MVP | À entrées identiques, la table de correspondance des noms est identique. |
| H-20 | Le stockage des fichiers est abstrait. Le MVP utilise le disque local ; l’identité d’un objet ne dépend jamais d’un chemin fourni par l’utilisateur. | MVP | Les services dépendent d’un `ObjectStorage`, pas de `open()` sur un nom client. |
| H-21 | Les métadonnées utilisent SQLite en développement local et PostgreSQL dans l’environnement Docker cible. Les migrations Alembic constituent la source de vérité. | MVP | Le même schéma logique et la même suite de tests s’exécutent sur les deux moteurs. |
| H-22 | L’isolation multi-organisation est obligatoire, même en MVP. L’organisation provient de l’identité authentifiée et jamais d’un identifiant librement fourni dans le payload. | MVP | Toutes les lectures et écritures sont filtrées par `organization_id`; les chemins de stockage le contiennent. |
| H-23 | L’authentification du MVP est un mécanisme de démonstration/développement : `X-Organization-Id`, `X-User-Id` et, si configuré, `X-API-Key`. Les identités inconnues sont auto-provisionnées. | MVP limité | Ces en-têtes ne constituent pas une preuve d’identité ; le déploiement de production doit les remplacer par OIDC/SSO avant exposition. |
| H-24 | Les traitements sont modélisés comme des jobs persistés. Le MVP peut les exécuter immédiatement dans le processus API et répondre `201`; le contrat accepte aussi `202` et le polling pour un worker asynchrone futur. | MVP + évolution | Le frontend ne suppose jamais qu’un résultat est immédiatement disponible. |
| H-25 | Les dates sont stockées en UTC et exposées en ISO 8601 avec suffixe `Z`. Les identifiants publics sont des UUID. | MVP | Aucun contrat ne dépend du fuseau du serveur ou d’un identifiant séquentiel. |

## 3. Règles métier retenues

### 3.1 Cycle de vie du template et de la cartographie

1. L’import crée le template logique et sa première version binaire.
2. L’inspection enregistre les feuilles dans leur ordre d’origine, leur visibilité, leurs dimensions déclarées et constatées, les fusions, formules, tables natives et plages nommées.
3. `TemplateVersion.mapping_version` est initialisé ; les définitions de feuilles et tables portent l’état de configuration courant.
4. L’utilisateur accepte, modifie ou rejette les candidats, ou définit ses propres plages.
5. Chaque feuille passe à `CONFIGURED` lorsque tous ses tableaux sont validés, ou à `IGNORED` par une décision explicite.
6. La cartographie complète est exportable uniquement lorsque toutes les feuilles sont traitées.
7. Toute mutation incrémente `mapping_version`. Le MVP ne conserve pas encore chaque état antérieur des définitions.

Le numéro de version binaire (`TemplateVersion.version`) et le compteur de cartographie (`TemplateVersion.mapping_version`) sont indépendants. **Limite MVP :** le compteur prouve qu’un changement a eu lieu, mais ne remplace pas un snapshot. La cible de production ajoute une entité `MappingRevision` ou un snapshot JSON immuable référencé par chaque analyse.

### 3.2 Calcul de progression

La progression affichée est dérivée, jamais saisie :

- `detectedSheets` : nombre de feuilles inspectées ;
- `configuredSheets` : feuilles `CONFIGURED` ou `IGNORED` ;
- `remainingSheets` : différence entre les deux ;
- `validatedTables` : tables à l’état `VALIDATED` ;
- `percent` : `configuredSheets / detectedSheets × 100`, égal à 0 si aucune feuille n’est exploitable.

### 3.3 Validité structurelle et statut global

Les sévérités sont ordonnées ainsi : `INFO < WARNING < ERROR < BLOCKING`.

- `NO_FILE` : aucun import ;
- `IMPORTED` : fichier stocké, analyse pas encore commencée ;
- `ANALYZING` : analyse en cours ;
- `COMPLIANT` : aucune anomalie active de niveau warning ou supérieur ;
- `COMPLIANT_WITH_WARNINGS` : uniquement des avertissements, ou des erreurs explicitement acceptées selon la politique ;
- `NON_COMPLIANT` : au moins une erreur ou anomalie bloquante active ;
- `READ_ERROR` : inspection impossible.

Une décision utilisateur ne modifie pas la détection originale. Le statut global est recalculé à partir des anomalies et de leur dernière décision.

### 3.4 Rapprochement prudent

Le moteur calcule des scores explicables à partir de signaux pondérés : position, dimensions, en-têtes, clés de lignes, formules caractéristiques, styles et proximité. Les poids et seuils sont versionnés dans `engineVersion` et dans la configuration du job.

Valeurs par défaut du MVP, configurables :

- score `>= 0,85` et écart avec le second candidat `>= 0,10` : proposition forte, toujours signalée si la position a changé ;
- score entre `0,65` et `0,85` : rapprochement à confirmer ;
- score `< 0,65` ou écart insuffisant entre les deux premiers : ambigu, aucune extraction.

Ces seuils sont des paramètres techniques, pas des vérités métier. Ils doivent être validés sur les classeurs de démonstration et ajustés sans modifier les rapports historiques.

### 3.5 Extraction structurée

L’extraction conserve les valeurs brutes, les formules textuelles, le type estimé et les coordonnées d’origine. Elle n’effectue aucun calcul de KPI ni correction de valeur. Pour limiter la volumétrie, le résultat complet peut être stocké comme artefact JSON dans le stockage d’objets ; la base conserve ses métadonnées, son hash et les avertissements.

### 3.6 Consolidation

La consolidation opère sur des versions précises de fichiers pays. La sélection « dernières versions » est résolue en liste d’UUID au moment du lancement, puis figée dans le job.

Pour chaque pays :

1. tous les noms cibles sont normalisés et réservés ;
2. les feuilles sont copiées dans l’ordre source ;
3. les références internes simples entre feuilles sont réécrites uniquement lorsqu’elles peuvent l’être sans ambiguïté ;
4. les références non réécrites, externes ou complexes sont conservées telles quelles et signalées ;
5. un classeur distinct est écrit, fermé, rouvert pour un contrôle de lisibilité, haché, puis publié au téléchargement.

Le fichier consolidé n’est pas une source de vérité métier : le rapport et la table de correspondance des noms font partie intégrante du résultat.

## 4. Périmètre du MVP

Le MVP comprend :

- import sécurisé de `.xlsx`, inspection et empreinte SHA-256 ;
- navigation par feuille et lecture paginée de cellules pour une grille web ;
- plusieurs tableaux par feuille et feuille explicitement ignorée ;
- détection semi-automatique explicable, sélection et correction manuelle ;
- modes `STRICT` et `SEMI_DYNAMIC` ;
- prévisualisation structurée, validation et export de la cartographie avec `mapping_version` ;
- création de pays, imports versionnés et analyse structurelle ;
- taxonomie complète des anomalies du cahier des charges ;
- dashboard, filtres, comparaison attendu/constaté et décisions historisées ;
- extraction seulement lorsque la correspondance est suffisamment fiable ;
- consolidation explicite, noms de feuilles sûrs, rapport et téléchargement ;
- stockage local abstrait, SQLite local, PostgreSQL sous Docker ;
- principal de démonstration par en-têtes/API key, isolation multi-organisation, audit et protections d’upload ;
- tests unitaires et d’intégration avec classeurs générés automatiquement.

## 5. Évolutions prévues mais non requises pour le MVP

- historique immuable des révisions de cartographie et référence figée depuis chaque analyse ;
- worker distribué avec broker, reprise après panne, annulation et progression fine ;
- stockage compatible S3, chiffrement géré par KMS et antivirus ;
- OIDC/SSO, RBAC fin, invitations et administration des organisations ;
- PostgreSQL Row-Level Security en défense supplémentaire ;
- prise en charge contrôlée de `.xlsm`, `.xls` ou `.xlsb` avec un moteur dédié ;
- moteur Excel alternatif pour une meilleure fidélité des dessins, graphiques, objets et calculs ;
- complément Excel pour envoyer une sélection de plage ;
- règles métier sur les valeurs, calcul des KPIs, insights et dashboards analytiques ;
- export vers un data warehouse ;
- correction assistée ou automatique des classeurs pays ;
- notifications, webhooks et événements métier ;
- comparaison sémantique avancée de formules et détection entraînée sur un corpus POPS.

## 6. Hors périmètre explicite

- évaluation serveur des formules Excel ;
- exécution de VBA, ActiveX ou connexions externes ;
- édition du fichier pays original ;
- garantie de rendu identique à Microsoft Excel ;
- collaboration temps réel sur une cartographie ;
- calcul des KPIs globaux et validation métier des valeurs ;
- support mobile complet de la grille de cartographie.

## 7. Questions à confirmer avant une mise en production

Ces questions ne bloquent pas le développement du MVP, mais doivent être résolues avant un déploiement réel :

1. Quel fournisseur d’identité et quels rôles (`ADMIN`, `MAPPER`, `REVIEWER`, `VIEWER`) seront utilisés ?
2. Quelles limites de taille, durée de conservation et quotas s’appliquent par organisation ?
3. Quelles anomalies de niveau `ERROR` peuvent être acceptées pour une consolidation ?
4. Les fichiers contiennent-ils des données personnelles ou financières imposant chiffrement, résidence géographique ou durée de rétention particulière ?
5. Quels objets Excel non copiés sont fréquents dans les vrais POPS et doivent devenir bloquants ?
6. La réécriture des références inter-feuilles doit-elle couvrir les noms définis, formules structurées et liens externes ?
7. Le pays est-il unique par nom, par code interne, par code ISO, ou par combinaison template/organisation ?

## 8. Traçabilité

Les décisions de ce document sont mises en œuvre dans :

- `ARCHITECTURE.md` pour les composants, flux, sécurité et limites ;
- `DATA_MODEL.md` pour l’immuabilité, le multi-tenant et les états ;
- `API.md` pour les contrats synchrones et asynchrones compatibles ;
- `IMPLEMENTATION_PLAN.md` pour les phases, tests et preuves des 20 critères d’acceptation.
