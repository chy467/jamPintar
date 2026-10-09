const rad = (x) => (x * Math.PI) / 180

export const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length

const haversine = (a, b) => {
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

export function parseGPX(text) {
  const doc = new DOMParser().parseFromString(text, "text/xml")
  if (doc.querySelector("parsererror")) {
    const msg = doc.querySelector("parsererror")?.textContent || ""
    throw new Error(msg.includes("collapsed") ? "File GPX rusak atau tanggal tidak wajar." : "File GPX tidak valid.")
  }
  const ext = (el, name) => {
    const node = [...el.getElementsByTagName("*")].find((x) => x.localName === name)
    const v = node ? parseFloat(node.textContent) : NaN
    return isNaN(v) ? null : v
  }
  const raw = [...doc.getElementsByTagName("trkpt")].map((el) => {
    const t = [...el.children].find((c) => c.localName === "time")
    return {
      lat: parseFloat(el.getAttribute("lat")),
      lon: parseFloat(el.getAttribute("lon")),
      ele: ext(el, "ele"),
      time: t ? Date.parse(t.textContent) : null,
      hr: ext(el, "hr"),
      cad: ext(el, "cad"),
    }
  }).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon))
  if (raw.length < 2) throw new Error("Tidak ada titik track di file GPX ini.")
  return { raw, name: doc.querySelector("trk > name")?.textContent?.trim() }
}

export function buildTrack(raw, title) {
  if (!raw.every((p) => Number.isFinite(p.time))) throw new Error("GPX tidak memiliki data waktu, pace tidak bisa dihitung.")
  let d = 0
  raw.forEach((p, i) => {
    if (i) d += haversine(raw[i - 1], p)
    p.d = d
    p.t = (p.time - raw[0].time) / 1000
  })

  const el = raw.map((p) => p.ele).filter((v) => v != null)
  let gain = 0, loss = 0
  if (el.length > 5) {
    const sm = el.map((_, i) => avg(el.slice(Math.max(0, i - 2), i + 3)))
    for (let i = 1; i < sm.length; i++) {
      const diff = sm[i] - sm[i - 1]
      if (diff > 0) gain += diff; else loss -= diff
    }
  }

  const hrs = raw.map((p) => p.hr).filter(Boolean)
  const cads = raw.map((p) => p.cad).filter(Boolean)
  let avgCad = cads.length ? Math.round(avg(cads)) : null
  if (avgCad && avgCad < 120) avgCad *= 2

  const step = Math.ceil(raw.length / 1200)
  const pts = raw
    .filter((_, i) => i % step === 0 || i === raw.length - 1)
    .map((p) => ({ lat: +p.lat.toFixed(6), lon: +p.lon.toFixed(6), ele: p.ele, d: Math.round(p.d), t: Math.round(p.t), hr: p.hr, cad: p.cad }))

  let last = null
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 4)], b = pts[Math.min(pts.length - 1, i + 4)]
    const dd = b.d - a.d, dt = b.t - a.t
    p.pace = dd > 3 && dt > 0 ? (dt / dd) * 1000 : last
    last = p.pace
  })

  const distance = pts[pts.length - 1].d
  const duration = pts[pts.length - 1].t

  let maxSpeed = 0
  for (let i = 1; i < pts.length; i++) {
    const dt = pts[i].t - pts[i - 1].t, dd = pts[i].d - pts[i - 1].d
    if (dt > 0.5 && dd > 0) maxSpeed = Math.max(maxSpeed, (dd / dt) * 3.6)
  }

  return {
    title,
    date: new Date(raw[0].time).toISOString(),
    distance, duration,
    avgPace: duration / (distance / 1000),
    elevGain: Math.round(gain), elevLoss: Math.round(loss),
    minEle: el.length ? Math.round(Math.min(...el)) : null,
    maxEle: el.length ? Math.round(Math.max(...el)) : null,
    avgHR: hrs.length ? Math.round(avg(hrs)) : null,
    maxHR: hrs.length ? Math.max(...hrs) : null,
    avgCad,
    maxSpeed: maxSpeed ? +maxSpeed.toFixed(1) : null,
    pts,
  }
}

