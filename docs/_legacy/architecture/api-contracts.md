# API Contracts

> Définition des endpoints exposés par l'API Fastify et de leurs schémas d'entrée/sortie.
> Les schémas Zod réels vivront dans `packages/shared/schemas/`. Ce document est la source de vérité métier.

## 1. Conventions

- **Base URL** : `/api/v1`
- **Format** : JSON UTF-8
- **Dates** : ISO 8601 UTC (`2026-04-18T14:00:00.000Z`)
- **Pagination** : `?page=1&pageSize=50`, headers `X-Total-Count`, `X-Page`, `X-Page-Size`
- **Tri** : `?sort=recordedAt:desc`
- **Erreurs** : `{ error: { code: string, message: string, details?: unknown } }`
- **Auth** : header `Authorization: Bearer <token>` pour routes protégées

## 2. Codes d'erreur standards

| Code HTTP | `error.code` | Signification |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Payload invalide (Zod) |
| 401 | `UNAUTHORIZED` | Token manquant ou invalide |
| 403 | `FORBIDDEN` | Token valide mais droits insuffisants |
| 404 | `NOT_FOUND` | Ressource inexistante |
| 409 | `CONFLICT` | Conflit d'état (ex: seuils incohérents) |
| 429 | `RATE_LIMITED` | Trop de requêtes |
| 500 | `INTERNAL_ERROR` | Erreur serveur (pas de détail leaké) |
| 503 | `SERVICE_UNAVAILABLE` | Healthcheck échoué |

## 3. Endpoints publics

### 3.1 `GET /api/v1/health`

**Liveness probe** simple. Non authentifié. Utilisé par Coolify/Traefik. Volontairement minimaliste : un appelant peut le hit à la seconde.

**Response 200** :

```json
{
  "status": "ok",
  "timestamp": "2026-04-21T10:00:00.000Z",
  "database": "ok"
}
```

**Response 503** si la DB est inaccessible (payload identique avec `database: "error"`).

> Contrairement à la v1 initiale de ce contrat, `/health` ne porte **pas** les infos d'ingestion. Elles vivent sur `/status`, pour garder `/health` cheap et sans dépendance à la table `IngestionRun`.

---

### 3.2 `GET /api/v1/status`

**Observabilité élargie.** Non authentifié. Sert à la fois au debug/ops et au badge frontend « données mises à jour il y a X min ». Retourne le dernier `IngestionRun` (tous statuts confondus) et le timestamp du dernier succès, sans fuiter l'historique.

**Response 200** :

```json
{
  "api": { "status": "ok", "uptimeSeconds": 3600 },
  "database": { "status": "ok" },
  "ingestion": {
    "lastRun": {
      "source": "LINDAS_HYDRO",
      "status": "SUCCESS",
      "startedAt": "2026-04-21T10:00:00.000Z",
      "completedAt": "2026-04-21T10:00:02.340Z",
      "stationsSeenCount": 4,
      "measurementsCreatedCount": 8,
      "durationMs": 2340
    },
    "lastSuccessAt": "2026-04-21T10:00:02.340Z",
    "healthyThresholdMinutes": 30,
    "today": {
      "runsCount": 6,
      "measurementsCreatedSum": 48,
      "successRate": 1
    }
  }
}
```

- `lastRun` est `null` si la table `IngestionRun` est vide (ex. juste après un reset DB).
- `lastSuccessAt` est `null` si aucun run `SUCCESS` n'existe encore.
- Le frontend calcule l'état du badge : `now - lastSuccessAt < healthyThresholdMinutes * 60s` → vert, sinon rouge.
- Le threshold est surchargeable via `INGESTION_HEALTHY_THRESHOLD_MINUTES` côté serveur.
- `today` agrège les `IngestionRun` depuis **minuit UTC**. Choix délibéré : UTC est stable, ne dépend pas du fuseau serveur, et `today` est une métrique ops/demo, pas un affichage légal. `successRate` ∈ `[0, 1]` ou `null` si `runsCount === 0` — évite d'afficher un « 0 % » trompeur avant le premier tick du cron de la journée.
- La forme de `ingestion` est volontairement extensible : en v2 elle pourra devenir `{ sources: { LINDAS_HYDRO: {...}, MCH_SWISSMETNET: {...} } }` sans casser les consommateurs actuels si l'on ajoute une clé à côté.

**Response 503** si la DB est inaccessible. Payload identique avec `database.status = "error"` et `ingestion.lastRun = null`.

---

### 3.3 `GET /api/v1/stations`

Liste toutes les stations actives avec leur dernière mesure de chaque paramètre.

