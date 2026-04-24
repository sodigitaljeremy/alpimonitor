# §10 — Risques et dette technique

Fusion des sections arc42 §11 *Risks* et §12 *Glossary*. Rassemble les risques identifiés, la dette assumée documentée à chaque finding, le non-scope candidature explicitement écarté, et le [glossaire](glossary.md) des termes métier + tech du projet.

## 10.1 Risques identifiés

- **Flakiness d3 x-ticks cross-env** — le test `OHydroChart > drops from 3 x-ticks to 6 x-ticks` a rendu 3 ticks en local, 5 ticks sur le runner GitHub Actions (d3 heuristic non-déterministe cross-env). Hotfix `1013f04` (2026-04-23) relâche le bound absolu, garde uniquement le comparatif monotone `desktop > narrow`. Leçon tracée en mémoire projet `feedback_ci_feedback_loop`.
- **Dépendance externe `/ultrareview` pour la revue cloud** — le service a renvoyé 404/502 pendant 24 h au moment de la phase R8. Pivot vers une passe C locale équivalente en forme (findings structurés). Risque atténué mais non éliminé : pour toute phase future nécessitant une revue cloud, prévoir un plan B local.
- **DB prod vidée cause indéterminée** (incident 2026-04-21) — forensic complète n'a pas identifié la commande concrète. Risque : ré-occurrence possible. Atténuation : `entrypoint.sh` replay `prisma migrate deploy` + `prisma db seed` idempotent à chaque boot. Le système converge vers un état connu, peu importe l'événement déclencheur.
- **Gate `pnpm typecheck` silencieusement no-op depuis la migration Storybook** (découvert passe C J17) — le script `vue-tsc --noEmit` sans `-p/-b` exite 0 sans visiter aucun fichier sur un setup composite. 40 erreurs cachées pendant ~2 j. Fix `9439e43` force `--project tsconfig.app.json`. Leçon : **injecter une erreur volontaire pour prouver un gate**.

## 10.2 Dette assumée (connue et documentée)

Les findings tracés dans la passe C J17 ont été classés entre « fix avant merge » (appliqués dans R8) et « dette assumée tracée ». La seconde catégorie :

- **M3 — Pas de façade sur `useStatusStore`** — `OHeroSection` et `OKeyMetricsSection` importent le store directement. Règle de 3 non atteinte, 2 consumers à subset presque identique. Commentaire explicite en tête de `stores/status.ts` nomme le seuil de révision. Référence : [ADR-010 §Trade-offs](../09-architectural-decisions/adr-010.md).
- **M4 — Dualité tests `OStationDrawer` .vue + composable** — `OStationDrawer.test.ts` (mount-based, 149 lignes) + `useStationDrawer.test.ts` (composable-based, 177 lignes) testent des intents distincts mais chevauchent ~30 % d'assertions. Budget-doubled assumé : si régression, les deux suites cassent → deux signaux. Bascule "composable canonique + .vue smoke minimaliste" envisagée sans urgence.
- **m3 — `useScrollLock` single-consumer only** — si deux drawers montaient simultanément, le 2ᵉ capturerait `'hidden'` comme valeur initiale (posée par le 1er) et restaurerait incorrectement à la fermeture. Pratiquement N/A aujourd'hui (un seul drawer dans l'app) — commentaire en tête du composable nomme l'hypothèse et la solution (ref-count module-scoped) si multi-drawer apparait.
- **m4 — Skew `drawerNow` vs `fetchNow` < 1 s** — `useStationDrawer` snapshot `now` pour l'axe X chart, `store.fetchMeasurements` compute son propre `now`. Écart ~1 s en pratique, invisible à l'œil. Fix demanderait restructurer l'API `fetchMeasurements` — scope creep rejeté.
- **m5 — `VITE_API_BASE_URL` undefined silencieux** — si l'env var manque, `fetch('undefined/stations')` surface comme `{ kind: 'network' }`. POC-acceptable en dev, TODO commenté dans `lib/api-client.ts` pour throw at module load en prod.
- **`useI18nList` test fixture cast** — `LocaleMessageDictionary<VueMessageType>` vue-i18n 11 trop strict pour les payloads mixtes que le test injecte délibérément (edge cases). Cast scoped au boundary `createI18n` avec commentaire documentant le trade-off.
- **Archive EACCES non-fatal → silencieux** — le plugin ingestion logue `warn` en cas d'échec archive. Correct pour panne disque ponctuelle, insuffisant pour `EACCES` récurrent. Follow-up : seuil d'échecs consécutifs ou compteur dans `/status`.
- **Helmet + rate-limit API non wired** — défauts Fastify pour la démo read-only. À wirer pour prod réelle avec trafic public réel.
- **CI informative non-bloquante** — le merge sur `main` n'est pas gated par la CI GitHub Actions. Assumé en démo, à modifier en prod réelle.

