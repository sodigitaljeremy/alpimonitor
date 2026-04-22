# ADR-008 — Transparence du sourcing des stations CREALP

**Date** : 2026-04-22
**Statut** : Acceptée — implémentée
**Implémentation** : `8f9ffb5` (champ `Station.sourcingStatus` + migration + seed), `fb94f5a` (exposition DTO + test API), `b5af019` (atom `ASourcingBadge` + intégration `MStationCard` + tests).

## Contexte

Le modèle de stations d'AlpiMonitor mélange deux natures :

- **Stations LIVE** — ingérées depuis LINDAS (BAFU open data) : Rhône à Brig, Sion, Porte du Scex ; Sionne à Sion. Quatre stations fédérales documentées avec identifiants OFEV officiels.
- **Stations RESEARCH** — réseau cantonal CREALP sur la Borgne (affluent du Rhône valaisan, hors couverture fédérale) : Bramois, Les Haudères, Evolène. Trois stations illustrant narrativement le rôle CREALP au-delà du réseau fédéral (cf. ADR-007).

Un audit factuel mené le 2026-04-22 contre la page publique [crealp.ch/monitoring-des-eaux-de-surface](https://www.crealp.ch/monitoring-des-eaux-de-surface/) a révélé que seule **Borgne — Bramois** est documentée publiquement par CREALP (équipements décrits, photographie, chef de projet identifié). Les deux autres stations — **Les Haudères** et **Evolène** — sont plausibles dans le maillage du réseau cantonal (~20 stations sur cours d'eau latéraux du Rhône, opéré par CREALP depuis fin 2015) mais n'ont pas de confirmation publique spécifique à leur emplacement exact.

**Risque identifié** : notre public cible est CREALP lui-même. Un recruteur ou un relecteur qui connaît son propre réseau hydrométrique peut détecter une imprécision dans les emplacements. Sans explicitation, cela lit comme de l'approximation involontaire — signal contraire à la rigueur factuelle que le métier demande.

## Décision

Introduire un champ **`sourcingStatus`** orthogonal à `dataSource` sur le modèle `Station`, avec deux valeurs :

- **`CONFIRMED`** — donnée issue d'une source publique vérifiable (LINDAS SPARQL, page projet CREALP, publication académique).
- **`ILLUSTRATIVE`** — emplacement plausible construit pour la démo, sans confirmation publique spécifique.

Traverser la valeur du seed Prisma jusqu'au DTO API **verbatim** (pas de conversion casing), sur le même pattern que `dataSource` et `flowType` (convention SCREAMING_SNAKE_CASE bout-en-bout).

**Surface UI** : rendre un badge discret `ASourcingBadge` **uniquement sur les cartes research** (`MStationCard --kind-research`). Les stations LIVE fédérales sont implicitement `CONFIRMED` — afficher le badge là-bas serait bruit. Chaque badge porte :

- un libellé court (`Source officielle` / `Représentation illustrative`),
- une icône (check / info),
- un tooltip explicatif au survol ou focus clavier, incluant l'URL de la source pour les stations confirmées.

Documenter la méthodologie d'audit et le détail par station dans `docs/context/crealp-stations-sourcing.md`.

### Arbitrages d'implémentation

- **Atom dédié `ASourcingBadge` plutôt qu'extension de `ABadge`**. Le badge sourcing a des responsabilités uniques — icône, tooltip, liaison a11y via `aria-describedby` — qui pollueraient l'atome générique `ABadge` (texte + variant). La cohérence visuelle inter-atom est obtenue en mimant les primitives CSS (`rounded-full`, `border`, `px-2.5 py-0.5`, `text-xs font-medium`), pas en partageant le composant. Single-responsibility préservé.
- **Valeur DTO verbatim** (`'CONFIRMED' | 'ILLUSTRATIVE'`, pas `'confirmed' | 'illustrative'`). Un casing différent sur un seul enum aurait créé une singularité à défendre en entretien (`dataSource: 'LIVE'` cohabitant avec `sourcingStatus: 'confirmed'`). Le mapping libellé FR est fait dans le badge via i18n, à l'endroit où il coûte le moins.
- **Badge conditionnel**, pas systématique. Afficher un badge `CONFIRMED` sur les 4 stations BAFU serait redondant avec le badge `BAFU live` déjà présent en tête de carte, et diluerait la valeur informative du signal `ILLUSTRATIVE` sur les deux stations concernées.

## Conséquences

### Positives

- **Transparence totale** pour un recruteur CREALP ou un auditeur : la provenance factuelle de chaque station est exposée dans l'UI (badge), dans la DB (champ typé), dans les docs (ADR + context markdown).
- **Signal de rigueur** renversant le risque initial : passer d'un trou factuel à un pattern nommé (`CONFIRMED` / `ILLUSTRATIVE`) est un différentiateur en entretien technique — la capacité à tracer ce qu'on ne sait pas est plus rare que la maîtrise d'un framework.
- **Extensibilité** : toute station future ajoutée au seed hérite du mécanisme. Si CREALP ouvre son portail Web Hydro ou expose son réseau via une API, la bascule se fait par simple mise à jour du seed (`ILLUSTRATIVE → CONFIRMED` + mise à jour des coordonnées).
- **Pattern généralisable** : applicable à d'autres sources (MétéoSuisse SwissMetNet, GLAMOS glaciers) sans refonte — une provenance typée par entité.
- **Migration prod-safe** : additive (`ALTER TABLE ADD COLUMN NOT NULL DEFAULT 'ILLUSTRATIVE'`). Aucun `DROP`, aucun `NULL` sur données existantes.

### Négatives

- **Surface UI légèrement augmentée** : +1 atom (~50 lignes Vue + CSS), +1 rangée dans chaque carte research. Acceptable — gain d'information > coût visuel.
- **Cohérence à maintenir** : tout ajout de station dans le seed demande de statuer explicitement sur le sourcingStatus. Mitigation : le champ est `NOT NULL` au niveau Prisma, forçant la décision au moment du seed.

### Trade-offs assumés

- **Sourcing des cartes research dans `fr.json`, pas dans le store Pinia**. La section landing utilise aujourd'hui `useI18nList<ResearchStation>('researchZones.stations')` — données statiques dupliquées avec le seed DB. La source de vérité reste la DB ; l'i18n est un reflet figé. Brancher la section sur `useStationsStore` est une dette post-candidature (scope v2). Acceptable pour v1 : les 3 research cards ne changent pas en production, et leur contenu (`name`, `river`, `context`) relève plus du storytelling que de la donnée live.
- **Palette Tailwind default (`emerald-*`) pour la variante CONFIRMED**. Le projet réserve les tokens custom (`primary`, `alpine`, `glacier`, `slate-alpi`, `graphite`) à la narration métier ; le token `alpine` est déjà alloué au signal RESEARCH. Introduire un token `success` dans `tailwind.config.ts` pour un usage unique serait disproportionné (cf. ADR-002 sur le parti-pris ABEM et la parcimonie des tokens). Tailwind emerald defaults suffit visuellement et reste orthogonal aux signaux existants.
- **Tooltip pur CSS sans lib**. Pas de `floating-ui`, pas de `@headlessui/vue`. Le placement statique au-dessus du badge est acceptable pour un layout non-scrollable où le badge est toujours en bas de carte. Si la surface s'étend (tableaux, grilles denses), basculer vers une lib de positionnement sera justifié — pas avant.

## Alternatives écartées

### Ne rien faire

- **Risque** : imprécision factuelle détectable par un relecteur CREALP, lit comme du désinvolte.
- **Coût évité** : zéro — mais coût caché en entretien potentiel.

### Supprimer les deux stations non confirmées (Les Haudères, Evolène)

- **Perte narrative** : le maillage à 3 stations sur la Borgne sert la démonstration "réseau cantonal CREALP au-delà du fédéral". Avec 1 seule station, la narration s'effondre.
- **Gain** : zéro risque factuel.
- **Verdict** : sacrifier le storytelling pour un risque modéré est un mauvais arbitrage dans un livrable candidature dont l'angle raconté est central.

### Rechercher les 20 stations réelles du réseau cantonal CREALP

- **Voies possibles** : portail Web Hydro CREALP, rapports d'activité annuels PDF, contact direct avec Eric Travaglini (chef de projet hydrométrie).
- **Coût** : 4 à 8h de recherche, issue incertaine. Certaines données peuvent être sur accès restreint.
- **Verdict** : DEFERRED (backlog post-candidature). Trop risqué comme investissement dans la fenêtre restante (J13 / deadline 2026-04-30).

### Conversion camelCase dans le DTO API (`'confirmed' | 'illustrative'`)

- **Bénéfice** : libellés plus "UI-friendly" côté frontend.
- **Coût** : création d'une singularité — `dataSource: 'LIVE'` cohabiterait avec `sourcingStatus: 'confirmed'` dans le même DTO. Impossible à défendre en entretien.
- **Verdict** : rejeté en faveur du verbatim SCREAMING_SNAKE_CASE. Le mapping libellé FR est concentré dans `ASourcingBadge` via i18n.

## Références

- [crealp.ch/monitoring-des-eaux-de-surface](https://www.crealp.ch/monitoring-des-eaux-de-surface/) — page projet publique, source principale de l'audit
- `docs/context/crealp-stations-sourcing.md` — audit factuel détaillé par station (équipements, coordonnées, plausibilité)
- `apps/api/prisma/migrations/20260422141207_add_station_sourcing_status/migration.sql` — migration additive
- `apps/web/src/components/atoms/ASourcingBadge.vue` — implémentation UI
- ADR-002 — parti-pris ABEM et parcimonie des tokens Tailwind
- ADR-007 — `DataSource` (`LIVE` / `RESEARCH` / `SEED`), sur lequel `SourcingStatus` est orthogonal
