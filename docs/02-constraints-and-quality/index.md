# §2 — Contraintes et exigences qualité

Fusion des sections arc42 §2 *Constraints* et §10 *Quality requirements* — elles se chevauchent trop à notre échelle pour justifier deux pages distinctes.

## 2.1 Contraintes techniques

| Contrainte | Source | Implication |
|-----------|--------|-------------|
| **Stack TypeScript unique** (pas de Python, pas de FastAPI, pas de ML/IA) | [ADR-001](../09-architectural-decisions/adr-001.md), annonce CREALP | Un seul langage côté code produit, une seule toolchain `pnpm`. Simplifie l'onboarding mais renonce à l'écosystème data science. |
| **Vue 3 + Vite + Tailwind** (imposés par l'annonce) | Annonce CREALP, [ADR-001](../09-architectural-decisions/adr-001.md) | Pas de React/Svelte/Angular. Pinia comme store ([ADR-010](../09-architectural-decisions/adr-010.md) pour le pattern façade). |
| **Atomic Design ABEM strict** | Annonce CREALP, [ADR-002](../09-architectural-decisions/adr-002.md) | Préfixes `a-` / `m-` / `o-` / `t-` / `p-` sur 100 % des composants Vue. Vérifié manuellement lors des revues (pas de lint custom). |
| **Fastify + Prisma** côté backend | [ADR-003](../09-architectural-decisions/adr-003.md), [ADR-004](../09-architectural-decisions/adr-004.md) | Monolithe API + cron ingestion dans le même runtime Node 20. Pas de microservices. |
| **Pas de Vue Flow, pas de 3D, pas de photogrammétrie** | Annonce CREALP (non-goals implicites), positionnement vs 3DGEOWEB | Protège le périmètre vs cœur de produit CREALP. Vue Flow reporté backlog v2. |
| **Lecture seule, pas d'authentification** | [§1 objectif G1 densité](../01-introduction-and-goals/index.md), [ADR-003](../09-architectural-decisions/adr-003.md) | Aucune page protégée. Épopée admin (JWT + bcrypt + CRUD thresholds) explicitement hors scope v1. |

## 2.2 Contraintes organisationnelles

- **Deadline candidature 2026-04-30** — calibre tout le scope. Toute feature nécessitant plus de 2 jours de dev est challengée vs ROI signal. Les décisions de recentrage sont tracées dans le PRD et les ADR.
- **Monorepo pnpm + Turborepo** — 3 workspaces : `apps/web`, `apps/api`, `packages/shared` (types + schémas Zod partagés). Un seul `pnpm install` à la racine.
- **Self-hosting Coolify** — pas de Vercel/Netlify/Fly. Infrastructure unique : VPS Hetzner + Coolify v4 + Traefik + Let's Encrypt. Cohérent avec l'esprit "sobre" CREALP.
- **Conventional commits en anglais** — les messages commit suivent `type(scope): summary`. Facilite la lecture `git log` par un relecteur. Règle d'engagement 6 de `CLAUDE.md`.
- **Atomic commits obligatoires** — un commit = un sous-livrable testable. Pas d'accumulation multi-phases dans le working tree.

## 2.3 Exigences qualité (quality tree arc42)

Priorité descendante. Chaque exigence a un critère vérifiable — pas d'adjectif sans mesure.

| Priorité | Exigence | Critère vérifiable |
|----------|----------|---------------------|
| 1 | **Lisibilité recruteur < 30 s** | Un relecteur technique sans brief ouvre `alpimonitor.fr`, identifie le métier et le stack en moins de 30 s. README + hero page testés informellement en J13. |
| 2 | **Transparence factuelle** | Chaque décision structurante a une ADR. Les stations dont le sourcing n'est pas publiquement vérifiable sont explicitement marquées `ILLUSTRATIVE` ([ADR-008](../09-architectural-decisions/adr-008.md)). |
| 3 | **Stabilité prod** | 3 incidents rencontrés, 3 post-mortems écrits ([§7](../07-deployment-view/post-mortems/index.md)). Depuis J14, uptime 100 % sur les 3 sous-domaines. |
| 4 | **Testabilité** | 173 tests verts (71 API + 102 web). Pyramide : fonctions pures → composables → intégration. Règle façade enforced par grep ([ADR-010](../09-architectural-decisions/adr-010.md)). |
| 5 | **Performance** | Lighthouse prod **Desktop 96/100/100/100**, **Mobile 93/100/96/100**. Bundle web 382 kB js / 129 kB gzip — au-dessus de la cible initiale 300 kB, acceptable (Leaflet + D3 dominent, code-split reporté v2). |
| 6 | **Accessibilité** | WCAG AA contrastes validés sur sections sombres, focus visible, `aria-label` drawer, scroll-lock, Escape-fermeture. Lighthouse a11y 100/100 Desktop et Mobile. Audit axe-core informel passé. |
| 7 | **Sécurité** | 6 headers nginx (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, COOP). CORS allowlist. Container non-root. Zod sur tous les endpoints. Helmet + rate-limit API reportés post-candidature. |
| 8 | **Observabilité minimale** | Pino JSON stdout, `/api/v1/health` avec probe DB, `/api/v1/status` expose `IngestionRun.lastRun` + `lastSuccessAt` + compteurs journée. Pas d'APM ni tracing distribué en v1. |

Les exigences 1 et 2 sont **non-négociables** ; 3-5 sont **tenues shipped** ; 6-8 sont **tenues à un niveau défendable** avec reste-à-faire tracé dans [§10](../10-risks-and-debt/index.md).

## 2.4 Règles d'engagement (résumé)

Les 8 règles absolues du projet, extraites de `CLAUDE.md` — voir [§8 Conventions](../08-cross-cutting-concepts/conventions.md) pour le détail opérationnel :

1. Lire les docs avant d'agir — jamais de code sans contexte.
2. YAGNI dur — ne pas implémenter ce qui n'est pas demandé.
3. ABEM strictement appliqué (préfixes + ADR-002).
4. Aucune dépendance ajoutée sans justification commit ou ADR.
5. Tests avant commit.
6. Conventional commits en anglais.
7. Pas de Python, pas d'IA embarquée, pas de Vue Flow en v1.
8. L'auteur humain doit pouvoir défendre chaque ligne en entretien.

Ces règles cadrent toutes les décisions tracées dans les ADR et la doc architecturale. Elles sont citées pour référence uniquement — ne pas les dupliquer ailleurs.
