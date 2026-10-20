// Umur selalu diturunkan dari tanggal lahir supaya ikut bertambah otomatis.
export function ageFromBirthDate(birthDate, now = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(birthDate || ''))
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2]) - 1
  const day = Number(m[3])
  const date = new Date(year, month, day)
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null
  let age = now.getFullYear() - year
  if (now.getMonth() < month || (now.getMonth() === month && now.getDate() < day)) age--
  return age >= 0 && age <= 120 ? age : null
}

// Profil lama yang belum punya tanggal lahir masih memakai kolom age.
export function profileAge(profile) {
  const derived = ageFromBirthDate(profile?.birth_date)
  if (derived != null) return derived
  const legacy = Number(profile?.age)
  return Number.isFinite(legacy) && legacy > 0 ? Math.round(legacy) : null
}
