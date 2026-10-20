import { findIdx, elevationGainLoss } from "./gpx"
import { profileAge } from "./profile"

export const PR_DISTANCES = [
  { key: "1k", label: "1 km", meters: 1000, short: "1K" },
  { key: "mile", label: "1 mil", meters: 1609.344, short: "1M" },
  { key: "5k", label: "5 km", meters: 5000, short: "5K" },
  { key: "10k", label: "10 km", meters: 10000, short: "10K" },
  { key: "half", label: "Half marathon", meters: 21097.5, short: "HM" },
  { key: "marathon", label: "Marathon", meters: 42195, short: "M" },
]

export const PREDICT_DISTANCES = [
  { key: "5k", label: "5 km", meters: 5000 },
  { key: "10k", label: "10 km", meters: 10000 },
  { key: "half", label: "Half marathon", meters: 21097.5 },
  { key: "marathon", label: "Marathon", meters: 42195 },
]

const hrsSince = (iso) => (Date.now() - Date.parse(iso)) / 3600000

// Jarak referensi minimum untuk prediksi Riegel, makin jauh target makin panjang acuan yang diutamakan.
const sourceMinMeters = (targetMeters) =>
  targetMeters < 5000 ? 1000 : targetMeters < 10000 ? 3000 : 5000

// Jeda antar titik GPX: <= PREFER dianggap wajar, > MAX dianggap aktivitas rusak dan tidak dipakai.
const SOURCE_GAP_PREFER_S = 60
const SOURCE_GAP_MAX_S = 300

function maxStepS(pts, i0, i1) {
  let max = 0
  for (let i = i0 + 1; i <= i1 && i < pts.length; i++) {
    const dt = Number(pts[i].t) - Number(pts[i - 1].t)
    if (Number.isFinite(dt) && dt > max) max = dt
  }
  return max
}

function bestTimeForDistance(pts, meters) {
  let best = null
  let right = 0
  for (let left = 0; left < pts.length - 1; left++) {
    if (right < left) right = left
    while (right + 1 < pts.length && pts[right].d - pts[left].d < meters) right++
    if (pts[right].d - pts[left].d >= meters && right + 1 < pts.length) {
      const a = pts[right], b = pts[right + 1]
      const need = meters - (a.d - pts[left].d)
      const frac = b.d - a.d > 0 ? need / (b.d - a.d) : 1
      const t = a.t - pts[left].t + frac * (b.t - a.t)
      if (!best || t < best.time) best = { time: t, pace: (t / meters) * 1000, i0: left, i1: right }
    }
  }
  return best
}

export function personalRecords(tracks) {
  const recs = PR_DISTANCES.map((d) => {
    let best = null
    for (const t of tracks) {
      if (!Number.isFinite(t.distance) || !Number.isFinite(t.duration)) continue
      if (t.distance < d.meters || t.duration < 60 || !t.pts?.length) continue
      const hit = bestTimeForDistance(t.pts, d.meters)
      if (hit && (!best || hit.time < best.time)) {
        best = { ...d, time: hit.time, pace: hit.pace, trackId: t.id, title: t.title, date: t.date, maxGapS: maxStepS(t.pts, hit.i0, hit.i1) }
      }
    }
    return best
  })
  const longest = tracks.reduce((m, t) => (!m || t.distance > m.distance ? { distance: t.distance, trackId: t.id, title: t.title, date: t.date } : m), null)
  return { records: recs, longest }
}

export function newPRsForTrack(tracks, trackId) {
  const { records } = personalRecords(tracks)
  return records.filter((r) => r && r.trackId === trackId).map((r) => r.key)
}

// Batas validasi GPS: satu langkah antar titik harus punya waktu positif, jeda wajar,
// jarak tidak mundur, dan kecepatan sesaat yang masih masuk akal untuk lari.
const PERF_MAX_STEP_S = 30
const PERF_MAX_SPEED_MPS = 12
const PERF_MAX_GRADE = 0.5

export const PERF_WINDOW_S = 600

