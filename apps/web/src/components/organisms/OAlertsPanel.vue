<script setup lang="ts">
import type { AlertDTO, AlertLevel } from '@alpimonitor/shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import AIcon from '@/components/atoms/AIcon.vue';
import MSectionHeader from '@/components/molecules/MSectionHeader.vue';
import { useAlertsPanel } from '@/composables/alerts';
import { useStationsList } from '@/composables/stations';
import { usePolling } from '@/composables/shared/usePolling';
import {
  alertDirection,
  alertHourBucket,
  alertZ,
  formatHourBucket,
  formatIsoDayTime,
  formatZ,
} from '@/lib/alerts/alert-presentation';

// AI layer — extension B4 (ADR-012). Network-wide statistical anomaly panel.
// Reads the open episodes (primary) plus a short closed-episode history, and
// resolves station ids to names via the already-loaded stations list. The
// detection is purely statistical (B1-bis, hour-of-day deseasonalised z-score);
// the footer says so plainly — these are not expert hydrological alerts.

const { t } = useI18n();

const {
  openAlerts,
  recentClosedAlerts,
  activeAlertsCount,
  hasOpenAlerts,
  error,
  hasLoadedOnce,
  loadAll,
} = useAlertsPanel();
const { stations } = useStationsList();

const stationNameById = computed(() => {
  const map = new Map<string, string>();
  for (const s of stations.value) map.set(s.id, s.name);
  return map;
});

function stationName(stationId: string): string {
  return stationNameById.value.get(stationId) ?? stationId;
}

interface AlertView {
  id: string;
  stationName: string;
  parameterLabel: string;
  directionLabel: string;
  level: AlertLevel;
  levelLabel: string;
  zLabel: string | null;
  hourLabel: string | null;
  openedLabel: string;
}

function toView(alert: AlertDTO): AlertView {
  const z = formatZ(alertZ(alert));
  const hour = formatHourBucket(alertHourBucket(alert));
  return {
    id: alert.id,
    stationName: stationName(alert.stationId),
    parameterLabel: t(`alerts.parameter.${alert.parameter}`),
    directionLabel: t(`alerts.direction.${alertDirection(alert)}`),
    level: alert.level,
    levelLabel: t(`alerts.level.${alert.level}`),
    zLabel: z === null ? null : t('alerts.z', { value: z }),
    hourLabel: hour === null ? null : t('alerts.hour', { hour }),
    openedLabel: formatIsoDayTime(alert.openedAt),
  };
}

const openViews = computed<AlertView[]>(() => openAlerts.value.map(toView));
const historyViews = computed<AlertView[]>(() => recentClosedAlerts.value.map(toView));

// First fetch before the first interval, then refresh on the same 60s cadence
// as the status and AI badges (OHeroSection). Stations come from OMapSection,
// which mounts earlier; the name map fills in as that list lands.
const POLL_INTERVAL_MS = 60_000;
usePolling(() => loadAll(), POLL_INTERVAL_MS, { immediate: true });

const showError = computed(() => error.value !== null && openAlerts.value.length === 0);
</script>

