# Sources de données

Détail des flux de données consommés par AlpiMonitor — sous-page de [§3 Contexte et périmètre](index.md). Deux angles : la source technique (LINDAS, OSM) et la transparence factuelle du sourcing des stations affichées ([ADR-008](../09-architectural-decisions/adr-008.md)).

## 1. LINDAS SPARQL — source principale

### Accès et licence

- **Endpoint** : `https://lindas.admin.ch/query` (SPARQL 1.1)
- **Graph hydro** : `<https://lindas.admin.ch/foen/hydro>`
- **Licence** : libre réutilisation avec attribution **« Source : OFEV/BAFU — hydrodaten.admin.ch via LINDAS »**
- **Coût** : gratuit — stratégie fédérale « Open by default » depuis 2020

L'attribution est servie dans le footer de l'app, dans le README du repo, et dans la licence de cette documentation.

### Contenu du graph (inventaire 2026-04-20)

| Type | Nombre | Description |
|------|--------|-------------|
| `HydroMeasuringStation` | 233 | Stations fédérales rivières + lacs |
| `cube:Observation` | 233 | Dernière mesure par station (1 par station) |
| `schema:BodyOfWater` | 162 | Rivières et lacs référencés |
| `geosparql:Geometry` | 233 | Coordonnées WGS84 (WKT `POINT(lon lat)`) |

**Caractéristiques importantes** :

- **Pas d'historique en open** : chaque station n'expose que son observation la plus récente. L'historique 24 h affiché dans le drawer est **construit par AlpiMonitor lui-même** en persistant chaque snapshot du cron dans la table `Measurement`.
- **Rafraîchissement BAFU** : ~toutes les heures côté source. Le cron AlpiMonitor tourne à 10 min — la donnée reste idempotente (upsert sur `{stationId, parameter, timestamp}`).
- **Paramètres disponibles** : débit (`discharge`, m³/s) et niveau d'eau (`waterLevel`, m). Pas de température, turbidité, oxygène dans ce graph. Extensions v2 à explorer via autres graphs LINDAS.
- **UTF-8 required** : noms de stations avec accents (`Schüpfheim`, `Fürthen`).
- **Ordre WKT** : `POINT(lon lat)` — `lon` en premier, piège classique.

### Requête SPARQL type

```sparql
PREFIX schema: <http://schema.org/>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
PREFIX cube: <https://cube.link/>
PREFIX hydro: <https://environment.ld.admin.ch/foen/hydro/dimension/>

SELECT ?code ?name ?water ?wkt ?discharge ?waterLevel ?measuredAt
WHERE {
  GRAPH <https://lindas.admin.ch/foen/hydro> {
    ?station a <http://example.com/HydroMeasuringStation> ;
             schema:identifier ?code ;
             schema:name ?name ;
             geo:hasGeometry/geo:asWKT ?wkt .
    OPTIONAL { ?station schema:containedInPlace ?water }
    ?obs a cube:Observation ;
         hydro:station ?station ;
         hydro:measurementTime ?measuredAt .
    OPTIONAL { ?obs hydro:discharge ?discharge }
    OPTIONAL { ?obs hydro:waterLevel ?waterLevel }
  }
}
```

Réponse : `application/sparql-results+json`, ~150 kB pour les 233 stations.

### Fallback et mode dégradé

Si LINDAS est indisponible au démarrage :

- L'API démarre quand même (pas de crash). Le cron logge `IngestionRun.status = FAILURE` mais n'émet aucune exception qui remonterait au process Fastify.
- Le seed alimente `Station`, `Catchment`, `Glacier` avec les entités de contexte. Les séries temporelles manquent jusqu'au premier tick réussi.
- Un badge UI signale **« Données temps-réel indisponibles — dernier état connu »** ([§5 frontend](../05-building-block-view/frontend.md), composant `MStatusBadge`).

Ce fallback est **critique** pour la démo — si pendant l'entretien LINDAS tombe, l'app reste démontrable.

## 2. OpenStreetMap — tuiles cartographiques

- **URL** : `https://tile.openstreetmap.org/{z}/{x}/{y}.png` (Leaflet default)
- **Licence** : ODbL, attribution `© OpenStreetMap contributors` servie dans l'attribution control Leaflet
- **Drift assumé vs swisstopo WMTS** : l'ADR-005 initial visait swisstopo pour l'identité visuelle suisse. OSM retenu en pratique pour stabilité, zero-cost attribution, absence de clé API requise. Voir [ADR-005](../09-architectural-decisions/adr-005.md) §Drift.

## 3. Stations affichées dans AlpiMonitor

La séparation LIVE/RESEARCH est **le parti-pris narratif** central ([ADR-008](../09-architectural-decisions/adr-008.md)) : le réseau fédéral BAFU s'arrête au Rhône principal, CREALP prend le relais sur les affluents latéraux du Valais.

### 3.1 Stations LIVE (4) — BAFU via LINDAS

Toutes `CONFIRMED` — identifiants, coordonnées et métadonnées proviennent directement du graph LINDAS.

| `ofevCode` | Station | Cours d'eau | Altitude | `sourcingStatus` |
|-----------|---------|-------------|----------|------------------|
| `2346` | Brig | Rhône | 677 m | `CONFIRMED` |
| `2011` | Sion | Rhône | 483 m | `CONFIRMED` |
| `2630` | Sion | Sionne | 510 m | `CONFIRMED` |
| `2009` | Porte du Scex | Rhône | 377 m | `CONFIRMED` |

