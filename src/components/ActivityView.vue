<script setup>
import { ref, reactive, computed, watch, onBeforeUnmount, nextTick } from 'vue'
import { supabase } from '../lib/supabaseClient'
import TrackMap from './TrackMap.vue'
import { fmtDur, fmtPace, fmtDate, fmtHours } from '../lib/format'
import { splitsOf, zoneDuration, findIdx } from '../lib/gpx'
import { resolveMaxHr } from '../lib/hrMax'
import { newPRsForTrack, PR_DISTANCES, vo2Performance, recoveryBreakdown } from '../lib/performance'
import ShareStickerModal from './ShareStickerModal.vue'

const props = defineProps({
  track: { type: Object, required: true },
  tracks: { type: Array, default: () => [] },
  profile: { type: Object, default: null },
})
const emit = defineEmits(['back', 'delete', 'settings'])

const tab = ref('overview')
const tabs = [
  { key: 'overview', label: 'Ringkasan' },
  { key: 'splits', label: 'Split' },
  { key: 'charts', label: 'Grafik' },
]
const colorBy = ref('solid')
const colorOptions = [
  ['solid', 'Polos'],
  ['pace', 'Pace'],
  ['hr', 'HR'],
]
const tileMode = ref('map')
const previewIdx = ref(null)
const activeSplit = ref(null)
const playing = ref(false)
const speed = ref(2)
const mapRef = ref(null)
const showShareModal = ref(false)

let timer = null

const hasHR = computed(() => !!props.track.pts.some((p) => p.hr))
const splits = computed(() => splitsOf(props.track))
const personalMaxHr = computed(() => resolveMaxHr(props.profile))
const zones = computed(() => zoneDuration(props.track, personalMaxHr.value?.value))

const hrForm = reactive({ restingHr: '' })
const hrSaving = ref(false)
const hrError = ref('')
const hrSaved = ref(false)
watch(
  () => props.track,
  (t) => {
    hrForm.restingHr = t?.restingHr || ''
    hrError.value = ''
    hrSaved.value = false
  },
  { immediate: true },
)

const saveHrSettings = async () => {
  hrError.value = ''
  hrSaved.value = false
  const restingHr = hrForm.restingHr ? Number(hrForm.restingHr) : null
  if (restingHr != null && (restingHr < 30 || restingHr > 110)) return (hrError.value = 'HR Istirahat (Rest Heart Rate / RHR) umumnya antara 30 dan 110 bpm.')
  if (restingHr != null && props.track.maxHR != null && restingHr >= props.track.maxHR) return (hrError.value = 'HR Istirahat (Rest Heart Rate / RHR) harus lebih kecil dari HR Maks Aktivitas.')
  hrSaving.value = true
  try {
    const { error } = await supabase.from('tracks').update({ resting_hr: restingHr }).eq('id', props.track.id)
    if (error) throw new Error(error.message)
    emit('settings', { restingHr, hrMaxSet: props.track.hrMaxSet })
    hrSaved.value = true
  } catch (e) {
    hrError.value = e.message
  } finally {
    hrSaving.value = false
  }
}
const cur = computed(() => (previewIdx.value != null ? props.track.pts[previewIdx.value] : null))
const newPRs = computed(() => newPRsForTrack(props.tracks, props.track.id))

const PR_LABELS = PR_DISTANCES.reduce((m, d) => { m[d.key] = d.label; return m }, {})
const perf = computed(() => vo2Performance(props.track))
const recovery = computed(() => recoveryBreakdown(props.track, props.profile))

const headline = computed(() => [
  { label: 'Jarak', value: (props.track.distance / 1000).toFixed(2), unit: 'km' },
  { label: 'Waktu', value: fmtDur(props.track.duration), unit: '' },
  { label: 'Pace rata-rata', value: fmtPace(props.track.avgPace), unit: '/km' },
])

