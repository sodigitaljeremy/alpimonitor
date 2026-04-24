# Internal Projects and Institutional Context

> Ce document synthétise les informations extraites des **rapports d'activité CREALP 2022, 2023 et 2024**.
> Source : rapports publics téléchargeables sur crealp.ch.
> Il complète `business.md` et `domain.md` sans les remplacer.

## 1. Sources de ce document

- [Rapport d'activités 2024](https://www.crealp.ch/wp-content/uploads/2025/10/Rapport-dactivites-2024.pdf)
- [Rapport d'activités 2023](https://www.crealp.ch/wp-content/uploads/2025/10/Rapport-dactivite-2023.pdf)
- [Rapport d'activités 2022](https://crealp.ch/wp-content/uploads/2023/07/RA2022-web.pdf)

Rédaction basée principalement sur l'analyse détaillée du rapport 2024.

## 2. Équipe IT et direction

### Direction générale

- **Raphaël Marclay** — Directeur général
- **Jean-Christophe Putallaz** — Président du Conseil de Fondation (ancien adjoint du chef du SDM)
- **Sabiré Iljazi** — Responsable administration, finances et RH (depuis 2024)

### Responsables de filière (2024)

- **Dr Marie Arnoux** — Géo-ressources, aussi responsable du Pool des Répondants Scientifiques
- **Dr Theo Baracchini** — Dangers naturels (depuis 2024-10)
- **Pascal Ornstein** — Monitoring environnemental
- **Frédéric Etter** — IT (depuis 2024-08)

### Équipe IT (détail)

| Nom | Rôle |
|---|---|
| Frédéric Etter | Chef d'Équipe IT |
| Aymeric Sarrasin | Développeur full-stack |
| Mauro Bertoldi | Analyste développeur |
| Eliot Jean | Physicien-Informaticien (ingestion/validation données) |
| Dr Emmanuel Wyser | Géoinformaticien |
| Dr Fernando Galan Moles | Machine learning / IA |

### Contexte RH

- L'équipe IT a été remaniée mi-2024 : Gilles Marchand est parti (juillet 2024), Frédéric Etter est arrivé (août 2024)
- Frédéric Etter vient d'« une agence web locale » avec 10+ ans d'expérience — profil pragmatique, non-académique
- Témoignage public : « environnement de travail stimulant et diversité des projets me permettent d'apporter mon expertise en développement logiciel tout en relevant de nouveaux défis »

## 3. Produits et plateformes CREALP

### 3.1 MINERVE — Système de prévision des crues

**Statut** : opéré par CREALP depuis **plus de 10 ans** pour le Service des Dangers Naturels du canton du Valais (SDANA).

**Ce que c'est** :
- Modèle hydrologique simulant la formation et la propagation des écoulements dans le Rhône et ses affluents
- Prévisions jusqu'à **10 jours à l'avance** basées sur données météorologiques
- Résultats publiés en continu sur la plateforme GUARDAVAL

**Ce qu'il implique côté ops** :
- Veille hydrométéorologique **24/7** via un service de piquet
- L'opérateur CREALP surveille les prévisions en continu
- Fournit des analyses aux experts SDANA
- Échange avec les exploitants hydroélectriques
- Appuie la Cellule scientifique cantonale pour les dangers naturels (CSDN)

**Implication pour AlpiMonitor** : ne pas essayer de faire un concurrent de MINERVE. Se positionner comme un **outil léger et complémentaire** pour la consultation de données hydrologiques, dans l'esprit d'une plateforme publique grand public.

### 3.2 GUARDAVAL — Plateforme de publication MINERVE

Plateforme où les résultats MINERVE sont publiés et analysés par les autorités et les opérateurs CREALP. Clients directs : SDANA et Cellule scientifique cantonale (CSDN).

**Implication pour AlpiMonitor** : AlpiMonitor peut se revendiquer comme une **mini-démonstration** de ce type de plateforme, à échelle réduite (un sous-bassin au lieu du Rhône complet, données OFEV au lieu de prévisions MINERVE).

### 3.3 3DGEOWEB — Plateforme photogrammétrique

URL officielle (confirmée dans le rapport 2024) : **http://www.3dgeoweb.photodatabase.crealp.ch/**

**Ce que c'est** : base de données publique des vols de surveillance photogrammétrique 3D réalisés par CREALP (drones BVLOS et avions légers) au-dessus des zones valaisannes exposées aux aléas naturels. Les jeux de données 3D sont publics, les photos originales et les nuages de points sont téléchargeables.

**Usage interne et externe** : monitoring de l'érosion, suivi des glaciers, détection des changements de terrain (ex : zone proglaciaire du glacier de Zinal entre août 2023 et juin 2024).

**Implication pour AlpiMonitor** : c'est leur cœur de produit public, on **n'empiète pas**. AlpiMonitor reste orienté données hydrologiques tabulaires et time-series, pas 3D.

## 4. Projets scientifiques récents pertinents

### 4.1 Les intempéries de juin 2024 (fil rouge du rapport 2024)

**Épisode clé** : quatre semaines consécutives de crues en juin 2024 dans le Valais, liées à la conjonction :
- Manteau neigeux encore très présent en altitude
- Sols saturés en eau
- Lits de cours d'eau chargés
- Précipitations abondantes

**Exemple emblématique** : inondation de la Navisence à Chippis (vallée d'Anniviers, voisine du Val d'Hérens).

**Six projets CREALP en ont découlé** :
1. Veille hydrométrique MINERVE (prévision crues)
2. Vidange du lac proglaciaire de la Tsessette → lave torrentielle → route communale coupée 2 semaines
3. Instabilité de versant du **Fregnoley** (3 juillet 2024) avec laves torrentielles plusieurs jours
4. Surveillance des eaux souterraines post-crues du Rhône (remontées de nappe, turbidité, bactériologique)
5. Monitoring de l'érosion par drone et avion léger (vol au-dessus de Zinal)
6. Études sur l'impact sur les ressources en eau souterraine

**Implication pour AlpiMonitor** : juin 2024 est dans la mémoire vive des équipes CREALP. Un dataset seed qui inclut cette période et la met visuellement en évidence dans l'app est un **signal très fort** qu'on a lu leur travail.

### 4.2 WATERWISE (INTERREG Alpine Space)

Projet INTERREG avec 12 partenaires, 7 pays de l'Arc Alpin, 7 sites pilotes dont le **Vallon de Réchy en Valais** (représenté par CREALP, portée par Marie Arnoux).

**Objet** : boîte à outils numérique innovante pour évaluer la vulnérabilité des eaux alpines aux changements climatiques et environnementaux.

**Implication** : sujet stratégique vivant, positionnement naturel pour une candidature qui évoque « l'impact du changement climatique sur les ressources en eau alpine » en lettre de motivation.

### 4.3 Monitoring photogrammétrique 3D

Dans le cadre du programme « promotion des technologies environnementales » de l'OFEV. Suivi haute précision par drone et avion léger. Produit des jeux de données 3D publics sur 3DGEOWEB.

### 4.4 Exposition publique « Changement climatique en montagne : eau et dangers naturels »

Créée par CREALP, présentée à Sion et Saint-Maurice en 2024. Format pédagogique grand public. Indique une volonté de vulgarisation que **AlpiMonitor peut honorer** en gardant une UX accessible aux non-spécialistes.

## 5. Vocabulaire institutionnel et partenaires

### 5.1 Acronymes à connaître

| Acronyme | Signification |
|---|---|
| **SDANA** | Service des Dangers Naturels de l'État du Valais (client principal de MINERVE) |
| **SDM** | Service du Développement de la Montagne |
| **CSDN** | Cellule scientifique cantonale pour les dangers naturels |
| **OFEV** | Office fédéral de l'environnement (= BAFU en allemand, UFAM en italien) |
| **OFEN** | Office fédéral de l'énergie |
| **DDC** | Direction du développement et de la coopération (suisse) |
| **ECA** | Établissement cantonal d'assurance (prévention incendies et éléments naturels) |
| **GATS** | Groupe d'appui technoscientifique (organe de gouvernance CREALP) |
| **IAH** | International Association of Hydrogeologists |

### 5.2 Partenaires institutionnels clés (tirés du Conseil de Fondation et du GATS)

- **Canton du Valais** (fondateur historique)
- **Ville de Sion** (fondatrice historique)
- **Confédération** (Service Géologique National, OFEV, OFEN)
- **Région Autonome de la Vallée d'Aoste** (coopération transfrontalière)
- **EPFL** (Prof. Devis Tuia, Laboratoire ECEO)
- **UNIFR** (Département des Géosciences, Prof. Reynald Delaloye)
- **UNINE** (Laboratoire Géothermie CHYN, Prof. Benoît Valley)
- **Norbert SA, SD Ingénierie Sion SA, HydroCosmos SA, ALTIS SA** (bureaux d'études privés partenaires)

### 5.3 Concepts métier à manier

Ces termes apparaissent régulièrement dans les rapports et seront utilisés naturellement par l'équipe CREALP en interview :

- **Vidange soudaine de lac proglaciaire** — rupture d'un lac formé par recul glaciaire, libère rapidement un volume d'eau
- **Lave torrentielle** — écoulement de matériaux (eau + sédiments + blocs) à forte pente, très destructeur
- **Zone proglaciaire** — zone immédiatement en aval d'un glacier, en cours de réorganisation
- **Manteau neigeux** — couche de neige en altitude dont la fonte alimente les cours d'eau
- **Sols saturés** — sols qui ne peuvent plus absorber d'eau, toute précipitation ruisselle
- **Résurgence** — émergence d'une circulation d'eau souterraine en surface
- **Instabilité de versant** — pente susceptible de glisser
- **Piézomètre** — instrument de mesure du niveau d'une nappe phréatique
- **Remontée de nappe** — élévation du niveau de la nappe phréatique, cause d'inondations locales
- **Crue** vs **étiage** — période de haut débit vs période de bas débit
- **Exploitants hydroélectriques** — opérateurs de barrages et centrales (Grande Dixence SA, FMV, Alpiq…)
- **Piquet** — service d'astreinte 24/7 pour surveillance active

## 6. Positionnement d'AlpiMonitor dans l'écosystème CREALP

### 6.1 Tableau de positionnement

| Aspect | MINERVE / GUARDAVAL | 3DGEOWEB | **AlpiMonitor** |
|---|---|---|---|
| Nature | Prévision hydrologique | Base 3D photogrammétrique | Dashboard de consultation |
| Périmètre | Rhône + affluents (canton) | Sites ponctuels (Valais) | Sous-bassin (Borgne) |
| Données | Modélisation + temps réel | Relevés aériens archivés | OFEV open data (temps réel + historique) |
| Audience | Autorités, opérateurs | Chercheurs, public | Public informé, démonstration |
| Opéré par | CREALP 24/7 | CREALP | Démo candidat |
| Horizon | Prévision 10 jours | Rétrospectif | Instantané + 90j historique |

### 6.2 Positionnement narratif

AlpiMonitor **s'inspire** de la philosophie MINERVE/GUARDAVAL (rendre la donnée hydrologique lisible et actionnable) sans **prétendre** les remplacer ni les concurrencer. C'est une mise en pratique à l'échelle d'un développeur individuel des mêmes principes que CREALP porte à l'échelle d'un canton.

## 7. Storytelling activable

### 7.1 Pour la lettre de motivation (paragraphes à adapter)

**Ouverture possible** :
> « La lecture de vos rapports d'activité 2022, 2023 et 2024 a confirmé l'intérêt que je porte à votre mission. Les dispositifs MINERVE et GUARDAVAL que vous opérez depuis plus de dix ans pour le SDANA illustrent une philosophie que je partage : rendre la donnée environnementale lisible, actionnable, accessible. »

**Mention d'un projet spécifique** :
> « Votre intervention rapide sur la vidange du lac proglaciaire de la Tsessette en juin 2024, comme l'instrumentation post-événement du site du Fregnoley, montrent une capacité à conjuguer terrain et outillage numérique qui me semble rare et précieuse. »

**Différenciant personnel** :
> « Pour concrétiser cet intérêt, j'ai développé AlpiMonitor, un tableau de bord hydrologique du bassin de la Borgne qui consomme les données ouvertes OFEV et met en scène les enjeux de captage hydroélectrique du complexe Grande Dixence. Ce projet n'ambitionne pas de concurrencer vos plateformes internes ; il illustre ma capacité à maîtriser la stack Vue 3 / TypeScript / Fastify / Tailwind dans un contexte métier aligné avec le vôtre. »

### 7.2 Pour le README du projet

Premier paragraphe possible :
> « AlpiMonitor est un tableau de bord hydrologique du bassin de la Borgne (Valais, Suisse). Il consomme les données ouvertes de l'Office fédéral de l'environnement et les met en scène pour une lecture rapide par les acteurs du territoire alpin. Inspiré par les dispositifs MINERVE et GUARDAVAL que CREALP opère depuis plus de dix ans pour le Service cantonal des dangers naturels, AlpiMonitor est une démonstration technique à plus petite échelle : un sous-bassin, deux sources de données, 90 jours d'historique — mais avec le même esprit de lisibilité et d'accessibilité publique. »

### 7.3 Pour l'appel téléphonique à Frédéric Etter

**Questions à poser** (signalent un candidat qui a lu les docs publics) :

1. « Comment voyez-vous l'évolution de vos plateformes publiques (3DGEOWEB, mais aussi la partie publique de GUARDAVAL) sur les 12-24 prochains mois ? Est-ce que le poste s'inscrit plutôt dans la continuité ou sur de nouveaux produits ? »
2. « Le rapport 2024 évoque WATERWISE comme projet stratégique sur la vulnérabilité des eaux alpines. Est-ce qu'un volet dev front en ressortira, ou c'est porté ailleurs ? »
3. « Comment s'organise concrètement la collaboration entre l'équipe IT et les équipes scientifiques (hydrogéologie, glaciologie, dangers naturels) ? Rituels, pairing, co-design ? »
4. « Quelle est la posture sur l'utilisation d'outils IA par l'équipe dev au quotidien ? »

**Ce qu'il ne faut PAS demander** :
- Salaire au premier appel (à garder pour RH)
- « Qu'est-ce que vous faites ? » (tu dois déjà savoir)
- Des détails sur l'équipe (le rapport te les a donnés)

## 8. Implications concrètes pour le MVP

À intégrer si possible dans le dev :

1. **Dataset seed** : inclure un épisode centré sur juin 2024 avec une annotation visuelle explicite (« Crues de juin 2024 — événement documenté dans le Rapport d'activité CREALP »)
2. **Glossaire UI** : une page ou une infobulle « termes » qui explique vidange proglaciaire, lave torrentielle, manteau neigeux, etc. — à la manière d'un outil pédagogique CREALP
3. **Footer enrichi** : en plus de l'attribution OFEV, un petit « Projet réalisé dans le cadre d'une candidature au CREALP — s'inspire de MINERVE/GUARDAVAL » qui clarifie le positionnement dès le premier coup d'œil

Ces trois points sont **optionnels mais à fort ROI signalisation**. Les garder en backlog v1, les implémenter en fin de sprint (J10-J11) si marge disponible.
