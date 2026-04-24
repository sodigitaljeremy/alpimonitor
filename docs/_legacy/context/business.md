# Business Context

> Ce document explique **pour qui** et **pourquoi** ce projet existe.
> À lire en premier par tout contributeur (humain ou IA) avant d'écrire une ligne de code.

## Positionnement du projet

AlpiMonitor est un projet de démonstration technique (MVP) réalisé dans le cadre d'une candidature au poste de **Développeur·se Front-End (80-100 %) au CREALP** — Centre de recherche sur l'environnement alpin, basé à Sion (Valais, Suisse).

Ce n'est **pas** un produit commercial, ce n'est **pas** une tentative de concurrencer une plateforme existante de CREALP (comme 3DGEOWEB). C'est une preuve de compétence ciblée, contextualisée au métier du centre, livrée en 13 jours.

## L'organisation ciblée : CREALP

Fondation à but non lucratif créée en 1968 par le Canton du Valais et la Ville de Sion. Équipe de 11-50 personnes. Siège à Sion, à proximité du campus Energypolis de l'EPFL Valais.

Ses trois domaines d'expertise affichés :

1. **Gestion durable et intégrée des ressources en eau** — hydrologie, hydrogéologie
2. **Dangers naturels** — laves torrentielles, glissements de terrain, crues, avalanches
3. **Développement d'outils et de plateformes web** pour la gestion et la valorisation des données environnementales

CREALP joue un rôle de **structure relais** entre les institutions publiques (cantons, communes, Confédération), le monde académique (EPFL, universités) et les acteurs privés (bureaux d'études, industriels). Depuis 2025, elle est fondation formatrice reconnue (apprentissage).

Chiffre d'affaires annuel ~3 millions CHF (2024), en croissance vs. moyenne 10 ans à 2M. Répartition des revenus : 51 % monitoring environnemental, 40 % dangers naturels, 6 % géo-ressources, 1 % prestations IT, 2 % subventions. L'IT est donc un **support transverse** qui irrigue les piliers métier, pas un centre de coût autonome.

Leur plateforme phare publique : **3DGEOWEB** — accès à des données photogrammétriques aériennes (drones BVLOS + avions légers) pour la reconstruction 3D et l'analyse de dangers naturels.

Pour le détail des autres produits internes (MINERVE, GUARDAVAL), des projets scientifiques récents et du vocabulaire institutionnel, voir **[`internal-projects.md`](./internal-projects.md)** qui synthétise les rapports d'activité 2022-2024.

## L'équipe IT

L'équipe IT compte environ 5-6 personnes et a été restructurée en 2024. Composition connue :

- **Frédéric Etter** — Chef d'Équipe IT depuis août 2024. Profil dev issu d'une agence web locale (10+ ans d'expérience). C'est le contact recrutement de l'annonce, donc le décideur direct pour ce poste.
- **Aymeric Sarrasin** — Développeur full-stack
- **Mauro Bertoldi** — Analyste développeur
- **Eliot Jean** — Physicien-Informaticien (travaille sur ingestion et validation de données)
- **Dr Emmanuel Wyser** — Géoinformaticien
- **Dr Fernando Galan Moles** — Machine learning / IA

Implication pour la candidature : profil non-académique acceptable (Frédéric lui-même est un dev agence), ML déjà couvert en interne (ne pas surjouer cette carte), équipe récemment remaniée (ouverture à l'accueil de nouveaux profils).

## L'annonce visée

**Poste** : Développeur·se Front-End 80-100 %
**Lieu** : Sion
**Deadline de candidature** : 30 avril 2026
**Contact recrutement** : Frédéric Etter, +41 27 607 11 93

### Stack technique demandée (extrait annonce)

- HTML5, CSS3, TypeScript
- Vue.js + Vite
- API REST, Node.js avec Fastify
- Tailwind CSS
- Atomic Design
- Tests unitaires
- Méthodologie Agile (SCRUM)
- Appréciés : D3.js, Vue Flow (visualisation de données, interfaces interactives)

### Exigences profil

- CFC d'informaticien ou formation jugée équivalente (un CDA est acceptable)
- Min. 5 ans d'expérience front-end — **critère indicatif, pas bloquant si le reste du profil démontre une maîtrise équivalente**
- Français professionnel, anglais B2

### Ce que CREALP communique sur leur culture

Slogan de recrutement : « Envie de donner du sens à ton code ? »
Hashtags utilisés : #TechForGood #Frontend #Geosciences #Environnement
Conditions : horaires flexibles, télétravail, équilibre vie pro/privée, environnement inclusif.

## Le positionnement que le projet doit démontrer

Par ordre d'importance, AlpiMonitor doit prouver que son auteur :

1. **Maîtrise le stack demandé** (Vue 3 + Vite + TS + Tailwind + Fastify + tests)
2. **Comprend le domaine métier** (hydrologie alpine, Valais, enjeux CREALP)
3. **Applique des bonnes pratiques** (Atomic Design / ABEM, SOLID, DRY, KISS, YAGNI, tests, sécurité)
4. **Sait livrer bout en bout** (conception → dev → tests → déploiement → documentation)
5. **Pense en produit, pas seulement en code** (UX, accessibilité, performance)

## Non-goals explicites

Pour éviter la dispersion sur un sprint de 13 jours, le projet **n'inclut pas** :

- Python, FastAPI, ML/IA (stack TypeScript unique)
- Vue Flow (reporté en v2, justifié dans README)
- Storybook complet (nice-to-have, seulement si marge en fin de sprint)
- Cartographie 3D, photogrammétrie (c'est le cœur métier de 3DGEOWEB, on n'empiète pas)
- Authentification complexe (OAuth, SSO) — JWT simple suffit
- Multi-tenancy, i18n, thèmes multiples
- Microservices — monolithe Fastify

## Positionnement par rapport à 3DGEOWEB

3DGEOWEB = photogrammétrie 3D de sites géologiques (drones/avions).
AlpiMonitor = monitoring temps-réel et historique de stations hydrologiques.

**Les deux sont complémentaires, pas concurrents.** Le projet doit se présenter comme un outil qui pourrait coexister avec 3DGEOWEB dans l'écosystème CREALP, pas comme une tentative de le reproduire.

## Critères de succès

Le projet est un succès si, à sa livraison :

- L'application est déployée et accessible via une URL HTTPS
- Le code compile, les tests passent, le linter est vert
- Un lecteur non-technique peut comprendre l'intérêt métier en 30 secondes
- Un lecteur technique peut comprendre l'architecture en 5 minutes en lisant le README
- L'auteur peut défendre chaque décision technique en interview sans hésiter