const sections = computed(() => {
  const t = props.track
  const eles = t.pts.map((p) => p.ele).filter((v) => v != null)
  const best = splits.value.length ? Math.min(...splits.value.map((s) => s.pace)) : null
  const out = [
    {
      title: 'Kecepatan',
      rows: [
        ['Pace rata-rata', fmtPace(t.avgPace), '/km'],
        best ? ['Pace terbaik per km', fmtPace(best), '/km'] : null,
        ['Kecepatan rata-rata', (t.distance / 1000 / (t.duration / 3600)).toFixed(1), 'km/jam'],
      ],
    },
    eles.length ? {
      title: 'Elevasi',
      rows: [
        ['Total naik', t.elevGain, 'm'],
        t.elevLoss ? ['Total turun', t.elevLoss, 'm'] : null,
        ['Tertinggi', t.maxEle, 'm'],
        ['Terendah', t.minEle, 'm'],
      ],
    } : null,
    t.avgHR ? { title: 'Detak jantung', rows: [['Rata-rata', t.avgHR, 'bpm'], ['HR Maks Aktivitas', t.maxHR, 'bpm']] } : null,
    t.avgCad ? { title: 'Dinamika lari', rows: [['Kadensi rata-rata', t.avgCad, 'spm']] } : null,
    perf.value || recovery.value ? {
      title: 'Fisiologi & Pemulihan',
      rows: [
        perf.value ? ['Estimasi VO2max (segmen terbaik 10 menit)', Math.round(perf.value), 'ml/kg/menit'] : null,
        recovery.value ? ['Base recovery', fmtHours(recovery.value.base), ''] : null,
        recovery.value ? ['Extra recovery', fmtHours(recovery.value.extra), ''] : null,
        recovery.value ? ['Total recovery', fmtHours(recovery.value.total), ''] : null,
      ],
      note: 'Angka estimasi, bukan hasil tes laboratorium atau waktu pemulihan medis.',
    } : null,
  ]
  return out.filter(Boolean).map((s) => ({ ...s, rows: s.rows.filter(Boolean) }))
})

const CH = {
  pace: ['Pace', '#0a6a7d'],
  hr: ['Detak jantung', '#c0392b'],
  ele: ['Elevasi', '#8c6f5a'],
}
const charts = computed(() => {
  const t = props.track
  const W = 800, H = 120, P = 10, total = t.distance
  return ['pace', 'hr', 'ele'].map((key) => {
    const vals = t.pts.map((p) => (key === 'pace' ? (p.pace == null ? null : Math.min(Math.max(p.pace, 180), 720)) : (p[key] ?? null)))
    const valid = vals.filter((v) => v != null)
    if (!valid.length) return null
    let min = Math.min(...valid), max = Math.max(...valid)
    if (min === max) { min -= 1; max += 1 }
    const Y = (v) => (key === 'pace' ? P + ((v - min) / (max - min)) * (H - 2 * P) : P + ((max - v) / (max - min)) * (H - 2 * P))
    let line = ''
    let started = false
    vals.forEach((v, i) => {
      if (v == null) return
      line += `${started ? 'L' : 'M'}${((t.pts[i].d / total) * W).toFixed(1)} ${Y(v).toFixed(1)}`
      started = true
    })
    const lab = key === 'pace' ? [fmtPace(min), fmtPace(max)] : key === 'ele' ? [Math.round(max) + ' m', Math.round(min) + ' m'] : [Math.round(max), Math.round(min)]
    return { key, title: CH[key][0], color: CH[key][1], line, area: `${line}L${W} ${H}L0 ${H}Z`, top: lab[0], bottom: lab[1] }
  }).filter(Boolean)
})

const hx = computed(() =>
  props.track && previewIdx.value != null && props.track.distance
    ? (props.track.pts[previewIdx.value].d / props.track.distance) * 800
    : null,
)
const activeSplitRange = computed(() => {
  const s = splits.value[activeSplit.value]
  return s ? [(s.from / props.track.distance) * 800, (s.to / props.track.distance) * 800] : null
})
const chartNow = (key) => {
  const c = cur.value
  if (!c) return ''
  if (key === 'pace') return fmtPace(c.pace) + ' /km'
  if (key === 'hr') return c.hr != null ? c.hr + ' bpm' : '-'
  return c.ele != null ? Math.round(c.ele) + ' m' : '-'
}

const stopPlay = () => { clearInterval(timer); timer = null; playing.value = false }
const togglePlay = () => {
  if (playing.value) return stopPlay()
  const last = props.track.pts.length - 1
  if (previewIdx.value == null || previewIdx.value >= last) previewIdx.value = 0
  playing.value = true
  timer = setInterval(() => {
    const next = previewIdx.value + speed.value
    if (next >= last) { previewIdx.value = last; stopPlay() } else previewIdx.value = next
  }, 60)
}
const cycleSpeed = () => { speed.value = { 1: 2, 2: 4, 4: 8, 8: 1 }[speed.value] }

