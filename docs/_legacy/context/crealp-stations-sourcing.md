# Sourcing des stations CREALP — documentation détaillée

> Ce document détaille la provenance factuelle de chaque station affichée dans AlpiMonitor. Il est destiné à un lecteur technique — recruteur, auditeur, contributeur futur — qui veut vérifier ou étendre notre modèle de données.
>
> **Audit** : 2026-04-22 · **Lié à** : [ADR-008](../architecture/adr/008-station-sourcing-transparency.md)

## 1. Réseau hydrométrique CREALP — vue d'ensemble

Le CREALP (Centre de recherche sur l'environnement alpin, Sion) opère un **réseau cantonal hydrométrique** sur les cours d'eau latéraux du Rhône valaisan, en complément du réseau fédéral BAFU qui couvre uniquement le Rhône principal et ses grands affluents.

Éléments clés extraits de la page publique du projet :

> Le réseau hydrométrique, mis en service fin 2015, dénombre une vingtaine de stations.
>
> Il est géré et entretenu par le CREALP avec la collaboration technique de la section Logistique d'entretien du SDM.
>
> — [crealp.ch/monitoring-des-eaux-de-surface](https://www.crealp.ch/monitoring-des-eaux-de-surface/)

**Objectifs du réseau** :

- Système d'alarme pour le **Plan d'Alarme en cas d'Intempéries (PAI)** cantonal.
- Fourniture de données de base pour le modèle hydrologique **MINERVE** (prévision des débits à l'échelle du bassin du Rhône valaisan).

**Gouvernance** :

- **Porteur du projet** : SDANA et SEFH du Canton du Valais.
- **Chef de projet CREALP** : Eric Travaglini (spécialiste hydrométrie et hydrologie).
- **Maintenance technique** : Section Logistique d'entretien du SDM.

## 2. Stations affichées dans AlpiMonitor

### 2.1 Stations LIVE fédérales (4)

Données ingérées depuis **LINDAS SPARQL** (BAFU open data, cf. [ADR-007](../architecture/adr/007-lindas-sparql-data-source.md)). Toutes **CONFIRMED** — les identifiants OFEV, coordonnées et métadonnées proviennent directement du graph `<https://lindas.admin.ch/foen/hydro>`.

| `ofevCode` | Station          | Cours d'eau | Altitude | `sourcingStatus` |
| ---------- | ---------------- | ----------- | -------- | ---------------- |
| `2346`     | Brig             | Rhône       | 677 m    | `CONFIRMED`      |
| `2011`     | Sion             | Rhône       | 483 m    | `CONFIRMED`      |
| `2630`     | Sion             | Sionne      | 510 m    | `CONFIRMED`      |
| `2009`     | Porte du Scex    | Rhône       | 377 m    | `CONFIRMED`      |

Ces stations sont le **point de vérité BAFU** — coordonnées WGS84 et identifiants stables, réingérés toutes les 10 minutes par le cron LINDAS. Leur marquage `CONFIRMED` est automatique (pas de jugement humain).

### 2.2 Stations RESEARCH CREALP (3)

Stations situées sur la **Borgne**, affluent rive gauche du Rhône drainant le Val d'Hérens. Ce bassin est **hors couverture BAFU** et relève du réseau cantonal CREALP — les mesures ne sont pas exposées publiquement dans le flux fédéral (cf. ADR-007).

#### Borgne — Bramois · `CONFIRMED`

Station hydrométrique officielle, documentée publiquement par CREALP. Exutoire du bassin versant de la Borgne, point de confluence avec le Rhône.

**Équipements documentés** (source : page projet CREALP) :

- **Capteur radar** installé sous le pont.
- **Échelle limnimétrique** pour la lecture visuelle de contrôle.
- **Datalogger** enregistrant les mesures en continu.
- **Armoire technique** abritant l'électronique.

**Photographie de référence** : [crealp.ch/wp-content/uploads/2020/12/Station-hydrometrique-de-la-Borgne-Bramois.png](https://www.crealp.ch/wp-content/uploads/2020/12/Station-hydrometrique-de-la-Borgne-Bramois.png)

**Projet actif depuis** : 2019 (selon la documentation du projet).

**Chef de projet CREALP** : Eric Travaglini.

#### Borgne — Les Haudères · `ILLUSTRATIVE`

Représentation plausible dans le val d'Hérens, non confirmée publiquement.

**Éléments de plausibilité** :

- CREALP opère un **Centre de Géologie et Glaciologie** aux Haudères (documenté via les expositions INTERREG **RESERVAQUA** tenues dans le village).
- Les Haudères est un **point de jonction hydrologique clé** du bassin de la Borgne (confluence Borgne d'Arolla / Borgne de Ferpècle) — point naturel pour une station de mesure dans un réseau de ~20 stations cantonales.
- La vallée est historiquement instrumentée par Grande Dixence SA (régime résiduel en aval des captages d'Arolla et Ferpècle).

**Statut factuel** : coordonnées et identifiant (`TBD-HAUDERES`) n'ont pas pu être vérifiés sur les canaux publics explorés lors de l'audit J13 (2026-04-22).

#### Borgne — Evolène · `ILLUSTRATIVE`

Représentation plausible sur le milieu de cours de la Borgne, non confirmée publiquement.

**Éléments de plausibilité** :

- Village central du val d'Hérens, sur le cours de la Borgne — point logique de suivi amont des apports glaciaires (Ferpècle, Mont Miné).
- Zone d'activité historique CREALP (cf. réseau **Sources** et projet **MINERVE**).
- Maillage cohérent avec la densité d'~20 stations du réseau cantonal sur les cours d'eau latéraux.

**Statut factuel** : coordonnées et identifiant (`TBD-EVOLENE`) n'ont pas pu être vérifiés sur les canaux publics explorés lors de l'audit.

## 3. Méthodologie d'audit (J13, 2026-04-22)

**Canaux explorés** :

1. Page projet publique [crealp.ch/monitoring-des-eaux-de-surface](https://www.crealp.ch/monitoring-des-eaux-de-surface/) — confirmation complète pour Bramois.
2. Pages `crealp.ch/projets`, `crealp.ch/services`, `crealp.ch/actualites` — recherche par nom de localité.
3. Recherche web ciblée : `"CREALP station hydrométrique Les Haudères"`, `"CREALP station hydrométrique Evolène"` — aucun résultat probant.
4. LinkedIn officiel CREALP — confirmation de l'activité récente sur le projet `monitoring-des-eaux-de-surface` mais pas de liste exhaustive des stations.

**Canaux non explorés** (backlog post-candidature) :

- **Portail Web Hydro CREALP** — accès et granularité publique à investiguer (possible API ou export).
- **Rapports d'activité annuels CREALP** — PDFs publiés sur [crealp.ch/rapports-dactivite](https://www.crealp.ch/rapports-dactivite/). Les éditions 2022-2024 mentionnent `monitoring-des-eaux-de-surface` dans le vocabulaire interne (cf. `docs/context/internal-projects.md`) mais la lecture détaillée du réseau complet n'a pas été effectuée dans la fenêtre J13.
- **Contact direct** avec Eric Travaglini (hydrométrie) — non effectué dans un cadre candidature pour ne pas solliciter un futur collègue hors processus RH.

## 4. Évolution future (post-candidature CREALP)

Si le projet continue après le 2026-04-30 (embauche, portfolio, ou simple continuation) :

- **Remplacer les 2 stations `ILLUSTRATIVE`** par les vraies stations CREALP sur la Borgne. Les identifier passe probablement par une recherche ciblée dans les rapports d'activité PDF ou via le portail Web Hydro.
- **Ajouter un adaptateur d'ingestion pour CREALP**. Si le portail Web Hydro expose une API ou un flux structuré, construire un parser parallèle à `apps/api/src/ingestion/lindas/`, avec son propre `IngestionSourceKind` dans l'enum Prisma. L'architecture (cf. ADR-003 monolithe Fastify + cron interne, ADR-007 multi-sources prévu) est déjà prête pour ce cas.
- **Enrichir le schéma `Station`** avec un champ optionnel `sourcingSourceUrl: String?` contenant l'URL de la source pour les stations `CONFIRMED`, affiché comme lien dans le tooltip du badge. Une évolution naturelle, à écrire quand une deuxième source viendra consolider le besoin.
- **Étendre le pattern `SourcingStatus` à d'autres entités** : glaciers (GLAMOS vs illustrative), captages (Grande Dixence SA documents publics vs illustrative). La mécanique est prête et générique.
