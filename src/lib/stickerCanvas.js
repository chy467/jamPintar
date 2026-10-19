import { fmtPace, fmtDur, fmtDate } from './format'
import { splitsOf } from './gpx'

const MAX_SPLITS = 10

/**
 * Format data aktivitas ke bentuk ringkas untuk template stiker
 */
export function extractStickerData(track) {
  const splits = splitsOf(track)

  return {
    title: track.title || 'Aktivitas Lari',
    distanceKm: (track.distance / 1000).toFixed(2),
    durationStr: fmtDur(track.duration),
    paceStr: fmtPace(track.avgPace),
    avgHR: track.avgHR,
    elevGain: track.elevGain,
    dateStr: fmtDate(track.date, false),
    splits,
    pts: track.pts || [],
  }
}

/**
 * Maksimal 10 baris split. Bila lebih, ambil 10 split tercepat (pace terbaik).
 */
function pickSplits(splits) {
  if (!splits || !splits.length) return { rows: [], truncated: false }
  if (splits.length <= MAX_SPLITS) return { rows: splits, truncated: false }
  const rows = [...splits].sort((a, b) => a.pace - b.pace).slice(0, MAX_SPLITS)
  return { rows, truncated: true }
}

/**
 * Gambar rute GPX ke kotak x/y/width/height dengan halo agar tetap terlihat di foto apa pun.
 */
