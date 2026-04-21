# UI Design System

> Ce document définit la **langue visuelle** et les **conventions de composants** d'AlpiMonitor.
> Il décrit l'état réel du code dans `apps/web/` — toute dérive entre ce document et l'implémentation doit être corrigée dans le même commit que la modification.

## 1. Principes visuels

AlpiMonitor s'adresse à un public technique (hydrologues, ingénieurs, chercheurs) dans un contexte institutionnel (fondation publique). La langue visuelle cible :

- **Sobriété** : pas de décoration gratuite, focus sur la lisibilité des données
- **Crédibilité scientifique** : typo neutre, palette restreinte, pas d'effets gratuits
- **Ancrage alpin** : gris-bleu évoquant la glace et la roche, jaune alpin pour les accents chauds
- **Accessibilité** : contrastes élevés, focus visible, états explicites

Références d'inspiration : sites institutionnels suisses (admin.ch, swisstopo), sites scientifiques (NASA Earth Data, Copernicus) — sobriété et densité d'information maîtrisée.

## 2. Tokens Tailwind

La source de vérité est `apps/web/tailwind.config.ts`. Ce document en est le miroir commenté.

### 2.1 Couleurs

Palette custom "alpine" (pas de tints générés), chaque token exprime un rôle sémantique ou visuel.

| Token | Valeur | Usage |
|---|---|---|
| `primary` | `#0F2847` | Texte de titres, actions, marqueurs de stations fédérales |
| `primary-hover` | `#1A3B66` | État hover des liens / boutons primaires |
| `glacier` | `#F4F8FB` | Fond principal des sections claires (hero, WhyLindas) |
| `glacier-soft` | `#ECF2F7` | Fond alternatif (section KeyMetrics) |
| `slate-alpi` | `#5C6B7A` | Texte secondaire, légendes, bordures subtiles (`/20`, `/15`) |
| `alpine` | `#F4C542` | Accent chaud — marqueurs de zones de recherche, URIs en code |
| `alpine-soft` | `#FBE9AD` | Réserve pour halos / backgrounds d'accent (non utilisé v1) |
| `graphite` | `#2C3640` | Fond des sections sombres (ResearchZones), texte sur fond clair |
| `graphite-strong` | `#1C242C` | Réserve pour variantes plus denses |

**Note sur `slate-alpi`** : le suffixe `-alpi` évite la collision avec la palette Tailwind native `slate-*`. Tailwind accepte une sous-clé personnalisée sous `slate`, ce qui donne la classe `text-slate-alpi` sans masquer `slate-50..900` si on en a besoin plus tard.

### 2.2 États (status)

Utilisés par `MStatusBadge` et `ABadge`. Pas de palette `emerald / amber / red` dans v1 : les états visibles actuellement sont des états de flux de données, pas des seuils hydrologiques.

| État | Token composé | Usage |
|---|---|---|
| `live` | bordure `primary/20`, texte `primary`, dot `primary` + `shadow-glow-primary` | Flux BAFU en direct |
| `stale` | bordure `alpine/40`, texte `graphite`, dot `alpine` | Données datées (ingestion retardée) |
| `offline` | bordure `slate-alpi/40`, texte `slate-alpi`, dot `slate-alpi` | Flux indisponible |

Règle d'or : **jamais de couleur seule pour communiquer un état**. Toujours doublé par le libellé textuel (`aria-live` où pertinent).

### 2.3 Typographie

- **Famille** : Inter (Google Fonts, préchargé via `<link rel="preconnect">` dans `index.html`)
- **Famille monospace** : JetBrains Mono (même canal) pour timestamps, codes SPARQL, eyebrows techniques
- **Échelle utilisée** : `text-xs` à `text-7xl`. Le hero (`OHeroSection`) est volontairement hors-échelle avec `text-5xl md:text-7xl` pour porter le titre d'entrée ; le reste du produit reste à `text-4xl` max.
- **Weights** : 400, 500, 600
- **Line-height** : `leading-relaxed` pour les blocs de prose, `leading-tight` pour les titres

