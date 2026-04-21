# ADR-007 — Source de données hydrologiques : LINDAS SPARQL

**Date** : 2026-04-20
**Statut** : Acceptée — implémentée
**Implémentation** : `733c8c3` (rédaction ADR), `df82f87` (`Station.dataSource` + `IngestionRun`), `1fe5d36` (discovery SPARQL + parser + seed idempotent), `10609b9` (cron 10 min + plugin ingestion). Observabilité via `/api/v1/status` (`755b3fb`) qui expose `ingestion.lastRun`.

## Contexte

La cible initiale d'ingestion, documentée dans `docs/context/data-sources.md` (première version, 2026-04-18), était le flux XML historique de l'OFEV :

```
https://www.hydrodaten.admin.ch/lhg/az/xml/hydroweb.xml
```

Ce document s'appuyait sur des sources tierces (bibliothèque `cstuder/parse-hydrodaten`) et notait explicitement que le format devait être validé contre le flux réel à l'implémentation.

Le script de discovery US-2.1 a révélé, en J3, deux surprises :

1. **L'endpoint XML documenté n'existe plus** : toutes les variantes (`/lhg/az/xml/*`, `/graphs/*.xml`, `/data/*.xml`, etc.) retournent HTTP 404. Le portail `hydrodaten.admin.ch` est désormais une SPA, et les fichiers XML publics ont été retirés. L'accès par fichier reste disponible **sur abonnement** (cf. `abonnementsdienst.pdf` de la BAFU) mais n'est pas gratuit.
2. **Il n'y a aucune station BAFU publique dans le bassin de la Borgne, sur la Dixence, ou sur les affluents du Val d'Hérens.** Ces cours d'eau sont instrumentés par Grande Dixence SA (privé) et par CREALP (recherche, non publié sur le réseau fédéral).

La page `/de/aktuelle-hydrologische-daten-beziehen` pointe vers trois canaux de substitution : SMS (payant), transfert de fichiers (abonnement payant), et **LINDAS** — le Linked Data Service du Bund — pour l'accès public gratuit.

## Décision

AlpiMonitor ingère les données hydrologiques BAFU via **LINDAS SPARQL** :

- **Endpoint** : `https://lindas.admin.ch/query` (SPARQL 1.1)
- **Graph** : `<https://lindas.admin.ch/foen/hydro>`
- **Payload** : 233 stations fédérales (rivières + lacs), observations les plus récentes, rafraîchies ~toutes les heures
- **Format** : JSON SPARQL results (`application/sparql-results+json`)

La bibliothèque d'ingestion est `undici` natif (fetch Node 20+) + parsing JSON standard. Aucun client SPARQL n'est ajouté au stack — les requêtes sont écrites en SPARQL string littéral, suffisamment simple pour ce POC.

En parallèle, les stations du bassin de la Borgne (Bramois, Les Haudères, Evolène) sont conservées dans le modèle avec un flag `dataSource = RESEARCH`, reflétant la réalité métier : ces stations existent dans le réseau CREALP mais ne sont pas exposées au public. L'intégration de leur flux sera un chantier hors scope v1.

## Conséquences

### Positives

- **Source officielle, stable** : LINDAS est un service pérenne du Bund, avec SLA implicite et gouvernance fédérale
- **Stack moderne** : démonstration de maîtrise d'une API Linked Data, différentiateur dans un contexte de candidature
- **Métadonnées enrichies** : coordonnées WGS84 (WKT), cours d'eau, niveau de danger (1-5), identifiants stables — tout en un seul graph
- **Cohérence narrative** : la distinction `LIVE` (BAFU Rhône) vs `RESEARCH` (Borgne CREALP) devient un angle d'interview — le candidat comprend ce que CREALP apporte de spécifique vs l'open data fédéral

### Négatives

- **Pas d'historique en open** : LINDAS n'expose que la dernière observation par station. Les séries temporelles > dernière heure nécessitent un abonnement payant ou un mécanisme interne d'accumulation (stockage des snapshots successifs en base, ce qui est précisément ce que fait notre cron d'ingestion 10-15 min)
- **Paramètres limités** : le graph `foen/hydro` couvre `waterLevel`, `discharge`, `dangerLevel`. Pas de température, turbidité, oxygène dans ce graph (ils vivent dans d'autres graphs ou ne sont pas exposés en open). Acceptable pour v1
- **Requêtes SPARQL à maintenir** : la syntaxe est moins familière que REST pour les contributeurs futurs. Mitigation : les requêtes sont isolées dans `apps/api/src/ingestion/lindas/`, courtes, commentées

### Neutres

- La contrainte "bassin de la Borgne" devient une contrainte **métier** (CREALP network), pas technique. Le seed reflète cette distinction explicitement via `dataSource`

## Alternatives écartées

### Abonnement BAFU SMS / File transfer

- **Coût** : payant
- **Délais** : contractualisation avec la BAFU, incompatible avec un POC à 13 jours
- **Format fermé** : pas de différenciateur technique

### Scraping de la SPA hydrodaten.admin.ch

- **Fragilité** : la BAFU peut changer sa SPA sans préavis, cassant l'ingestion
- **Éthique** : contourne l'intention officielle (LINDAS est le canal public désigné)
- **Rendu** : les contrôleurs Stimulus du bundle chargent des endpoints internes non documentés, sans garantie de stabilité

### Source canton du Valais ou CREALP 3dgeoweb

- **Risque métier** : 3dgeoweb est le produit existant de CREALP, marcher dessus dans une candidature est politiquement maladroit
- **Découverte additionnelle requise** : ajoute 0.5-1 jour d'exploration pour un gain incertain en v1

### Continuer avec le XML mort en local uniquement (fixtures)

- **Problème** : plus d'ingestion live, perd l'intérêt démonstratif du pipeline cron

## Références

- `apps/api/scripts/output/discovery-findings-2026-04-20.md` — transcription complète de la discovery
- Endpoint LINDAS : https://lindas.admin.ch/
- Page BAFU canaux d'accès : https://www.hydrodaten.admin.ch/de/aktuelle-hydrologische-daten-beziehen
- ADR-004 (Prisma) : la table `IngestionRun` introduite par cette ADR vit dans le même schéma Prisma
