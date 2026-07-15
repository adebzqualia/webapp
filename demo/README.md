# Jeux de données de démonstration

Les classeurs binaires ne sont pas versionnés. Générez-les avec :

```bash
python scripts/generate_demo_workbooks.py
```

Le script produit :

- `template_pops_demo.xlsx` : trois feuilles, cellules fusionnées, formules et deux tableaux dans une même feuille ;
- `pops_france_conforme.xlsx` : structure conforme et valeurs pays modifiées ;
- `pops_germany_anomalies.xlsx` : feuille renommée/réordonnée, tableau déplacé, colonne ajoutée, formule supprimée, visibilité modifiée et feuille supplémentaire.

