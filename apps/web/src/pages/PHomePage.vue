<script setup lang="ts">
import OHeroSection from '@/components/organisms/OHeroSection.vue';
import OKeyMetricsSection from '@/components/organisms/OKeyMetricsSection.vue';
import OMapSection from '@/components/organisms/OMapSection.vue';
import OResearchZonesSection from '@/components/organisms/OResearchZonesSection.vue';
import OStationDrawer from '@/components/organisms/OStationDrawer.vue';
import OWhyLindasSection from '@/components/organisms/OWhyLindasSection.vue';
import TDefaultLayout from '@/components/templates/TDefaultLayout.vue';
</script>

<template>
  <TDefaultLayout>
    <OHeroSection />
    <OMapSection />
    <OKeyMetricsSection />
    <OWhyLindasSection />
    <OResearchZonesSection />
  </TDefaultLayout>
  <!-- Drawer lives outside the layout so it can teleport to <body>
       regardless of scroll/overflow rules on the main flow. -->
  <OStationDrawer />
</template>
