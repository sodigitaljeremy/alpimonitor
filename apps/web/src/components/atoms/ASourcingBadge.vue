<script setup lang="ts">
import { computed, useId } from 'vue';
import { useI18n } from 'vue-i18n';

import AIcon from '@/components/atoms/AIcon.vue';

type Status = 'CONFIRMED' | 'ILLUSTRATIVE';

const props = defineProps<{
  status: Status;
}>();

const { t } = useI18n();
const tooltipId = useId();

const variantKey = computed(() => props.status.toLowerCase() as 'confirmed' | 'illustrative');
const iconName = computed(() => (props.status === 'CONFIRMED' ? 'check' : 'info'));
const label = computed(() => t(`sourcing.${variantKey.value}.label`));
const tooltipText = computed(() => t(`sourcing.${variantKey.value}.tooltip`));
</script>

<template>
  <span
    :class="['a-sourcing-badge', `a-sourcing-badge--${variantKey}`]"
    tabindex="0"
    :aria-describedby="tooltipId"
  >
    <AIcon :name="iconName" :size="12" class="a-sourcing-badge__icon" />
    <span class="a-sourcing-badge__label">{{ label }}</span>
    <span :id="tooltipId" role="tooltip" class="a-sourcing-badge__tooltip">
      {{ tooltipText }}
    </span>
  </span>
</template>

<style scoped>
/* Shape primitives mirror ABadge for cross-atom consistency, minus the
   uppercase styling (the long sourcing label reads better in sentence case). */
.a-sourcing-badge {
  @apply relative inline-flex cursor-help items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-sans text-xs font-medium;
}

.a-sourcing-badge:focus-visible {
  @apply outline-none ring-2 ring-offset-1;
}

/* CONFIRMED — emerald from the Tailwind default palette. We deliberately
   do NOT extend the project palette (ADR-002): reserving a new token for
   a single atom would be disproportionate. Alpine gold is already taken
   by the RESEARCH semantic, so an emerald here keeps the two signals
   orthogonal and readable on the graphite surface of research cards. */
.a-sourcing-badge--confirmed {
  @apply border-emerald-400/40 bg-emerald-400/15 text-emerald-300;
}

.a-sourcing-badge--confirmed:focus-visible {
  @apply ring-emerald-300/50;
}

/* ILLUSTRATIVE — neutral whites aligned with the dark theme secondary
   tokens already used in MStationCard --theme-dark. */
.a-sourcing-badge--illustrative {
  @apply border-white/20 bg-white/5 text-white/70;
}

.a-sourcing-badge--illustrative:focus-visible {
  @apply ring-white/40;
}

.a-sourcing-badge__tooltip {
  /* Hidden by default. We use opacity/visibility rather than display:none
     so the tooltip participates in aria-describedby without being spoken
     twice on focus (screen readers still read it because it's in the DOM). */
  @apply pointer-events-none invisible absolute bottom-full left-1/2 z-10 mb-2 w-64 -translate-x-1/2 rounded-md border border-white/10 bg-graphite-strong px-3 py-2 text-[11px] font-normal leading-snug text-white/90 opacity-0 shadow-card transition-opacity duration-150;
}

.a-sourcing-badge:hover .a-sourcing-badge__tooltip,
.a-sourcing-badge:focus-visible .a-sourcing-badge__tooltip {
  @apply visible opacity-100;
}
</style>
