<script setup>
import { toasts, dismiss } from '../lib/toast'

const STYLES = {
  success: { box: 'border-teal-400/40 bg-teal-600 text-white', stroke: '#ffffff' },
  error: { box: 'border-[#e6b3ae] bg-[#a93226] text-white', stroke: '#ffffff' },
  info: { box: 'border-line bg-ink-950 text-dark-1', stroke: '#0e9bb3' },
}
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 top-16 z-[3000] flex flex-col items-center gap-2 px-4">
    <transition-group name="toast">
      <button
        v-for="t in toasts"
        :key="t.key"
        type="button"
        :role="t.type === 'error' ? 'alert' : 'status'"
        :aria-live="t.type === 'error' ? 'assertive' : 'polite'"
        class="pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-xl border px-4 py-3 text-left text-sm font-semibold shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
        :class="STYLES[t.type]?.box || STYLES.info.box"
        @click="dismiss(t.id)"
      >
        <svg v-if="t.type === 'success'" class="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" :stroke="STYLES.success.stroke" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        <svg v-else-if="t.type === 'error'" class="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3l10 18H2L12 3zm0 5.2L6.4 19h11.2L12 8.2zM11 12v3h2v-3h-2zm0 4v2h2v-2h-2z" /></svg>
        <svg v-else class="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3a9 9 0 100 18 9 9 0 000-18zm-.75 4h1.5v1.5h-1.5V7zM11 10h2v7h-2v-7z" /></svg>
        <span class="min-w-0 flex-1">{{ t.message }}</span>
      </button>
    </transition-group>
  </div>
</template>

<style scoped>
.toast-enter-active, .toast-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.toast-enter-from, .toast-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>