const selectSplit = (i) => {
  activeSplit.value = activeSplit.value === i ? null : i
  tab.value = 'overview'
  nextTick(() => mapRef.value?.refreshSize())
}

const onChartMove = (e) => {
  stopPlay()
  const t = props.track
  const r = e.currentTarget.getBoundingClientRect()
  const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
  previewIdx.value = findIdx(t.pts, frac * t.distance)
}
const onChartLeave = () => { if (!playing.value) previewIdx.value = null }

watch(tab, (v) => { if (v === 'overview') nextTick(() => mapRef.value?.refreshSize()) })

onBeforeUnmount(stopPlay)
</script>

<template>
  <main class="mx-auto w-full max-w-6xl space-y-4 px-4 pb-32 pt-4">
    <section class="rounded-xl border border-line bg-surface">
      <div class="flex items-center gap-2 p-4">
        <button type="button" aria-label="Kembali ke daftar" class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition hover:bg-page focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600" @click="$emit('back')">
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
        <div class="min-w-0 flex-1">
          <h1 class="font-num truncate text-xl font-semibold">{{ track.title }}</h1>
          <p class="text-xs text-text-2">{{ fmtDate(track.date, true) }}</p>
        </div>
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-lg border border-teal-600/30 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-600 transition hover:bg-teal-100/70"
          @click="showShareModal = true"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="18" cy="5" r="3"></circle>
            <circle cx="6" cy="12" r="3"></circle>
            <circle cx="18" cy="19" r="3"></circle>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
          </svg>
          <span class="hidden sm:inline">Stiker</span>
        </button>
        <button type="button" class="rounded-lg px-3 py-2 text-xs font-semibold text-[#a93226] transition hover:bg-[#fbeceb]" @click="$emit('delete', track)">Hapus</button>
      </div>

      <div class="flex gap-6 overflow-x-auto border-t border-line px-4" role="tablist" aria-label="Tab aktivitas">
        <button v-for="t in tabs" :key="t.key" type="button" role="tab" :aria-selected="tab === t.key"
          :class="['shrink-0 border-b-[3px] py-3 text-sm font-semibold transition', tab === t.key ? 'border-teal-600 text-teal-600' : 'border-transparent text-text-2 hover:text-text-1']"
          @click="tab = t.key">{{ t.label }}</button>
      </div>
    </section>

    <section v-if="newPRs.length" class="rounded-xl border border-line bg-surface p-3" role="status">
      <p class="text-sm text-teal-600"><span class="font-bold">Rekor pribadi baru:</span>
        <span v-for="(k, i) in newPRs" :key="k"> {{ PR_LABELS[k] }}{{ i < newPRs.length - 1 ? ',' : '' }}</span>
      </p>
    </section>

    <div v-show="tab === 'overview'" class="grid gap-4 lg:grid-cols-12">
      <section class="self-start overflow-hidden rounded-xl border border-line bg-surface lg:col-span-7">
        <div class="map-wrap relative h-[360px] sm:h-[480px]">
          <TrackMap ref="mapRef" :track="track" :color-by="colorBy" :tile-mode="tileMode" :split="activeSplit != null ? splits[activeSplit] : null" :preview-idx="previewIdx" :follow="playing" />

          <div class="absolute right-3 top-3 z-[1100] flex flex-col items-end gap-2 text-[11px] font-semibold">
            <div class="flex overflow-hidden rounded-lg border border-line bg-surface">
              <button v-for="m in [['map', 'Peta'], ['sat', 'Satelit']]" :key="m[0]" type="button"
                :aria-pressed="tileMode === m[0]"
                :class="['px-3 py-2 transition', tileMode === m[0] ? 'bg-teal-600 text-white' : 'text-text-1 hover:bg-page']"
                @click="tileMode = m[0]">{{ m[1] }}</button>
            </div>
            <div class="flex overflow-hidden rounded-lg border border-line bg-surface">
              <button v-for="m in colorOptions" :key="m[0]" type="button" :disabled="m[0] === 'hr' && !hasHR"
                :aria-pressed="colorBy === m[0]"
                :class="['px-3 py-2 transition disabled:opacity-30', colorBy === m[0] ? 'bg-teal-600 text-white' : 'text-text-1 hover:bg-page']"
                @click="colorBy = m[0]">{{ m[1] }}</button>
            </div>
          </div>

          <div class="pointer-events-none absolute left-3 top-3 z-[1100] min-w-[150px] rounded-lg border border-line bg-surface/95 px-3 py-2 text-[11px]">
            <div v-if="cur" class="grid grid-cols-2 gap-x-4 gap-y-0.5">
              <span class="text-text-2">Jarak</span><span class="font-num text-right font-semibold">{{ (cur.d / 1000).toFixed(2) }} km</span>
              <span class="text-text-2">Waktu</span><span class="font-num text-right font-semibold">{{ fmtDur(cur.t) }}</span>
              <span class="text-text-2">Pace</span><span class="font-num text-right font-semibold">{{ fmtPace(cur.pace) }}</span>
              <span class="text-text-2">Elevasi</span><span class="font-num text-right font-semibold">{{ cur.ele != null ? Math.round(cur.ele) + ' m' : '-' }}</span>
              <span class="text-text-2">HR</span><span class="font-num text-right font-semibold">{{ cur.hr ?? '-' }}</span>
            </div>
            <p v-else class="text-text-2">Tekan putar untuk replay rute</p>
          </div>

          <div v-if="colorBy !== 'solid'" class="absolute bottom-6 left-3 z-[1100] w-40 rounded-lg border border-line bg-surface/95 px-3 py-2 text-[10px] text-text-2">
            <div class="h-1.5 rounded-full" style="background: linear-gradient(90deg, hsl(215,90%,58%), hsl(115,90%,58%), hsl(15,90%,58%))"></div>
            <div class="mt-1 flex justify-between"><span>{{ colorBy === 'pace' ? 'Lambat' : 'Rendah' }}</span><span>{{ colorBy === 'pace' ? 'Cepat' : 'Tinggi' }}</span></div>
          </div>
        </div>

        <div class="flex items-center gap-3 border-t border-line px-4 py-3">
          <button type="button" :aria-label="playing ? 'Jeda replay' : 'Putar replay'" class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white transition hover:bg-teal-600/90"
            @click="togglePlay">
            <svg v-if="!playing" class="ml-0.5 h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
            <svg v-else class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
          </button>
          <input type="range" min="0" :max="track.pts.length - 1" :value="previewIdx ?? 0" class="flex-1 accent-teal-600" aria-label="Posisi replay" @input="previewIdx = Number($event.target.value)" />
          <button type="button" class="font-num w-12 rounded-lg border border-line py-2 text-xs font-bold transition hover:bg-page" @click="cycleSpeed">{{ speed }}x</button>
        </div>
      </section>

      <div class="space-y-4 lg:col-span-5">
        <section class="grid grid-cols-3 divide-x divide-line rounded-xl border border-line bg-surface">
          <div v-for="h in headline" :key="h.label" class="p-4">
            <p class="text-[11px] text-text-2">{{ h.label }}</p>
            <p class="font-num mt-0.5 text-3xl font-bold leading-tight">{{ h.value }}</p>
            <p class="text-[11px] text-text-2">{{ h.unit }}</p>
          </div>
        </section>

        <section v-if="hasHR" class="rounded-xl border border-line bg-surface p-4">
          <h3 class="text-sm font-bold">Waktu di zona detak jantung</h3>
          <template v-if="zones">
            <div class="mt-3 space-y-2.5">
              <div v-for="z in zones" :key="z.n" class="flex items-center gap-3">
                <span class="w-14 shrink-0 text-xs font-semibold">{{ z.n }}</span>
                <div class="h-5 flex-1 overflow-hidden rounded bg-page">
                  <div class="h-full rounded" :style="{ width: Math.max(z.pct, z.sec ? 2 : 0) + '%', background: z.c }"></div>
                </div>
                <span class="font-num w-11 shrink-0 text-right text-sm font-semibold">{{ fmtDur(z.sec) }}</span>
              </div>
            </div>
            <ul class="mt-3 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-text-2">
              <li v-for="z in zones" :key="z.n"><span class="mr-1.5 inline-block h-2 w-2 rounded-full" :style="{ background: z.c }"></span>{{ z.n }} {{ z.name }} {{ z.range }}</li>
            </ul>
            <p class="mt-2 text-[10px] text-text-2">
              {{ personalMaxHr.source === 'estimated' ? `Zona dihitung berdasarkan estimasi HR Maks Personal ${personalMaxHr.value} bpm (208 - 0,7 x umur).` : `Zona dihitung berdasarkan HR Maks Personal ${personalMaxHr.value} bpm.` }}
            </p>
          </template>
          <p v-else-if="!personalMaxHr" class="mt-3 text-xs text-text-2">Isi HR Maks Personal atau umur pada Profil untuk melihat zona detak jantung.</p>
          <p v-else class="mt-3 text-xs text-text-2">Aktivitas ini belum punya sampel detak jantung yang valid, jadi zona tidak bisa dihitung.</p>
        </section>

        <section class="rounded-xl border border-line bg-surface p-4">
          <h3 class="text-sm font-bold">Pengaturan detak jantung</h3>
          <p class="mt-1 text-xs text-text-2">Atur HR Istirahat (Rest Heart Rate / RHR) untuk estimasi VO2max. HR Maks Aktivitas ({{ track.maxHR ?? '-' }} bpm) diambil otomatis dari data GPX dan hanya berlaku untuk aktivitas ini.</p>
          <p v-if="hrSaved" role="status" class="mt-3 rounded-lg border border-teal-400/40 bg-teal-400/10 p-2.5 text-xs text-teal-600">Pengaturan tersimpan.</p>
          <p v-if="hrError" role="alert" class="mt-3 rounded-lg border border-[#e6b3ae] bg-[#fbeceb] p-2.5 text-xs text-[#a93226]">{{ hrError }}</p>
          <form class="mt-3 space-y-3" @submit.prevent="saveHrSettings">
            <label class="block">
              <span class="text-xs font-semibold text-text-2">HR Istirahat (Rest Heart Rate / RHR) - bpm</span>
              <input :value="hrForm.restingHr" type="number" inputmode="numeric" min="30" max="110" placeholder="55"
                class="mt-1 w-full rounded-lg border border-text-2/40 bg-surface px-3.5 py-2.5 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/25"
                @input="hrForm.restingHr = $event.target.value" />
            </label>
            <button type="submit" :disabled="hrSaving" class="w-full rounded-lg bg-teal-600 py-2.5 text-sm font-bold text-white transition hover:bg-teal-600/90 disabled:opacity-50">
              {{ hrSaving ? 'Menyimpan...' : 'Simpan pengaturan' }}
            </button>
          </form>
        </section>

        <section v-for="s in sections" :key="s.title" class="rounded-xl border border-line bg-surface">
          <h3 class="px-4 pb-2 pt-4 text-sm font-bold">{{ s.title }}</h3>
          <dl>
            <div v-for="r in s.rows" :key="r[0]" class="flex items-baseline justify-between border-t border-line px-4 py-2.5 text-sm">
              <dt class="text-text-2">{{ r[0] }}</dt>
              <dd class="font-num text-lg font-semibold">{{ r[1] }}<span class="ml-1 text-xs font-medium text-text-2">{{ r[2] }}</span></dd>
            </div>
          </dl>
          <p v-if="s.note" class="border-t border-line px-4 py-2.5 text-[11px] text-text-2">{{ s.note }}</p>
        </section>

        <section v-if="!perf" class="rounded-xl border border-line bg-surface p-4">
          <h3 class="text-sm font-bold">Estimasi VO2max</h3>
          <p class="mt-1 text-xs text-text-2">Belum bisa dihitung: aktivitas ini belum punya segmen berjalan minimal 10 menit dengan data jarak dan waktu yang valid.</p>
        </section>
      </div>
    </div>

    <section v-if="tab === 'splits'" class="overflow-x-auto rounded-xl border border-line bg-surface">
      <table class="w-full min-w-[520px] text-sm">
        <thead>
          <tr class="text-left text-[11px] text-text-2">
            <th class="px-4 py-3 font-semibold">Km</th>
            <th class="py-3 font-semibold">Waktu</th>
            <th class="py-3 font-semibold">Jarak</th>
            <th class="w-1/3 py-3 font-semibold">Pace</th>
            <th class="py-3 font-semibold text-right">Elev</th>
            <th class="px-4 py-3 font-semibold text-right">HR</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(s, i) in splits" :key="i" tabindex="0" role="button" :aria-pressed="activeSplit === i"
            :class="['cursor-pointer border-t border-line transition hover:bg-page focus:outline-none focus-visible:bg-page', activeSplit === i ? 'bg-teal-400/10' : '']"
            @click="selectSplit(i)" @keydown.enter="selectSplit(i)" @keydown.space.prevent="selectSplit(i)">
            <td class="font-num px-4 py-3 text-base font-semibold">{{ s.label }}</td>
            <td class="font-num py-3 text-base">{{ fmtDur(s.sec) }}</td>
            <td class="font-num py-3 text-base">{{ (s.dist / 1000).toFixed(2) }}</td>
            <td class="py-3">
              <div class="flex items-center gap-2">
                <span :class="['font-num w-12 text-base font-semibold', s.fastest ? 'text-teal-600' : '']">{{ fmtPace(s.pace) }}</span>
                <span class="h-2 flex-1 overflow-hidden rounded bg-page"><span class="block h-full rounded" :class="s.fastest ? 'bg-teal-600' : 'bg-teal-400/60'" :style="{ width: s.bar + '%' }"></span></span>
              </div>
            </td>
            <td class="font-num py-3 text-right text-base">{{ s.elev > 0 ? '+' : '' }}{{ s.elev }}</td>
            <td class="font-num px-4 py-3 text-right text-base">{{ s.hr ?? '-' }}</td>
          </tr>
        </tbody>
      </table>
      <p class="border-t border-line px-4 py-3 text-[11px] text-text-2">Pilih satu baris untuk melihat bagian itu di peta.</p>
    </section>

    <div v-if="tab === 'charts'" class="space-y-4">
      <section v-for="(c, ci) in charts" :key="c.key" class="rounded-xl border border-line bg-surface p-4">
        <div class="mb-2 flex items-baseline justify-between">
          <h3 class="text-sm font-bold">{{ c.title }}</h3>
          <span class="font-num text-sm font-semibold" :style="{ color: c.color }">{{ cur ? chartNow(c.key) : '' }}</span>
        </div>
        <div class="relative cursor-crosshair touch-pan-y select-none" @pointermove="onChartMove" @pointerdown="onChartMove" @pointerleave="onChartLeave">
          <svg viewBox="0 0 800 120" preserveAspectRatio="none" class="h-32 w-full">
            <defs>
              <linearGradient :id="'area-' + c.key" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" :stop-color="c.color" stop-opacity="0.28" />
                <stop offset="100%" :stop-color="c.color" stop-opacity="0.02" />
              </linearGradient>
            </defs>
            <line v-for="y in [40, 80]" :key="y" x1="0" x2="800" :y1="y" :y2="y" stroke="#d7dee0" stroke-width="1" vector-effect="non-scaling-stroke" />
            <rect v-if="activeSplitRange" :x="activeSplitRange[0]" y="0" :width="activeSplitRange[1] - activeSplitRange[0]" height="120" fill="#0a6a7d" opacity="0.1" />
            <path :d="c.area" :fill="'url(#area-' + c.key + ')'" />
            <path :d="c.line" fill="none" :stroke="c.color" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
            <line v-if="hx != null" :x1="hx" :x2="hx" y1="0" y2="120" stroke="#16252b" stroke-width="1.5" vector-effect="non-scaling-stroke" />
          </svg>
          <span class="font-num absolute left-1 top-0 text-[10px] text-text-2">{{ c.top }}</span>
          <span class="font-num absolute bottom-1 left-1 text-[10px] text-text-2">{{ c.bottom }}</span>
        </div>
        <div v-if="ci === charts.length - 1" class="mt-1 flex justify-between text-[10px] text-text-2">
          <span>0 km</span><span>{{ (track.distance / 2000).toFixed(1) }} km</span><span>{{ (track.distance / 1000).toFixed(1) }} km</span>
        </div>
      </section>
      <p v-if="!charts.length" class="py-10 text-center text-sm text-text-2">File GPX ini tidak punya data untuk grafik.</p>
    </div>

    <!-- Modal Buat Stiker Share -->
    <ShareStickerModal
      v-if="showShareModal"
      :track="track"
      @close="showShareModal = false"
    />
  </main>
</template>