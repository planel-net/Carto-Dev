# Conventions CSS - CartoExcel

## Charte Malakoff Humanis

Utiliser les variables CSS definies dans `css/variables.css` :

### Couleurs principales
- `--mh-bleu-fonce: #003366` : titres, headers, elements principaux
- `--mh-bleu-clair: #0066CC` : boutons primaires, liens, accents
- `--mh-orange: #FF6600` : boutons action/CTA, badge DEV
- `--mh-gris-fonce: #333333` : texte principal
- `--mh-gris-moyen: #666666` : texte secondaire
- `--mh-gris-clair: #F5F5F5` : fonds secondaires
- `--mh-vert-succes: #28A745` : succes, validation
- `--mh-rouge-erreur: #DC3545` : erreur, suppression
- `--mh-jaune-warning: #FFC107` : avertissement

### Espacements et bordures
- Utiliser `--spacing-xs/sm/md/lg/xl` pour les marges et paddings
- Utiliser `--border-radius-sm/md/lg` pour les coins arrondis
- Utiliser `--shadow-sm/md/lg` pour les ombres

## Organisation des fichiers CSS

| Fichier | Role |
|---------|------|
| `variables.css` | Variables CSS globales |
| `base.css` | Reset et styles de base |
| `components.css` | Boutons, formulaires, badges |
| `notifications.css` | Notifications toast |
| `taskpane.css` | Styles specifiques au volet lateral |
| `app.css` | Layout principal, sidebar, navigation |
| `dashboard.css` | Tableaux de bord, KPI |
| `table.css` | Tableaux de donnees |
| `process-matrix.css` | Matrice processus (page parc) |
| `mae.css` | Page MAE specifique |

## Regles

- **Pas de styles inline** sauf pour les valeurs dynamiques (couleurs de phases, etc.)
- **Classes descriptives** : `sidebar-header`, `nav-item-icon`, `btn-action` (pas de BEM strict)
- **Responsive** : media queries pour les ecrans mobiles/tablettes
- **Animations** : utiliser `transition` pour les interactions, `@keyframes` pour les animations complexes
- **Typographie** : `font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif`
- **Taille de police de base** : 14px

## Boutons

```css
.btn-primary   /* Bleu clair - action principale */
.btn-action    /* Orange - CTA, action importante */
.btn-secondary /* Gris - action secondaire */
.btn-success   /* Vert - validation, sauvegarde */
.btn-danger    /* Rouge - suppression, annulation */
```
