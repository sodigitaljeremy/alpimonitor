# Domain Context — Hydrologie alpine et Val d'Hérens

> Ce document est un **primer métier** pour toute personne (humaine ou IA) qui travaille sur le projet.
> Le but : écrire du code dont le vocabulaire, les entités et la logique sont cohérents avec le réel.

## Géographie du périmètre

AlpiMonitor se concentre sur un sous-bassin précis du réseau hydrographique valaisan : le **bassin versant de la Borgne**, depuis les glaciers d'Arolla, de Ferpècle et du Mont Miné jusqu'à sa confluence avec le Rhône à Bramois (en amont immédiat de Sion).

### Structure hydrographique simplifiée

```
[Glaciers Ferpècle / Mont Miné]   [Glacier d'Arolla]
              │                          │
     Borgne de Ferpècle          Borgne d'Arolla
              │                          │
              └─────── Les Haudères ─────┘
                          │
                       Borgne
                          │
                       Evolène
                          │
                 [Gorges de la Borgne]
                          │
                     Euseigne ◄─── Dixence (depuis lac des Dix)
                          │
                       Bramois
                          │
                        Rhône
                          │
                         Sion
```

### Chiffres-clés

- **Borgne** : ~21,5 km, affluent rive gauche du Rhône
- **Dixence** : ~12,1 km, affluent de la Borgne, source à 2030 m
- **Glaciers Ferpècle/Mont Miné** : perte moyenne ~26 m/an (retrait glaciaire)
- **Bassin versant Grande Dixence** : ~380-420 km², 35 glaciers captés

## Les captages Grande Dixence (enjeu critique du projet)

Le barrage de la **Grande Dixence** (285 m de haut, plus haut barrage-poids du monde) se trouve dans le val d'Hérémence, vallée parallèle à l'ouest du Val d'Hérens. Mais **son réseau de captage prélève massivement dans le Val d'Hérens** via deux stations de pompage :

- **Station de pompage de Ferpècle** (1896 m) — capte le glacier de Ferpècle, ~60 millions de m³/an refoulés
- **Station de pompage d'Arolla** (2009 m) — capte les glaciers de Tsidjiore et Bertol + eaux remontées depuis Ferpècle, ~90 millions de m³/an

**Implication métier pour AlpiMonitor** : une partie significative de l'eau de fonte du Val d'Hérens est détournée vers le lac des Dix au lieu de descendre dans la Borgne. Les débits observés dans la Borgne sont donc **résiduels** (après prélèvement), pas naturels. Cette distinction est fondamentale :

- Débit naturel (théorique) = ce qui s'écoulerait sans barrage
- Débit résiduel (observé) = ce qui s'écoule après captage
- Débit de dotation = minimum écologique imposé par la loi (Suisse : Loi sur la protection des eaux, LEaux)

## Glossaire technique

| Terme | Définition courte |
|---|---|
| **Bassin versant** | Surface géographique drainée par un cours d'eau et ses affluents |
| **Débit** | Volume d'eau qui passe à un point donné par unité de temps. Unité : m³/s |
| **Hauteur d'eau** | Niveau de la surface de l'eau au-dessus d'un repère fixe. Unité : cm ou m |
| **Station hydrométrique** | Point de mesure fixe (hauteur, débit, parfois température, turbidité) |
| **Étiage** | Période de plus bas niveau d'un cours d'eau |
| **Crue** | Période de hausse rapide et importante du débit |
| **Isohyète** | Ligne reliant les points de même précipitation annuelle |
| **Captage** | Prise d'eau dérivant tout ou partie d'un cours d'eau |
| **Dotation** | Débit minimum maintenu en aval d'un captage (obligation légale) |
| **Bassin glaciaire** | Portion du bassin versant couverte de glaciers (production tardive) |
| **Régime nival/glaciaire** | Cours d'eau dont le débit dépend de la fonte des neiges/glaces |
| **Crue de fonte** | Crue saisonnière liée à la fonte printanière/estivale |
| **Turbidité** | Mesure du trouble de l'eau (particules en suspension) |

## Enjeux métier que l'application doit rendre visibles

1. **Surveillance quotidienne** — débit et niveau courants par station, tendance 24h/7j
2. **Alertes sur seuils** — dépassement de hauteur, crue imminente, étiage sévère
3. **Comparaison multi-stations** — suivre la propagation d'un événement pluvieux de l'amont à l'aval
4. **Contexte temporel** — comparer la saison en cours à la moyenne historique
5. **Impact du captage** — visualiser les stations en amont vs aval des prises de la Grande Dixence
6. **Anomalies statistiques** — détecter automatiquement les valeurs atypiques (pic brutal, panne capteur)

## Acteurs de l'écosystème (pour comprendre qui parle à qui)

- **OFEV** (Office fédéral de l'environnement, BAFU en allemand) — division Hydrologie, exploite le réseau national de stations et publie les données sur hydrodaten.admin.ch
- **MétéoSuisse** — données météo et climatiques
- **GHO** (Groupe d'Hydrologie Opérationnelle de Suisse) — coordonne OFEV, MétéoSuisse et cantons
- **Services cantonaux** (Valais) — exploitent leurs propres réseaux de mesure complémentaires
- **Grande Dixence SA** — opérateur du barrage et du réseau de captage
- **Alpiq** — actionnaire majoritaire de Grande Dixence SA
- **FMV** (Forces Motrices Valaisannes) — autre opérateur hydroélectrique valaisan, client de CREALP
- **GLAMOS** — réseau suisse de surveillance des glaciers (données long terme)
- **EPFL Valais / Energypolis** — voisins de CREALP à Sion, partenaires académiques

## Événements récents du territoire (pour enrichir la démo si besoin)

- **Juin 2024** : crues importantes sur plusieurs torrents valaisans, dont Zinal (vallée voisine d'Anniviers)
- **Installation FMV 2026** : CREALP a récemment équipé un torrent de montagne pour FMV avec un radar de surface + sondes de pression (voir post LinkedIn CREALP mars 2026)
- **Retrait glaciaire continu** : 2024-2025 parmi les pires années pour les glaciers suisses

## Principes de nommage à respecter dans le code

Le code sera en anglais (convention), mais les **noms de domaine métier** gardent leur forme géographique locale. Exemples :

- ✅ `valDHerensCatchment`, `BorgneRiver`, `FerpecleGlacier`, `GrandeDixenceWithdrawal`
- ✅ `Station`, `Measurement`, `Threshold`, `Alert`, `Catchment`, `Glacier`
- ❌ `RiverA`, `Site1`, `ZoneAlpine1` (trop générique, perd le sens métier)

Les **labels UI** en revanche seront en **français** (audience CREALP francophone) : « Borgne à Bramois », « Débit », « Crue détectée ».

## Sources d'information utilisées pour ce document

- hydrodaten.admin.ch (OFEV — Division Hydrologie)
- bafu.admin.ch (OFEV)
- crealp.ch (site institutionnel)
- fr.wikipedia.org/wiki/Val_d'Hérens
- fr.wikipedia.org/wiki/Barrage_de_la_Grande-Dixence
- fr.wikipedia.org/wiki/Grande_Dixence
- grande-dixence.ch (documentation technique)