**Query params** :
- `catchmentId?: string`
- `isActive?: boolean` (défaut : `true`)

**Response 200** :

```json
{
  "data": [
    {
      "id": "clxyz...",
      "ofevCode": "2011",
      "name": "Borgne - Bramois",
      "riverName": "Borgne",
      "latitude": 46.233,
      "longitude": 7.397,
      "altitudeM": 494,
      "flowType": "NATURAL",
      "operatorName": "OFEV",
      "dataSource": "LIVE",
      "latestMeasurements": [
        {
          "parameter": "DISCHARGE",
          "unit": "m3/s",
          "value": 12.34,
          "recordedAt": "2026-04-18T13:50:00.000Z",
          "status": "NORMAL"
        },
        {
          "parameter": "WATER_LEVEL",
          "unit": "cm",
          "value": 145,
          "recordedAt": "2026-04-18T13:50:00.000Z",
          "status": "VIGILANCE"
        }
      ],
      "activeAlertsCount": 1
    }
  ]
}
```

- Le champ `status` (par mesure) est calculé côté serveur : `NORMAL | VIGILANCE | ALERT | OFFLINE`.
  - `OFFLINE` si `recordedAt` est plus vieux que 60 min (const `STATION_STALE_MINUTES` côté API).
  - `VIGILANCE` / `ALERT` selon le `Threshold` (direction `ABOVE` ou `BELOW`).
  - `NORMAL` si pas de seuil défini ou valeur sous vigilance.
- Le champ `dataSource` vaut `LIVE` (station BAFU ingérée via LINDAS), `RESEARCH` (instrumentée par CREALP / opérateurs, pas de flux public → `latestMeasurements` vide) ou `SEED` (données de démo). Voir ADR-007.
- Les stations `RESEARCH` remontent ici avec `latestMeasurements: []` — le frontend peut les afficher avec un style distinctif.

---

### 3.4 `GET /api/v1/stations/:id`

Détail d'une station avec ses métadonnées enrichies (capteurs, seuils, glaciers associés, captages).

**Response 200** :

```json
{
  "data": {
    "id": "clxyz...",
    "ofevCode": "2011",
    "name": "Borgne - Bramois",
    "riverName": "Borgne",
    "latitude": 46.233,
    "longitude": 7.397,
    "altitudeM": 494,
    "flowType": "NATURAL",
    "operatorName": "OFEV",
    "catchment": {
      "id": "...",
      "name": "Bassin de la Borgne"
    },
    "sensors": [
      {
        "parameter": "DISCHARGE",
        "unit": "m3/s",
        "isActive": true
      }
    ],
    "thresholds": [
      {
        "parameter": "DISCHARGE",
        "vigilanceValue": 25,
        "alertValue": 40,
        "direction": "ABOVE"
      }
    ],
    "relatedGlaciers": [
      { "name": "Ferpècle" },
      { "name": "Mont Miné" }
    ],
    "upstreamWithdrawals": [
      {
        "name": "Station de pompage de Ferpècle",
        "operatorName": "Grande Dixence SA",
        "annualVolumeM3": 60000000
      }
    ]
  }
}
```

---

### 3.5 `GET /api/v1/stations/:id/measurements`

Série temporelle pour un ou plusieurs paramètres d'une station.

**Query params** :
- `parameter?: Parameter` (sinon tous les paramètres actifs)
- `from: ISO date` (requis, timezone-aware)
- `to: ISO date` (requis, timezone-aware, strictement > `from`)
- `aggregate?: 'raw' | 'hourly' | 'daily'` (défaut : auto selon range)

**Règles d'agrégation automatique** (si `aggregate` non fourni) :
- range ≤ 24h → `raw`
- range ≤ 7j → `hourly`
- range > 7j → `daily`

**Erreurs possibles** :
- `400 VALIDATION_ERROR` : `from`/`to` absents, malformés, ou `from >= to`.
- `404 NOT_FOUND` : station inexistante.
- `200` avec `series: []` si la station existe mais n'a pas de capteur actif matchant le filtre (typique des stations `RESEARCH` ou d'un filtre `parameter` qui ne correspond à rien).

**Response 200** :

```json
{
  "data": {
    "stationId": "clxyz...",
    "from": "2026-04-11T00:00:00.000Z",
    "to": "2026-04-18T00:00:00.000Z",
    "aggregate": "hourly",
    "series": [
      {
        "parameter": "DISCHARGE",
        "unit": "m3/s",
        "points": [
          { "t": "2026-04-11T00:00:00.000Z", "v": 10.2 },
          { "t": "2026-04-11T01:00:00.000Z", "v": 10.4 }
        ]
      }
    ]
  }
}
```

