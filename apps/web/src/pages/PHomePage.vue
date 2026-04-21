<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <main class="p-home-page">
    <h1 class="p-home-page__title">{{ t('meta.appName') }}</h1>
    <p class="p-home-page__tagline">{{ t('meta.tagline') }}</p>
  </main>
</template>

<style scoped>
.p-home-page {
  @apply flex min-h-screen flex-col items-center justify-center gap-2 bg-slate-50 p-8;
}

.p-home-page__title {
  @apply font-sans text-4xl font-semibold text-slate-900;
}

.p-home-page__tagline {
  @apply text-slate-600;
}
</style>
