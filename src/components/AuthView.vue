<script setup>
import { ref } from 'vue'
import { supabase } from '../lib/supabaseClient'

const mode = ref('login')
const email = ref('')
const password = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const infoMessage = ref('')
const unconfigured = !supabase

const switchMode = () => {
  mode.value = mode.value === 'login' ? 'signup' : 'login'
  errorMessage.value = ''
  infoMessage.value = ''
}

const submit = async () => {
  if (!supabase) return
  errorMessage.value = ''
  infoMessage.value = ''
  isLoading.value = true
  try {
    if (mode.value === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email: email.value, password: password.value })
      if (error) errorMessage.value = error.message
    } else {
      const { data, error } = await supabase.auth.signUp({ email: email.value, password: password.value })
      if (error) {
        errorMessage.value = error.message
      } else if (data.session) {
        mode.value = 'login'
      } else {
        infoMessage.value = 'Akun dibuat. Cek email kamu untuk konfirmasi sebelum masuk.'
        mode.value = 'login'
      }
    }
  } catch {
    errorMessage.value = 'Terjadi kesalahan jaringan. Coba lagi.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <main class="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-sm flex-col justify-center px-4 py-10">
    <div class="rounded-xl border border-line bg-surface p-6">
      <div class="flex items-center gap-2.5">
        <svg class="h-9 w-9" viewBox="0 0 32 32" aria-hidden="true">
          <rect width="32" height="32" rx="7" fill="#0e9bb3" />
          <path d="M8 20.5c3 0 3.5-9 6.5-9s2.5 6 5.5 6 3-3.5 4-5" fill="none" stroke="#0e1f26" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <div>
          <h1 class="font-num text-xl font-bold">Jam Pintar</h1>
          <p class="text-xs text-text-2">Dashboard lari dari file GPX</p>
        </div>
      </div>

      <p class="mt-5 text-sm text-text-2">
        {{ mode === 'login' ? 'Masuk untuk melihat aktivitas lari dan analisis kamu.' : 'Buat akun untuk menyimpan aktivitas GPX kamu.' }}
      </p>

      <p v-if="unconfigured" role="status" class="mt-4 rounded-lg border border-[#e6b3ae] bg-[#fbeceb] p-3 text-sm text-[#a93226]">
        Supabase belum dikonfigurasi. Tambahkan <code class="font-mono">VITE_SUPABASE_URL</code> dan
        <code class="font-mono">VITE_SUPABASE_PUBLISHABLE_KEY</code> di file <code class="font-mono">.env</code> lalu jalankan
        <code class="font-mono">npm run build</code> ulang.
      </p>

      <p v-if="errorMessage" role="alert" class="mt-4 rounded-lg border border-[#e6b3ae] bg-[#fbeceb] p-3 text-sm text-[#a93226]">{{ errorMessage }}</p>
      <p v-if="infoMessage" role="status" class="mt-4 rounded-lg border border-teal-400/40 bg-teal-400/10 p-3 text-sm text-teal-600">{{ infoMessage }}</p>

      <form class="mt-4 space-y-4" @submit.prevent="submit">
        <label class="block">
          <span class="text-xs font-semibold text-text-2">Email</span>
          <input v-model="email" type="email" name="email" autocomplete="email" required placeholder="runner@example.com"
            class="mt-1 w-full rounded-lg border border-text-2/40 bg-surface px-3.5 py-2.5 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/25" />
        </label>
        <label class="block">
          <span class="text-xs font-semibold text-text-2">Password</span>
          <input v-model="password" type="password" name="password" autocomplete="current-password" required minlength="6" placeholder="Minimal 6 karakter"
            class="mt-1 w-full rounded-lg border border-text-2/40 bg-surface px-3.5 py-2.5 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/25" />
        </label>
        <button type="submit" :disabled="isLoading"
          class="w-full rounded-lg bg-teal-600 py-3 text-sm font-bold text-white transition hover:bg-teal-600/90 disabled:opacity-50">
          {{ isLoading ? 'Memproses...' : mode === 'login' ? 'Masuk' : 'Buat akun' }}
        </button>
      </form>

      <button type="button" class="mt-4 w-full text-center text-sm font-semibold text-teal-600 transition hover:underline" @click="switchMode">
        {{ mode === 'login' ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk' }}
      </button>
    </div>

    <p class="mt-6 text-center text-xs text-text-2">
      Aktivitas disimpan di database Supabase milik akunmu.
    </p>
  </main>
</template>