/*
 * AlpiMonitor — C4 architecture workspace.
 *
 * Source of truth for the 4 C4 diagrams embedded in the arc42 docs.
 * Rendered to SVG via structurizr/structurizr → C4 PlantUML →
 * plantuml/plantuml (local), SVG committed to docs/assets/diagrams/.
 *
 * Regenerate: see docs/README.md §"Regenerate C4 diagrams".
 */

workspace "AlpiMonitor" "Hydrological monitoring for the Rhône valaisan (Borgne basin) — CREALP candidacy deliverable." {

    model {

        publicUser = person "Public web" "Consulte les débits du bassin de la Borgne"
        reviewer = person "Relecteur technique" "Évalue stack, architecture, rigueur (recruteur CREALP)"

        lindas = softwareSystem "LINDAS SPARQL" "Endpoint open-data OFEV/BAFU pour les stations hydrométriques fédérales" "External"
        osm = softwareSystem "OpenStreetMap" "Tuiles cartographiques WMTS publiques" "External"
        github = softwareSystem "GitHub App" "Repository + webhook push main → Coolify" "External"

        alpimonitor = softwareSystem "AlpiMonitor" "Tableau de bord hydrologique bassin Borgne" {

            traefik = container "Traefik" "Reverse proxy + TLS Let's Encrypt" "Traefik (géré Coolify)"

            webNginx = container "Web nginx" "Serve SPA statique + 6 headers sécurité" "nginx:1.27-alpine"
            sbNginx = container "Storybook nginx" "Serve Storybook statique (46 stories)" "nginx:1.27-alpine"

            spa = container "SPA Web" "Vue 3 + Vite + TS + Tailwind + Pinia + Leaflet + D3" "Vue 3 SPA" {

                atoms = component "UI Atoms" "ABadge, AButton, AIcon, ANumericValue, ASourcingBadge" "Vue components"
                molecules = component "UI Molecules" "MSectionHeader, MStatCard, MStationCard, MStatusBadge" "Vue components"

                oHero = component "OHeroSection" "Hero + status badge + polling /status" "Vue organism"
                oMap = component "OMapSection + OStationMap" "Leaflet markers LIVE/RESEARCH + légende" "Vue organism"
                oDrawer = component "OStationDrawer + OHydroChart" "Drawer slide-in + chart D3 24h" "Vue organism"
                oKeyMetrics = component "OKeyMetricsSection" "4 KPI cards (stations, measurements, lastSync)" "Vue organism"
                oOther = component "OResearch / OWhyLindas / OSiteFooter" "Sections narratives landing" "Vue organism"

                facadesStations = component "composables/stations/" "useStationsList, useStationSelection, useStationMeasurements, useStationDrawer" "Vue composable"
                shared = component "composables/shared/" "useEscapeClose, useScrollLock, usePolling" "Vue composable"

                apiClient = component "lib/api-client" "HTTP centralisé + ApiError discriminé" "TS module"
                libOther = component "lib/{charts,map,constants,hydrodaten,status}" "Fonctions pures D3/Leaflet + constantes" "TS module"

                stationsStore = component "stores/stations" "Pinia singleton (accès via façades)" "Pinia store"
                statusStore = component "stores/status" "Pinia singleton (accès direct)" "Pinia store"
            }

            api = container "API + Cron" "Fastify REST + cron ingestion LINDAS embarqué" "Node.js 20" {

                routes = component "routes/" "/health, /status, /stations, /stations/:id/measurements" "Fastify routes"

                pluginIngestion = component "plugins/ingestion" "Cron node-cron 10 min + orchestration" "Fastify plugin"
                pluginPrisma = component "plugins/prisma" "Singleton PrismaClient + lifecycle" "Fastify plugin"
                pluginCors = component "plugins/cors" "CORS allowlist via env CORS_ORIGINS" "Fastify plugin"

                ingestionLindas = component "ingestion/lindas/" "fetch + parser SPARQL + persist upsert + archive gzip" "TS module"
                schemas = component "schemas/" "Validation Zod (input + output)" "TS module"

                entrypoint = component "entrypoint.sh" "prisma migrate deploy + seed-on-boot + exec node" "Shell"
            }

            db = container "PostgreSQL" "Schéma Prisma: Station, Measurement, IngestionRun, Threshold, Glacier, Withdrawal, Catchment, Alert" "PostgreSQL 16" "Database"
        }

        # Relationships — people to system
        publicUser -> alpimonitor "HTTPS consultation lecture seule"
        reviewer -> alpimonitor "HTTPS review + design system"
        reviewer -> github "Consulte repo + ADR"

        # AlpiMonitor → externals
        alpimonitor -> lindas "SPARQL HTTP cron 10 min"
        alpimonitor -> osm "HTTPS tiles à la demande"
        github -> alpimonitor "Webhook push main → deploy"

        # Containers wiring
        publicUser -> traefik "HTTPS"
        reviewer -> traefik "HTTPS"
        traefik -> webNginx "alpimonitor.fr"
        traefik -> api "api.alpimonitor.fr"
        traefik -> sbNginx "storybook.alpimonitor.fr"
        webNginx -> spa "sert index.html + assets"
        spa -> traefik "REST JSON vers API"
        spa -> osm "tiles WMTS (bypass Traefik)"
        api -> db "Prisma SQL"
        api -> lindas "SPARQL HTTP (cron 10 min)"
        github -> traefik "webhook deploy (via Coolify)"

        # SPA components — organisms → composables/stores
        oHero -> statusStore "storeToRefs"
        oHero -> shared "usePolling 60s → fetchStatus"
        oHero -> molecules "MStatusBadge"
        oMap -> facadesStations "useStationSelection"
        oMap -> libOther "MAP_CENTER, MAP_ZOOM, stationToMarkerOptions"
        oMap -> molecules "MSectionHeader"
        oDrawer -> facadesStations "useStationDrawer (orchestrateur)"
        oDrawer -> libOther "chart-model, MARGIN, ONE_DAY_MS"
        oDrawer -> shared "useEscapeClose + useScrollLock"
        oDrawer -> atoms "AIcon"
        oKeyMetrics -> facadesStations "useStationsList"
        oKeyMetrics -> statusStore "storeToRefs (pas de façade — rule of 3)"
        oKeyMetrics -> molecules "MStatCard"
        oOther -> molecules
        oOther -> atoms

        # SPA — façades → store + api
        facadesStations -> stationsStore "lecture via storeToRefs + actions"
        facadesStations -> apiClient "via store.fetchStations, store.fetchMeasurements"
        statusStore -> apiClient "api.getStatus()"
        stationsStore -> apiClient "api.getStations, api.getStationMeasurements"

        # API components
        routes -> pluginPrisma "prisma.* via Fastify decorator"
        routes -> schemas "validation Zod request/response"
        pluginIngestion -> ingestionLindas "orchestre fetch+parse+persist+archive"
        pluginIngestion -> pluginPrisma "Prisma client pour upsert"
        ingestionLindas -> schemas "Zod validation SPARQL bindings"
        entrypoint -> pluginPrisma "prisma migrate deploy + db seed"
    }

    views {

        systemContext alpimonitor "Context" "C4 niveau 1 — AlpiMonitor et ses acteurs externes" {
            include *
            autolayout lr
        }

        container alpimonitor "Containers" "C4 niveau 2 — containers Docker sur VPS Hetzner" {
            include *
            autolayout lr
        }

        component spa "Components-Frontend" "C4 niveau 3 — composants SPA Vue 3" {
            include *
            autolayout lr
        }

        component api "Components-Backend" "C4 niveau 3 — composants API Fastify + cron" {
            include *
            autolayout lr
        }

        styles {
            element "Person" {
                background #0F2847
                color #ffffff
                shape person
            }
            element "External" {
                background #999999
                color #ffffff
            }
            element "Database" {
                shape cylinder
            }
            element "Vue 3 SPA" {
                background #42b883
                color #ffffff
            }
            element "Node.js 20" {
                background #339933
                color #ffffff
            }
            element "Vue organism" {
                background #F4C542
                color #2C3640
            }
            element "Vue composable" {
                background #0F2847
                color #ffffff
            }
            element "Pinia store" {
                background #F4F8FB
                color #0F2847
            }
            element "TS module" {
                background #ECF2F7
                color #0F2847
            }
            element "Fastify plugin" {
                background #F4C542
                color #2C3640
            }
        }

        theme default
    }
}
