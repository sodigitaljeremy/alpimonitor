<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import MSectionHeader from '@/components/molecules/MSectionHeader.vue';

const { t, tm, rt } = useI18n();

// Kept in the component, not in fr.json: i18n JSON treats `{...}` as named
// placeholders and `<...>` as HTML, both of which appear in SPARQL syntax.
const SPARQL_EXAMPLE = `PREFIX hg: <https://environment.ld.admin.ch/foen/hydro/>
PREFIX schema: <http://schema.org/>

SELECT ?station ?discharge ?measuredAt WHERE {
  ?obs a hg:RiverObservation ;
       hg:station ?station ;
       hg:discharge ?discharge ;
       hg:measurementTime ?measuredAt .
}
ORDER BY DESC(?measuredAt)
LIMIT 100`;

const SPARQL_KEYWORDS = [
  'PREFIX',
  'SELECT',
  'WHERE',
  'ORDER',
  'BY',
  'DESC',
  'LIMIT',
  'a',
] as const satisfies readonly string[];

type Token = { text: string; kind: 'keyword' | 'uri' | 'text' };

const paragraphs = computed(() => {
  const raw = tm('whyLindas.paragraphs') as unknown;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((entry) => rt(entry));
});

const sparqlLines = computed(() => SPARQL_EXAMPLE.split('\n').map((line) => highlightLine(line)));

function highlightLine(line: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /(<[^>]+>|"[^"]*"|[A-Za-z_][A-Za-z0-9_:]*|\s+|.)/g;
  let match;
  while ((match = pattern.exec(line)) !== null) {
    const text = match[0];
    if (/^<[^>]+>$/.test(text)) {
      tokens.push({ text, kind: 'uri' });
    } else if ((SPARQL_KEYWORDS as readonly string[]).includes(text)) {
      tokens.push({ text, kind: 'keyword' });
    } else {
      tokens.push({ text, kind: 'text' });
    }
  }
  return tokens;
}
</script>

<template>
  <section class="o-why-lindas-section" aria-labelledby="why-lindas-title">
    <div class="o-why-lindas-section__inner">
      <MSectionHeader
        eyebrow="Pivot technique — ADR-007"
        :title="t('whyLindas.title')"
        tone="light"
      />

      <div class="o-why-lindas-section__body">
        <div class="o-why-lindas-section__prose">
          <p v-for="(paragraph, index) in paragraphs" :key="index">
            {{ paragraph }}
          </p>
        </div>

        <figure class="o-why-lindas-section__code-figure">
          <figcaption class="o-why-lindas-section__code-caption">
            {{ t('whyLindas.snippet.caption') }}
          </figcaption>
          <pre class="o-why-lindas-section__code"><code>
<span
  v-for="(line, lineIndex) in sparqlLines"
  :key="lineIndex"
  class="o-why-lindas-section__code-line"
><span
    v-for="(token, tokenIndex) in line"
    :key="tokenIndex"
    :class="['o-why-lindas-section__token', `o-why-lindas-section__token--${token.kind}`]"
  >{{ token.text }}</span></span></code></pre>
        </figure>
      </div>
    </div>
  </section>
</template>

<style scoped>
.o-why-lindas-section {
  @apply bg-glacier py-20;
}

.o-why-lindas-section__inner {
  @apply mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 md:px-10;
}

.o-why-lindas-section__body {
  @apply grid gap-10 md:grid-cols-[1.1fr_1fr] md:items-start;
}

.o-why-lindas-section__prose {
  @apply flex flex-col gap-4 text-base leading-relaxed text-graphite;
}

.o-why-lindas-section__code-figure {
  @apply flex flex-col gap-3;
}

.o-why-lindas-section__code-caption {
  @apply font-mono text-xs uppercase tracking-widest text-slate-alpi;
}

.o-why-lindas-section__code {
  @apply overflow-x-auto rounded-lg border border-slate-alpi/15 bg-white p-5 font-mono text-[0.8rem] leading-relaxed shadow-card;
}

.o-why-lindas-section__code-line {
  @apply block whitespace-pre;
}

.o-why-lindas-section__token--keyword {
  @apply font-medium text-primary;
}

.o-why-lindas-section__token--uri {
  @apply text-alpine;
}

.o-why-lindas-section__token--text {
  @apply text-graphite;
}
</style>