Chaque entrée renvoie à un commit hash ou à un ADR qui la cadre. Aucune dette n'est orpheline.

## 10.3 Non-scope candidature (explicitement écarté)

Ces features font partie du PRD initial mais ont été intentionnellement exclues du livrable candidature. Leur absence est un parti-pris assumé, défendable en entretien en pointant cette section + l'ADR ou la ligne PRD associée.

- **Multi-pages** (`/stations/:id`, `/compare`, `/alerts`) — densité d'impression > dispersion, [ADR-003](../09-architectural-decisions/adr-003.md) + [§1.2 objectifs](../01-introduction-and-goals/index.md).
- **Admin UI + JWT + bcrypt** — lecture seule public par design, [ADR-003](../09-architectural-decisions/adr-003.md).
- **Alertes** (CRUD + détection moyenne mobile ±2σ) — dépend de seuils + cron d'évaluation + UI. Backlog v2.
- **Export CSV + brush/zoom D3** — backlog v2. Le chart 24 h est assez court pour une lecture directe.
- **E2E Playwright + Lighthouse formel** — budget dépassé. Vitest (173 tests) + audit axe-core informel ont suffi.
- **Python / FastAPI / ML / LLM embarqué** — stack TypeScript unique, [ADR-001](../09-architectural-decisions/adr-001.md).
- **Vue Flow, module 3D, photogrammétrie** — respect du territoire 3DGEOWEB. [§1.4 positionnement](../01-introduction-and-goals/index.md).
- **Multi-langue, OAuth, multi-tenant, microservices** — complexité sans gain signal. [ADR-003](../09-architectural-decisions/adr-003.md).
- **Sources alt** (MétéoSuisse SwissMetNet, GLAMOS temps réel) — [ADR-007 §Alternatives écartées](../09-architectural-decisions/adr-007.md).

## 10.4 Backlog post-candidature

Si le projet continue après le 2026-04-30 (embauche, portfolio vivant, continuation) :

- **Stations RESEARCH — passer `ILLUSTRATIVE` → `CONFIRMED`** après recherche dans les rapports d'activité CREALP ou via le portail Web Hydro. Pattern extensible, infrastructure prête ([ADR-008 §Évolution future](../09-architectural-decisions/adr-008.md)).
- **Adaptateur d'ingestion CREALP** — parser parallèle à `apps/api/src/ingestion/lindas/`, avec `IngestionSourceKind` propre dans l'enum Prisma.
- **Multi-source pattern** — étendre `SourcingStatus` aux glaciers (GLAMOS), captages (Grande Dixence SA). La mécanique est générique.
- **Alertes épopée complète** — schéma Prisma déjà en place (`Threshold`, `Alert`), UI + détection d'anomalies à construire.
- **Comparateur multi-stations** — page `/compare` avec overlays D3 sur 2-4 stations. Backlog v2 identifié PRD.
- **Helmet + rate-limit** côté API pour prod réelle.
- **Chromatic visual regression Storybook** — décision si Chromatic devient pertinent (budget + besoin d'une vraie discipline de review visuel).
- **CI bloquante sur merge `main`** avec `pnpm typecheck` réellement couvrant (post-C1).
- **Self-host `yuzutech/kroki`** pour cette doc si besoin de souveraineté sur les diagrammes.

## 10.5 Traces dédiées

- **[Audit refactor (condensé)](refactor-audit.md)** — les 10 hypothèses de dette pré-refactor, leur statut post-R1→R8, les patterns SkillSwap importés, les process learnings de la méthode d'audit elle-même.
- **[Findings passe C (verbatim)](passe-c-findings.md)** — 10 findings post-refactor (1 Critical / 4 Major / 5 Minor) + axes propres + synthèse. Trace de revue structurée conservée intacte.
- **[Glossaire](glossary.md)** — vocabulaire métier (hydrologie, Valais) + tech (arc42, ABEM, façade) + institutionnel (CREALP, MINERVE, 3DGEOWEB).