### 2.4 Espacements

Échelle Tailwind native (multiples de 4px). Conventions observées dans le code :
- Entre sections : `py-16 md:py-24` (landing)
- Entre blocs d'une section : `gap-8` à `gap-10`
- Padding interne de cards : `p-5`
- Container max width : `max-w-5xl` (sections texte + code) ou `max-w-6xl` (sections larges avec grille)

### 2.5 Rayons et ombres

Rayons natifs Tailwind :
- `rounded-md` (6px) : boutons, badges rectangulaires, legend du map
- `rounded-lg` (8px) : cards, frame du map
- `rounded-full` : dots de status, badges pill

Ombres — **tokens custom définis dans `tailwind.config.ts`** pour éviter les `rgba` bruts en composant :
- `shadow-card` : surface légèrement surélevée (cards, frame, footer-like)
- `shadow-glow-primary` : halo 3px autour d'un élément actif (focus `primary/12`)

### 2.6 Breakpoints

Standards Tailwind : `sm:640` `md:768` `lg:1024` `xl:1280` `2xl:1536`.

Stratégie : **desktop-first dans la pensée, lisible ≥ 375px en exécution**. Deux points de bascule critiques testés v1 :
- Hero : `justify-start md:justify-end` pour le status badge (évite le dead-space à 375px)
- Map legend : `bottom-4 left-4 sm:bottom-auto sm:top-4 sm:right-4` (évite le chevauchement dans la frame 327px)

## 3. Conventions de composants (Atomic Design + ABEM)

Rappel ADR-002 : préfixes `a-`, `m-`, `o-`, `t-`, `p-`.

### 3.1 Atomes (`a-`) — implémentés

| Composant | Responsabilité |
|---|---|
| `AButton.vue` | Bouton avec variants `primary / secondary / ghost` |
| `ABadge.vue` | Badge coloré selon `variant` (`live / research / neutral`) |
| `AIcon.vue` | Dictionnaire SVG inline typé (`station / clock / chart / signal / arrow-down / external / github / linkedin`) |
| `ANumericValue.vue` | Valeur numérique + unité optionnelle, typo mono |

### 3.2 Molécules (`m-`) — implémentées

| Composant | Composition | Rôle |
|---|---|---|
| `MStatusBadge.vue` | Dot + label | Indicateur d'état de flux (`live / stale / offline`) |
| `MSectionHeader.vue` | Eyebrow + `<h2>` + subtitle, prop `headingId` **requis** pour `aria-labelledby` | Titre de section réutilisable |
| `MStatCard.vue` | Icon + label + valeur + hint | Carte KPI (KeyMetrics) |
| `MStationCard.vue` | Badge + nom + rivière + contexte, props `kind` × `theme` orthogonaux | Carte de station, porte son propre thème (`light` / `dark`) |

**Note architecturale sur `MStationCard`** : `kind` (`federal / research`) et `theme` (`light / dark`) sont orthogonaux — la molécule ne suppose pas la couleur de fond de son parent. Voir les compound selectors dans le scoped style pour les 4 variantes.

### 3.3 Organismes (`o-`) — implémentés

Scope v1 : landing scroll-based, 6 sections.

| Composant | Rôle |
|---|---|
| `OHeroSection.vue` | Hero plein écran : status, eyebrow, titre, intro, scroll-hint, silhouette montagne SVG |
| `OMapSection.vue` | Frame carte (placeholder 70vh v1, Leaflet en Temps 2) + légende flottante |
| `OKeyMetricsSection.vue` | Grille 4 cartes KPI sur fond `glacier-soft` |
| `OWhyLindasSection.vue` | Explication du pivot XML → LINDAS + snippet SPARQL tokenisé |
| `OResearchZonesSection.vue` | Fond `graphite` (dark), prose + grille de `MStationCard theme="dark"` |
| `OSiteFooter.vue` | Sources (BAFU / OSM / CREALP), liens (GitHub, ADR, LinkedIn placeholder), disclaimer, copyright |

