<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import MSectionHeader from '@/components/molecules/MSectionHeader.vue';

const { t } = useI18n();
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

    <div class="o-map-section__frame" role="region" aria-label="Carte du réseau">
      <div class="o-map-section__placeholder">
        <p class="o-map-section__placeholder-text">{{ t('map.stubHint') }}</p>
      </div>

      <aside class="o-map-section__legend" aria-label="Légende">
        <p class="o-map-section__legend-title">Légende</p>
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

.o-map-section__legend {
  @apply absolute right-4 top-4 flex flex-col gap-2 rounded-md border border-slate-alpi/20 bg-white/95 px-4 py-3 text-sm shadow-card backdrop-blur;
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
