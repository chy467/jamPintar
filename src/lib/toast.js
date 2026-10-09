import { reactive } from 'vue'

export const toasts = reactive([])

let seq = 0

export function toast(message, type = 'info', duration = 3500) {
  const t = { id: ++seq, message, type, key: ++seq + '-' + message }
  toasts.push(t)
  if (duration > 0) setTimeout(() => dismiss(t.id), duration)
}

export function dismiss(id) {
  const i = toasts.findIndex((x) => x.id === id)
  if (i >= 0) toasts.splice(i, 1)
}