<script setup>
defineProps({
  user: { type: Object, default: null },
  displayName: { type: String, default: '' },
})
defineEmits(['logout'])
</script>

<template>
  <header class="sticky top-0 z-[1000] bg-ink-950 text-dark-1 shadow-sm">
    <div class="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
      <div class="flex min-w-0 items-center gap-2.5">
        <svg class="h-8 w-8 shrink-0" viewBox="0 0 32 32" aria-hidden="true">
          <rect width="32" height="32" rx="7" fill="#0e9bb3" />
          <path d="M8 20.5c3 0 3.5-9 6.5-9s2.5 6 5.5 6 3-3.5 4-5" fill="none" stroke="#0e1f26" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span class="font-num truncate text-lg font-bold tracking-wide">Jam Pintar</span>
      </div>

      <div v-if="user" class="flex shrink-0 items-center gap-2">
        <span class="hidden text-xs text-dark-2 sm:block">{{ displayName || user.email }}</span>
        <span
          class="flex h-8 w-8 items-center justify-center rounded-full bg-teal-400 font-num text-sm font-bold text-ink-950"
          :title="displayName || user.email"
        >{{ (displayName || user.email || '?')[0].toUpperCase() }}</span>
        <button
          type="button"
          class="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-dark-2 transition hover:bg-ink-800 hover:text-dark-1"
          @click="$emit('logout')"
        >Keluar</button>
      </div>
    </div>
  </header>
</template>