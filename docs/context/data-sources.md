# Data Sources — Accès aux données hydrologiques

> Ce document décrit **d'où viennent les données** qu'AlpiMonitor ingère, sous quel format, sous quelle licence.
> Il est la référence pour l'implémentation du service d'ingestion côté Fastify.

## Source principale : OFEV (hydrodaten.admin.ch)

### Accès et licence

- **Portail** : https://www.hydrodaten.admin.ch
- **Catalogue open data** : opendata.swiss
- **Licence** : libre réutilisation, avec **obligation d'attribution**
- **Attribution requise** : « Source : Office fédéral de l'environnement (OFEV), www.hydrodaten.admin.ch »
- **Cadre légal** : stratégie fédérale « Open by default » depuis 2020
- **Coût** : gratuit

**Implémentation** : intégrer l'attribution dans le footer de l'application, dans le README, dans les métadonnées de chaque jeu de données affiché.

### Format et endpoints

Les données temps-réel sont diffusées au format **XML**, pas JSON.

- **Endpoint principal** : `https://www.hydrodaten.admin.ch/lhg/az/xml/hydroweb.xml`
- **Schémas XSD** : `hydroweb.xsd`, `hydroweb2.xsd` (versions coexistantes selon stations)
- **Périodicité** : mesures actualisées toutes les 10 minutes
- **Paramètres disponibles** (variables selon station) :
  - Hauteur d'eau (cm)
  - Débit (m³/s)
  - Température de l'eau (°C)
  - Turbidité (pour certaines stations)

### Caractéristiques importantes à gérer

- Toutes les stations ne mesurent pas tous les paramètres
- Les timestamps de mise à jour varient d'une station à l'autre
- Certaines stations peuvent être temporairement hors-ligne (maintenance, panne)
- Les identifiants de station sont des codes numériques (ex. `2011`, `2135`)

### Exemple de structure XML (extrait simplifié)

```xml
<locations>
  <location number="2011" name="Borgne - Bramois">
    <parameter type="10" unit="m3/s" name="Abfluss">
      <value datetime="2026-04-18T14:00:00">12.34</value>
    </parameter>
    <parameter type="02" unit="cm" name="Pegel">
      <value datetime="2026-04-18T14:00:00">145</value>
    </parameter>
  </location>
</locations>
```

*Note : format indicatif basé sur l'analyse de sources tierces (cstuder/parse-hydrodaten). À valider contre le flux réel lors de l'implémentation.*

### Stations cibles pour AlpiMonitor (à confirmer au premier fetch)

Le périmètre est le bassin Borgne + captages Grande Dixence + Rhône local. Stations candidates (liste à valider contre le catalogue OFEV réel) :

- Borgne — Bramois (confluence Rhône)
- Borgne — Evolène ou Les Haudères (haut bassin)
- Dixence — en aval du lac des Dix
- Rhône — Sion (intégration bassin)
- Stations complémentaires sur affluents si disponibles

**Action J2 (sprint dev)** : faire un script de discovery qui fetch le XML, liste toutes les stations, filtre par coordonnées (lat/lon de la zone Valais central) et produit la shortlist définitive.

## Sources secondaires (pour enrichissement)

### Geoadmin (map.geo.admin.ch)

- **Usage** : fond de carte suisse, contours de bassins versants, géolocalisation des stations
- **Accès** : WMS/WMTS publics, pas d'API REST classique
- **Licence** : usage libre avec attribution « © swisstopo »
- **Pour AlpiMonitor** : tuiles carto via Leaflet ou MapLibre, layer basemap officiel suisse

### opendata.swiss

- **Usage** : catalogue de métadonnées (CKAN API) si besoin d'enrichir les infos stations
- **Accès** : API CKAN JSON
- **Licence** : métadonnées libres

### GLAMOS (glamos.ch)

- **Usage (optionnel v2)** : données long terme sur les glaciers suisses (bilan de masse, longueur)
- **Accès** : datasets téléchargeables (CSV)
- **Pour AlpiMonitor v1** : pas utilisé en temps réel, mais possibilité d'une page "contexte glaciers" avec graphique historique du retrait de Ferpècle/Mont Miné (dataset statique seeded)

## Stratégie d'ingestion pour AlpiMonitor

### Pipeline

```
[OFEV XML feed]
      ↓ (fetch toutes les 10 min via cron Fastify)
[Parser XML → objets TS]
      ↓
[Validation Zod] → (si échec : log + skip)
      ↓
[Upsert Prisma / Postgres]
      ↓
[Calcul d'anomalies statistiques] (moyenne mobile + 2σ)
      ↓
[Création alertes si seuil dépassé]
```

### Choix techniques associés

- **HTTP fetch** : `undici` (natif Node 20+) ou `fetch` global
- **Parsing XML** : `fast-xml-parser` (pas `xml2js`, trop lent et ancien)
- **Validation** : `zod` sur un schéma cible (post-parsing)
- **Scheduling** : `node-cron` ou scheduler Fastify natif, toutes les 10 minutes
- **Retry/backoff** : à implémenter simplement (3 tentatives exponentielles)
- **Idempotence** : upsert sur `(stationId, parameter, timestamp)` unique

### Fallback et mode dégradé

Si le flux OFEV est indisponible au démarrage :
- L'application doit démarrer quand même (pas de crash)
- Les données **seed** (historique figé inclus via migration Prisma) permettent une démo fonctionnelle
- Un badge UI signale « Données temps-réel indisponibles — affichage historique »

Ce fallback est **critique** pour la démo : si pendant l'interview le flux OFEV tombe, l'app doit rester démontrable.

### Stratégie de seed

- **Dataset seed minimal** : ~90 jours d'historique pour 4-6 stations, généré en script à partir d'un échantillon réel téléchargé lors du dev
- **Données seed = données d'intégration de test** : pas besoin de deux jeux séparés
- **Fichier versionné** : `prisma/seed/measurements.json` (ou CSV)

## Considérations RGPD et éthique

- Les données hydrologiques OFEV ne contiennent **aucune donnée personnelle**
- Pas de tracking utilisateur dans l'app publique
- Pas de cookies non-essentiels
- Logs applicatifs : pas de PII, pas d'IP en clair en base

## Attribution et crédits (à intégrer dans l'UI et le README)

- Footer UI permanent : « Données hydrologiques : OFEV — hydrodaten.admin.ch | Fond cartographique : © swisstopo »
- README : section « Sources de données » listant OFEV, swisstopo, et le cas échéant GLAMOS et CREALP (pour les éventuelles illustrations)
- Metadata HTML : balises Dublin Core si l'app est publique indexable
