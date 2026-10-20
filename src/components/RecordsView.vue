<script setup>
import { computed } from 'vue'
import { fmtDur, fmtPace, fmtDate } from '../lib/format'
import { PR_DISTANCES, personalRecords, predictTimes, cooperBand, bestVO2 } from '../lib/performance'
import { profileAge } from '../lib/profile'

const props = defineProps({
  tracks: { type: Array, default: () => [] },
  profile: { type: Object, default: null },
  vo2: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
})
defineEmits(['open', 'nav'])

const pr = computed(() => personalRecords(props.tracks))
const predictions = computed(() => predictTimes(pr.value.records))
const roughCount = computed(() => predictions.value.predictions.filter((p) => p.rough).length)
const best = computed(() => bestVO2(props.tracks, props.profile))
const band = computed(() =>
  props.vo2?.value != null
    ? cooperBand(props.vo2.value, props.profile?.gender, profileAge(props.profile))
    : null,
)

const trend = computed(() => {
  const d = props.vo2?.perActivity?.filter((x) => x.perf != null) || []
  if (d.length < 2) return null
  const W = 360, H = 120, P = 8
  const vals = d.map((x) => x.perf)
  const min = Math.min(...vals), max = Math.max(...vals)
  const X = (i) => P + (i / (d.length - 1)) * (W - 2 * P)
  const Y = (v) => P + (1 - (v - min) / (max - min || 1)) * (H - 2 * P)
  let line = ''
  d.forEach((x, i) => { line += `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(x.perf).toFixed(1)}` })
  let area = `${line}L${X(d.length - 1).toFixed(1)} ${H}L${X(0).toFixed(1)} ${H}Z`
  return {
    line,
    area,
    first: fmtDate(d[0].date),
    last: fmtDate(d[d.length - 1].date),
    min: Math.round(min),
    max: Math.round(max),
  }
})
</script>