function drawRoute(ctx, pts, x, y, width, height, strokeStyle, lineWidth = 5) {
  if (!pts || pts.length < 2) return

  const step = Math.max(1, Math.floor(pts.length / 300))
  const sample = pts.filter((_, i) => i % step === 0)
  if (sample.length < 2) return

  const rad = (v) => (v * Math.PI) / 180
  const cosLat = Math.cos(rad(sample[0].lat))
  const xs = sample.map((p) => p.lon * cosLat)
  const ys = sample.map((p) => -p.lat)

  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const spanX = maxX - minX || 0.0001
  const spanY = maxY - minY || 0.0001

  const padding = 14
  const targetW = width - padding * 2
  const targetH = height - padding * 2
  const scale = Math.min(targetW / spanX, targetH / spanY)
  const offsetX = x + padding + (targetW - spanX * scale) / 2
  const offsetY = y + padding + (targetH - spanY * scale) / 2

  const path = () => {
    ctx.beginPath()
    sample.forEach((_, i) => {
      const px = offsetX + (xs[i] - minX) * scale
      const py = offsetY + (ys[i] - minY) * scale
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
  }

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Halo gelap/terang supaya rute kontras di atas foto apa pun
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'
  ctx.lineWidth = lineWidth + 6
  path()
  ctx.stroke()

  ctx.strokeStyle = strokeStyle
  ctx.lineWidth = lineWidth
  path()
  ctx.stroke()

  const startX = offsetX + (xs[0] - minX) * scale
  const startY = offsetY + (ys[0] - minY) * scale
  const endX = offsetX + (xs[xs.length - 1] - minX) * scale
  const endY = offsetY + (ys[ys.length - 1] - minY) * scale

  const dot = (px, py, color) => {
    ctx.beginPath()
    ctx.arc(px, py, lineWidth * 1.6, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(px, py, lineWidth * 1.15, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
  }

  dot(startX, startY, '#22c55e')
  dot(endX, endY, '#ef4444')
  ctx.restore()
}

function roundRect(ctx, x, y, w, h, r) {
  if (w < 2 * r) r = w / 2
  if (h < 2 * r) r = h / 2
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/**
 * Registry Template Stiker.
 * Template baru cukup ditambahkan di array ini; UI otomatis menampilkannya.
 * Kontrak render: (ctx, { width, height, data, opts }) => void
 */
export const STICKER_TEMPLATES = [
  {
    id: 'minimal-modern',
    name: 'Modern Minimal',
    description: 'Statistik besar dalam panel solid, rute melayang di atas foto.',
    render: (ctx, { width, height, data, opts }) => {
      const u = height < 1400 ? 0.72 : 1
      const isDark = opts.colorTheme === 'dark'
      const textColor = isDark ? '#0f172a' : '#ffffff'
      const mutedColor = isDark ? 'rgba(15, 23, 42, 0.62)' : 'rgba(255, 255, 255, 0.72)'
      const accentColor = isDark ? '#0a6a7d' : '#2dd4bf'
      const pad = Math.round(48 * (height < 1400 ? 0.75 : 1))
      const cardW = width - pad * 2
      const innerPad = 28 * u

      const { rows, truncated } = opts.showSplits ? pickSplits(data.splits) : { rows: [], truncated: false }
      const rowH = 36 * u

      const statsH = 250 * u
      const splitsH = rows.length ? 46 * u + rows.length * rowH + 14 * u : 0
      const cardH = statsH + splitsH
      const cardX = pad
      const cardY = height - pad - cardH

      // 1. Gradient bawah: pemanis + jaring pengaman keterbacaan
      const grad = ctx.createLinearGradient(0, height * 0.35, 0, height)
      if (isDark) {
        grad.addColorStop(0, 'rgba(255, 255, 255, 0)')
        grad.addColorStop(1, 'rgba(255, 255, 255, 0.55)')
      } else {
        grad.addColorStop(0, 'rgba(0, 0, 0, 0)')
        grad.addColorStop(1, 'rgba(0, 0, 0, 0.6)')
      }
      ctx.fillStyle = grad
      ctx.fillRect(0, height * 0.35, width, height * 0.65)

      // 2. Rute peta: ukuran tetap, tidak menyusut saat split bertambah
      if (opts.showMap && data.pts.length > 1) {
        const mapY = 130 * u
        const mapH = Math.max(height * 0.78 - mapY, 320 * u)
        drawRoute(ctx, data.pts, pad, mapY, cardW, mapH, accentColor, 5 * u)
      }

      // 3. Overlay statistik: tanpa bingkai, menimpa peta bila perlu
      ctx.save()
      ctx.shadowColor = isDark ? 'rgba(15, 23, 42, 0.18)' : 'rgba(0, 0, 0, 0.15)'
      ctx.shadowBlur = 24 * u
      ctx.shadowOffsetY = 8 * u
      roundRect(ctx, cardX, cardY, cardW, cardH, 22 * u)
      ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(14, 31, 38, 0.75)'
      ctx.fill()
      ctx.restore()

      const x0 = cardX + innerPad
      const top = cardY + 44 * u

      // 4. Jarak utama
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      ctx.fillStyle = mutedColor
      ctx.font = `700 ${30 * u}px "Barlow", sans-serif`
      ctx.fillText('JARAK', x0, top)

      ctx.fillStyle = textColor
      ctx.font = `900 ${102 * u}px "Barlow Semi Condensed", sans-serif`
      ctx.fillText(data.distanceKm, x0, top + 84 * u)

      const distW = ctx.measureText(data.distanceKm).width
      ctx.fillStyle = accentColor
      ctx.font = `700 ${44 * u}px "Barlow", sans-serif`
      ctx.fillText('km', x0 + distW + 10 * u, top + 54 * u)

      // 5. Tiga statistik pendukung
      const statY = top + 126 * u
      const colW = (cardW - innerPad * 2) / 3
      const stats = [
        ['AVG PACE', `${data.paceStr} /km`],
        ['WAKTU', data.durationStr],
        [data.avgHR ? 'AVG HR' : 'ELEV', data.avgHR ? `${data.avgHR} bpm` : `${data.elevGain || 0} m`],
      ]

      stats.forEach(([label, value], i) => {
        const sx = x0 + colW * i
        ctx.fillStyle = mutedColor
        ctx.font = `600 ${24 * u}px "Barlow", sans-serif`
        ctx.fillText(label, sx, statY)
        ctx.fillStyle = textColor
        ctx.font = `800 ${30 * u}px "Barlow Semi Condensed", sans-serif`
        ctx.fillText(value, sx, statY + 36 * u)
      })

      // 6. Split (satu kolom, urut dari atas ke bawah)
      if (rows.length) {
        const splitY = cardY + statsH + 6 * u
        ctx.fillStyle = mutedColor
        ctx.font = `700 ${28 * u}px "Barlow", sans-serif`
        ctx.fillText(truncated ? `SPLIT TERBAIK (${MAX_SPLITS} TERCEPAT)` : 'SPLIT PER KILOMETER', x0, splitY + 16 * u)

        const fastestPace = Math.min(...rows.map((r) => r.pace))
        const rowW = Math.min(cardW - innerPad * 2, 420 * u)

        rows.forEach((s, i) => {
          const cy = splitY + 46 * u + i * rowH + 20 * u

          ctx.fillStyle = mutedColor
          ctx.font = `600 ${28 * u}px "Barlow", sans-serif`
          ctx.fillText(`Km ${s.label}`, x0, cy)

          ctx.textAlign = 'right'
          ctx.fillStyle = s.pace === fastestPace ? accentColor : textColor
          ctx.font = `700 ${36 * u}px "Barlow Semi Condensed", sans-serif`
          ctx.fillText(fmtPace(s.pace), x0 + rowW, cy)
          ctx.textAlign = 'left'

          if (i < rows.length - 1) {
            ctx.strokeStyle = isDark ? 'rgba(15, 23, 42, 0.10)' : 'rgba(255, 255, 255, 0.10)'
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(x0, cy + 10 * u)
            ctx.lineTo(x0 + rowW, cy + 10 * u)
            ctx.stroke()
          }
        })
      }

      // 7. Header brand
      ctx.fillStyle = '#ffffff' //textColor
      ctx.font = `800 ${30 * u}px "Barlow", sans-serif`
      ctx.fillText('JAM PINTAR', pad, 62 * u)

      ctx.fillStyle = '#ffffff' //mutedColor
      ctx.font = `500 ${20 * u}px "Barlow", sans-serif`
      ctx.fillText(data.dateStr, pad, 94 * u)
    },
  },
]

/**
 * Render stiker ke canvas.
 */
export async function renderSticker({
  canvas,
  track,
  imageSrc = null,
  aspectRatio = 'story',
  templateId = 'minimal-modern',
  options = { colorTheme: 'light', showMap: true, showSplits: false },
}) {
  if (!canvas || !track) return

  const ctx = canvas.getContext('2d')
  const width = 1080
  const height = aspectRatio === 'story' ? 1920 : 1080

  canvas.width = width
  canvas.height = height
  ctx.clearRect(0, 0, width, height)

  if (imageSrc) {
    try {
      const img = await loadImage(imageSrc)
      drawImageCover(ctx, img, 0, 0, width, height)
    } catch {
      drawDefaultBackground(ctx, width, height)
    }
  } else {
    drawDefaultBackground(ctx, width, height)
  }

  const data = extractStickerData(track)
  const template = STICKER_TEMPLATES.find((t) => t.id === templateId) || STICKER_TEMPLATES[0]
  template.render(ctx, { width, height, data, opts: options })
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function drawImageCover(ctx, img, x, y, w, h) {
  const imgRatio = img.width / img.height
  const targetRatio = w / h
  let sw, sh, sx, sy

  if (imgRatio > targetRatio) {
    sh = img.height
    sw = img.height * targetRatio
    sx = (img.width - sw) / 2
    sy = 0
  } else {
    sw = img.width
    sh = img.width / targetRatio
    sx = 0
    sy = (img.height - sh) / 2
  }

  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}

function drawDefaultBackground(ctx, w, h) {
  const grad = ctx.createLinearGradient(0, 0, w, h)
  grad.addColorStop(0, '#0e1f26')
  grad.addColorStop(0.6, '#17272e')
  grad.addColorStop(1, '#0a323d')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)
}
