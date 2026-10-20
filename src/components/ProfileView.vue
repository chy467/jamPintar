<script setup>
import { reactive, ref, watch, computed } from 'vue'
import { supabase } from '../lib/supabaseClient'
import { ageFromBirthDate, profileAge } from '../lib/profile'

const props = defineProps({
  profile: { type: Object, default: null },
  email: { type: String, default: '' },
  saving: { type: Boolean, default: false },
})
const emit = defineEmits(['save', 'logout'])

const form = reactive({
  display_name: '',
  birth_date: '',
  gender: '',
  weight_kg: '',
  height_cm: '',
  max_hr: '',
})
const errorMessage = ref('')
const saved = ref(false)

// Profil lama yang belum punya tanggal lahir tetap memakai kolom age.
const formAge = computed(() => {
  const derived = ageFromBirthDate(form.birth_date)
  if (derived != null) return derived
  return form.birth_date ? null : profileAge(props.profile)
})

const pad = (n) => String(n).padStart(2, '0')
const today = new Date()
const todayISO = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`

watch(
  () => props.profile,
  (p) => {
    form.display_name = p?.display_name || ''
    form.birth_date = p?.birth_date || ''
    form.gender = p?.gender || ''
    form.weight_kg = p?.weight_kg || ''
    form.height_cm = p?.height_cm || ''
    form.max_hr = p?.max_hr ?? ''
  },
  { immediate: true },
)

const fill = (path, v) => { saved.value = false; form[path] = v }

const submit = () => {
  errorMessage.value = ''
  const age = ageFromBirthDate(form.birth_date)
  const payload = {
    display_name: form.display_name.trim() || null,
    birth_date: form.birth_date || null,
    gender: form.gender || null,
    weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
    height_cm: form.height_cm ? Number(form.height_cm) : null,
    max_hr: form.max_hr ? Number(form.max_hr) : null,
  }
  if (form.birth_date && age == null) return (errorMessage.value = 'Tanggal lahir tidak valid atau berada di masa depan.')
  if (age != null && (age < 5 || age > 110)) return (errorMessage.value = 'Umur harus antara 5 dan 110 tahun.')
  if (payload.weight_kg != null && (payload.weight_kg < 20 || payload.weight_kg > 300)) return (errorMessage.value = 'Berat badan harus antara 20 dan 300 kg.')
  if (payload.height_cm != null && (payload.height_cm < 50 || payload.height_cm > 250)) return (errorMessage.value = 'Tinggi badan harus antara 50 dan 250 cm.')
  if (payload.max_hr != null && (payload.max_hr < 80 || payload.max_hr > 250)) return (errorMessage.value = 'HR Maks Personal harus antara 80 dan 250 bpm.')
  emit('save', payload)
  saved.value = true
}

const changeEmail = ref('')
const changePassword = ref('')
const emailBusy = ref(false)
const passwordBusy = ref(false)
const accountError = ref('')
const accountInfo = ref('')

const updateEmail = async () => {
  if (!supabase) return
  accountError.value = ''
  accountInfo.value = ''
  emailBusy.value = true
  try {
    const { error } = await supabase.auth.updateUser({ email: changeEmail.value })
    if (error) throw new Error(error.message)
    accountInfo.value = 'Tautan konfirmasi dikirim ke email baru. Setelah dikonfirmasi, email dan sesi login diperbarui.'
    changeEmail.value = ''
  } catch (e) {
    accountError.value = e.message
  } finally {
    emailBusy.value = false
  }
}

const updatePassword = async () => {
  if (!supabase) return
  accountError.value = ''
  accountInfo.value = ''
  if (changePassword.value.length < 6) return (accountError.value = 'Password minimal 6 karakter.')
  passwordBusy.value = true
  try {
    const { error } = await supabase.auth.updateUser({ password: changePassword.value })
    if (error) throw new Error(error.message)
    accountInfo.value = 'Password berhasil diubah.'
    changePassword.value = ''
  } catch (e) {
    accountError.value = e.message
  } finally {
    passwordBusy.value = false
  }
}
</script>

<template>
  <main class="mx-auto w-full max-w-md space-y-4 px-4 pb-32 pt-4">
    <section class="rounded-xl border border-line bg-surface p-5">
      <h1 class="font-num text-xl font-semibold">Profil atlet</h1>
      <p class="mt-1 text-xs text-text-2">Tanggal lahir, jenis kelamin, berat, tinggi, dan HR Maks Personal dipakai untuk perhitungan lanjutan seperti estimasi VO2max, pembakaran kalori, dan zona detak jantung. Umur dihitung otomatis dari tanggal lahir.</p>

      <p v-if="saved" role="status" class="mt-4 rounded-lg border border-teal-400/40 bg-teal-400/10 p-3 text-sm text-teal-600">Profil tersimpan.</p>
      <p v-if="errorMessage" role="alert" class="mt-4 rounded-lg border border-[#e6b3ae] bg-[#fbeceb] p-3 text-sm text-[#a93226]">{{ errorMessage }}</p>

      <form class="mt-4 space-y-4" @submit.prevent="submit">
        <label class="block">
          <span class="text-xs font-semibold text-text-2">Nama tampilan</span>
          <input :value="form.display_name" type="text" placeholder="Nama kamu" class="mt-1 w-full rounded-lg border border-text-2/40 bg-surface px-3.5 py-2.5 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/25" @input="fill('display_name', $event.target.value)" />
        </label>

        <label class="block">
          <span class="text-xs font-semibold text-text-2">Tanggal lahir</span>
          <input :value="form.birth_date" type="date" :max="todayISO" class="mt-1 w-full rounded-lg border border-text-2/40 bg-surface px-3.5 py-2.5 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/25" @input="fill('birth_date', $event.target.value)" />
        </label>

        <div class="space-y-1">
          <div class="grid grid-cols-2 gap-3">
            <label class="block">
              <span class="text-xs font-semibold text-text-2">Jenis kelamin</span>
              <select :value="form.gender" class="mt-1 w-full rounded-lg border border-text-2/40 bg-surface px-3 py-2.5 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/25" @change="fill('gender', $event.target.value)">
                <option value="">Pilih</option>
                <option value="male">Laki-laki</option>
                <option value="female">Perempuan</option>
              </select>
            </label>
            <div>
              <span class="text-xs font-semibold text-text-2">Umur</span>
              <p class="mt-1 w-full rounded-lg border border-line bg-page px-3.5 py-2.5 text-sm">{{ formAge != null ? `${formAge} tahun` : 'Belum diisi' }}</p>
            </div>
          </div>
          <p class="text-[11px] text-text-2">Umur dihitung otomatis dari tanggal lahir, jadi ikut bertambah tanpa perlu diperbarui manual.</p>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="text-xs font-semibold text-text-2">Berat badan (kg)</span>
            <input :value="form.weight_kg" type="number" inputmode="decimal" min="20" max="300" step="0.1" placeholder="65" class="mt-1 w-full rounded-lg border border-text-2/40 bg-surface px-3.5 py-2.5 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/25" @input="fill('weight_kg', $event.target.value)" />
          </label>
          <label class="block">
            <span class="text-xs font-semibold text-text-2">Tinggi badan (cm)</span>
            <input :value="form.height_cm" type="number" inputmode="decimal" min="50" max="250" step="0.5" placeholder="170" class="mt-1 w-full rounded-lg border border-text-2/40 bg-surface px-3.5 py-2.5 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/25" @input="fill('height_cm', $event.target.value)" />
          </label>
        </div>

        <label class="block">
          <span class="text-xs font-semibold text-text-2">HR Maks Personal (bpm)</span>
          <input :value="form.max_hr" type="number" inputmode="numeric" min="80" max="250" placeholder="190" class="mt-1 w-full rounded-lg border border-text-2/40 bg-surface px-3.5 py-2.5 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/25" @input="fill('max_hr', $event.target.value)" />
          <span class="mt-1 block text-[11px] text-text-2">HR Maks Personal digunakan sebagai acuan perhitungan zona detak jantung. Isi berdasarkan hasil pengukuran maksimal atau gunakan estimasi.</span>
        </label>

        <button type="submit" :disabled="saving" class="w-full rounded-lg bg-teal-600 py-3 text-sm font-bold text-white transition hover:bg-teal-600/90 disabled:opacity-50">
          {{ saving ? 'Menyimpan...' : 'Simpan profil' }}
        </button>
      </form>
    </section>

    <section class="rounded-xl border border-line bg-surface p-5">
      <h2 class="font-num text-xl font-semibold">Pengaturan akun</h2>
      <p class="mt-1 text-xs text-text-2">Masuk sebagai <span class="font-medium text-text-1">{{ email }}</span>.</p>

      <p v-if="accountInfo" role="status" class="mt-4 rounded-lg border border-teal-400/40 bg-teal-400/10 p-3 text-sm text-teal-600">{{ accountInfo }}</p>
      <p v-if="accountError" role="alert" class="mt-4 rounded-lg border border-[#e6b3ae] bg-[#fbeceb] p-3 text-sm text-[#a93226]">{{ accountError }}</p>

      <form class="mt-4 space-y-4" @submit.prevent="updateEmail">
        <label class="block">
          <span class="text-xs font-semibold text-text-2">Ganti email</span>
          <input v-model="changeEmail" type="email" name="email" autocomplete="email" required placeholder="email@baru.com" class="mt-1 w-full rounded-lg border border-text-2/40 bg-surface px-3.5 py-2.5 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/25" />
        </label>
        <button type="submit" :disabled="emailBusy" class="w-full rounded-lg border border-teal-600 py-2.5 text-sm font-bold text-teal-600 transition hover:bg-teal-400/10 disabled:opacity-50">
          {{ emailBusy ? 'Mengirim...' : 'Kirim konfirmasi email baru' }}
        </button>
      </form>

      <form class="mt-4 space-y-4 border-t border-line pt-4" @submit.prevent="updatePassword">
        <label class="block">
          <span class="text-xs font-semibold text-text-2">Ganti password</span>
          <input v-model="changePassword" type="password" name="new-password" autocomplete="new-password" required minlength="6" placeholder="Password baru, minimal 6 karakter" class="mt-1 w-full rounded-lg border border-text-2/40 bg-surface px-3.5 py-2.5 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/25" />
        </label>
        <button type="submit" :disabled="passwordBusy" class="w-full rounded-lg bg-teal-600 py-2.5 text-sm font-bold text-white transition hover:bg-teal-600/90 disabled:opacity-50">
          {{ passwordBusy ? 'Menyimpan...' : 'Ganti password' }}
        </button>
      </form>
    </section>

    <section class="rounded-xl border border-line bg-surface p-5 text-xs text-text-2">
      <h2 class="text-sm font-bold text-text-1">Catatan</h2>
      <ul class="mt-2 list-disc space-y-1 pl-5">
        <li>HR Maks Personal dipakai untuk zona detak jantung. HR maksimum tiap aktivitas tetap diambil dari data GPX.</li>
        <li>HR istirahat diatur per aktivitas, di tab Ringkasan masing-masing lari.</li>
        <li>Berat dan tinggi siap dipakai untuk hitung pembakaran kalori dan rasio VO2 terhadap berat badan.</li>
        <li>Umur dihitung otomatis dari tanggal lahir dan dipakai untuk estimasi HR maks serta kategori VO2max.</li>
        <li>Tanpa tanggal lahir dan jenis kelamin, kategori VO2max (tabel Cooper) belum bisa ditampilkan.</li>
      </ul>
    </section>

    <button type="button" class="w-full rounded-xl border border-line bg-surface py-3 text-sm font-semibold text-[#a93226] transition hover:bg-[#fbeceb]" @click="$emit('logout')">
      Keluar dari akun
    </button>
  </main>
</template>