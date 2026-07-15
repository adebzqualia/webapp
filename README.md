# POPS Control Center

Plateforme web de cartographie, contrôle structurel et consolidation de classeurs POPS `.xlsx`. Le projet livre un parcours vertical complet : importer un template, définir plusieurs tableaux par feuille, analyser des fichiers pays, qualifier les anomalies puis produire un classeur consolidé téléchargeable.

## Architecture

```text
POPS/
├── backend/                 API FastAPI et moteurs Excel
│   ├── app/                 routes, modèles, services et adaptateurs
│   ├── alembic/             migrations SQL
│   └── tests/               tests et classeurs générés à la volée
├── frontend/                application React + TypeScript + Vite
├── demo/                    classeurs de démonstration reproductibles
├── docs/                    hypothèses, architecture, données et API
├── scripts/                 outils de développement
├── docker-compose.yml       PostgreSQL, API et interface
└── .env.example             configuration documentée
```

Le backend isole `openpyxl` derrière des services d’inspection, de détection, de comparaison, d’extraction et de consolidation. Les imports sont immuables et adressés par clé serveur ; les métadonnées utilisent SQLite pour l’exécution locale et PostgreSQL sous Docker.

## Démarrage rapide avec Docker

Prérequis : Docker Desktop avec Compose v2.

```bash
cp .env.example .env
docker compose up --build
```

Puis ouvrir :

- interface : <http://localhost:5173> ;
- documentation OpenAPI : <http://localhost:8000/docs> ;
- santé API : <http://localhost:8000/health>.

L’identité de développement est créée automatiquement. Les en-têtes facultatifs `X-Organization-Id` et `X-User-Id` permettent de simuler une autre identité ; ce mécanisme doit être remplacé par OIDC/SSO avant toute exposition publique.

## Démarrage local sans Docker

### API

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

Sans `DATABASE_URL`, l’API utilise une base SQLite sous `backend/data/`.

### Interface

```bash
cd frontend
npm install
npm run dev
```

Pour viser une autre API, définir `VITE_API_URL`, par exemple `http://localhost:8000/api`.

## Démonstration

Les trois fichiers de `demo/` peuvent être régénérés à tout moment :

```bash
python scripts/generate_demo_workbooks.py
```

Ordre conseillé :

1. importer `demo/template_pops_demo.xlsx` dans **Templates** ;
2. accepter ou ajuster les candidats des feuilles `Financial KPIs` et `Operations` ;
3. créer les pays France et Allemagne liés au template ;
4. importer les deux fichiers pays correspondants ;
5. examiner et qualifier les anomalies allemandes ;
6. lancer explicitement une consolidation.

Le fichier Allemagne contient volontairement une feuille renommée/réordonnée, un tableau déplacé, une colonne ajoutée, une formule supprimée, une visibilité modifiée et une feuille supplémentaire.

## Vérifications

```bash
cd backend
pytest

cd ../frontend
npm test
npm run build
```

Les tests backend créent leurs classeurs Excel dans un répertoire temporaire : aucun fichier métier n’est modifié.

## Limites Excel connues

Les formules sont conservées et comparées comme du texte, jamais évaluées. La reconstruction avec `openpyxl` préserve les cellules, styles usuels, fusions, dimensions, commentaires, hyperliens, zones d’impression et volets figés, mais ne garantit pas la fidélité des graphiques, images, objets OLE/ActiveX, connexions externes, signatures ou macros. Chaque perte ou élément potentiellement invalide est inscrit dans le rapport de consolidation.

## Documentation

- [Hypothèses fonctionnelles](docs/HYPOTHESES.md)
- [Architecture détaillée](docs/ARCHITECTURE.md)
- [Modèle de données](docs/DATA_MODEL.md)
- [Contrats API](docs/API.md)
- [Plan d’implémentation et acceptation](docs/IMPLEMENTATION_PLAN.md)

