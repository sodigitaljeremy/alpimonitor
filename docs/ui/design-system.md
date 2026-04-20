# UI Design System

> Ce document définit la **langue visuelle** et les **conventions de composants** d'AlpiMonitor.
> Référence opérationnelle pour tout développement UI.

## 1. Principes visuels

AlpiMonitor s'adresse à un public technique (hydrologues, ingénieurs, chercheurs) dans un contexte institutionnel (fondation publique). La langue visuelle cible :

- **Sobriété** : pas de décoration gratuite, focus sur la lisibilité des données
- **Crédibilité scientifique** : typo neutre, palette restreinte, pas d'effets gratuits
- **Ancrage alpin** : nuances de gris-bleu évoquant la glace et la roche, accents naturels pour les états
- **Accessibilité** : contrastes élevés, focus très visible, états explicites

Référence d'inspiration : sites institutionnels suisses (admin.ch, swisstopo), sites scientifiques (NASA Earth Data, Copernicus) — sobriété et densité d'information maîtrisée.

## 2. Tokens Tailwind

La configuration Tailwind utilisée s'appuie sur les palettes natives avec quelques extensions sémantiques. Le fichier `tailwind.config.ts` exposera :

### 2.1 Couleurs

Palette primaire : **slate + sky**.

Rôles sémantiques :

| Rôle | Token | Couleur Tailwind |
|---|---|---|
| Primaire | `primary` | `sky-600` |
| Primaire foncé (hover) | `primary-hover` | `sky-700` |
| Secondaire | `secondary` | `slate-200` |
| Texte principal | `text-base` | `slate-900` |
| Texte secondaire | `text-muted` | `slate-600` |
| Fond principal | `surface` | `white` |
| Fond alternatif | `surface-alt` | `slate-50` |
| Bordure standard | `border-base` | `slate-200` |
| Bordure forte | `border-strong` | `slate-300` |

### 2.2 Couleurs d'état (status)

Utilisées pour les states de stations, alertes, badges :

| État | Token | Fond | Texte | Bordure |
|---|---|---|---|---|
| Normal | `status-normal` | `emerald-50` | `emerald-800` | `emerald-200` |
| Vigilance | `status-vigilance` | `amber-50` | `amber-800` | `amber-300` |
| Alerte | `status-alert` | `red-50` | `red-800` | `red-300` |
| Offline | `status-offline` | `slate-100` | `slate-600` | `slate-300` |
| Info | `status-info` | `sky-50` | `sky-800` | `sky-200` |

Règle d'or : **jamais de couleur seule pour communiquer un état**. Toujours doublé par une icône et/ou un texte.

### 2.3 Typographie

- **Famille** : Inter (via Google Fonts self-hosted) pour tout le texte
- **Familie monospace** : JetBrains Mono pour les codes, timestamps, valeurs numériques techniques
- **Échelle modulaire** : 12 / 14 / 16 / 18 / 20 / 24 / 30 / 36 (px), accessible via `text-xs` à `text-4xl`
- **Weights** : 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- **Line-height** : 1.5 pour body, 1.2 pour titres

### 2.4 Espacements

Échelle Tailwind native : multiples de 4px (0.25rem). Usage recommandé :
- Entre sections : `py-12` (48px)
- Entre blocs : `gap-6` (24px)
- Entre éléments d'un bloc : `gap-3` (12px)
- Padding interne de cards : `p-4` ou `p-6` selon taille

### 2.5 Rayons et ombres

- `rounded-md` (6px) : boutons, inputs
- `rounded-lg` (8px) : cards
- `rounded-full` : badges, markers, avatars
- `shadow-sm` : éléments surélevés subtilement
- `shadow-md` : cards importantes, modales
- Pas de `shadow-xl` ou extrêmes — on reste sobre

### 2.6 Breakpoints

Standards Tailwind : `sm:640` `md:768` `lg:1024` `xl:1280` `2xl:1536`.

Stratégie : **desktop-first dans la pensée, mobile-fonctionnel en exécution**. La carte et les charts sont optimisés pour desktop, mais tout reste lisible ≥ 375px de large.

## 3. Conventions de composants (Atomic Design + ABEM)

Rappel ADR-002 : préfixes `a-`, `m-`, `o-`, `t-`, `p-`.

### 3.1 Atomes (`a-`)

Unité non-décomposable, pas de logique métier, props primitives.

Inventaire v1 :

| Composant | Responsabilité |
|---|---|
| `AButton.vue` | Bouton, variants primary/secondary/ghost, sizes sm/md/lg |
| `ABadge.vue` | Badge coloré selon status (normal/vigilance/alert/offline) |
| `AIcon.vue` | Icône wrapper autour de Lucide Vue, tailles normalisées |
| `AInput.vue` | Input texte avec label, hint, error |
| `ASelect.vue` | Select natif stylé |
| `ACheckbox.vue` | Checkbox accessible |
| `ASpinner.vue` | Indicateur de chargement |
| `AStatusDot.vue` | Pastille de couleur pour un état (ne contient jamais texte seul) |
| `ALabel.vue` | Label stylé pour formulaires |
| `AHeading.vue` | H1 à H4 avec tailles cohérentes |

### 3.2 Molécules (`m-`)

Composition de plusieurs atomes, petite logique interne possible.

Inventaire v1 :

