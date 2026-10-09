<script setup>
defineProps({
  view: { type: String, required: true },
})
defineEmits(['navigate'])

const items = [
  { key: 'home', label: 'Utama' },
  { key: 'records', label: 'Rekor' },
  { key: 'profile', label: 'Profil' },
]
</script>

<template>
  <nav class="fixed inset-x-0 bottom-0 z-[1000] border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]" aria-label="Navigasi utama">
    <div class="mx-auto grid max-w-md grid-cols-3">
      <button
        v-for="it in items"
        :key="it.key"
        type="button"
        :aria-current="view === it.key ? 'page' : undefined"
        class="flex h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold transition focus:outline-none focus-visible:bg-page"
        :class="view === it.key ? 'text-teal-600' : 'text-text-2 hover:text-text-1'"
        @click="$emit('navigate', it.key)"
      >
        <svg v-if="it.key === 'home'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 11.5 12 5l8 6.5" /><path d="M6.5 10v9h11v-9" />
        </svg>
        <svg v-else-if="it.key === 'records'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M8.5 19V10.5m0 0L5 9.5m3.5 1L12 9m-3.5.5L12 9" /><path d="M7 9 12 7.5l4 1.5" /><path d="M16.5 19V13.5L20 12.5v1.5l-3.5 1" />
        </svg>
        <svg v-else class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="8" r="3.4" /><path d="M5 20c0-3.4 3.1-5.5 7-5.5s7 2.1 7 5.5" />
        </svg>
        {{ it.label }}
      </button>
    </div>
  </nav>
</template>