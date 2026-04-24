<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import AIcon from '@/components/atoms/AIcon.vue';

const { t } = useI18n();

const currentYear = new Date().getFullYear();
</script>

<template>
  <footer class="o-site-footer">
    <div class="o-site-footer__inner">
      <div class="o-site-footer__columns">
        <section class="o-site-footer__column">
          <h3 class="o-site-footer__heading">{{ t('footer.sourcesTitle') }}</h3>
          <ul class="o-site-footer__list">
            <li>{{ t('footer.sources.bafu') }}</li>
            <li>{{ t('footer.sources.osm') }}</li>
            <li>{{ t('footer.sources.crealp') }}</li>
          </ul>
        </section>

        <section class="o-site-footer__column">
          <h3 class="o-site-footer__heading">{{ t('footer.linksTitle') }}</h3>
          <ul class="o-site-footer__list">
            <li>
              <a
                class="o-site-footer__link"
                href="https://github.com/sodigitaljeremy/alpimonitor"
                target="_blank"
                rel="noopener noreferrer"
              >
                <AIcon name="github" :size="16" />
                <span>{{ t('footer.links.github') }}</span>
                <AIcon name="external" :size="14" />
              </a>
            </li>
            <li>
              <a
                class="o-site-footer__link"
                href="https://docs.alpimonitor.fr/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>{{ t('footer.links.docs') }}</span>
                <AIcon name="external" :size="14" />
              </a>
            </li>
            <li>
              <a
                class="o-site-footer__link"
                href="https://www.linkedin.com/in/sojeremy/"
                target="_blank"
                rel="noopener noreferrer"
                :aria-label="t('footer.links.linkedinAriaLabel')"
              >
                <AIcon name="linkedin" :size="16" />
                <span>{{ t('footer.links.linkedin') }}</span>
                <AIcon name="external" :size="14" />
              </a>
            </li>
          </ul>
        </section>
      </div>

      <p class="o-site-footer__disclaimer">{{ t('footer.disclaimer') }}</p>

      <p class="o-site-footer__copyright">
        © {{ currentYear }} {{ t('meta.appName') }} — Jeremy Soriano
      </p>
    </div>
  </footer>
</template>

<style scoped>
.o-site-footer {
  @apply border-t border-slate-alpi/20 bg-white;
}

.o-site-footer__inner {
  @apply mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-14 md:px-10;
}

.o-site-footer__columns {
  @apply grid gap-10 md:grid-cols-2;
}

.o-site-footer__heading {
  @apply mb-4 font-mono text-xs font-medium uppercase tracking-widest text-slate-alpi;
}

.o-site-footer__list {
  @apply flex flex-col gap-2 text-sm text-graphite;
}

.o-site-footer__link {
  @apply inline-flex items-center gap-2 text-primary transition-colors hover:text-primary-hover;
}

.o-site-footer__disclaimer {
  @apply max-w-3xl border-t border-slate-alpi/15 pt-8 text-sm text-slate-alpi;
}

.o-site-footer__copyright {
  @apply font-mono text-xs text-slate-alpi;
}
</style>
