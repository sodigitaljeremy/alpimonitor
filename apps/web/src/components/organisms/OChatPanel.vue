<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import AIcon from '@/components/atoms/AIcon.vue';
import MSectionHeader from '@/components/molecules/MSectionHeader.vue';
import { useDataChat } from '@/composables/chat/useDataChat';

// AI layer — extension C6 (ADR-012 D7). A DEDICATED, scrollable section (not a
// floating widget) for asking grounded questions about the network's structured
// data. It owns a local chat thread via useDataChat; the backend is stateless
// and single-turn, so this transcript is purely client-side.
//
// Honest by construction: a permanent disclaimer (consistent with A/B), a visible
// trace of WHICH whitelisted tools answered (`used`), and explicit loading / error
// / refusal states — the model's "je ne peux pas répondre" is just an answer.

const { t, locale } = useI18n();

const { messages, isLoading, error, hasMessages, ask } = useDataChat();

const draft = ref('');
const thread = ref<HTMLElement | null>(null);

const canSend = computed(() => draft.value.trim() !== '' && !isLoading.value);

// Discoverability (feat/chat-ux): in the empty state we offer a few clickable
// example questions, one per whitelisted function, so the user learns the scope
// by example. A click sends the question straight away; the chips vanish as soon
// as a conversation starts (they only render while `hasMessages` is false).
const exampleKeys = ['flow', 'trend', 'anomalies', 'stations'] as const;
const examples = computed(() =>
  exampleKeys.map((key) => ({ key, label: t(`chat.examples.${key}`) }))
);

// Map the model's tool names to readable labels for the discreet `used` trace.
function toolLabel(tool: string): string {
  const key = `chat.tool.${tool}`;
  const label = t(key);
  // vue-i18n returns the key itself when missing; fall back to the raw name.
  return label === key ? tool : label;
}

async function submit(): Promise<void> {
  if (!canSend.value) return;
  const question = draft.value;
  draft.value = '';
  // Pass the active locale so the answer language tracks the UI (FR today).
  await ask(question, locale.value);
}

// A suggested-question chip sends its text directly — no detour through the
// input. Guarded by isLoading like submit() so a double-click can't fire twice.
async function askExample(question: string): Promise<void> {
  if (isLoading.value) return;
  await ask(question, locale.value);
}

// Keep the latest turn in view as the thread grows or a request resolves.
watch(
  () => [messages.value.length, isLoading.value],
  async () => {
    await nextTick();
    const el = thread.value;
    if (el) el.scrollTop = el.scrollHeight;
  }
);
</script>