<template>
  <section id="alerts" class="o-alerts-panel" aria-labelledby="alerts-title">
    <div class="o-alerts-panel__inner">
      <div class="o-alerts-panel__head">
        <MSectionHeader
          heading-id="alerts-title"
          :eyebrow="t('meta.tagline')"
          :title="t('alerts.title')"
          :subtitle="t('alerts.subtitle')"
          tone="light"
        />
        <span
          v-if="activeAlertsCount > 0"
          class="o-alerts-panel__count"
          role="status"
          aria-live="polite"
        >
          <AIcon name="alert" :size="16" />
          {{ t('alerts.countBadge', { count: activeAlertsCount }) }}
        </span>
      </div>

      <!-- Before the first fetch lands: a neutral loading line, never a
           misleading "nominal" or error state. -->
      <p v-if="!hasLoadedOnce" class="o-alerts-panel__placeholder">
        {{ t('alerts.loading') }}
      </p>

      <p
        v-else-if="showError"
        class="o-alerts-panel__placeholder o-alerts-panel__placeholder--error"
      >
        {{ t('alerts.error') }}
      </p>

      <template v-else>
        <!-- Open episodes — the panel's primary concern. -->
        <div v-if="hasOpenAlerts" class="o-alerts-panel__block">
          <h3 class="o-alerts-panel__block-title">{{ t('alerts.open.title') }}</h3>
          <ul class="o-alerts-panel__list">
            <li v-for="view in openViews" :key="view.id" class="o-alerts-panel__item">
              <div class="o-alerts-panel__item-main">
                <span class="o-alerts-panel__station">{{ view.stationName }}</span>
                <span class="o-alerts-panel__param">{{ view.parameterLabel }}</span>
                <span class="o-alerts-panel__direction">{{ view.directionLabel }}</span>
              </div>
              <div class="o-alerts-panel__item-meta">
                <span
                  :class="[
                    'o-alerts-panel__level',
                    `o-alerts-panel__level--${view.level.toLowerCase()}`,
                  ]"
                  >{{ view.levelLabel }}</span
                >
                <span v-if="view.zLabel" class="o-alerts-panel__stat">{{ view.zLabel }}</span>
                <span v-if="view.hourLabel" class="o-alerts-panel__stat">{{ view.hourLabel }}</span>
              </div>
            </li>
          </ul>
        </div>

        <!-- Nominal: fetched, nothing open. A cared-for state, not a raw void. -->
        <div v-else class="o-alerts-panel__nominal">
          <AIcon name="check" :size="22" class="o-alerts-panel__nominal-icon" />
          <div>
            <p class="o-alerts-panel__nominal-title">{{ t('alerts.nominal.title') }}</p>
            <p class="o-alerts-panel__nominal-body">{{ t('alerts.nominal.body') }}</p>
          </div>
        </div>

        <!-- Recent closed episodes — a short history strip. -->
        <div v-if="historyViews.length > 0" class="o-alerts-panel__block">
          <h3 class="o-alerts-panel__block-title">{{ t('alerts.history.title') }}</h3>
          <ul class="o-alerts-panel__list o-alerts-panel__list--history">
            <li v-for="view in historyViews" :key="view.id" class="o-alerts-panel__item">
              <div class="o-alerts-panel__item-main">
                <span class="o-alerts-panel__station">{{ view.stationName }}</span>
                <span class="o-alerts-panel__param">{{ view.parameterLabel }}</span>
                <span class="o-alerts-panel__direction">{{ view.directionLabel }}</span>
              </div>
              <div class="o-alerts-panel__item-meta">
                <span class="o-alerts-panel__closed-tag">{{ t('alerts.history.closedTag') }}</span>
                <span class="o-alerts-panel__stat">{{ view.openedLabel }}</span>
              </div>
            </li>
          </ul>
        </div>
      </template>

      <p class="o-alerts-panel__disclaimer">
        {{ t('alerts.method') }} {{ t('alerts.disclaimer') }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.o-alerts-panel {
  @apply bg-white py-20;
}

.o-alerts-panel__inner {
  @apply mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 md:px-10;
}

.o-alerts-panel__head {
  @apply flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between;
}

.o-alerts-panel__count {
  @apply inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 font-sans text-sm font-medium text-amber-800;
}

.o-alerts-panel__placeholder {
  @apply rounded-md bg-glacier-soft px-4 py-3 font-mono text-sm text-slate-alpi;
}

.o-alerts-panel__placeholder--error {
  @apply text-graphite;
}

.o-alerts-panel__block {
  @apply flex flex-col gap-3;
}

.o-alerts-panel__block-title {
  @apply font-mono text-xs font-medium uppercase tracking-[0.2em] text-slate-alpi;
}

.o-alerts-panel__list {
  @apply flex flex-col gap-2;
}

.o-alerts-panel__item {
  @apply flex flex-col gap-2 rounded-lg border border-slate-alpi/20 bg-glacier-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between;
}

.o-alerts-panel__list--history .o-alerts-panel__item {
  @apply border-slate-alpi/15 bg-white;
}

.o-alerts-panel__item-main {
  @apply flex flex-wrap items-baseline gap-x-3 gap-y-1;
}

.o-alerts-panel__station {
  @apply font-sans text-base font-semibold text-primary;
}

.o-alerts-panel__param {
  @apply font-sans text-sm text-graphite;
}

.o-alerts-panel__direction {
  @apply font-sans text-sm text-slate-alpi;
}

.o-alerts-panel__item-meta {
  @apply flex shrink-0 flex-wrap items-center gap-2;
}

.o-alerts-panel__level {
  @apply rounded-full px-2.5 py-0.5 font-sans text-xs font-semibold uppercase tracking-wide;
}

.o-alerts-panel__level--vigilance {
  @apply bg-amber-100 text-amber-800;
}

.o-alerts-panel__level--alert {
  @apply bg-red-100 text-red-800;
}

.o-alerts-panel__stat {
  @apply font-mono text-xs text-slate-alpi;
}

.o-alerts-panel__closed-tag {
  @apply rounded-full bg-slate-alpi/10 px-2.5 py-0.5 font-sans text-xs font-medium uppercase tracking-wide text-slate-alpi;
}

.o-alerts-panel__nominal {
  @apply flex items-center gap-3 rounded-lg border border-primary/15 bg-glacier px-5 py-4;
}

.o-alerts-panel__nominal-icon {
  @apply text-primary;
}

.o-alerts-panel__nominal-title {
  @apply font-sans text-base font-semibold text-primary;
}

.o-alerts-panel__nominal-body {
  @apply font-sans text-sm text-slate-alpi;
}

.o-alerts-panel__disclaimer {
  @apply max-w-3xl font-sans text-xs leading-relaxed text-slate-alpi;
}
</style>