export function findIdx(pts, target) {
  let lo = 0, hi = pts.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (pts[mid].d < target) lo = mid + 1; else hi = mid
  }
  return lo > 0 && Math.abs(pts[lo - 1].d - target) < Math.abs(pts[lo].d - target) ? lo - 1 : lo
}

export function timeAt(pts, target) {
  const i = Math.max(1, findIdx(pts, target))
  const a = pts[i - 1], b = pts[i]
  return b.d === a.d ? b.t : a.t + ((target - a.d) / (b.d - a.d)) * (b.t - a.t)
}

export function splitsOf(track) {
  const pts = track.pts, total = track.distance, out = []
  for (let from = 0; from < total; from += 1000) {
    const to = Math.min(from + 1000, total)
    if (to - from < 50) break
    const sec = timeAt(pts, to) - timeAt(pts, from)
    const i0 = findIdx(pts, from), i1 = findIdx(pts, to)
    const hr = pts.slice(i0, i1 + 1).map((p) => p.hr).filter(Boolean)
    out.push({
      label: to - from < 1000 ? (to / 1000).toFixed(2) : String(from / 1000 + 1),
      from, to, sec, dist: to - from, pace: (sec / (to - from)) * 1000,
      elev: pts[i0].ele != null && pts[i1].ele != null ? Math.round(pts[i1].ele - pts[i0].ele) : 0,
      hr: hr.length ? Math.round(avg(hr)) : null,
    })
  }
  const paces = out.map((s) => s.pace)
  const fast = Math.min(...paces), slow = Math.max(...paces)
  out.forEach((s) => {
    s.bar = slow === fast ? 100 : 35 + 65 * ((slow - s.pace) / (slow - fast))
    s.fastest = s.pace === fast
  })
  return out
}

export const ZONES = [
  { n: "Z5", name: "Maksimum", c: "#c0392b", lo: 0.9 },
  { n: "Z4", name: "Ambang", c: "#d97706", lo: 0.8 },
  { n: "Z3", name: "Aerobik", c: "#2e7d4f", lo: 0.7 },
  { n: "Z2", name: "Mudah", c: "#0a6a7d", lo: 0.6 },
  { n: "Z1", name: "Pemanasan", c: "#8a979c", lo: 0 },
]

export function zoneDuration(track) {
  const hrMax = track?.hrMaxSet || track?.maxHR
  if (!hrMax) return null
  const secs = ZONES.map(() => 0)
  for (let i = 1; i < track.pts.length; i++) {
    const hr = track.pts[i].hr
    if (!hr) continue
    const zi = ZONES.findIndex((z) => hr / hrMax >= z.lo)
    secs[zi] += track.pts[i].t - track.pts[i - 1].t
  }
  const total = secs.reduce((a, b) => a + b, 0) || 1
  return ZONES.map((z, i) => {
    const lo = Math.round(hrMax * z.lo)
    const hi = i ? Math.round(hrMax * ZONES[i - 1].lo) - 1 : null
    return { ...z, sec: secs[i], pct: (secs[i] / total) * 100, range: i === 0 ? `${lo}+ bpm` : i === 4 ? `< ${hi + 1} bpm` : `${lo}${hi === null ? "" : "-" + hi} bpm` }
  })
}

export function routeThumb(pts) {
  if (!pts?.length) return ""
  const s = Math.ceil(pts.length / 70)
  const sample = pts.filter((_, i) => i % s === 0)
  const kx = Math.cos(rad(sample[0].lat))
  const xs = sample.map((p) => p.lon * kx), ys = sample.map((p) => -p.lat)
  const x0 = Math.min(...xs), y0 = Math.min(...ys)
  const sc = Math.min(52 / (Math.max(...xs) - x0 || 1), 36 / (Math.max(...ys) - y0 || 1))
  return sample.map((_, i) => `${i ? "L" : "M"}${(4 + (xs[i] - x0) * sc).toFixed(1)} ${(4 + (ys[i] - y0) * sc).toFixed(1)}`).join("")
}