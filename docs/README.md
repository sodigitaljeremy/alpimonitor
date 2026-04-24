# AlpiMonitor — Documentation site

Contenu de ce dossier rendu sur [docs.alpimonitor.fr](https://docs.alpimonitor.fr) via MkDocs + Material, structure **arc42 adaptée 10 sections** (voir `mkdocs.yml` à la racine pour la navigation).

## Preview local

Prérequis : Python 3.11+ et `pip`.

```bash
# Depuis la racine du repo
pip install -r requirements-docs.txt
mkdocs serve
```

Ouvre <http://localhost:8000> — hot-reload sur chaque fichier `.md` modifié.

## Build statique

```bash
mkdocs build -d site/
```

Sortie : `site/` (HTML + assets prêts à servir par n'importe quel serveur HTTP statique, voir [ADR-à-venir] Phase 4 pour le Dockerfile dédié).

## Structure arc42

| Section | Dossier | Contenu |
|---------|---------|---------|
| 1. Introduction et objectifs | `01-introduction-and-goals/` | Pourquoi AlpiMonitor, public cible, critères de succès |
| 2. Contraintes et qualité | `02-constraints-and-quality/` | Contraintes techniques, organisationnelles, exigences qualité |
| 3. Contexte et périmètre | `03-context-and-scope/` | C4-C1 (contexte système), sources de données externes |
| 4. Stratégie de solution | `04-solution-strategy/` | Décisions top-level (stack, monolithe, hébergement) |
| 5. Vue des blocs de construction | `05-building-block-view/` | C4-C2 + C3 (containers, composants), décomposition par couche |
| 6. Vue d'exécution | `06-runtime-view/` | Scénarios runtime critiques (ingestion cron, fetch UI, etc.) |
| 7. Vue de déploiement | `07-deployment-view/` | Coolify, Traefik, post-mortems incidents |
| 8. Concepts transverses | `08-cross-cutting-concepts/` | Design system, conventions, observabilité, sécurité |
| 9. Décisions architecturales | `09-architectural-decisions/` | Les 10 ADR du projet, index navigable |
| 10. Risques et dette | `10-risks-and-debt/` | Audit refactor, findings passe C, glossaire |

## Diagrammes (Diagrams-as-Code)

- **Mermaid** : inline dans les pages `.md`, rendu via `mkdocs-mermaid2-plugin`. Utilisation typique : flowcharts, sequence simples, diagrammes de déploiement légers.
- **PlantUML** : inline via bloc ```plantuml```, rendu par `mkdocs-kroki-plugin` qui POST vers `kroki.io`. Réservé aux sequence diagrams complexes.
- **C4 Structurizr** : workspace unique `assets/structurizr/workspace.dsl` + export SVG commité dans `assets/diagrams/`. 4 vues (Context, Containers, Components Frontend, Components Backend) rendues par le workflow ci-dessous.

### Regenerate C4 diagrams

Prérequis : Docker installé. Workflow en deux étapes, à lancer depuis la racine du repo :

```bash
# 1. DSL → 4 fichiers PlantUML/C4 (via structurizr/structurizr)
docker run --rm -u "$(id -u):$(id -g)" \
  -v "$(pwd)/docs/assets/structurizr:/ws" \
  structurizr/structurizr export \
  -w /ws/workspace.dsl -f plantuml/c4plantuml -o /ws

# 2. Chaque .puml → SVG (via plantuml/plantuml local, stdlib bundled)
docker run --rm -u "$(id -u):$(id -g)" \
  -v "$(pwd)/docs/assets/structurizr:/data" \
  plantuml/plantuml -tsvg -o /data /data/structurizr-*.puml

# 3. Déplacer les SVG vers docs/assets/diagrams/ (naming conventionnel)
mv docs/assets/structurizr/structurizr-Context.svg docs/assets/diagrams/c4-context.svg
mv docs/assets/structurizr/structurizr-Containers.svg docs/assets/diagrams/c4-containers.svg
mv docs/assets/structurizr/structurizr-Components-Frontend.svg docs/assets/diagrams/c4-components-frontend.svg
mv docs/assets/structurizr/structurizr-Components-Backend.svg docs/assets/diagrams/c4-components-backend.svg

# 4. Nettoyer les .puml intermédiaires (régénérables depuis workspace.dsl)
trash docs/assets/structurizr/structurizr-*.puml
```

Kroki.io a été testé pour ce rendu mais refuse les PlantUML stdlib `<C4/C4>` (HTTP 400). `plantuml/plantuml` local embarque la stdlib et rend proprement.

Auto-render via GitHub Action envisagé post-candidature (trigger sur changement de `workspace.dsl`, commit auto des 4 SVG).

### Décision Kroki : SaaS public plutôt que self-host

`mkdocs-kroki-plugin` pointe sur `kroki.io` (SaaS public). Trade-off assumé : chaque `mkdocs build` envoie le source des diagrammes PlantUML au service externe. Acceptable ici parce que (a) les diagrammes documentent une architecture publique sans donnée sensible, (b) le round-trip n'intervient qu'au build time (pas au runtime du site servi), (c) éviter un container Kroki self-hosté économise ~600 MB RAM sur le VPS Hetzner et simplifie la config Coolify. Pivot vers `yuzutech/kroki` self-hosté envisagé post-candidature si un besoin de souveraineté apparaît.

## Roadmap documentation

- **Phase 1** (en cours — ce commit) : squelette MkDocs + structure arc42 + stubs par section.
- **Phase 2** : migration du contenu existant (`docs/context/`, `docs/architecture/`, `docs/refactor/`, etc.) vers les sections arc42. Condensation, dédup, archivage des fichiers sources après validation.
- **Phase 3** : diagrammes (Structurizr C4 + Mermaid + PlantUML minimal).
- **Phase 4** : déploiement sur `docs.alpimonitor.fr` (Coolify + nginx + TLS).

## Convention d'édition

- Chaque fichier `.md` commence par un `# Titre H1` unique.
- Liens internes : chemins relatifs depuis la page courante (`../09-architectural-decisions/adr-007.md`).
- Liens vers le code : chemins relatifs depuis la racine repo (`../apps/web/src/lib/api-client.ts`) — MkDocs rewrite à l'émission.
- Liens externes : URLs absolues https://.
- Images / screenshots : `assets/screenshots/` ou `assets/diagrams/`, référencées par chemin relatif.

La source de vérité reste le code et les ADR. Cette documentation les orchestre, elle ne les remplace pas.