// Titik GPX sudah di-downsample buildTrack, jadi jarak antar titik tergantung panjang aktivitas.
// Batas jeda mengikuti sampling data, dengan lantai 30 detik dan pagar 120 detik agar
// jeda GPS yang nyata tidak dianggap gerakan kontinu.
function stepLimit(pts) {
  const steps = []
  for (let i = 1; i < pts.length; i++) {
    const dt = Number(pts[i].t) - Number(pts[i - 1].t)
    if (Number.isFinite(dt) && dt > 0) steps.push(dt)
  }
  if (!steps.length) return PERF_MAX_STEP_S
  steps.sort((a, b) => a - b)
  const median = steps[Math.floor(steps.length / 2)]
  return Math.min(120, Math.max(PERF_MAX_STEP_S, median * 2.5))
}

function validRuns(pts, limit) {
  const runs = []
  let run = []
  for (const p of pts) {
    if (!Number.isFinite(p?.t) || !Number.isFinite(p?.d)) {
      if (run.length > 1) runs.push(run)
      run = []
      continue
    }
    if (!run.length) { run.push(p); continue }
    const prev = run[run.length - 1]
    const dt = p.t - prev.t
    const dd = p.d - prev.d
    if (dt > 0 && dt <= limit && dd >= 0 && dd / dt <= PERF_MAX_SPEED_MPS) run.push(p)
    else {
      if (run.length > 1) runs.push(run)
      run = [p]
    }
  }
  if (run.length > 1) runs.push(run)
  return runs
}

// Segmen tercepat yang panjangnya tepat windowSec dan utuh dalam satu rentetan data valid.
function bestSustainedSegment(pts, windowSec) {
  let best = null
  for (const run of validRuns(pts, stepLimit(pts))) {
    let right = 0
    for (let left = 0; left < run.length - 1; left++) {
      if (right < left) right = left
      const targetT = run[left].t + windowSec
      while (right + 1 < run.length && run[right].t < targetT) right++
      const end = run[right]
      if (end.t - run[left].t < windowSec) break
      let dd = end.d - run[left].d
      if (end.t > targetT) {
        const a = run[right - 1], b = end
        dd = a.d - run[left].d + ((targetT - a.t) / (b.t - a.t)) * (b.d - a.d)
      }
      if (!(dd > 0)) continue
      const segment = run.slice(left, right + 1)
      if (!best || dd / windowSec > best.speedMps) {
        best = { speedMps: dd / windowSec, distance: dd, segment }
      }
    }
  }
  return best
}

// Estimasi VO2max dari segmen berjalan minimal 10 menit (persamaan ACSM), bukan pengukuran laboratorium.
export function vo2Performance(track) {
  if (!track?.pts?.length) return null
  const best = bestSustainedSegment(track.pts, PERF_WINDOW_S)
  if (!best) return null
  const speedMPerMin = best.speedMps * 60
  const { gain } = elevationGainLoss(best.segment.map((p) => p.ele))
  let grade = best.distance > 0 ? gain / best.distance : 0
  if (!Number.isFinite(grade) || grade < 0 || grade > PERF_MAX_GRADE) grade = 0
  const vo2 = 3.5 + 0.2 * speedMPerMin + 0.9 * speedMPerMin * grade
  return Number.isFinite(vo2) && vo2 > 0 && vo2 <= 100 ? vo2 : null
}

export function vo2HeartRate(track, profile) {
  const resting = Number(track?.restingHr) || Number(profile?.resting_hr)
  const hrMax =
    Number(track?.hrMaxSet) > 120
      ? Number(track.hrMaxSet)
      : Number(track?.maxHR) > 120
        ? Number(track.maxHR)
        : Number(profile?.max_hr)
  if (!resting || !hrMax || hrMax < 120) return null
  const v = 15.3 * (hrMax / resting)
  return v > 30 && v < 90 ? v : null
}

export function summarizeVO2(tracks, profile) {
  const per = tracks
    .filter((t) => t.duration >= 120)
    .map((t) => {
      const perf = vo2Performance(t)
      const hr = vo2HeartRate(t, profile)
      return { date: t.date, perf, hr }
    })
    .filter((x) => x.perf != null || x.hr != null)
    .sort((a, b) => a.date.localeCompare(b.date))

  const hrVal = per.length ? per[per.length - 1].hr : null
  const perfVal = per.filter((x) => x.perf != null).pop()?.perf ?? null
  const value = hrVal ?? perfVal
  return {
    value: value != null ? Math.round(value) : null,
    method: hrVal != null ? "hr" : perfVal != null ? "perf" : null,
    sources: { hr: hrVal != null ? Math.round(hrVal) : null, perf: perfVal != null ? Math.round(perfVal) : null },
    perActivity: per,
  }
}

