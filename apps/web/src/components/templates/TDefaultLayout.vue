<script setup lang="ts"></script>

<template>
  <div class="t-default-layout">
    <main class="t-default-layout__main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.t-default-layout {
  @apply flex min-h-screen flex-col bg-white;
}

.t-default-layout__main {
  @apply flex-1;
}
</style>
