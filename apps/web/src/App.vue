<script setup lang="ts">
const appName = 'AlpiMonitor';
</script>

<template>
  <main class="t-main-layout">
    <h1 class="t-main-layout__title">{{ appName }}</h1>
  </main>
</template>

<style scoped>
.t-main-layout {
  @apply flex min-h-screen items-center justify-center bg-slate-50;
}

.t-main-layout__title {
  @apply font-sans text-4xl font-semibold text-slate-900;
}
</style>
