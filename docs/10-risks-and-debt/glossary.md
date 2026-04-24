# Glossaire

Vocabulaire métier (hydrologie alpine, Valais) + technique (archi, conventions projet) + institutionnel (CREALP et ses produits). Ordre alphabétique, définition 1-2 phrases max.

## A

- **ABEM** — Atomic Design + convention de nommage BEM-like. Préfixes `a-` / `m-` / `o-` / `t-` / `p-` appliqués à 100 % des composants Vue d'AlpiMonitor. Voir [ADR-002](../09-architectural-decisions/adr-002.md).
- **ADR** — Architectural Decision Record. Format court (≤ 5 pages) documentant une décision structurante : contexte, choix, conséquences, alternatives écartées. 10 ADR dans ce projet ([§9](../09-architectural-decisions/index.md)).
- **Alpine** — couleur jaune (`#F4C542`) du design system, accent chaud évoquant les pâturages d'altitude. Utilisée pour les marqueurs RESEARCH et les tokens SPARQL URI.
- **arc42** — template de documentation architecturale en 12 sections, condensé ici en 10 (§2 fusionne Constraints + Quality, §10 fusionne Risks + Glossary). Source : [arc42.org](https://arc42.org).
- **ApiError** — union discriminée TypeScript `{ kind: 'network' | 'http' | 'parse', ... }` dans `lib/api-client.ts`. Force chaque consumer à nommer sa branche d'échec via le compilateur.

## B

- **BAFU** — Bundesamt für Umwelt, forme allemande. Nom officiel en français : [OFEV](#o).
- **Borgne** — rivière de ~21,5 km, affluent rive gauche du Rhône à Bramois, drainant le Val d'Hérens. Bassin versant cible d'AlpiMonitor.

## C

- **Catchment** — bassin versant. Entité Prisma qui regroupe plusieurs stations d'un même sous-bassin. Une seule instance aujourd'hui (`borgne`).
- **Composable** — fonction Vue 3 (nom commençant par `use*`) qui encapsule de la logique réactive réutilisable. Équivalent des React hooks.
- **CONFIRMED** — valeur `sourcingStatus` indiquant qu'une station est documentée publiquement sur une source vérifiable (page projet CREALP, graph LINDAS). Voir [ADR-008](../09-architectural-decisions/adr-008.md).
- **Coolify** — plateforme self-hosted de déploiement continu v4, alternative open-source à Vercel/Heroku. Orchestre les containers Docker via Traefik sur le VPS Hetzner.
- **CREALP** — Centre de recherche sur l'environnement alpin, fondation à but non lucratif créée en 1968 à Sion. Employeur ciblé par le livrable candidature.
- **CSF3** — Component Story Format 3, API de définition de stories Storybook v7+. Utilisée pour les 46 stories d'AlpiMonitor ([ADR-009](../09-architectural-decisions/adr-009.md)).

## D

- **D3** — librairie JavaScript de data visualization (`d3-scale`, `d3-shape`, `d3-time-format`). Utilisée en mode vanilla pour le chart 24 h ([ADR-006](../09-architectural-decisions/adr-006.md)).
- **Discharge** — débit en m³/s. Paramètre principal ingéré depuis LINDAS pour les 4 stations BAFU.
- **Dotation** — débit minimum maintenu en aval d'un captage, imposé par la loi suisse sur la protection des eaux (LEaux).

## F

- **Façade** — pattern composable read-only qui expose une surface limitée d'un store Pinia. 3 façades stations dans AlpiMonitor ([ADR-010](../09-architectural-decisions/adr-010.md)).
- **Fastify** — framework Node.js HTTP de l'API AlpiMonitor. Choisi pour sa vitesse et son plugin system explicite ([ADR-003](../09-architectural-decisions/adr-003.md)).
- **Ferpècle** — glacier du Val d'Hérens, point de départ de la Borgne de Ferpècle. Captage Grande Dixence en base (1896 m, ~60 M m³/an).

## G

- **Glacier** — masse de glace pérenne. Entités Prisma `Glacier` + jonction `StationGlacier` pour relier les stations aux glaciers qui les alimentent.
- **GLAMOS** — Glacier Monitoring Switzerland, réseau suisse de surveillance des glaciers. Source non utilisée en v1 (extension backlog v2).
- **Grande Dixence** — barrage-poids (285 m), plus haut du monde à sa catégorie. Opère un réseau de captage massif dans le Val d'Hérens ; la Borgne coule en régime **résiduel** en aval.
- **GUARDAVAL** — plateforme CREALP de publication des résultats du modèle MINERVE (prévisions de crues).

## H

- **Hydrodaten** — portail web BAFU des stations hydrologiques fédérales suisses. AlpiMonitor lie les stations `CONFIRMED` à leur page `hydrodaten.admin.ch/fr/<ofevCode>.html`.

## I

- **ILLUSTRATIVE** — valeur `sourcingStatus` indiquant qu'une station est plausible mais non confirmée publiquement. Parti-pris de transparence ([ADR-008](../09-architectural-decisions/adr-008.md)).
- **IngestionRun** — entité Prisma qui trace chaque tick du cron LINDAS (source, status, compteurs, durée). Lue par `/api/v1/status`.

## L

- **LINDAS** — plateforme Linked Data de la Confédération suisse. Endpoint SPARQL `lindas.admin.ch/query` consommé par AlpiMonitor ([ADR-007](../09-architectural-decisions/adr-007.md)).
- **LIVE** — valeur `dataSource` pour une station ingérée depuis LINDAS en temps réel (4 stations BAFU dans v1).

## M

- **MINERVE** — modèle hydrologique opéré 24/7 par CREALP pour le Service cantonal des Dangers Naturels. Prévisions de crues jusqu'à 10 jours. AlpiMonitor ne reproduit pas MINERVE.
- **Mont Miné** — glacier du Val d'Hérens, source de la Borgne de Ferpècle avec le glacier de Ferpècle.

## O

- **OFEV** — Office fédéral de l'environnement (`BAFU` en allemand). Opère le réseau national de stations hydrométriques et publie les données via Hydrodaten + LINDAS.
- **OpenStreetMap (OSM)** — projet de carte collaborative. AlpiMonitor utilise les tuiles `tile.openstreetmap.org` comme fond cartographique ([ADR-005](../09-architectural-decisions/adr-005.md) drift vs swisstopo).

## P

- **Pinia** — store management officiel Vue 3. AlpiMonitor utilise 2 stores singletons (`useStationsStore` via 3 façades, `useStatusStore` direct).
- **Prisma** — ORM TypeScript pour PostgreSQL. Schéma versionné, migrations additives, zéro SPARQL brut ([ADR-004](../09-architectural-decisions/adr-004.md)).
- **Post-mortem** — document court rédigé à chaud après un incident prod. 3 post-mortems dans AlpiMonitor ([§7](../07-deployment-view/post-mortems/index.md)).

## R

- **RESEARCH** — valeur `dataSource` pour une station du réseau cantonal CREALP non ingérée depuis LINDAS (3 stations Borgne dans v1).
- **Rhône** — fleuve valaisan principal, coule d'est en ouest depuis le glacier du Rhône jusqu'au Léman. 3 des 4 stations LIVE d'AlpiMonitor y sont installées.

## S

- **SEED** — valeur `dataSource` pour une station de démonstration sans source définie. Non utilisée en prod v1.
- **sourcingStatus** — champ Prisma/DTO distinguant `CONFIRMED` vs `ILLUSTRATIVE`. Orthogonal à `dataSource`.
- **SPARQL** — langage de requête RDF, utilisé pour interroger le graph `<https://lindas.admin.ch/foen/hydro>` via HTTP POST.
- **Storybook** — catalogue interactif de composants UI. AlpiMonitor en héberge un sur [storybook.alpimonitor.fr](https://storybook.alpimonitor.fr) ([ADR-009](../09-architectural-decisions/adr-009.md)).
- **Structurizr** — outil de modélisation C4 via DSL texte (`workspace.dsl`). Utilisé pour produire les 4 diagrammes C4 d'AlpiMonitor (phase 3 à venir).

## T

- **Traefik** — reverse proxy Docker-native. Géré par Coolify, assure TLS Let's Encrypt et routing par label sur les containers.

## V

- **Val d'Hérens** — vallée latérale du Valais, drainée par la Borgne. Instrumentée par le réseau cantonal CREALP (hors couverture BAFU).

## 3

- **3DGEOWEB** — plateforme photogrammétrique publique CREALP. Produit cœur de CREALP que AlpiMonitor n'empiète pas (zéro 3D, zéro photogrammétrie).
