<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import AIcon from '@/components/atoms/AIcon.vue';
import OHydroChart from '@/components/organisms/OHydroChart.vue';
import { useStationDrawer } from '@/composables/stations';

const { t } = useI18n();

const {
  isOpen,
  station,
  dischargeSeries,
  isLoading,
  error: fetchError,
  windowFrom,
  windowTo,
  close,
  retry,
  coordsLabel,
  hydrodatenUrl,
  narrative,
  canNarrate,
  generateNarrative,
} = useStationDrawer();

// Flatten the narration facade's refs so the template auto-unwraps them.
const {
  state: narrativeState,
  text: narrativeText,
  reason: narrativeReason,
  isLoading: narrativeLoading,
  error: narrativeError,
  hasRequested: narrativeRequested,
} = narrative;
</script>

<template>
  <Teleport to="body">
    <Transition name="o-station-drawer">
      <div
        v-if="isOpen && station"
        class="o-station-drawer"
        role="dialog"
        aria-modal="true"
        :aria-label="station.name"
      >
        <div class="o-station-drawer__overlay" @click="close" />

        <aside class="o-station-drawer__panel">
          <header class="o-station-drawer__header">
            <div class="o-station-drawer__title-block">
              <h3 class="o-station-drawer__title">{{ station.name }}</h3>
              <p class="o-station-drawer__subtitle">
                <span class="o-station-drawer__ofev-code">{{ station.ofevCode }}</span>
                <span aria-hidden="true"> · </span>
                <span>{{ station.riverName }}</span>
              </p>
              <p class="o-station-drawer__coords">{{ coordsLabel }}</p>
            </div>
            <button
              type="button"
              class="o-station-drawer__close"
              :aria-label="t('drawer.close')"
              @click="close"
            >
              <AIcon name="close" :size="20" />
            </button>
          </header>

          <section class="o-station-drawer__body">
            <h4 class="o-station-drawer__chart-title">{{ t('drawer.chartTitle') }}</h4>

            <div v-if="isLoading" class="o-station-drawer__chart-loading">
              {{ t('drawer.chartLoading') }}
            </div>

            <div v-else-if="fetchError" class="o-station-drawer__chart-error">
              <p>{{ t('drawer.chartError') }}</p>
              <button type="button" class="o-station-drawer__retry" @click="retry">
                {{ t('drawer.chartRetry') }}
              </button>
            </div>

            <OHydroChart
              v-else
              :series="dischargeSeries"
              :window-from="windowFrom"
              :window-to="windowTo"
            />
          </section>

          <section class="o-station-drawer__narrative">
            <h4 class="o-station-drawer__chart-title">{{ t('drawer.narrative.title') }}</h4>

            <button
              v-if="!narrativeRequested"
              type="button"
              class="o-station-drawer__narrative-btn"
              :disabled="!canNarrate"
              @click="generateNarrative"
            >
              <AIcon name="info" :size="14" />
              <span>{{ t('drawer.narrative.generate') }}</span>
            </button>

            <p v-else-if="narrativeLoading" class="o-station-drawer__narrative-loading">
              {{ t('drawer.narrative.loading') }}
            </p>

            <div v-else class="o-station-drawer__narrative-result" aria-live="polite">
              <p v-if="narrativeError" class="o-station-drawer__narrative-message" role="status">
                {{ t('drawer.narrative.error') }}
              </p>
              <p
                v-else-if="narrativeState === 'unavailable'"
                class="o-station-drawer__narrative-message"
                role="status"
              >
                {{ t(`drawer.narrative.unavailable.${narrativeReason ?? 'llm_error'}`) }}
              </p>
              <template v-else>
                <p
                  class="o-station-drawer__narrative-text"
                  :aria-label="t('drawer.narrative.ariaResult')"
                >
                  {{ narrativeText }}
                </p>
                <p class="o-station-drawer__narrative-ai">{{ t('drawer.narrative.aiLabel') }}</p>
              </template>

              <button
                type="button"
                class="o-station-drawer__narrative-retry"
                :disabled="!canNarrate"
                @click="generateNarrative"
              >
                {{
                  narrativeError ? t('drawer.narrative.retry') : t('drawer.narrative.regenerate')
                }}
              </button>
            </div>
          </section>

          <footer v-if="hydrodatenUrl" class="o-station-drawer__footer">
            <a
              :href="hydrodatenUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="o-station-drawer__external-link"
            >
              <span>{{ t('drawer.viewOnHydrodaten') }}</span>
              <AIcon name="external" :size="14" />
            </a>
          </footer>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.o-station-drawer {
  @apply fixed inset-0 z-[1000] flex;
}

