# ADR-005 — Leaflet pour la cartographie

**Date** : 2026-04-18
**Statut** : Acceptée

## Contexte

AlpiMonitor nécessite une carte interactive affichant les stations du bassin de la Borgne avec markers colorés. Bibliothèques candidates :

- **Leaflet** : standard de facto, lib JS pure, léger, bien documenté
- **MapLibre GL** : fork OSS de Mapbox, moderne, rendu WebGL, tuiles vectorielles
- **OpenLayers** : puissant, SIG-friendly, plus verbeux
- **Mapbox GL** : propriétaire, coût à l'usage

## Décision

On utilise **Leaflet 1.9** avec les tuiles **WMTS de swisstopo** comme fond de carte.

## Conséquences

### Positives

- **Poids minimal** (~40 Ko gzipped) : cohérent avec l'objectif NFR-2.1.3 (payload < 300 Ko)
- **API simple** : apprentissage rapide, pas de shader WebGL à comprendre
- **Tuiles swisstopo officielles** : rendu reconnaissable par un public suisse, crédible pour CREALP, attribution claire
- **Compatibilité Vue trivialement** : pas besoin d'un wrapper lourd, on instancie Leaflet dans un composable
- **Markers custom faciles** : SVG inline pour les états colorés

### Négatives

- **Pas de tuiles vectorielles natives** : si on voulait des styles dynamiques complexes, MapLibre serait mieux. Hors scope v1.
- **Rendu raster** : moins smooth qu'un rendu WebGL sur zoom/pan, mais acceptable pour ~10 markers

## Conventions d'usage

- Un composable `useLeafletMap` qui encapsule l'instanciation et le cleanup
- Les markers sont des composants Vue qui reçoivent une ref vers la map et s'auto-enregistrent
- Le basemap utilise la couche swisstopo `ch.swisstopo.pixelkarte-farbe` via WMTS
- Attribution explicite `© swisstopo` dans le bottom-right de la map

### Exemple de configuration tuiles

```ts
L.tileLayer(
  'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
  {
    attribution: '© swisstopo',
    maxZoom: 17,
  }
).addTo(map);
```

## Accessibilité

Leaflet n'est **pas entièrement accessible par défaut**. Contre-mesures :
- Fournir systématiquement une **liste textuelle alternative** des stations (FR-1.1.5)
- Markers navigables au clavier via `keyboard: true` sur Leaflet + gestion manuelle du focus
- `aria-label` explicite sur chaque marker

## Alternatives écartées

### MapLibre GL

Envisagée. Plus moderne, rendu vectoriel plus fluide. Écartée parce que :
- Poids JS plus élevé (~200 Ko) pour un gain visuel faible sur notre cas
- Complexité config tuiles vectorielles + style JSON vs Leaflet trivial
- Pas de démonstration supplémentaire de compétence pour l'annonce

### vue-leaflet (wrapper)

Écartée. Ajoute une couche d'abstraction et des dépendances pour un gain marginal. On utilise Leaflet directement via un composable Vue maison — plus pédagogique, plus contrôlé.
