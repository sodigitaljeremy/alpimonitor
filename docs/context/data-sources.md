# Data Sources — Accès aux données hydrologiques

> Ce document décrit **d'où viennent les données** qu'AlpiMonitor ingère, sous quel format, sous quelle licence.
> Il est la référence pour l'implémentation du service d'ingestion côté Fastify.
>
> **Historique** : la première version (2026-04-18) ciblait le flux XML `hydroweb.xml`. Cette voie s'est révélée obsolète lors de la discovery US-2.1 (2026-04-20) — voir [ADR-007](../architecture/adr/007-lindas-sparql-data-source.md).

## Source principale : LINDAS SPARQL (service fédéral)

### Accès et licence

- **Portail** : https://lindas.admin.ch
- **Endpoint SPARQL** : `https://lindas.admin.ch/query` (SPARQL 1.1)
- **Graph BAFU hydrologie** : `<https://lindas.admin.ch/foen/hydro>`
- **Licence** : libre réutilisation, avec **obligation d'attribution**
- **Attribution requise** : « Source : Office fédéral de l'environnement (OFEV / BAFU), hydrodaten.admin.ch — via LINDAS »
- **Cadre légal** : stratégie fédérale « Open by default » depuis 2020
- **Coût** : gratuit

**Implémentation** : intégrer l'attribution dans le footer de l'application, dans le README, dans les métadonnées de chaque jeu de données affiché. Mention du canal LINDAS côté /about.

### Schéma et contenu du graph

Contenu du graph `<https://lindas.admin.ch/foen/hydro>` (inventaire 2026-04-20) :

| Type                          | Nombre | Description |
|-------------------------------|--------|-------------|
| `HydroMeasuringStation`       | 233    | Stations fédérales rivières + lacs |
| `cube:Observation`            | 233    | Dernière mesure par station (1 par station) |
| `schema:BodyOfWater`          | 162    | Rivières et lacs référencés |
| `schema:DefinedTerm`          | 395    | Termes contrôlés (vocabulaire) |
| `cube:Cube`                   | 2      | Un cube rivières, un cube lacs |
| `geosparql:Geometry`          | 233    | Coordonnées WGS84 (WKT point) |

**Propriétés d'une station** :

- `schema:identifier` — code OFEV numérique (ex. `"2011"`)
- `schema:name` — nom affichable (ex. `"Sion"`)
- `geosparql:hasGeometry` → `geosparql:asWKT` — `POINT(lon lat)` en WGS84
- `schema:containedInPlace` — URI du cours d'eau (ex. `.../waterbody/Rhône`)

**Propriétés d'une observation rivière** :

- `foen-hydro:station` — URI de la station
- `foen-hydro:measurementTime` — timestamp ISO 8601 (ex. `2026-04-20T21:00:00+01:00`)
- `foen-hydro:discharge` — débit en m³/s
- `foen-hydro:waterLevel` — niveau en mètres (altitude-référencé, pas hauteur depuis le lit)
- `foen-hydro:dangerLevel` — niveau 1 à 5 (échelle BAFU)
- `cube:observedBy` — organisation (OFEV)

**Propriétés d'une observation lac** : identique, sans `discharge`.

### Requête SPARQL type — liste stations + dernière mesure

```sparql
PREFIX ex: <http://example.com/>
PREFIX schema: <http://schema.org/>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
PREFIX cube: <https://cube.link/>
PREFIX hydro: <https://environment.ld.admin.ch/foen/hydro/dimension/>

SELECT ?code ?name ?water ?wkt ?discharge ?waterLevel ?danger ?measuredAt
WHERE {
  GRAPH <https://lindas.admin.ch/foen/hydro> {
    ?station a ex:HydroMeasuringStation ;
             schema:identifier ?code ;
             schema:name ?name ;
             geo:hasGeometry/geo:asWKT ?wkt .
    OPTIONAL { ?station schema:containedInPlace ?water }
    ?obs a cube:Observation ;
         hydro:station ?station ;
         hydro:measurementTime ?measuredAt ;
         hydro:dangerLevel ?danger .
    OPTIONAL { ?obs hydro:discharge ?discharge }
    OPTIONAL { ?obs hydro:waterLevel ?waterLevel }
  }
}
```

Réponse : `application/sparql-results+json`. Payload typique : ~150 Ko pour les 233 stations.

### Caractéristiques importantes à gérer

