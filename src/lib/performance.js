import { findIdx } from "./gpx"

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
      if (!best || t < best.time) best = { time: t, pace: (t / meters) * 1000, i0: left }
    }
  }
  return best
}

export function personalRecords(tracks) {
  const recs = PR_DISTANCES.map((d) => {
    let best = null
    for (const t of tracks) {
      if (t.distance < d.meters || t.duration < 60) continue
      const hit = bestTimeForDistance(t.pts, d.meters)
      if (hit && (!best || hit.time < best.time)) {
        best = { ...d, time: hit.time, pace: hit.pace, trackId: t.id, title: t.title, date: t.date }
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

function bestSpeedMperMin(pts, targetSec) {
  let best = 0
  let right = 0
  for (let left = 0; left < pts.length - 1; left++) {
    const targetT = pts[left].t + targetSec
    while (right + 1 < pts.length && pts[right].t < targetT) right++
    let dt = Math.min(targetT, pts[pts.length - 1].t) - pts[left].t
    let dd = pts[right].d - pts[left].d
    if (right + 1 < pts.length && pts[right].t < targetT) {
      const frac = (targetT - pts[right].t) / (pts[right + 1].t - pts[right].t)
      dd += (pts[right + 1].d - pts[right].d) * frac
    }
    if (dt > 60 && dd > 0) best = Math.max(best, (dd / dt) * 60)
  }
  return best
}

export const PERF_WINDOW_S = 600

export function vo2Performance(track) {
  if (track.duration < 120 || !track.pts?.length) return null
  const speed = bestSpeedMperMin(track.pts, PERF_WINDOW_S)
  if (!speed) return null
  return 3.5 + 0.2 * speed
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

export function predictTimes(records) {
  const eligible = records.filter((r) => r && r.meters >= 5000 && r.meters <= 21100 && r.time && hrsSince(r.date) < 24 * 180)
  let base = null
  for (const r of eligible) if (!base || r.pace < base.pace) base = r
  if (!base) return { base: null, predictions: [] }
  const predictions = PREDICT_DISTANCES
    .filter((d) => d.meters !== base.meters)
    .map((d) => {
      const time = base.time * Math.pow(d.meters / base.meters, 1.06)
      return { ...d, time, pace: (time / d.meters) * 1000 }
    })
    .sort((a, b) => a.meters - b.meters)
  return { base, predictions }
}