| Composant | Composition | Rôle |
|---|---|---|
| `MStationCard.vue` | Heading + Badge + métriques | Résumé d'une station en carte |
| `MStatMetric.vue` | Label + valeur numérique + unité + variation | Affichage d'une métrique |
| `MAlertBanner.vue` | Icon + texte + bouton close | Bandeau d'alerte active |
| `MThresholdBar.vue` | Range SVG avec zones colorées | Visualise seuils + valeur courante |
| `MFormField.vue` | Label + Input + hint/error | Champ complet |
| `MMapMarker.vue` | StatusDot + label optionnel | Marker Leaflet custom |
| `MEmptyState.vue` | Icon + titre + description + CTA | État vide d'une liste |
| `MErrorState.vue` | Icon + titre + message + retry | État d'erreur |
| `MDataSourceNote.vue` | Attribution + timestamp + source | Bloc "Source : OFEV, …" |

### 3.3 Organismes (`o-`)

Sections autonomes avec logique métier.

Inventaire v1 :

| Composant | Rôle |
|---|---|
| `OHeader.vue` | Header global (logo + nav + status global) |
| `OFooter.vue` | Footer (attribution OFEV + swisstopo + lien GitHub) |
| `OStationList.vue` | Liste/grille de StationCards, filtres intégrés |
| `OStationMap.vue` | Carte Leaflet + markers, synchronisée avec la liste |
| `OAlertPanel.vue` | Panneau alertes (filtres + liste paginée) |
| `OTimeSeriesChart.vue` | Chart D3 complet avec controls (range, brush) |
| `OComparisonPicker.vue` | Interface de sélection multi-stations |
| `OThresholdEditor.vue` | Éditeur de seuils (formulaire admin) |

### 3.4 Templates (`t-`)

Squelettes de mise en page sans contenu spécifique.

| Composant | Structure |
|---|---|
| `TMainLayout.vue` | Header + slot + Footer |
| `TSidebarLayout.vue` | Header + sidebar + main (pour admin) |

### 3.5 Pages (`p-`)

Routes. Orchestrent la récupération de data et passent aux organismes.

| Page | Route |
|---|---|
| `PHomePage.vue` | `/` — carte + liste |
| `PStationDetailPage.vue` | `/stations/:id` — fiche + charts |
| `PComparisonPage.vue` | `/compare` — multi-stations |
| `PAlertsPage.vue` | `/alerts` — liste alertes |
| `PAdminLoginPage.vue` | `/admin/login` |
| `PAdminThresholdsPage.vue` | `/admin/thresholds` |
| `PNotFoundPage.vue` | `/:pathMatch(.*)*` |

## 4. Comportement standard des états

Tout composant qui consomme une source async doit gérer explicitement :

- **Loading** : `ASpinner` dans le contexte, ou skeleton pour les cards
- **Error** : `MErrorState` avec retry
- **Empty** : `MEmptyState` avec CTA ou lien
- **Success** : rendu normal

Pas d'état non-géré, pas de "loading infini". Un composable `useAsyncState` standardisera ce pattern.

## 5. Accessibilité (check-list par composant)

Chaque composant développé doit cocher :

- [ ] Fonctionne au clavier seul (tab, enter, espace, flèches si applicable)
- [ ] Focus visible respecté (outline Tailwind par défaut + overrides)
- [ ] `aria-*` présent si état dynamique (`aria-expanded`, `aria-selected`, `aria-busy`)
- [ ] `role` explicite si pas sémantique natif (`role="status"`, `role="alert"`)
- [ ] Texte alternatif pour tout contenu non-texte
- [ ] Contraste ≥ 4.5:1 (ou 3:1 si texte ≥ 18px bold)
- [ ] Testé avec lecteur d'écran (au moins une fois pour les composants clés)

## 6. Iconographie

**Librairie** : Lucide Vue (`lucide-vue-next`). Cohérente, open source, bien couverte.

Ne pas mélanger avec d'autres sets d'icônes. Si une icône manque : demander / créer custom en SVG inline dans `a-icon`.

### Icônes standards utilisées

| Contexte | Icône Lucide |
|---|---|
| Info | `Info` |
| Vigilance | `AlertTriangle` |
| Alerte | `AlertOctagon` |
| Offline | `PlugZap` |
| Station | `MapPin` |
| Rivière | `Waves` |
| Glacier | `Mountain` |
| Captage | `Droplets` |
| Chart | `LineChart` |
| Admin | `Settings` |
| Logout | `LogOut` |

## 7. Animation et mouvement

Minimal et fonctionnel :
- Transitions de couleur sur hover : `transition-colors duration-150`
- Transitions de taille sur toggle : `transition-all duration-200`
- Pas d'animation d'entrée de page (respecte `prefers-reduced-motion`)
- Pas de parallax, pas de scroll-jacking

Respecte systématiquement `@media (prefers-reduced-motion)` : toute animation doit avoir un fallback statique.

## 8. Checklist qualité avant merge d'un composant

- [ ] Respecte la convention ABEM (préfixe + structure des classes)
- [ ] Utilise `@apply` Tailwind dans `<style scoped>`, pas de style inline magique
- [ ] Props typés strictement (TS), defaults explicites
- [ ] Émissions (`emits`) déclarées
- [ ] Gère loading / error / empty si applicable
- [ ] A11y check-list (§ 5) cochée
- [ ] Au moins un test unitaire (Vitest) si logique non-triviale
- [ ] Visuellement vérifié à 375 / 768 / 1440 px
- [ ] Pas de console.log qui traîne
