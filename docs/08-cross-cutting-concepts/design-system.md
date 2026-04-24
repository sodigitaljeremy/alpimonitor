# Design system

Langue visuelle et conventions de composants d'AlpiMonitor. Référence autoritative : `apps/web/tailwind.config.ts` + le catalogue Storybook live sur [`storybook.alpimonitor.fr`](https://storybook.alpimonitor.fr) ([ADR-009](../09-architectural-decisions/adr-009.md)).

## Principes visuels

- **Sobriété** — pas de décoration gratuite, focus sur la lisibilité des données.
- **Crédibilité scientifique** — typo neutre (Inter + JetBrains Mono), palette restreinte, pas d'effets gratuits.
- **Ancrage alpin** — gris-bleu évoquant la glace et la roche, jaune alpin pour les accents chauds.
- **Accessibilité** — contrastes élevés, focus visible, états explicites. WCAG AA contrasté sur sections sombres, Lighthouse a11y 100/100 Desktop + Mobile.

Références d'inspiration : sites institutionnels suisses (admin.ch, swisstopo), sites scientifiques sobres (NASA Earth Data, Copernicus).

## Tokens Tailwind

Palette custom "alpine" — chaque token exprime un rôle sémantique ou visuel. Pas de tints générés Tailwind (`primary-50..900`) pour forcer la parcimonie ([ADR-002](../09-architectural-decisions/adr-002.md)).

| Token | Valeur | Usage |
|-------|--------|-------|
| `primary` | `#0F2847` | Texte titres, actions, marqueurs LIVE |
| `primary-hover` | `#1A3B66` | Hover liens / boutons primaires |
| `glacier` | `#F4F8FB` | Fond principal sections claires |
| `glacier-soft` | `#ECF2F7` | Fond alternatif (KeyMetrics) |
| `slate-alpi` | `#5C6B7A` | Texte secondaire, bordures subtiles |
| `alpine` | `#F4C542` | Accent chaud — marqueurs RESEARCH, URIs SPARQL |
| `graphite` | `#2C3640` | Fond sections sombres (ResearchZones) |

Note : le suffixe `-alpi` sur `slate-alpi` évite la collision avec la palette Tailwind native `slate-*`.

## Typographie

- **Inter** (sans-serif) + **JetBrains Mono** (mono) — Google Fonts, préchargé via `<link rel="preconnect">`.
- **Échelle** `text-xs` à `text-7xl`. Hero volontairement hors-échelle (`text-5xl md:text-7xl`), reste du produit à `text-4xl` max.
- **Weights** 400 / 500 / 600. **Line-height** `leading-relaxed` pour prose, `leading-tight` pour titres.

## Atomic Design + ABEM

Préfixes obligatoires sur 100 % des composants ([ADR-002](../09-architectural-decisions/adr-002.md)) :

- `a-` **Atomes** — 5 implémentés : `ABadge`, `AButton`, `AIcon`, `ANumericValue`, `ASourcingBadge` (ce dernier ajouté en [ADR-008](../09-architectural-decisions/adr-008.md)).
- `m-` **Molécules** — 4 implémentées : `MSectionHeader`, `MStatCard`, `MStationCard`, `MStatusBadge`.
- `o-` **Organismes** — 9 implémentés : `OHeroSection`, `OHydroChart`, `OKeyMetricsSection`, `OMapSection`, `OResearchZonesSection`, `OSiteFooter`, `OStationDrawer`, `OStationMap`, `OWhyLindasSection`.
- `t-` **Templates** — 1 implémenté : `TDefaultLayout` (main + footer partagés).
- `p-` **Pages** — 1 implémentée : `PHomePage` (route `/`).

## Storybook — scope et exclusions

15 composants présentationnels storyisés (46 stories). 3 organismes exclus du catalogue par décision explicite ([ADR-009](../09-architectural-decisions/adr-009.md)) :

- `OKeyMetricsSection` — couplage Pinia stations + status, coût de mock disproportionné.
- `OStationDrawer` — couplage Pinia + vue-router + focus trap + backdrop.
- `OStationMap` — dépendance Leaflet + ResizeObserver + CSS externe.

Pattern `seedStations` / `seedStatus` en decorator factory permet de storyiser `OHeroSection` et `OMapSection` (états Live / Stale / Offline / Loading / Error).

## Iconographie

Dictionnaire SVG inline dans `AIcon.vue`, typé par union littérale. 8 glyphes en v1 (`station`, `clock`, `chart`, `signal`, `arrow-down`, `external`, `github`, `linkedin`). Pas de lib runtime — ajouter une icône demande une PR explicite. Si le besoin dépasse ~15, passage à `lucide-vue-next` à documenter dans un nouvel ADR.

## Animation

Minimal et fonctionnel :

- Transitions de couleur hover via `transition-colors`.
- Pas d'animation d'entrée de page, pas de parallax, pas de scroll-jacking.
- Respecte `@media (prefers-reduced-motion: reduce)` — les transitions dans `OHeroSection` et `OStationDrawer` sont désactivées sous cette préférence.

## Checklist merge d'un composant

- Respecte ABEM (préfixe + structure des classes).
- Utilise `@apply` dans `<style scoped>` — zéro `rgba(...)` / hex / longueur brute hors `tailwind.config.ts`.
- Props typés strictement, defaults via `withDefaults`, emits déclarés.
- Gère loading / error / empty si async.
- A11y : clavier, focus visible, `aria-*` dynamique, contraste ≥ 4.5:1, pas de `href="#"` focusable.
- Au moins un test Vitest si logique non-triviale.
- Visuellement vérifié à 375 / 768 / 1440 px.