const COOPER_BANDS = ["Superior", "Very Good", "Good", "Fair", "Poor"]
const COOPER_THRESHOLDS = {
  male: { "20": [55.4, 51.1, 45.4, 41.7], "30": [54, 48.3, 44, 40.5], "40": [52.5, 46.4, 42.4, 38.5], "50": [48.9, 43.4, 39.2, 35.6], "60": [45.7, 39.5, 35.5, 32.3], "70": [42.1, 36.7, 32.3, 29.4] },
  female: { "20": [49.6, 43.9, 39.5, 36.1], "30": [47.4, 42.4, 37.8, 34.4], "40": [45.3, 39.7, 36.3, 33], "50": [41.1, 36.7, 33, 30.1], "60": [37.8, 33, 30, 27.5], "70": [36.7, 30.9, 28.1, 25.9] },
}

const COOPER_LABELS_ID = ["Superior", "Sangat baik", "Baik", "Cukup", "Kurang"]

export function activityVO2(track, profile) {
  const perf = vo2Performance(track)
  const hr = vo2HeartRate(track, profile)
  const value = hr ?? perf
  return { value: value == null ? null : Math.round(value), method: hr != null ? "hr" : perf != null ? "perf" : null }
}

export function bestVO2(tracks, profile) {
  let best = null
  for (const t of tracks) {
    const v = activityVO2(t, profile)
    if (v.value != null && (!best || v.value > best.value)) {
      best = { value: v.value, method: v.method, trackId: t.id, title: t.title, date: t.date }
    }
  }
  return best
}

const BADGE_DISTS = [
  { key: "5k", label: "5K" },
  { key: "10k", label: "10K" },
  { key: "half", label: "Half" },
  { key: "marathon", label: "Marathon" },
]

export function badgesForTrack(tracks, trackId) {
  if (!tracks.length) return []
  const out = []
  const byDate = [...tracks].sort((a, b) => a.date.localeCompare(b.date))
  if (byDate[0]?.id === trackId) out.push("Aktivitas pertama")
  const { records, longest } = personalRecords(tracks)
  for (const d of BADGE_DISTS) {
    const f = byDate.find((t) => t.distance >= 5000 && t.duration >= 60 && t.distance >= d.meters)
    const pr = records.find((r) => r && r.key === d.key)
    if (f?.id === trackId) out.push(`${d.label} pertama`)
    if (pr?.trackId === trackId) out.push(`${d.label} terbaik`)
  }
  if (longest?.id === trackId) out.push("Terjauh")
  return out
}

export function cooperBand(vo2, gender, age) {
  if (!vo2 || !gender || !age) return null
  const bandKey = COOPER_THRESHOLDS[gender]
  if (!bandKey) return null
  const bands = [20, 30, 40, 50, 60, 70].map((s) => [s, bandKey])
  let thresholds = null
  for (let i = bands.length - 1; i >= 0; i--) {
    if (age >= bands[i][0]) { thresholds = bands[i][1][String(bands[i][0])]; break }
  }
  if (!thresholds) thresholds = bandKey["20"]
  const idx = vo2 >= thresholds[0] ? 0 : vo2 >= thresholds[1] ? 1 : vo2 >= thresholds[2] ? 2 : vo2 >= thresholds[3] ? 3 : 4
  return { idx, label: COOPER_LABELS_ID[idx], en: COOPER_BANDS[idx], thresholds }
}

// Faktor intensitas (heuristik aplikasi, bukan standar fisiologis tervalidasi).
const INTENSITY_FACTORS = {
  easy: 0.7,
  moderate: 1.0,
  hard: 1.3,
  veryHard: 1.6,
}

// %HRR Karvonen -> faktor intensitas. Dipakai supaya Recovery Time tetap sejalan dengan
// klasifikasi intensitas berbasis detak jantung yang sudah ada, bukan klasifikasi baru.
export function intensityFactor(hrrRatio) {
  if (!Number.isFinite(hrrRatio)) return INTENSITY_FACTORS.moderate
  if (hrrRatio < 0.6) return INTENSITY_FACTORS.easy
  if (hrrRatio < 0.75) return INTENSITY_FACTORS.moderate
  if (hrrRatio < 0.85) return INTENSITY_FACTORS.hard
  return INTENSITY_FACTORS.veryHard
}

