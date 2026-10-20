export const MAX_HR_MIN = 80
export const MAX_HR_MAX = 250

export const estimateMaxHr = (age) => Math.round(208 - 0.7 * Number(age))

// HR Maks Personal: nilai dari profil, atau estimasi umur. Tidak pernah memakai HR Maks Aktivitas.
export function resolveMaxHr(profile) {
  const manual = profile?.max_hr
  if (manual != null && Number.isFinite(Number(manual)) && Number(manual) > 0) {
    return { value: Math.round(Number(manual)), source: 'manual' }
  }
  const age = profile?.age
  if (age != null && Number.isFinite(Number(age)) && Number(age) > 0) {
    return { value: estimateMaxHr(age), source: 'estimated' }
  }
  return null
}
