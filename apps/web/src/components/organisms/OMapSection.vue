<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

import MSectionHeader from '@/components/molecules/MSectionHeader.vue';
import OStationMap from '@/components/organisms/OStationMap.vue';
import { useStationsList } from '@/composables/stations';

const { t } = useI18n();

const { stations, hasLoadedOnce, error, loadAll } = useStationsList();

// The placeholder stays visible until the first response lands. After that,
// OStationMap takes over — even when the list is empty we still want the
// map visible (it can be used to frame the catchment).
const showMap = computed(() => hasLoadedOnce.value && error.value === null);

onMounted(() => {
  void loadAll();
});
</script>

<template>
  <section id="map" class="o-map-section" aria-labelledby="map-title">
    <div class="o-map-section__header">
      <MSectionHeader
        heading-id="map-title"
        :eyebrow="t('meta.tagline')"
        :title="t('map.title')"
        :subtitle="t('map.subtitle')"
        tone="light"
      />
    </div>

    <div class="o-map-section__frame" role="region" :aria-label="t('map.title')">
      <OStationMap v-if="showMap" :stations="stations" />

      <div v-else-if="error" class="o-map-section__placeholder">
        <p class="o-map-section__placeholder-text">{{ t('map.error') }}</p>
      </div>

      <div v-else class="o-map-section__placeholder">
        <p class="o-map-section__placeholder-text">{{ t('map.loading') }}</p>
      </div>

      <aside class="o-map-section__legend" :aria-label="t('map.legend.title')">
        <p class="o-map-section__legend-title">{{ t('map.legend.title') }}</p>
        <ul class="o-map-section__legend-list">
          <li class="o-map-section__legend-item">
            <span class="o-map-section__marker o-map-section__marker--federal" aria-hidden="true" />
            <span>{{ t('map.legend.federal') }}</span>
          </li>
          <li class="o-map-section__legend-item">
            <span
              class="o-map-section__marker o-map-section__marker--research"
              aria-hidden="true"
            />
            <span>{{ t('map.legend.research') }}</span>
          </li>
        </ul>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.o-map-section {
  @apply mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-16 md:px-10 md:py-24;
}

.o-map-section__frame {
  @apply relative h-[70vh] min-h-[420px] overflow-hidden rounded-lg border border-slate-alpi/20 bg-glacier shadow-card;
}

.o-map-section__placeholder {
  @apply flex h-full w-full items-center justify-center;
  background-image:
    linear-gradient(
      to right,
      color-mix(in srgb, theme('colors.primary.DEFAULT') 4%, transparent) 1px,
      transparent 1px
    ),
    linear-gradient(
      to bottom,
      color-mix(in srgb, theme('colors.primary.DEFAULT') 4%, transparent) 1px,
      transparent 1px
    );
  background-size: 40px 40px;
}

.o-map-section__placeholder-text {
  @apply rounded-md bg-white/80 px-4 py-2 font-mono text-sm text-slate-alpi shadow-card backdrop-blur;
}

/* Legend sits above the Leaflet canvas (z-index 400 by default), and the
   Leaflet attribution takes the bottom-right. Keep our legend top-right
   on desktop, bottom-left on mobile to avoid the attribution overlap. */
.o-map-section__legend {
  @apply absolute bottom-4 left-4 z-[500] flex flex-col gap-2 rounded-md border border-slate-alpi/20 bg-white/95 px-4 py-3 text-sm shadow-card backdrop-blur sm:bottom-auto sm:left-auto sm:right-4 sm:top-4;
}

.o-map-section__legend-title {
  @apply font-mono text-[0.65rem] font-medium uppercase tracking-widest text-slate-alpi;
}

.o-map-section__legend-list {
  @apply flex flex-col gap-1.5;
}

.o-map-section__legend-item {
  @apply flex items-center gap-2 text-graphite;
}

.o-map-section__marker {
  @apply inline-flex h-3 w-3 shrink-0 rounded-full border-2;
}

.o-map-section__marker--federal {
  @apply border-primary bg-primary;
}

.o-map-section__marker--research {
  @apply border-alpine bg-white;
}
</style>