.o-station-drawer__overlay {
  @apply absolute inset-0 bg-primary/40 backdrop-blur-sm;
}

.o-station-drawer__panel {
  @apply relative ml-auto flex h-full w-full flex-col overflow-y-auto bg-white shadow-xl md:w-[450px];
}

.o-station-drawer__header {
  @apply flex items-start justify-between gap-4 border-b border-slate-alpi/15 px-6 py-5;
}

.o-station-drawer__title-block {
  @apply flex min-w-0 flex-col gap-1;
}

.o-station-drawer__title {
  @apply font-sans text-xl font-semibold text-primary;
}

.o-station-drawer__subtitle {
  @apply text-sm text-graphite;
}

.o-station-drawer__ofev-code {
  @apply font-mono text-xs text-slate-alpi;
}

.o-station-drawer__coords {
  @apply font-mono text-[11px] text-slate-alpi;
}

.o-station-drawer__close {
  @apply -mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-alpi transition-colors hover:bg-glacier hover:text-primary;
}

.o-station-drawer__body {
  @apply flex flex-1 flex-col gap-4 px-6 py-6;
}

.o-station-drawer__chart-title {
  @apply font-mono text-xs font-medium uppercase tracking-widest text-slate-alpi;
}

.o-station-drawer__chart-loading,
.o-station-drawer__chart-error {
  @apply flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-md border border-dashed border-slate-alpi/30 text-center text-sm text-slate-alpi;
}

.o-station-drawer__retry {
  @apply rounded-md border border-slate-alpi/30 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-glacier;
}

.o-station-drawer__narrative {
  @apply flex flex-col gap-3 border-t border-slate-alpi/15 px-6 py-6;
}

.o-station-drawer__narrative-btn {
  @apply inline-flex w-fit items-center gap-1.5 rounded-md border border-primary/30 px-3 py-2 font-sans text-sm font-medium text-primary transition-colors hover:bg-glacier disabled:cursor-not-allowed disabled:opacity-50;
}

.o-station-drawer__narrative-loading {
  @apply text-sm text-slate-alpi;
}

.o-station-drawer__narrative-result {
  @apply flex flex-col gap-2;
}

.o-station-drawer__narrative-message {
  @apply text-sm text-slate-alpi;
}

.o-station-drawer__narrative-text {
  @apply text-sm leading-relaxed text-graphite;
}

.o-station-drawer__narrative-ai {
  @apply font-mono text-[11px] uppercase tracking-widest text-slate-alpi;
}

.o-station-drawer__narrative-retry {
  @apply w-fit rounded-md border border-slate-alpi/30 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-glacier disabled:cursor-not-allowed disabled:opacity-50;
}

.o-station-drawer__footer {
  @apply border-t border-slate-alpi/15 px-6 py-4;
}

.o-station-drawer__external-link {
  @apply inline-flex items-center gap-1.5 font-sans text-sm font-medium text-primary transition-colors hover:text-primary-hover;
}

/* Transitions: slide-in from the right + overlay fade. */
.o-station-drawer-enter-active .o-station-drawer__panel,
.o-station-drawer-leave-active .o-station-drawer__panel {
  @apply transition-transform duration-300 ease-out;
}

.o-station-drawer-enter-from .o-station-drawer__panel,
.o-station-drawer-leave-to .o-station-drawer__panel {
  @apply translate-x-full;
}

.o-station-drawer-enter-active .o-station-drawer__overlay,
.o-station-drawer-leave-active .o-station-drawer__overlay {
  @apply transition-opacity duration-300 ease-out;
}

.o-station-drawer-enter-from .o-station-drawer__overlay,
.o-station-drawer-leave-to .o-station-drawer__overlay {
  @apply opacity-0;
}

@media (prefers-reduced-motion: reduce) {
  .o-station-drawer-enter-active .o-station-drawer__panel,
  .o-station-drawer-leave-active .o-station-drawer__panel,
  .o-station-drawer-enter-active .o-station-drawer__overlay,
  .o-station-drawer-leave-active .o-station-drawer__overlay {
    @apply transition-none;
  }
}
</style>