<template>
  <main class="mx-auto w-full max-w-2xl space-y-4 px-4 pb-32 pt-4">
    <section v-if="loading" class="flex flex-col items-center gap-3 rounded-xl border border-line bg-surface py-14 text-center">
      <span class="h-6 w-6 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" aria-hidden="true"></span>
      <p class="text-sm text-text-2">Memuat rekor...</p>
    </section>

    <section v-else-if="error" class="rounded-xl border border-line bg-surface px-4 py-10 text-center" role="alert">
      <p class="text-sm font-semibold">Gagal memuat data</p>
      <p class="mt-1 text-sm text-text-2">{{ error }}</p>
    </section>

    <template v-else>
      <section v-if="vo2 && vo2.value" class="rounded-xl bg-ink-950 p-5 text-dark-1">
        <div class="flex items-end justify-between gap-3">
          <div>
            <p class="text-xs font-semibold tracking-wide text-teal-400">Estimasi VO2max</p>
            <p class="font-num text-6xl font-bold leading-none">{{ vo2.value }}</p>
          </div>
          <div class="text-right">
            <p v-if="band" class="inline-block rounded-md bg-teal-400/15 px-2.5 py-1 text-xs font-bold text-teal-400">{{ band.label }}</p>
            <p class="mt-1.5 text-[11px] text-dark-2">{{ vo2.method === 'hr' ? 'Dari detak jantung (Uth)' : 'Dari pace dan kemiringan (ACSM)' }}</p>
          </div>
        </div>

        <div v-if="trend" class="mt-4">
          <svg class="h-32 w-full" viewBox="0 0 360 120" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="vo2area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#0e9bb3" stop-opacity="0.4" />
                <stop offset="100%" stop-color="#0e9bb3" stop-opacity="0" />
              </linearGradient>
            </defs>
            <path :d="trend.area" fill="url(#vo2area)" />
            <path :d="trend.line" fill="none" stroke="#0e9bb3" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
          </svg>
          <div class="flex items-center justify-between text-[11px] text-dark-2">
            <span>{{ trend.first }}</span>
            <span>V O2 {{ trend.min }} hingga {{ trend.max }}</span>
            <span>{{ trend.last }}</span>
          </div>
        </div>

        <div v-if="best" class="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
          <div>
            <p class="text-[11px] text-dark-2">Estimasi VO2max terbaik</p>
            <p class="font-num text-2xl font-bold leading-tight">{{ best.value }}<span class="ml-1 text-xs font-medium text-dark-2">ml/kg/menit</span></p>
          </div>
          <button type="button" class="shrink-0 rounded-lg bg-teal-400/15 px-3 py-2 text-xs font-bold text-teal-400 transition hover:bg-teal-400/25" @click="$emit('open', best.trackId)">
            {{ best.date ? fmtDate(best.date) : 'Buka aktivitas' }}
          </button>
        </div>

        <p class="mt-4 border-t border-white/10 pt-3 text-[11px] text-dark-2">
          Estimasi, bukan hasil tes laboratorium. Dihitung dari segmen berjalan minimal 10 menit memakai kecepatan rata-rata dan kemiringan lintasan (persamaan ACSM), atau dari rasio HR maks personal dengan HR istirahat (rumus Uth). Pengelompokan kategori sesuai tabel The Cooper Institute.
        </p>
        <button type="button" class="mt-3 rounded-lg bg-teal-400 px-3 py-2 text-xs font-bold text-ink-950 transition hover:bg-teal-400/90" @click="$emit('nav', 'profile')">
          Kelola profil (umur, jenis kelamin, HR Maks Personal)
        </button>
      </section>

      <section v-else-if="tracks.length" class="rounded-xl border border-dashed border-text-2/40 p-4">
        <p class="text-sm font-semibold">Estimasi VO2max belum tersedia</p>
        <p class="mt-1 text-xs text-text-2">Butuh aktivitas dengan segmen berjalan minimal 10 menit dan data GPS yang valid, atau data detak jantung (HR Maks Personal dan HR istirahat) di Profil dan detail aktivitas.</p>
      </section>

      <section class="rounded-xl border border-line bg-surface">
        <h2 class="font-num px-4 pt-4 text-lg font-semibold">Personal best</h2>
        <dl class="mt-1">
          <template v-for="(r, i) in pr.records" :key="i">
            <div class="flex items-center justify-between gap-3 px-4 py-3 border-t border-line">
              <dt class="flex items-center gap-2 text-sm">
                <svg v-if="r" class="h-4 w-4 shrink-0 text-teal-600" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 3h14v3a7 7 0 0 1-5 6.7V16h1a3 3 0 0 1 3 3v1a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-1a3 3 0 0 1 3-3h1v-3.3A7 7 0 0 1 5 6V3zm2 2v1.5a5 5 0 0 0 1 3h2V5H7z" /></svg>
                {{ r ? r.label : PR_DISTANCES[i].label }}
              </dt>
              <dd class="text-right">
                <template v-if="r">
                  <span class="font-num text-base font-bold">{{ fmtDur(r.time) }}</span>
                  <span class="ml-1.5 text-xs text-text-2">{{ fmtPace(r.pace) }}/km</span>
                  <button type="button" class="block text-left text-[11px] text-teal-600 hover:underline" @click="$emit('open', r.trackId)">{{ r.date ? fmtDate(r.date) : '' }}</button>
                </template>
                <span v-else class="text-xs text-text-2">Belum ada catatan</span>
              </dd>
            </div>
          </template>

          <div class="flex items-center justify-between gap-3 px-4 py-3 border-t border-line">
            <dt class="text-sm">Lari terpanjang</dt>
            <dd v-if="pr.longest" class="text-right">
              <span class="font-num text-base font-bold">{{ (pr.longest.distance / 1000).toFixed(1) }} km</span>
              <button type="button" class="block text-left text-[11px] text-teal-600 hover:underline" @click="$emit('open', pr.longest.trackId)">{{ fmtDate(pr.longest.date) }}</button>
            </dd>
            <dd v-else class="text-xs text-text-2">Belum ada catatan</dd>
          </div>
        </dl>
      </section>

      <section v-if="predictions.predictions.length && !loading" class="rounded-xl border border-line bg-surface p-4">
        <h2 class="font-num text-lg font-semibold">Estimasi waktu balapan</h2>
        <p class="text-xs text-text-2">Dihitung dengan persamaan Riegel dari rekor terdekat yang tersedia. Estimasi, bukan jaminan hasil lomba.</p>
        <div class="mt-3 grid grid-cols-2 gap-2">
          <div v-for="p in predictions.predictions" :key="p.key" class="rounded-lg bg-page p-3">
            <p class="text-[11px] text-text-2">{{ p.label }}</p>
            <p class="font-num text-xl font-bold">{{ fmtDur(p.time) }}</p>
            <p class="text-[11px] text-text-2">{{ fmtPace(p.pace) }}/km</p>
            <p class="mt-1 text-[10px] text-text-2">Acuan {{ p.source.label }} {{ fmtDur(p.source.time) }}</p>
          </div>
        </div>
        <p v-if="roughCount" class="mt-2 text-[11px] text-text-2">{{ roughCount }} prediksi memakai acuan di luar jarak ideal, jadi hasilnya masih kasar.</p>
      </section>

      <section v-else-if="tracks.length && !loading" class="rounded-xl border border-dashed border-text-2/40 p-4">
        <p class="text-sm font-semibold">Estimasi waktu balapan belum tersedia</p>
        <p class="mt-1 text-xs text-text-2">Butuh rekor aktivitas dengan jarak dan waktu tempuh yang valid dalam 6 bulan terakhir.</p>
      </section>

      <section v-if="!tracks.length" class="rounded-xl border border-dashed border-text-2/40 p-8 text-center">
        <p class="text-sm font-semibold">Belum ada data rekor</p>
        <p class="mt-1 text-xs text-text-2">Impor aktivitas dari halaman Utama untuk menghitung personal best dan VO2max.</p>
      </section>
    </template>
  </main>
</template>