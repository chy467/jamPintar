<script setup>
import { computed, ref } from 'vue'
import { fmtDur, fmtPace } from '../lib/format'
import { routeThumb } from '../lib/gpx'
import { cooperBand, activityVO2, badgesForTrack } from '../lib/performance'
import { profileAge } from '../lib/profile'

const props = defineProps({
  tracks: { type: Array, default: () => [] },
  profile: { type: Object, default: null },
  vo2: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  importing: { type: Boolean, default: false },
  importError: { type: String, default: '' },
})
defineEmits(['open', 'files', 'nav', 'retry', 'quickdelete'])

const dupIds = computed(() => {
  const seen = new Map()
  const ids = new Set()
  for (const t of props.tracks) {
    const sig = `${t.date}|${Math.round(t.distance)}|${Math.round(t.duration)}`
    if (seen.has(sig)) { ids.add(t.id); ids.add(seen.get(sig)) } else seen.set(sig, t.id)
  }
  return ids
})

const DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

const kmForDay = (key) => props.tracks.filter((t) => new Date(t.date).toDateString() === key).reduce((s, t) => s + t.distance / 1000, 0)

const stripOffset = ref(0)
const selectedDate = ref(null)
let startX = null
let swiping = false

const stripEnd = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - stripOffset.value)
  return d
}

const strip = computed(() => {
  const end = stripEnd()
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(end)
    d.setDate(end.getDate() - (6 - i))
    const key = d.toDateString()
    return { key, date: d, label: DAY_LABELS[d.getDay()], num: d.getDate(), km: kmForDay(key), today: i === 6 && stripOffset.value === 0 }
  })
})

const week = computed(() => {
  const keys = new Set(strip.value.map((d) => d.key))
  let runs = 0, sec = 0, km = 0
  for (const t of props.tracks) {
    if (!keys.has(new Date(t.date).toDateString())) continue
    km += t.distance / 1000
    runs++
    sec += t.duration
  }
  return { runs, sec, km }
})

const focusKey = computed(() => selectedDate.value || strip.value[6]?.key)
const isFocus = (d) => d.key === focusKey.value
const selectedLabel = computed(() => {
  const dd = strip.value.find((d) => d.key === focusKey.value)
  if (!dd) return ''
  const full = dd.date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return selectedDate.value == null ? `Hari ini · ${full}` : full
})

const selectDay = (d) => { if (swiping) return; selectedDate.value = d.key }
const clearDay = () => { selectedDate.value = null }
const goOlder = () => {
  stripOffset.value++
  selectedDate.value = strip.value[6]?.key ?? null
}
const goNewer = () => {
  if (stripOffset.value === 0) return
  stripOffset.value--
  selectedDate.value = strip.value[6]?.key ?? null
}

const onStripDown = (e) => { startX = e.clientX; swiping = false }
const onStripUp = (e) => {
  if (startX == null) return
  const dx = e.clientX - startX
  startX = null
  if (Math.abs(dx) < 40) return
  swiping = true
  if (dx > 0) goOlder(); else goNewer()
}

const visibleTracks = computed(() => {
  if (selectedDate.value == null) return props.tracks
  return props.tracks.filter((t) => new Date(t.date).toDateString() === selectedDate.value)
})

const totals = computed(() => {
  if (!props.tracks.length) return null
  return {
    count: props.tracks.length,
    km: props.tracks.reduce((s, t) => s + t.distance, 0) / 1000,
    sec: props.tracks.reduce((s, t) => s + t.duration, 0),
  }
})

const band = computed(() =>
  props.vo2?.value != null
    ? cooperBand(props.vo2.value, props.profile?.gender, profileAge(props.profile))
    : null,
)

const spark = computed(() => {
  const d = props.vo2?.perActivity?.filter((x) => x.perf != null) || []
  const vals = d.slice(-30).map((x) => x.perf)
  if (vals.length < 2) return ''
  const W = 100, H = 28, P = 4
  const min = Math.min(...vals), max = Math.max(...vals)
  const Y = (v) => P + (1 - (v - min) / (max - min || 1)) * (H - 2 * P)
  return vals.map((v, i) => `${i ? 'L' : 'M'}${((i / (vals.length - 1)) * W).toFixed(1)} ${Y(v).toFixed(1)}`).join('')
})

