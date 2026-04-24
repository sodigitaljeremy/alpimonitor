# Post-mortems incidents

Trois incidents rencontrés en production, trois post-mortems écrits à chaud. Chaque document suit la structure **TL;DR / Timeline / Symptômes / Diagnostic / Résolution / Prévention / Lessons / Follow-ups** — format cohérent, référence pour les incidents futurs.

## Résumé des 3 incidents

- **[2026-04-21 — Production database found empty](2026-04-21.md)** — tables de contexte à zéro après un deploy, volume Postgres pourtant intact. Cause racine **indéterminée** après forensic (le Claude Code tooling a été disculpé par audit JSONL). Résolution : `entrypoint.sh` qui replay `prisma migrate deploy` + `prisma db seed` idempotent à chaque boot (`SEED_ON_BOOT=true`). Le système converge vers un état connu sur restart.
- **[2026-04-22 — 504 Gateway Timeout Traefik multi-homing](2026-04-22-traefik.md)** — un push documentaire déclenche un rebuild Coolify, le container web se monte sur deux réseaux Docker (auto + custom), Traefik sélectionne un backend non-déterministe entre rebuilds. Résolution : suppression du réseau custom dans `docker-compose.prod.yml`, Compose auto-crée `<project>_default` partagé avec Traefik.
- **[2026-04-22 — Archive EACCES silencieux](2026-04-22-eacces.md)** — named volume Docker provisionné en `root:root` au premier mount, container runtime en user non-root `app`, `mkdir` archive échoue silencieusement depuis 48 h (non-fatal dans le plugin). Résolution : `mkdir /app/var/lindas-archive && chown -R app:app /app/var` dans le Dockerfile avant `USER app`, volume renommé `-v2` pour forcer une provision neuve.

## Leçons transverses

Trois incidents, trois natures différentes. Deux patterns reviennent :

**Self-healing > forensic archaeology.** L'incident 2026-04-21 a mangé 30 min de forensic sans parvenir à identifier la commande exacte. La même fenêtre de temps investie dans un `entrypoint.sh` convergent a réglé le problème pour toutes les futures occurrences. Même discipline appliquée pour le post-mortem Traefik (suppression du piège à la racine) et EACCES (Dockerfile + renommage volume).

**Lire les logs post-deploy n'est jamais gratuit.** L'incident EACCES a été trouvé parce qu'on lisait les logs du deploy qui fixait l'incident Traefik. Deux minutes d'attention supplémentaire, un bug latent attrapé. Systématiser : après chaque swap prod, lire 30 s de logs en ambiance avant de déclarer le deploy OK.

Ces deux patterns sont consignés en mémoire auto du projet (`feedback_coolify_no_custom_network.md`, `feedback_nonroot_volume_ownership.md`) pour éviter de les ré-apprendre dans une future session.

## Follow-ups encore ouverts

- Volume orphelin `alpimonitor-prod_alpimonitor-lindas-archive` sur le VPS (vide, aucun impact fonctionnel, à `docker volume rm` quand la fenêtre le permet).
- Réseau orphelin `hto7…_alpimonitor-net` sur le VPS (aucun impact, à `docker network rm` quand la fenêtre le permet).
- `SEED_ON_BOOT=false` à activer si le projet quitte la phase démo (données opérationnelles à protéger).
- Remonter l'échec d'archive dans `/api/v1/status` comme compteur (cf. [§10 dette assumée](../../10-risks-and-debt/index.md)).