// Tambahan jam tetap (motivasi/gamifikasi) yang sudah ada sejak awal, tidak dihitung dua kali.
export const EXTRA_RECOVERY_HOURS = 5
const RECOVERY_MAX_HOURS = 96

export function recoveryBreakdown(track, profile = null) {
  if (!track) return null
  const durationHours = Number(track.duration) / 3600
  if (!Number.isFinite(durationHours) || durationHours <= 0) return null
  if (!Number(track.avgHR)) return null

  const restingHr = Number(track.restingHr) || Number(profile?.resting_hr) || 60
  const age = profileAge(profile)
  const maxHr =
    Number(track.hrMaxSet) ||
    Number(track.maxHR) ||
    Number(profile?.max_hr) ||
    (age != null ? 220 - age : 190)

  const hrr = maxHr - restingHr
  // Perhitungan Karvonen: %HRR = (HRavg - HRrest) / (HRmax - HRrest)
  const ratio = hrr > 0 ? (Number(track.avgHR) - restingHr) / hrr : NaN
  const bounded = Number.isFinite(ratio) ? Math.max(0.1, Math.min(1.0, ratio)) : NaN
  const factor = intensityFactor(bounded)

  const base = durationHours * 12 * factor
  const extra = EXTRA_RECOVERY_HOURS
  const total = Math.min(Math.max(base + extra, extra), RECOVERY_MAX_HOURS)

  if (!Number.isFinite(total)) return null
  return { base, extra, total, intensityFactor: factor }
}

export function karvonenRecoveryTime(track, profile = null) {
  return recoveryBreakdown(track, profile)?.total ?? null
}

export const recoveryTime = karvonenRecoveryTime

export function riegelPredict(timeSeconds, sourceDistance, targetDistance) {
  if (
    !Number.isFinite(timeSeconds) ||
    !Number.isFinite(sourceDistance) ||
    !Number.isFinite(targetDistance) ||
    timeSeconds <= 0 ||
    sourceDistance <= 0 ||
    targetDistance <= 0
  ) {
    return null
  }
  return timeSeconds * Math.pow(targetDistance / sourceDistance, 1.06)
}

// Acuan terdekat dengan jarak target, diutamakan yang memenuhi jarak minimum dan tanpa jeda GPS.
function pickSource(candidates, targetMeters) {
  const pool = candidates.filter((r) => r.meters !== targetMeters)
  const clean = pool.filter((r) => !(Number.isFinite(r.maxGapS) && r.maxGapS > SOURCE_GAP_PREFER_S))
  const list = clean.length ? clean : pool
  if (!list.length) return null
  const min = sourceMinMeters(targetMeters)
  const meets = list.filter((r) => r.meters >= min)
  const chosen = (meets.length ? meets : list)
    .slice()
    .sort((a, b) => Math.abs(a.meters - targetMeters) - Math.abs(b.meters - targetMeters) || a.pace - b.pace)[0]
  return chosen || null
}

export function predictTimes(records) {
  const eligible = (records || []).filter((r) =>
    r &&
    Number.isFinite(r.meters) && r.meters > 0 &&
    Number.isFinite(r.time) && r.time > 0 &&
    Number.isFinite(r.pace) && r.pace > 0 &&
    r.date && hrsSince(r.date) < 24 * 180 &&
    !(Number.isFinite(r.maxGapS) && r.maxGapS > SOURCE_GAP_MAX_S),
  )

  const predictions = PREDICT_DISTANCES.map((d) => {
    const source = pickSource(eligible, d.meters)
    if (!source) return null
    const time = riegelPredict(source.time, source.meters, d.meters)
    if (time == null) return null
    return {
      ...d,
      time,
      pace: (time / d.meters) * 1000,
      source,
      rough: source.meters < sourceMinMeters(d.meters) || (Number.isFinite(source.maxGapS) && source.maxGapS > SOURCE_GAP_PREFER_S),
    }
  }).filter(Boolean)

  const base = predictions.length ? predictions[predictions.length - 1].source : null
  return { base, predictions }
}