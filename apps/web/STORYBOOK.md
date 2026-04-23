# Storybook — guide contributeur

Guide pratique pour ajouter ou modifier des stories dans AlpiMonitor. Pour la
philosophie du design system, lire la page **Design System > Introduction**
dans Storybook. Pour les décisions de scope (ce qui est storyisé et ce qui
est exclu), voir [ADR-009](https://github.com/sodigitaljeremy/alpimonitor/blob/main/docs/architecture/adr/009-storybook-scope.md).

## Commandes

| Intention                                        | Commande                                                                     |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| Dev server (hot-reload, port 6006)               | `pnpm --filter @alpimonitor/web storybook`                                   |
| Build statique dans `apps/web/storybook-static/` | `pnpm --filter @alpimonitor/web build-storybook`                             |
| Lint + typecheck + format                        | `pnpm lint && pnpm format:check && pnpm --filter @alpimonitor/web typecheck` |
| Production live                                  | <https://storybook.alpimonitor.fr>                                           |

Dans le monorepo, les commandes sont exposées au niveau `apps/web/` via le
`package.json` — le filter pnpm est optionnel si on travaille déjà dans le
dossier.

## Convention CSF3

Toutes les stories suivent le même squelette typé : `Meta<typeof Component>`
avec `satisfies`, `StoryObj<typeof meta>`, et `tags: ['autodocs']` pour
générer automatiquement la page Docs.

```ts
import MyComponent from './MyComponent.vue';

import type { Meta, StoryObj } from '@storybook/vue3-vite';

const meta = {
  title: 'Atoms/MyComponent',
  component: MyComponent,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['a', 'b'] },
  },
  args: {
    variant: 'a',
  },
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
```

Le `title` détermine la place du composant dans la sidebar (`Atoms/…`,
`Molecules/…`, `Organisms/…`). L'ordre des sections est piloté par
`storySort` dans `.storybook/preview.ts` — ne pas renommer les préfixes sans
mettre à jour cette liste.

## Patterns réutilisables

### Slot-via-arg — pour composants à slot par défaut

Utilisé dans `ABadge` et `AButton`. Permet au panneau Controls d'éditer le
contenu du slot en live.

```ts
args: { label: 'Badge label', variant: 'neutral' },
render: (args) => ({
  components: { ABadge },
  setup() { return { args }; },
  template: `<ABadge :variant="args.variant">{{ args.label }}</ABadge>`,
}),
```

### `globals.backgrounds.value` — pour composants dark theme

API Storybook 10. L'ancien `parameters.backgrounds.default` est accepté
silencieusement mais ne s'applique pas — utiliser `globals` au niveau Meta
ou par story.

```ts
const meta = {
  // ...
  globals: {
    backgrounds: { value: 'graphite' },
  },
} satisfies Meta<typeof MyDarkComponent>;
```

### `seedStatus` / `seedStations` factory — pour organisms Pinia-couplés

Utilisé dans `OHeroSection` et `OMapSection`. Le decorator patche l'état du
store _et_ remplace la méthode `fetchXxx` par un no-op pour empêcher le
polling `onMounted` d'écraser l'état seedé avec un échec réseau.

```ts
function seedStatus(patch: StatusPatch) {
  return (story: unknown) => ({
    components: { story },
    setup() {
      const store = useStatusStore();
      store.$patch(patch);
      store.fetchStatus = async () => {};
      return {};
    },
    template: '<story />',
  });
}

export const Live: Story = {
  decorators: [seedStatus({ hasLoadedOnce: true, lastSuccessAt: new Date() })],
};
```

Fonctionne parce que les méthodes Pinia composition-API sont des propriétés
réassignables sur l'instance proxy.

### Liens ADR en URL GitHub absolues

Dans les 5 pages MDX (`apps/web/src/stories/design-system/`), tout lien vers
une ADR doit utiliser une URL GitHub absolue :

```md
[ADR-002](https://github.com/sodigitaljeremy/alpimonitor/blob/main/docs/architecture/adr/002-abem-methodology.md)
```

Les chemins relatifs `../../../docs/...` marchent en dev (Vite résout) mais
cassent en `storybook-static/` servi par nginx — le dossier `docs/` n'est
pas copié dans l'image.

## Ajouter un composant — workflow

1. Créer le composant `.vue` dans `src/components/{atoms|molecules|organisms}/`.
2. Créer le fichier `<Component>.stories.ts` à côté, avec au minimum une
   story `Default` et 2-3 variants significatifs.
3. Vérifier le rendu sur `http://localhost:6006` (sidebar, canvas,
   Controls, onglet Accessibility).
4. Lancer les gates :

   ```bash
   pnpm format:check
   pnpm lint
   pnpm --filter @alpimonitor/web typecheck
   ```

5. Commit atomique — un composant + ses stories par commit. Le message
   suit la convention du projet (`feat(storybook): …`).

Si la story dépend d'un store Pinia ou d'un fetch réseau, réutiliser
le pattern `seedStatus` / `seedStations` plutôt que d'introduire MSW ou
autre mock infrastructure — la dette d'outillage est justifiée seulement
si trois composants ou plus en auraient besoin.

## Composants exclus

Trois organisms ne sont volontairement pas storyisés :

- `OKeyMetricsSection` — store + fetch live
- `OStationDrawer` — router + store + chart + focus trap
- `OStationMap` — Leaflet + ResizeObserver + CSS externe

Les raisons techniques détaillées et les alternatives écartées sont dans
[ADR-009](https://github.com/sodigitaljeremy/alpimonitor/blob/main/docs/architecture/adr/009-storybook-scope.md).
Ne pas storyiser ces composants sans relire l'ADR d'abord.

## Déploiement production

| Artefact                                            | Chemin                                                               |
| --------------------------------------------------- | -------------------------------------------------------------------- |
| Dockerfile dédié (multi-stage node 20 → nginx 1.27) | `apps/web/Dockerfile.storybook`                                      |
| Vhost nginx                                         | `apps/web/nginx-storybook.conf`                                      |
| CSP spécifique                                      | `apps/web/nginx-storybook-security-headers.conf`                     |
| Service Coolify                                     | Application dédiée (distincte de l'app principale, même VPS Hetzner) |
| Domaine                                             | <https://storybook.alpimonitor.fr>                                   |

La CSP Storybook dérive de celle de l'app principale avec deux dérogations
load-bearing : `frame-ancestors 'self'` (le manager embarque le preview en
iframe same-origin) et `script-src 'unsafe-eval'` (le preview compilé
évalue MDX et docgen via `Function()`). Toutes les autres directives
(HSTS, X-Frame-Options `SAMEORIGIN`, Referrer-Policy, COOP) matchent
exactement la posture du vhost principal.

Déploiement auto-triggered par Coolify sur push `main`.

## Liens

- [ADR-009](https://github.com/sodigitaljeremy/alpimonitor/blob/main/docs/architecture/adr/009-storybook-scope.md) — scope Storybook et exclusions
- [ADR-002](https://github.com/sodigitaljeremy/alpimonitor/blob/main/docs/architecture/adr/002-abem-methodology.md) — ABEM et parcimonie des tokens
- [ADR-008](https://github.com/sodigitaljeremy/alpimonitor/blob/main/docs/architecture/adr/008-station-sourcing-transparency.md) — sourcing transparency
- Production : <https://storybook.alpimonitor.fr>