const vo2Of = (t) => activityVO2(t, props.profile).value
const badgesOf = (t) => badgesForTrack(props.tracks, t.id)
</script>

<template>
  <main class="mx-auto w-full max-w-2xl space-y-4 px-4 pb-32 pt-4">
    <section v-if="loading" class="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface py-14 text-center">
      <span class="h-6 w-6 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" aria-hidden="true"></span>
      <p class="text-sm text-text-2">Memuat aktivitas...</p>
    </section>

    <section v-else-if="error" class="rounded-xl border border-line bg-surface px-4 py-10 text-center" role="alert">
      <p class="text-sm font-semibold text-text-1">Gagal memuat data</p>
      <p class="mt-1 text-sm text-text-2">{{ error }}</p>
      <button type="button" class="mt-4 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-teal-600/90" @click="$emit('retry')">Coba lagi</button>
    </section>

    <template v-else>
      <section class="rounded-xl border border-line bg-surface p-4">
        <div class="flex items-end justify-between gap-2">
          <div>
            <h2 class="text-xs font-semibold text-text-2">7 hari terakhir</h2>
            <p class="font-num mt-1 text-4xl font-bold leading-none">{{ week.km.toFixed(1) }}<span class="ml-1 text-base font-medium text-text-2">km</span></p>
          </div>
          <p class="text-right text-xs text-text-2">{{ week.runs }} aktivitas<br />{{ fmtDur(week.sec) }}</p>
        </div>

        <div class="mt-3 flex items-center gap-1">
          <button
            type="button"
            aria-label="Lihat tanggal sebelumnya"
            class="flex h-9 w-8 shrink-0 items-center justify-center rounded-lg text-text-2 transition hover:bg-page hover:text-text-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            @click="goOlder"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <div
            class="flex flex-1 touch-pan-y select-none flex-col items-center gap-1.5"
            @pointerdown="onStripDown"
            @pointerup="onStripUp"
            @pointercancel="startX = null"
            @pointerleave="startX = null"
          >
            <div class="flex w-full justify-between gap-1">
              <button
                v-for="d in strip"
                :key="d.key"
                type="button"
                class="flex flex-col items-center gap-1 focus:outline-none"
                :aria-pressed="isFocus(d) ? 'true' : 'false'"
                @click="selectDay(d)"
              >
                <span
                  :class="[
                    'day-ring font-num flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition',
                    isFocus(d)
                      ? 'is-selected border-teal-600 bg-teal-600 text-white'
                      : d.today
                        ? 'border-teal-400 bg-teal-400/30 text-ink-950'
                        : d.km
                          ? 'border-teal-400/70 text-teal-600'
                          : 'border-line text-text-2',
                  ]"
                >{{ d.num }}</span>
                <span :class="['text-[11px]', d.today ? 'font-bold text-teal-600' : 'text-text-2']">{{ d.label }}</span>
              </button>
            </div>
          </div>
          <button
            type="button"
            aria-label="Lihat tanggal selanjutnya"
            :disabled="stripOffset === 0"
            class="flex h-9 w-8 shrink-0 items-center justify-center rounded-lg text-text-2 transition hover:bg-page hover:text-text-1 disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            @click="goNewer"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        <p class="mt-2.5 text-center text-xs font-semibold text-text-1" aria-live="polite">{{ selectedLabel }}</p>
      </section>

      <section v-if="vo2 && vo2.value" class="relative overflow-hidden rounded-xl bg-ink-950 p-5 text-dark-1">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-xs font-semibold tracking-wide text-teal-400">Estimasi VO2max</p>
            <p class="font-num text-5xl font-bold leading-none">{{ vo2.value }}</p>
            <p class="mt-1 text-xs capitalize text-dark-2">
              {{ vo2.method === 'hr' ? 'Dari detak jantung (Uth)' : 'Dari pace dan kemiringan (ACSM)' }}
            </p>
          </div>
          <button type="button" class="shrink-0 rounded-lg bg-teal-400 px-3 py-2 text-xs font-bold text-ink-950 transition hover:bg-teal-400/90" @click="$emit('nav', 'records')">
            Detail & rekor
          </button>
        </div>
        <svg v-if="spark" class="mt-4 h-8 w-full" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
          <path :d="spark" fill="none" stroke="#0e9bb3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <p v-if="band" class="mt-3 inline-block rounded-md bg-teal-400/15 px-2.5 py-1 text-xs font-bold text-teal-400">{{ band.label }}</p>
        <p v-else class="mt-3 text-xs text-dark-2">Lengkapi umur dan jenis kelamin di Profil untuk melihat kategori.</p>
      </section>

      <section v-else-if="tracks.length" class="rounded-xl border border-dashed border-text-2/40 p-4">
        <p class="text-sm font-semibold">Estimasi VO2max belum tersedia</p>
        <p class="mt-1 text-xs text-text-2">Butuh aktivitas dengan segmen berjalan minimal 10 menit dan data GPS yang valid, atau data detak jantung (HR Maks Personal dan HR istirahat) di Profil dan detail aktivitas.</p>
      </section>

      <section class="rounded-xl border border-line bg-surface p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="text-sm font-bold">Impor aktivitas</h2>
            <p class="mt-0.5 text-xs text-text-2">Pilih file GPX dari jam tangan atau aplikasi perekam.</p>
          </div>
          <label class="relative flex min-h-11 cursor-pointer items-center rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-bold text-white transition focus-within:ring-2 focus-within:ring-teal-600/40 hover:bg-teal-600/90">
            <span>{{ importing ? 'Mengimpor...' : 'Pilih file GPX' }}</span>
            <input
              type="file"
              accept=".gpx,application/gpx+xml"
              multiple
              class="sr-only"
              :disabled="importing"
              @change="$emit('files', $event.target.files)"
            />
          </label>
        </div>
        <p v-if="importError" role="alert" class="mt-3 rounded-lg border border-[#e6b3ae] bg-[#fbeceb] p-3 text-sm text-[#a93226]">{{ importError }}</p>
      </section>

      <section v-if="totals" class="grid grid-cols-3 divide-x divide-line rounded-xl border border-line bg-surface">
        <div class="p-4">
          <p class="text-[11px] text-text-2">Aktivitas</p>
          <p class="font-num text-2xl font-bold leading-tight">{{ totals.count }}</p>
        </div>
        <div class="p-4">
          <p class="text-[11px] text-text-2">Total jarak</p>
          <p class="font-num text-2xl font-bold leading-tight">{{ totals.km.toFixed(1) }}<span class="text-xs font-medium text-text-2"> km</span></p>
        </div>
        <div class="p-4">
          <p class="text-[11px] text-text-2">Total waktu</p>
          <p class="font-num text-2xl font-bold leading-tight">{{ fmtDur(totals.sec) }}</p>
        </div>
      </section>

      <template v-if="tracks.length">
        <div class="flex items-center justify-between gap-2 pt-1">
          <h2 class="font-num text-xl font-semibold">Aktivitas</h2>
          <button v-if="selectedDate" type="button" class="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-text-1 transition hover:bg-page" @click="clearDay">
            Tampilkan semua
          </button>
        </div>

        <template v-if="visibleTracks.length">
          <article
            v-for="t in visibleTracks"
            :key="t.id"
            class="relative rounded-xl border border-line bg-surface transition hover:border-teal-400/60"
          >
          <button
            type="button"
            class="w-full p-4 pr-12 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            @click="$emit('open', t)"
          >
            <div class="flex items-center gap-3">
              <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-400/15 text-teal-600">
                <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="14.5" cy="4.5" r="2.2" /><path d="M12.6 8.2l-3.4 1.6-1.9 3.5 1.7.9 1.3-2.4 1.6-.7-1 3.3 2.4 2.3.9 4.8 1.9-.4-1-5.6-1.7-1.6.7-2.2 1.3 1.6 3-.3-.2-1.9-2 .2-1.9-2.3a3 3 0 00-2.7-1.8z" /></svg>
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-bold">{{ t.title }}</p>
                <p class="text-xs text-text-2">{{ new Date(t.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' }) }}</p>
              </div>
            </div>
            <div class="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span v-if="vo2Of(t)" class="inline-flex shrink-0 items-center rounded-md bg-teal-400/15 px-2 py-0.5 text-[11px] font-bold text-teal-600">
                <svg class="mr-1 h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l1.9 4.3 4.6.4-3.5 3 1 4.6L12 11.9l-4 2.4 1-4.6-3.5-3 4.6-.4z" /></svg>
                VO2 {{ vo2Of(t) }}
              </span>
              <span v-for="b in badgesOf(t)" :key="b" class="inline-flex shrink-0 items-center rounded-md border border-line bg-page px-2 py-0.5 text-[11px] font-semibold text-text-1">
                <svg class="mr-1 h-3 w-3 text-teal-600" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l1.9 4.3 4.6.4-3.5 3 1 4.6L12 11.9l-4 2.4 1-4.6-3.5-3 4.6-.4z" /></svg>
                {{ b }}
              </span>
              <span v-if="dupIds.has(t.id)" class="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#e6b3ae] bg-[#fbeceb] px-2 py-0.5 text-[11px] font-semibold text-[#a93226]">
                <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3l10 18H2L12 3zm0 5.2L6.4 19h11.2L12 8.2zM11 12v3h2v-3h-2zm0 4v2h2v-2h-2z" /></svg>
                Kemungkinan data ganda
              </span>
            </div>
            <div class="mt-4 flex items-end justify-between gap-3">
              <div class="grid grid-cols-3 gap-5">
                <div><p class="text-[11px] text-text-2">Jarak</p><p class="font-num text-2xl font-bold leading-tight">{{ (t.distance / 1000).toFixed(2) }}<span class="ml-0.5 text-xs text-text-2">km</span></p></div>
                <div><p class="text-[11px] text-text-2">Waktu</p><p class="font-num text-2xl font-bold leading-tight">{{ fmtDur(t.duration) }}</p></div>
                <div><p class="text-[11px] text-text-2">Pace</p><p class="font-num text-2xl font-bold leading-tight">{{ fmtPace(t.avgPace) }}<span class="ml-0.5 text-xs text-text-2">/km</span></p></div>
              </div>
              <svg v-if="t.thumb" class="h-14 w-20 shrink-0 rounded-lg bg-page" viewBox="0 0 60 44" aria-hidden="true">
                <path :d="t.thumb" fill="none" stroke="#0a6a7d" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>
          </button>

          <button
            v-if="dupIds.has(t.id)"
            type="button"
            aria-label="Hapus aktivitas ganda ini"
            title="Hapus aktivitas ini"
            class="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-page text-text-2 transition hover:border-[#e6b3ae] hover:bg-[#fbeceb] hover:text-[#a93226] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            @click="$emit('quickdelete', t)"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-9 0l1 13h8l1-13" /></svg>
          </button>
        </article>
        </template>

        <section v-else class="rounded-xl border border-dashed border-text-2/40 p-8 text-center">
          <p class="text-sm font-semibold">{{ selectedDate ? 'Tidak ada aktivitas di tanggal ini' : 'Belum ada aktivitas' }}</p>
          <p class="mt-1 text-xs text-text-2">{{ selectedDate ? 'Coba pilih tanggal lain di kalender di atas, atau tampilkan semua aktivitas.' : 'Impor file GPX pertama untuk melihat peta, split, personal best, dan estimasi VO2max.' }}</p>
          <button v-if="selectedDate" type="button" class="mt-4 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-teal-600/90" @click="clearDay">Tampilkan semua</button>
        </section>
      </template>
    </template>
  </main>
</template>

<style scoped>
.day-ring.is-selected {
  animation: ring-glow 1.8s ease-in-out infinite;
}

@keyframes ring-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(14, 155, 179, 0); }
  50% { box-shadow: 0 0 0 6px rgba(14, 155, 179, 0.45); }
}
</style>