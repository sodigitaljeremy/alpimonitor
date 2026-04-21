<script setup lang="ts">
type Tone = 'light' | 'dark';

withDefaults(
  defineProps<{
    headingId: string;
    eyebrow?: string;
    title: string;
    subtitle?: string;
    tone?: Tone;
  }>(),
  {
    eyebrow: undefined,
    subtitle: undefined,
    tone: 'light',
  }
);
</script>

<template>
  <header :class="['m-section-header', `m-section-header--${tone}`]">
    <p v-if="eyebrow" class="m-section-header__eyebrow">{{ eyebrow }}</p>
    <h2 :id="headingId" class="m-section-header__title">{{ title }}</h2>
    <p v-if="subtitle" class="m-section-header__subtitle">{{ subtitle }}</p>
  </header>
</template>

<style scoped>
.m-section-header {
  @apply flex flex-col gap-2;
}

.m-section-header__eyebrow {
  @apply font-mono text-xs font-medium uppercase tracking-[0.2em];
}

.m-section-header__title {
  @apply font-sans text-3xl font-semibold leading-tight md:text-4xl;
}

.m-section-header__subtitle {
  @apply max-w-2xl text-base leading-relaxed md:text-lg;
}

.m-section-header--light .m-section-header__eyebrow {
  @apply text-primary/70;
}

.m-section-header--light .m-section-header__title {
  @apply text-primary;
}

.m-section-header--light .m-section-header__subtitle {
  @apply text-slate-alpi;
}

.m-section-header--dark .m-section-header__eyebrow {
  @apply text-alpine;
}

.m-section-header--dark .m-section-header__title {
  @apply text-glacier;
}

.m-section-header--dark .m-section-header__subtitle {
  @apply text-glacier/80;
}
</style>
