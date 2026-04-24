/*
 * AlpiMonitor — C4 architecture workspace.
 *
 * Source of truth for the 4 C4 diagrams embedded in the arc42 docs.
 * Rendered to SVG manually via Structurizr Lite or structurizr-cli, then
 * committed under docs/assets/diagrams/ for MkDocs to serve statically.
 *
 * Phase 3 will populate model + views. For now this file exists so that
 * Phase 2 index.md pages can reference the future SVG outputs without
 * dangling assumptions.
 *
 * Rendering (Phase 3):
 *   docker run --rm -v $PWD:/usr/local/structurizr structurizr/lite
 *   → open http://localhost:8080, export PNG/SVG of each view, commit.
 */

workspace "AlpiMonitor" "Hydrological monitoring for the Rhône valaisan (Borgne basin), CREALP demo." {

    model {
        # TODO (Phase 3):
        # - persons: recruiter, general public, ops
        # - softwareSystem: AlpiMonitor
        #   - containers: web (Vue 3), api (Fastify), postgres, cron (embedded in api)
        # - external systems: LINDAS SPARQL (OFEV), Coolify (deploy), DNS OVH, Kroki (docs)
    }

    views {
        # TODO (Phase 3):
        # - systemContext AlpiMonitor "c4-context"
        # - container AlpiMonitor "c4-containers"
        # - component web "c4-components-frontend"
        # - component api "c4-components-backend"

        styles {
            # TODO (Phase 3): color scheme matching the site palette
            # (primary indigo, accent amber, glacier background).
        }

        theme default
    }
}
