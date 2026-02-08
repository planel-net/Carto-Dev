# Modele de donnees - CartoExcel

## Vue d'ensemble

L'application gere 24 tables Excel reparties en domaines fonctionnels. Toutes les tables sont definies dans `CONFIG.TABLES` de `js/config.js`.

## Tables referentiels

| Cle CONFIG | Table Excel | Feuille | Description |
|------------|-------------|---------|-------------|
| ACTEURS | tActeurs | Acteurs | Personnes (Prenom, Nom, Mail, Equipe) |
| EQUIPES | tEquipe | Acteurs | Equipes (Equipe) |
| SHORES | tShores | Shore | Shores/Golds (Nom, Nom_pour_tables, Migre Tech) |
| PERIMETRES | tPerimetres | Perimetre | Perimetres fonctionnels |
| PROCESSUS | tProcessus | Processus | Processus metier (Processus, Sous-processus, Ordre) |
| SPRINTS | tSprints | Sprints | Sprints (Sprint, Debut, Fin) |

## Tables metier

| Cle CONFIG | Table Excel | Feuille | Description |
|------------|-------------|---------|-------------|
| PRODUITS | tProduits | Produits | Produits/Rapports BI avec statut migration |
| PROJETS_DSS | tProjetsDSS | ProjetsDSS | Projets DSS |
| DATAFLOWS | tDataflows | Dataflows | Dataflows |
| FLUX | tFlux | Flux | Flux de migration (liens Shore/Projet/Dataflow/Produit) |
| BACKLOG | tBacklog | Backlog | Backlog projets |
| CAPACITE | tCapacite | Capacite | Capacite par acteur et sprint |
| TABLES_MH | tTablesMHTech | Tables | Tables MHTech |

## Tables Roadmap (Chantiers)

| Cle CONFIG | Table Excel | Feuille | Description |
|------------|-------------|---------|-------------|
| CHANTIER | tChantiers | Chantier | Chantiers (NumChantier, Chantier, Responsable, Archive...) |
| PHASES | tPhases | Phases | Phases de chantier (Phase, Type, Sprint debut/fin, Couleur...) |
| PHASES_LIEN | tPhasesLien | PhasesLien | Liens associes aux phases |
| CHANTIER_PRODUIT | tChantierProduit | ChantierProduit | Association chantier-produit |
| CHANTIER_DATAANA | tChantierDataAna | ChantierDataAna | Association chantier-DataAna |
| CHANTIER_LIEN | tChantierLien | ChantierLien | Liens associes aux chantiers |

## Tables MAE (Demandes Data)

| Cle CONFIG | Table Excel | Feuille | Description |
|------------|-------------|---------|-------------|
| MAE | tMAE | MAE | Demandes MAE (Cle Jira, Resume, Etat, Priorite...) |
| MAE_NOTE | tMAENote | MAENote | Notes associees aux demandes |
| MAE_LIEN | tMAELien | MAELien | Liens associes aux demandes |

## Tables DataAna

| Cle CONFIG | Table Excel | Feuille | Description |
|------------|-------------|---------|-------------|
| DATAANA | tDataAnas | DataAna | DataAna (Cle Jira, Chantier, Resume, Etat...) |
| PDT_PROCESS | tPdtProcess | ProcessusProduits | Association produit-processus |

## Relations principales

```
ACTEURS <-- EQUIPES (Acteur.Equipe -> Equipe.Equipe)
PRODUITS <-- PERIMETRES (Produit.Perimetre -> Perimetre.Perimetre)
PRODUITS <-- SHORES (Produit.Gold/Shore -> Shore.Nom)
PRODUITS <-- ACTEURS (Produit.Responsable -> Acteur.Mail)
FLUX <-- SHORES, PROJETS_DSS, DATAFLOWS, PRODUITS, SPRINTS
CHANTIER <-- ACTEURS, PERIMETRES, PROCESSUS
PHASES <-- CHANTIER, SPRINTS
CHANTIER_PRODUIT <-- CHANTIER, PRODUITS
CHANTIER_DATAANA <-- CHANTIER, DATAANA
MAE <-- CHANTIER
MAE_NOTE <-- ACTEURS (Redacteur -> Mail)
CAPACITE <-- ACTEURS, SPRINTS
BACKLOG <-- PRODUITS, PROCESSUS, PERIMETRES, SPRINTS
```

## Conventions
- Prefixe `t` pour les noms de tables : `tActeurs`, `tChantiers`
- Les relations utilisent `source` et `sourceField` dans la config des colonnes
- Les tables Jira (DataAnaJira, MAEJiras) sont des feuilles synchronisees, pas dans CONFIG.TABLES