<template>
  <section id="chat" class="o-chat-panel" aria-labelledby="chat-title">
    <div class="o-chat-panel__inner">
      <MSectionHeader
        heading-id="chat-title"
        :eyebrow="t('meta.tagline')"
        :title="t('chat.title')"
        :subtitle="t('chat.subtitle')"
        tone="light"
      />

      <div
        ref="thread"
        class="o-chat-panel__thread"
        role="log"
        aria-live="polite"
        :aria-label="t('chat.title')"
      >
        <div v-if="!hasMessages" class="o-chat-panel__empty">
          <p class="o-chat-panel__intro">{{ t('chat.intro') }}</p>
          <p class="o-chat-panel__examples-label">{{ t('chat.examples.label') }}</p>
          <ul class="o-chat-panel__examples">
            <li v-for="example in examples" :key="example.key">
              <button
                type="button"
                class="o-chat-panel__example"
                :disabled="isLoading"
                @click="askExample(example.label)"
              >
                {{ example.label }}
              </button>
            </li>
          </ul>
        </div>

        <template v-else>
          <div
            v-for="message in messages"
            :key="message.id"
            :class="['o-chat-panel__turn', `o-chat-panel__turn--${message.role}`]"
          >
            <span class="o-chat-panel__role">
              {{ message.role === 'user' ? t('chat.you') : t('chat.assistant') }}
            </span>

            <div
              v-if="message.role === 'user'"
              class="o-chat-panel__bubble o-chat-panel__bubble--user"
            >
              {{ message.content }}
            </div>

            <div v-else class="o-chat-panel__bubble o-chat-panel__bubble--assistant">
              <p class="o-chat-panel__answer">{{ message.answer }}</p>
              <p v-if="message.used.length > 0" class="o-chat-panel__used">
                {{ t('chat.usedLabel') }}
                {{ message.used.map((u) => toolLabel(u.tool)).join(', ') }}
              </p>
            </div>
          </div>
        </template>

        <!-- In-flight: a discreet typing line below the thread. -->
        <p
          v-if="isLoading"
          class="o-chat-panel__status o-chat-panel__status--loading"
          role="status"
        >
          {{ t('chat.sending') }}
        </p>

        <!-- Transport / guard failure, mapped to an honest reason. -->
        <p v-if="error" class="o-chat-panel__status o-chat-panel__status--error" role="alert">
          {{ t(`chat.error.${error.reason}`) }}
        </p>
      </div>

      <form class="o-chat-panel__form" @submit.prevent="submit">
        <label class="o-chat-panel__label" for="chat-input">{{ t('chat.title') }}</label>
        <div class="o-chat-panel__field">
          <input
            id="chat-input"
            v-model="draft"
            class="o-chat-panel__input"
            type="text"
            autocomplete="off"
            :placeholder="t('chat.placeholder')"
            :disabled="isLoading"
          />
          <button class="o-chat-panel__send" type="submit" :disabled="!canSend">
            {{ isLoading ? t('chat.sending') : t('chat.send') }}
          </button>
        </div>
      </form>

      <p class="o-chat-panel__disclaimer">
        <AIcon name="info" :size="16" class="o-chat-panel__disclaimer-icon" />
        {{ t('chat.disclaimer') }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.o-chat-panel {
  @apply bg-glacier-soft py-20;
}

.o-chat-panel__inner {
  @apply mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 md:px-10;
}

.o-chat-panel__thread {
  @apply flex max-h-96 min-h-[12rem] flex-col gap-4 overflow-y-auto rounded-xl border border-slate-alpi/20 bg-white p-5;
}

.o-chat-panel__empty {
  @apply m-auto flex max-w-md flex-col items-center gap-3 text-center;
}

.o-chat-panel__intro {
  @apply max-w-md font-sans text-sm text-slate-alpi;
}

.o-chat-panel__examples-label {
  @apply font-mono text-[0.65rem] font-medium uppercase tracking-[0.2em] text-slate-alpi;
}

.o-chat-panel__examples {
  @apply flex flex-wrap justify-center gap-2;
}

.o-chat-panel__example {
  @apply rounded-full border border-primary/30 bg-white px-3.5 py-1.5 font-sans text-xs text-primary transition-colors hover:border-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50;
}

.o-chat-panel__turn {
  @apply flex flex-col gap-1;
}

.o-chat-panel__turn--user {
  @apply items-end;
}

.o-chat-panel__turn--assistant {
  @apply items-start;
}

.o-chat-panel__role {
  @apply font-mono text-[0.65rem] font-medium uppercase tracking-[0.2em] text-slate-alpi;
}

.o-chat-panel__bubble {
  @apply max-w-[85%] rounded-2xl px-4 py-2.5 font-sans text-sm leading-relaxed;
}

.o-chat-panel__bubble--user {
  @apply rounded-br-sm bg-primary text-white;
}

.o-chat-panel__bubble--assistant {
  @apply flex flex-col gap-1.5 rounded-bl-sm bg-glacier-soft text-graphite;
}

.o-chat-panel__answer {
  @apply whitespace-pre-line;
}

.o-chat-panel__used {
  @apply font-mono text-[0.7rem] text-slate-alpi;
}

.o-chat-panel__status {
  @apply font-sans text-sm;
}

.o-chat-panel__status--loading {
  @apply text-slate-alpi;
}

.o-chat-panel__status--error {
  @apply text-red-700;
}

.o-chat-panel__form {
  @apply flex flex-col gap-1.5;
}

.o-chat-panel__label {
  @apply sr-only;
}

.o-chat-panel__field {
  @apply flex flex-col gap-2 sm:flex-row;
}

.o-chat-panel__input {
  @apply w-full rounded-lg border border-slate-alpi/30 bg-white px-4 py-2.5 font-sans text-sm text-graphite outline-none focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-60;
}

.o-chat-panel__send {
  @apply shrink-0 rounded-lg bg-primary px-5 py-2.5 font-sans text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40;
}

.o-chat-panel__disclaimer {
  @apply inline-flex items-center gap-1.5 font-sans text-xs leading-relaxed text-slate-alpi;
}

.o-chat-panel__disclaimer-icon {
  @apply shrink-0 text-slate-alpi;
}
</style>
