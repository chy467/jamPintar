export const fmtPace = (secPerKm) => {
  if (!secPerKm || !isFinite(secPerKm)) return "--"
  let m = Math.floor(secPerKm / 60)
  let s = Math.round(secPerKm % 60)
  if (s === 60) { m++; s = 0 }
  return `${m}'${String(s).padStart(2, "0")}"`
}

export const fmtDur = (sec) => {
  sec = Math.round(sec || 0)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`
}

// Jam desimal -> "15 jam 36 menit" (dipakai estimasi Recovery Time)
export const fmtHours = (hours) => {
  if (!Number.isFinite(hours) || hours < 0) return "--"
  const total = Math.round(hours * 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  if (!h) return `${m} menit`
  return m ? `${h} jam ${m} menit` : `${h} jam`
}

export const fmtDate = (iso, withTime = false) =>
  new Date(iso).toLocaleDateString("id-ID", withTime
    ? { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "numeric", month: "short", year: "numeric" })