- **Pas d'historique en open** : chaque station n'a qu'une seule observation exposée (la plus récente). L'historique est **construit par AlpiMonitor lui-même** en stockant chaque snapshot du cron d'ingestion dans la table `Measurement`
- **Rafraîchissement** : ~toutes les heures côté BAFU (les timestamps observés sont à la demi-heure ou à l'heure ronde)
- **Paramètres absents** : pas de température, turbidité, oxygène dans ce graph. Si besoin v2, explorer d'autres graphs LINDAS ou dataset séparés
- **Langue** : les noms de stations peuvent contenir des accents (`Schüpfheim`, `Fürthen`). UTF-8 safe requis
- **Coordonnées** : WKT format `POINT(lon lat)` — attention à l'ordre, c'est lon-first

### Stations cibles pour AlpiMonitor (validées discovery 2026-04-20)

Le scope couvre le bassin de la Borgne + captages Grande Dixence + Rhône local. Le réseau fédéral BAFU n'instrumente **pas** la Borgne ni ses affluents du Val d'Hérens (ces cours d'eau sont suivis par Grande Dixence SA en privé et par CREALP en recherche). Deux types de stations coexistent donc dans notre modèle :

**Stations `LIVE` — ingérées depuis LINDAS (dataSource = LIVE)**

| OFEV code | Name                | Water body | Rôle narratif |
|-----------|---------------------|------------|---------------|
| 2346      | Brig                | Rhône      | Amont Rhône (proche glaciers Aletsch/Rhône) |
| 2011      | Sion                | Rhône      | Intermédiaire (exutoire Val d'Hérens côté Rhône) |
| 2630      | Sion                | Sionne     | Affluent urbain de Sion |
| 2009      | Porte du Scex       | Rhône      | Aval bassin Valaisan (entrée Léman) |

**Stations `RESEARCH` — réseau CREALP, non intégrées en v1 (dataSource = RESEARCH)**

| Code placeholder   | Name                 | River       | Rôle narratif |
|--------------------|----------------------|-------------|---------------|
| `TBD-BRAMOIS`      | Borgne — Bramois     | La Borgne   | Confluence Rhône |
| `TBD-HAUDERES`     | Borgne — Les Haudères| La Borgne   | Intermédiaire Val d'Hérens |
| `TBD-EVOLENE`      | Borgne — Evolène     | La Borgne   | Amont proche Ferpècle/Mont Miné |

Ces stations apparaissent en UI avec un badge explicite « Données en attente d'intégration — réseau CREALP interne ». Elles permettent de raconter le bassin complet sans exposer de fausses données.

## Sources secondaires (pour enrichissement)

### Geoadmin (map.geo.admin.ch)

- **Usage** : fond de carte suisse, contours de bassins versants, géolocalisation des stations
- **Accès** : WMS/WMTS publics, pas d'API REST classique
- **Licence** : usage libre avec attribution « © swisstopo »
- **Pour AlpiMonitor** : tuiles carto via Leaflet, layer basemap officiel suisse

### GLAMOS (glamos.ch)

- **Usage (optionnel v2)** : données long terme sur les glaciers suisses (bilan de masse, longueur)
- **Accès** : datasets téléchargeables (CSV)
- **Pour AlpiMonitor v1** : pas utilisé en temps réel, mais possibilité d'une page "contexte glaciers" avec graphique historique du retrait de Ferpècle/Mont Miné (dataset statique seeded)

## Stratégie d'ingestion pour AlpiMonitor

### Pipeline

```
[LINDAS SPARQL endpoint]
      ↓ (fetch toutes les 10-15 min via node-cron dans l'API Fastify)
[JSON SPARQL results → objets TS]
      ↓
[Validation Zod] → (si échec : log + skip + IngestionRun.status = PARTIAL)
      ↓
[Archive raw JSON sur disque + SHA-256 en DB (IngestionRun)]
      ↓
[Upsert Prisma / Postgres : Measurement avec @@unique(sensorId, recordedAt)]
      ↓
[Calcul d'anomalies statistiques] (moyenne mobile + 2σ)
      ↓
[Création alertes si seuil dépassé]
```

### Choix techniques associés

- **HTTP fetch** : `fetch` global natif (Node 20+)
- **Parsing** : `JSON.parse` standard (pas de lib XML, cf. ADR-007)
- **Validation** : `zod` sur un schéma cible (post-parsing)
- **Scheduling** : `node-cron` intégré à Fastify (onReady hook), toutes les 10-15 minutes
- **Retry/backoff** : 3 tentatives exponentielles (1s, 4s, 15s)
- **Idempotence** : upsert sur `(sensorId, recordedAt)` unique → rejouer une ingestion n'insère jamais de doublon
- **Archive** : chaque run persiste le corps JSON brut gzippé dans `var/lindas-archive/YYYY-MM-DD.json.gz` (rotation 30 jours), avec un hash SHA-256 stocké en DB pour déduplication du payload inchangé

### Fallback et mode dégradé

Si LINDAS est indisponible au démarrage :
- L'application doit démarrer quand même (pas de crash)
- Les données **seed** permettent une démo fonctionnelle (stations visibles, pas de séries temporelles)
- Un badge UI signale « Données temps-réel indisponibles — affichage du dernier état connu »

Ce fallback est **critique** pour la démo : si pendant l'interview LINDAS tombe, l'app doit rester démontrable. Le cron logge un `IngestionRun.status = FAILURE` mais ne propage jamais l'erreur au process API.

### Stratégie de seed

- Le seed alimente les tables `Station`, `Sensor`, `Threshold`, `Glacier`, `Withdrawal`, `Catchment` avec les entités de contexte
- Le seed **n'insère pas** de `Measurement` : les séries temporelles se construisent à partir de l'ingestion cron (qui démarre au premier boot)
- Pour la démo, 1-2 heures d'ingestion suffisent à afficher des séries réelles courtes sur les stations `LIVE`. Les stations `RESEARCH` restent sans série — l'UI l'indique clairement

## Considérations RGPD et éthique

- Les données hydrologiques BAFU ne contiennent **aucune donnée personnelle**
- Pas de tracking utilisateur dans l'app publique
- Pas de cookies non-essentiels
- Logs applicatifs : pas de PII, pas d'IP en clair en base

## Attribution et crédits (à intégrer dans l'UI et le README)

- Footer UI permanent : « Données hydrologiques : OFEV via LINDAS — lindas.admin.ch | Fond cartographique : © swisstopo »
- README : section « Sources de données » listant LINDAS, swisstopo, et le cas échéant GLAMOS et CREALP
- Metadata HTML : balises Dublin Core si l'app est publique indexable