Le marquage `CONFIRMED` est automatique — chaque station BAFU ingérée hérite du statut sans décision humaine.

### 3.2 Stations RESEARCH (3) — réseau cantonal CREALP

Réseau hydrométrique CREALP sur la Borgne, mis en service fin 2015, ~20 stations au total selon la page publique du projet ([crealp.ch/monitoring-des-eaux-de-surface](https://www.crealp.ch/monitoring-des-eaux-de-surface/)). Gouvernance : SDANA + SEFH Valais, chef de projet Eric Travaglini (CREALP). Maintenance : section Logistique d'entretien du SDM.

Trois stations affichées dans AlpiMonitor, audit factuel du 2026-04-22 :

#### Borgne — Bramois · `CONFIRMED`

Station officielle, documentée publiquement par CREALP. Exutoire du bassin versant de la Borgne, point de confluence avec le Rhône. Équipements (source : page projet) :

- Capteur radar installé sous le pont.
- Échelle limnimétrique pour lecture visuelle de contrôle.
- Datalogger + armoire technique abritant l'électronique.

Projet actif depuis 2019. Chef de projet : Eric Travaglini. Photo de référence disponible sur le site CREALP.

#### Borgne — Les Haudères · `ILLUSTRATIVE`

Représentation plausible dans le Val d'Hérens, non confirmée publiquement. Éléments de plausibilité :

- CREALP opère un Centre de Géologie et Glaciologie aux Haudères (documenté via les expositions INTERREG RESERVAQUA).
- Point de jonction hydrologique clé (confluence Borgne d'Arolla / Borgne de Ferpècle) — emplacement naturel pour une station de mesure dans un réseau de 20 stations.
- Vallée historiquement instrumentée par Grande Dixence SA (régime résiduel en aval des captages d'Arolla et Ferpècle).

Coordonnées et identifiant (`TBD-HAUDERES`) non vérifiés sur les canaux publics audités.

#### Borgne — Evolène · `ILLUSTRATIVE`

Représentation plausible sur le milieu de cours de la Borgne, non confirmée publiquement. Éléments de plausibilité :

- Village central du Val d'Hérens, sur le cours de la Borgne — point logique de suivi amont des apports glaciaires (Ferpècle, Mont Miné).
- Zone d'activité historique CREALP (réseau Sources, projet MINERVE).
- Maillage cohérent avec la densité de 20 stations du réseau cantonal.

Coordonnées et identifiant (`TBD-EVOLENE`) non vérifiés sur les canaux publics audités.

## 4. Méthodologie d'audit (2026-04-22)

**Canaux explorés** :

1. Page projet publique `crealp.ch/monitoring-des-eaux-de-surface` — confirmation complète pour Bramois.
2. Pages `crealp.ch/projets`, `/services`, `/actualites` — recherche par nom de localité.
3. Recherche web ciblée sur `"CREALP station hydrométrique Les Haudères/Evolène"` — aucun résultat probant.
4. LinkedIn officiel CREALP — activité récente sur le projet confirmée, pas de liste exhaustive des stations.

**Canaux non explorés** (backlog post-candidature) :

- **Portail Web Hydro CREALP** — accès et granularité publique à investiguer (possible API ou export).
- **Rapports d'activité annuels** — PDFs sur `crealp.ch/rapports-dactivite`. Les éditions 2022-2024 mentionnent `monitoring-des-eaux-de-surface` dans le vocabulaire interne, lecture détaillée du réseau complet non effectuée.
- **Contact direct Eric Travaglini** — non sollicité dans un cadre candidature pour ne pas contourner le processus RH.

## 5. Évolution future (post-candidature)

Si le projet continue après le 2026-04-30 :

- **Remplacer les 2 stations `ILLUSTRATIVE`** par les vraies stations CREALP Borgne (recherche ciblée dans les rapports d'activité PDF ou via le portail Web Hydro).
- **Ajouter un adaptateur d'ingestion pour CREALP** — parser parallèle à `apps/api/src/ingestion/lindas/`, avec son propre `IngestionSourceKind` dans l'enum Prisma. Architecture déjà prête ([ADR-003](../09-architectural-decisions/adr-003.md) + [ADR-007](../09-architectural-decisions/adr-007.md)).
- **Enrichir `Station`** avec un champ optionnel `sourcingSourceUrl: String?` (URL de la source pour les stations `CONFIRMED`, affiché dans le tooltip du badge).
- **Étendre le pattern `SourcingStatus`** à d'autres entités : glaciers (GLAMOS vs illustrative), captages (Grande Dixence SA vs illustrative). La mécanique est générique.

## 6. Considérations RGPD et attribution

- Les données hydrologiques BAFU ne contiennent **aucune donnée personnelle**.
- Pas de tracking utilisateur dans l'app publique. Pas de cookies non-essentiels.
- Logs applicatifs (pino) : pas de PII, pas d'IP en clair en base.
- Footer UI permanent : « Données hydrologiques : OFEV via LINDAS — lindas.admin.ch | Fond cartographique : © OpenStreetMap contributors ».
