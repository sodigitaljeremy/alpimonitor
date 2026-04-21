<script setup lang="ts">
import type { MeasurementPoint, MeasurementSeries } from '@alpimonitor/shared';
import { scaleLinear, scaleTime } from 'd3-scale';
import { area, line } from 'd3-shape';
import { timeFormat } from 'd3-time-format';
import { computed, onMounted, onScopeDispose, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { computeYDomain, findNearestPointByPx } from './chart-model';

const props = defineProps<{
  series: MeasurementSeries | null;
  windowFrom: Date;
  windowTo: Date;
}>();

const { t } = useI18n();

// Margins are chosen so that a 4-tick y-axis with 2-digit labels fits on
// the left, and the x-axis has room for "HH:mm" labels without clipping.
const MARGIN = { top: 16, right: 16, bottom: 28, left: 44 };

const containerEl = ref<HTMLDivElement | null>(null);
// Defaults match a typical desktop drawer width (~400px after padding).
// Overwritten by ResizeObserver on mount.
const width = ref(400);
const height = ref(220);

const hasData = computed(() => props.series !== null && props.series.points.length > 0);

const yDomain = computed(() => computeYDomain(props.series?.points.map((p) => p.v) ?? []));

const xScale = computed(() =>
  scaleTime()
    .domain([props.windowFrom, props.windowTo])
    .range([MARGIN.left, Math.max(MARGIN.left + 1, width.value - MARGIN.right)])
);

const yScale = computed(() =>
  scaleLinear()
    .domain(yDomain.value)
    .range([height.value - MARGIN.bottom, MARGIN.top])
    .nice()
);

const parsedPoints = computed(() =>
  (props.series?.points ?? []).map((p) => ({ ...p, date: new Date(p.t) }))
);

const linePath = computed(() => {
  if (parsedPoints.value.length === 0) return '';
  const gen = line<{ date: Date; v: number }>()
    .x((p) => xScale.value(p.date))
    .y((p) => yScale.value(p.v));
  return gen(parsedPoints.value) ?? '';
});

const areaPath = computed(() => {
  if (parsedPoints.value.length === 0) return '';
  const baseY = height.value - MARGIN.bottom;
  const gen = area<{ date: Date; v: number }>()
    .x((p) => xScale.value(p.date))
    .y0(baseY)
    .y1((p) => yScale.value(p.v));
  return gen(parsedPoints.value) ?? '';
});

const xTicks = computed(() => {
  // Fewer ticks below 420px so labels don't collide on mobile.
  const tickCount = width.value < 420 ? 3 : 6;
  const fmt = timeFormat('%H:%M');
  return xScale.value.ticks(tickCount).map((d) => ({
    value: d,
    label: fmt(d),
    x: xScale.value(d),
  }));
});

const yTicks = computed(() =>
  yScale.value.ticks(4).map((v) => ({
    value: v,
    label: v.toFixed(1),
    y: yScale.value(v),
  }))
);

const hoverPoint = ref<MeasurementPoint | null>(null);
const hoverX = computed(() => (hoverPoint.value ? xScale.value(new Date(hoverPoint.value.t)) : 0));
const hoverY = computed(() => (hoverPoint.value ? yScale.value(hoverPoint.value.v) : 0));
const hoverTimeLabel = computed(() => {
  if (!hoverPoint.value) return '';
  return timeFormat('%H:%M')(new Date(hoverPoint.value.t));
});

function onPointerMove(evt: PointerEvent): void {
  if (!hasData.value || !containerEl.value || !props.series) return;
  const rect = containerEl.value.getBoundingClientRect();
  // Cursor position in viewBox coordinates. Using the rect + width ratio
  // is robust to CSS scaling (preserveAspectRatio changes pixel → viewBox
  // mapping, so we can't trust evt.offsetX directly).
  const xPx = ((evt.clientX - rect.left) / Math.max(1, rect.width)) * width.value;
  hoverPoint.value = findNearestPointByPx(props.series.points, xPx, (p) =>
    xScale.value(new Date(p.t))
  );
}

function onPointerLeave(): void {
  hoverPoint.value = null;
}

let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (!containerEl.value) return;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = entry.contentRect.width;
      if (w > 0) {
        width.value = w;
        // Aspect ratio clamped to keep the chart readable across sizes.
        height.value = Math.min(280, Math.max(180, w * 0.45));
      }
    });
    resizeObserver.observe(containerEl.value);
  }
});

