# Legacy documentation structure

Ce dossier contient la structure documentaire pré-arc42, antérieure au 2026-04-24. Les fichiers ont été migrés dans les 10 sections arc42 de ce même repo (voir `docs/01-...` à `docs/10-...`) et le site rendu MkDocs.

Conservé pour :

- **Traçabilité git** — rename via `git mv`, historique préservé sans perte.
- **Archéologie** — le document source complet de l'audit refactor (`_legacy/refactor/audit.md`, 332 lignes) reste ici pour référence exhaustive. La version condensée post-R8 (92 lignes) vit sur le site arc42 sous `docs/10-risks-and-debt/refactor-audit.md`.
- **Référence des ADR 001-010** — mêmes fichiers, migrés verbatim vers `docs/09-architectural-decisions/`. L'original reste ici comme ancrage immuable.

Exclu du build MkDocs via `exclude_docs: _legacy/` dans `mkdocs.yml` — non servi sur [docs.alpimonitor.fr](https://docs.alpimonitor.fr).