### 3.4 Templates (`t-`) — implémentés

| Composant | Structure |
|---|---|
| `TDefaultLayout.vue` | `<main>` + `<OSiteFooter>` partagés ; toute page rendue dans ce template hérite du footer |

### 3.5 Pages (`p-`) — implémentées

| Page | Route |
|---|---|
| `PHomePage.vue` | `/` — orchestre les 6 organismes dans `TDefaultLayout` |

### 3.6 Hors scope v1 (candidature CREALP)

Volontairement non-implémentés dans la fenêtre des 13 jours. Les volumes d'inventaire du PRD (OStationList, OTimeSeriesChart, OComparisonPicker, PStationDetailPage, PAdminThresholdsPage, etc.) restent des cibles produit mais ne font pas partie du livrable de candidature. Ils seront ajoutés au design system au moment de leur implémentation effective.

## 4. Comportement standard des états

Tout composant qui consomme une source async doit gérer explicitement :

- **Loading** : skeleton ou `ASpinner` dans le contexte (pas encore nécessaire en v1 landing statique)
- **Error** : message d'erreur local avec retry
- **Empty** : état vide avec CTA ou lien
- **Success** : rendu normal

Pas d'état non-géré. Un composable `useAsyncState` sera standardisé avant Temps 2 (ingestion LINDAS côté client).

## 5. Accessibilité (check-list par composant)

Chaque composant développé doit cocher :

- [ ] Fonctionne au clavier seul (tab, enter, espace)
- [ ] Focus visible respecté (outline Tailwind par défaut + overrides)
- [ ] `aria-labelledby` sur chaque `<section>` pointe vers un `id` **réellement présent** dans le DOM
- [ ] `aria-*` présent si état dynamique (`aria-expanded`, `aria-selected`, `aria-busy`)
- [ ] `role` explicite si pas sémantique natif (`role="status"` pour les badges live)
- [ ] Texte alternatif pour tout contenu non-texte (`aria-hidden="true"` sur les décorations SVG)
- [ ] Contraste ≥ 4.5:1 (ou 3:1 si texte ≥ 18px bold)
- [ ] Aucun `href="#"` focusable — utiliser un `<span>` non-interactif tant que l'URL n'est pas connue

## 6. Iconographie

**Approche v1** : dictionnaire SVG **inline** dans `AIcon.vue`, typé par union littérale. Pas de dépendance runtime à une librairie d'icônes.

Justification :
- 8 icônes suffisent pour le landing (station, clock, chart, signal, arrow-down, external, github, linkedin)
- Évite ~40 kB gzip d'une librairie pour 8 glyphes
- Force la sobriété : ajouter une icône demande une PR, pas un import

Si le besoin dépasse ~15 icônes, passer à `lucide-vue-next` (évoqué dans ADR-002) — décision à documenter dans un nouvel ADR.

## 7. Animation et mouvement

Minimal et fonctionnel :
- Transitions de couleur sur hover : `transition-colors`
- Pas d'animation d'entrée de page
- Pas de parallax, pas de scroll-jacking

Respecte systématiquement `@media (prefers-reduced-motion: reduce)` : les transitions présentes dans `OHeroSection` sont désactivées sous cette préférence.

## 8. Checklist qualité avant merge d'un composant

- [ ] Respecte ABEM (préfixe + structure des classes)
- [ ] Utilise `@apply` Tailwind dans `<style scoped>` ; aucun `rgba(...)`, hex, ou longueur brute en CSS composant — tout passe par un token de `tailwind.config.ts`
- [ ] Props typés strictement (TS), defaults explicites via `withDefaults`
- [ ] Émissions (`emits`) déclarées
- [ ] Gère loading / error / empty si applicable
- [ ] A11y check-list (§ 5) cochée
- [ ] Au moins un test Vitest si logique non-triviale (composables, helpers)
- [ ] Visuellement vérifié à 375 / 768 / 1440 px
- [ ] Pas de `console.log`