onScopeDispose(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
});
</script>

<template>
  <div ref="containerEl" class="o-hydro-chart">
    <svg
      v-if="hasData"
      class="o-hydro-chart__svg"
      :viewBox="`0 0 ${width} ${height}`"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      :aria-label="t('drawer.chartAriaLabel')"
      @pointermove="onPointerMove"
      @pointerleave="onPointerLeave"
    >
      <g class="o-hydro-chart__grid">
        <line
          v-for="tick in yTicks"
          :key="`gy-${tick.value}`"
          :x1="MARGIN.left"
          :x2="width - MARGIN.right"
          :y1="tick.y"
          :y2="tick.y"
        />
      </g>

      <path class="o-hydro-chart__area" :d="areaPath" />
      <path class="o-hydro-chart__line" :d="linePath" />

      <g class="o-hydro-chart__y-axis">
        <text
          v-for="tick in yTicks"
          :key="`yt-${tick.value}`"
          :x="MARGIN.left - 6"
          :y="tick.y"
          text-anchor="end"
          dominant-baseline="middle"
        >
          {{ tick.label }}
        </text>
      </g>

      <g class="o-hydro-chart__x-axis">
        <line
          :x1="MARGIN.left"
          :x2="width - MARGIN.right"
          :y1="height - MARGIN.bottom"
          :y2="height - MARGIN.bottom"
        />
        <text
          v-for="tick in xTicks"
          :key="`xt-${tick.value.getTime()}`"
          :x="tick.x"
          :y="height - MARGIN.bottom + 16"
          text-anchor="middle"
        >
          {{ tick.label }}
        </text>
      </g>

      <g v-if="hoverPoint" class="o-hydro-chart__hover">
        <line :x1="hoverX" :x2="hoverX" :y1="MARGIN.top" :y2="height - MARGIN.bottom" />
        <circle :cx="hoverX" :cy="hoverY" r="4" />
      </g>
    </svg>

    <div v-if="!hasData" class="o-hydro-chart__empty">{{ t('drawer.chartEmpty') }}</div>

    <div
      v-if="hoverPoint"
      class="o-hydro-chart__tooltip"
      :style="{
        left: `${(hoverX / width) * 100}%`,
        top: `${(hoverY / height) * 100}%`,
      }"
    >
      <p class="o-hydro-chart__tooltip-value">
        {{ hoverPoint.v.toFixed(2) }} {{ props.series?.unit ?? '' }}
      </p>
      <p class="o-hydro-chart__tooltip-time">{{ hoverTimeLabel }}</p>
    </div>
  </div>
</template>

<style scoped>
.o-hydro-chart {
  @apply relative w-full;
}

.o-hydro-chart__svg {
  @apply block w-full h-auto;
}

.o-hydro-chart__area {
  fill: theme('colors.primary.DEFAULT');
  fill-opacity: 0.1;
}

.o-hydro-chart__line {
  fill: none;
  stroke: theme('colors.primary.DEFAULT');
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.o-hydro-chart__grid line {
  stroke: theme('colors.slate.alpi');
  stroke-opacity: 0.15;
  stroke-dasharray: 2 3;
}

.o-hydro-chart__x-axis line {
  stroke: theme('colors.slate.alpi');
  stroke-opacity: 0.3;
}

.o-hydro-chart__x-axis text,
.o-hydro-chart__y-axis text {
  @apply font-mono text-[10px] fill-slate-alpi;
}

.o-hydro-chart__hover line {
  stroke: theme('colors.primary.DEFAULT');
  stroke-opacity: 0.3;
  stroke-dasharray: 3 3;
}

.o-hydro-chart__hover circle {
  fill: theme('colors.primary.DEFAULT');
  stroke: white;
  stroke-width: 2;
}

.o-hydro-chart__empty {
  @apply flex h-[200px] items-center justify-center rounded-md border border-dashed border-slate-alpi/30 text-center text-sm text-slate-alpi;
}

.o-hydro-chart__tooltip {
  @apply pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-md border border-slate-alpi/20 bg-white/95 px-2 py-1 text-xs shadow-card backdrop-blur;
  margin-top: -8px;
}

.o-hydro-chart__tooltip-value {
  @apply font-mono font-semibold text-primary;
}

.o-hydro-chart__tooltip-time {
  @apply font-mono text-slate-alpi;
}
</style>