**Optimisation** : points sérialisés en `{t, v}` (pas `{time, value}`) pour réduire la taille de payload sur de longues séries.

---

### 3.6 `GET /api/v1/alerts`

Liste des alertes, filtrables et paginées.

**Query params** :
- `stationId?: string`
- `level?: AlertLevel`
- `type?: AlertType`
- `active?: boolean` (= `closedAt IS NULL`)
- `from?: ISO date`
- `to?: ISO date`
- `page?: number` (défaut 1)
- `pageSize?: number` (défaut 50, max 200)

**Response 200** :

```json
{
  "data": [
    {
      "id": "...",
      "station": {
        "id": "...",
        "name": "Borgne - Bramois",
        "ofevCode": "2011"
      },
      "type": "THRESHOLD_EXCEEDED",
      "level": "VIGILANCE",
      "parameter": "WATER_LEVEL",
      "triggerValue": 152,
      "thresholdValue": 150,
      "openedAt": "2026-04-18T12:30:00.000Z",
      "closedAt": null,
      "durationSeconds": 5400
    }
  ]
}
```

Headers : `X-Total-Count`, `X-Page`, `X-Page-Size`.

---

### 3.7 `GET /api/v1/catchments`

Liste des bassins versants. Utile pour filtres UI.

**Response 200** :

```json
{
  "data": [
    {
      "id": "...",
      "name": "Bassin de la Borgne",
      "areaKm2": 383,
      "stationsCount": 4
    }
  ]
}
```

## 4. Endpoints d'authentification

### 4.1 `POST /api/v1/auth/login`

**Rate limited** : 5 req/min par IP.

**Request** :
```json
{
  "username": "admin",
  "password": "..."
}
```

**Response 200** :
- Body : `{ "accessToken": "eyJ...", "expiresIn": 900 }`
- Cookie `Set-Cookie: refreshToken=...; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`

**Response 401** si credentials invalides (même code/message pour éviter énumération).

### 4.2 `POST /api/v1/auth/refresh`

Lit le cookie refresh token, renvoie un nouvel access token.

**Response 200** : `{ "accessToken": "...", "expiresIn": 900 }`

### 4.3 `POST /api/v1/auth/logout`

Invalide le refresh token (cookie effacé).

**Response 204**.

## 5. Endpoints admin (protégés par JWT admin)

### 5.1 `PUT /api/v1/stations/:id/thresholds`

Met à jour les seuils d'une station pour un paramètre donné.

**Request** :
```json
{
  "parameter": "WATER_LEVEL",
  "vigilanceValue": 140,
  "alertValue": 180,
  "direction": "ABOVE"
}
```

**Validation métier** (erreur `VALIDATION_ERROR` 400 si échec) :
- Si `direction === 'ABOVE'` : `alertValue > vigilanceValue`
- Si `direction === 'BELOW'` : `alertValue < vigilanceValue`
- Les valeurs doivent être > 0 pour DISCHARGE, WATER_LEVEL, TURBIDITY

**Response 200** : le seuil mis à jour.

Crée une entrée `ThresholdAudit` en parallèle.

### 5.2 `GET /api/v1/admin/threshold-audits`

Historique des modifications de seuils. Pagination standard.

## 6. Principes de design des contrats

### Séparation DTO / entités

Les types Prisma ne sont **jamais** exposés directement. Chaque réponse passe par un DTO construit explicitement (mapper dans `services/`). Raisons :
- Évite de leaker des champs internes (`createdAt`, `ingestedAt`)
- Permet d'évoluer le schéma DB sans casser l'API
- Force à réfléchir à ce qu'on expose

### Validation

- **Input** : validation Zod stricte sur tous les params, query, body. Pas de `any`, pas de `z.unknown()` qui traîne.
- **Output** : Zod peut aussi valider la réponse en dev (optionnel, utile pour détecter les drifts).

### Versioning

Base URL `/api/v1`. Pas de rupture prévue en v1. Si évolution, `v2` coexistera quelque temps.

## 7. Rate limiting

- Par défaut : **60 req/min par IP** sur toutes les routes
- `/auth/login` : 5 req/min par IP (plus strict)
- `/health` : illimité (Coolify doit pouvoir le hit fréquemment)
- `/status` : illimité (frontend le poll pour rafraîchir le badge freshness)

Header de réponse `RateLimit-Remaining`.

## 8. Headers de sécurité (via Helmet)

- `Content-Security-Policy` : stricte, sources explicites (tuiles swisstopo, API self)
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
