# Product Brief — AlpiMonitor

## En une phrase

AlpiMonitor est un tableau de bord web qui rend visibles, en quasi temps-réel et en contexte historique, les débits et niveaux d'eau du bassin de la Borgne (Valais, Suisse), en intégrant l'impact des captages hydroélectriques de la Grande Dixence.

## Problème à résoudre

Les données hydrologiques suisses sont ouvertes, mais leur consultation brute (via hydrodaten.admin.ch) reste peu lisible pour :

- **un praticien** qui veut comparer rapidement l'état de plusieurs stations d'un même bassin
- **un décideur local** qui veut vérifier l'état des débits par rapport à des seuils d'alerte
- **un chercheur** qui veut contextualiser une mesure par rapport à l'historique saisonnier
- **un citoyen informé** qui cherche à comprendre comment fonctionne l'hydrologie de sa vallée

L'outil officiel OFEV expose la donnée. AlpiMonitor la **met en scène** pour un périmètre ciblé.

## Public cible (par ordre de priorité)

1. **Recruteurs techniques et métier de CREALP** — audience primaire du projet (démonstration de compétences)
2. **Profils analogues à la cible métier de CREALP** — pour que la démo fasse sens au-delà du recrutement
3. **Curieux / public informé** — accessible par design

## Proposition de valeur

- **Lecture rapide** : état de toutes les stations du bassin en un coup d'œil, codes couleur clairs
- **Profondeur à la demande** : détail par station, série temporelle, comparaison multi-stations
- **Contexte métier** : distinction débit naturel / résiduel / dotation, visualisation des captages
- **Alertes** : détection automatique d'anomalies statistiques et dépassements de seuils

## Périmètre V1 (MVP)

### Ce qui est dans V1

- Carte interactive du bassin avec stations géolocalisées
- Fiche détaillée par station (mesures temps-réel + historique 90 jours)
- Visualisation D3 des séries temporelles avec zoom et brush
- Comparaison 2-4 stations sur un même graphique
- Seuils d'alerte configurables (par station ou global)
- Détection d'anomalies statistiques (moyenne mobile ± 2σ)
- Ingestion automatique du flux OFEV (toutes les 10 minutes)
- Interface responsive (desktop-first, mobile fonctionnel)
- Interface publique en français, accessibilité WCAG AA visée

### Ce qui est explicitement hors V1

- Authentification utilisateur public (tout est lecture seule)
- Interface admin pour créer/modifier stations (seeding en dur + UI admin minimale JWT pour les seuils)
- Intégration MétéoSuisse, GLAMOS temps réel
- Prévisions / forecasting
- Export PDF de rapports
- Notifications push / email
- Multi-langue (français uniquement)
- Vue Flow pour pipeline d'ingestion (reporté v2)
- Python / ML / IA générative
- Module 3D / photogrammétrie (respect du territoire de 3DGEOWEB)

## Principes produit

1. **Lisibilité avant exhaustivité** — mieux vaut 4 stations bien mises en scène que 40 illisibles
2. **Contexte toujours présent** — une valeur brute sans référence historique ou seuil est inutile
3. **Honnêteté des données** — afficher l'horodatage, la source, le statut (à jour / en retard / hors-ligne)
4. **Performance comme feature** — chargement initial < 2s, interaction < 100ms sur les charts
5. **Accessibilité non-négociable** — clavier, lecteurs d'écran, contrastes, focus visibles

## Mesures de succès (pour le projet, pas un produit commercial)

- Un recruteur technique comprend l'architecture en 5 minutes de lecture README
- Un recruteur métier reconnaît son vocabulaire et son territoire dès la page d'accueil
- Le déploiement est accessible 24/7 via HTTPS à l'URL partagée
- Lighthouse score ≥ 90 sur Performance, Accessibility, Best Practices
- Coverage tests sur logique métier (calcul seuils, agrégations) ≥ 80 %
- L'auteur peut défendre chaque décision en interview technique

## Risques et parades

| Risque | Parade |
|---|---|
| Flux OFEV indisponible lors de démo | Seed historique = démo fonctionnelle sans connexion externe |
| D3 plus long que prévu à maîtriser | 2 jours dédiés bloqués (J8-J9), fallback : chart Recharts si drame |
| Domaine ABEM mal appliqué | Document `ui/design-system.md` ultra précis + revue manuelle des composants |
| Scope qui enfle | Liste non-goals gardée à jour, refus explicite des ajouts mid-sprint |
| Déploiement Coolify en J11 qui échoue | Tester deploy dès J5 avec squelette d'app, pas à la fin |

## Storytelling en un paragraphe (à reprendre dans README et lettre)

> AlpiMonitor rend visible le flux d'eau du Val d'Hérens, de la fonte des glaciers de Ferpècle et d'Arolla jusqu'à la confluence de la Borgne avec le Rhône à Bramois, en intégrant l'effet des captages du complexe Grande Dixence. L'application consomme les données ouvertes de l'Office fédéral de l'environnement et les met en scène pour une lecture rapide par les acteurs du territoire alpin.
