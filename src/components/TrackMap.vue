<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { findIdx } from '../lib/gpx'

const props = defineProps({
  track: { type: Object, required: true },
  colorBy: { type: String, default: 'solid' },
  tileMode: { type: String, default: 'map' },
  split: { type: Object, default: null },
  previewIdx: { type: Number, default: null },
  follow: { type: Boolean, default: false },
})

const el = ref(null)

let map, tileLayer, routeGroup, splitLayer, hoverMarker

const TILES = {
  map: { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', attr: '&copy; OpenStreetMap &copy; CARTO' },
  sat: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: 'Tiles &copy; Esri' },
}

const heat = (t) => `hsl(${Math.round(215 - 200 * Math.min(1, Math.max(0, t)))}, 90%, 52%)`
const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length

const ll = () => (props.track ? props.track.pts.map((p) => [p.lat, p.lon]) : [])

const applyTiles = () => {
  if (!map) return
  if (tileLayer) tileLayer.remove()
  const c = TILES[props.tileMode]
  tileLayer = L.tileLayer(c.url, { attribution: c.attr, maxZoom: 19 }).addTo(map)
  tileLayer.bringToBack()
}

const drawRoute = () => {
  if (!map || !props.track) return
  if (routeGroup) routeGroup.remove()
  routeGroup = L.layerGroup().addTo(map)
  const coords = ll()

  L.polyline(coords, { color: '#ffffff', weight: 9, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }).addTo(routeGroup)

  if (props.colorBy === 'solid') {
    L.polyline(coords, { color: '#0a6a7d', weight: 5, lineCap: 'round', lineJoin: 'round' }).addTo(routeGroup)
  } else {
    const pts = props.track.pts
    const val = (p) => (props.colorBy === 'pace' ? p.pace : p.hr)
    const sorted = pts.map(val).filter(Boolean).sort((a, b) => a - b)
    const lo = sorted[Math.floor(sorted.length * 0.1)] || 1
    const hi = sorted[Math.floor(sorted.length * 0.9)] || 1
    for (let i = 1; i < pts.length; i++) {
      const v = avg([val(pts[i - 1]) ?? lo, val(pts[i]) ?? lo])
      const tt = props.colorBy === 'pace' ? (hi - v) / (hi - lo || 1) : (v - lo) / (hi - lo || 1)
      L.polyline([coords[i - 1], coords[i]], { color: heat(tt), weight: 5, lineCap: 'round' }).addTo(routeGroup)
    }
  }

  for (let k = 1; k * 1000 < props.track.distance; k++) {
    const p = props.track.pts[findIdx(props.track.pts, k * 1000)]
    L.marker([p.lat, p.lon], { interactive: false, icon: L.divIcon({ className: 'km-pin', html: String(k), iconSize: [20, 20] }) }).addTo(routeGroup)
  }
  L.circleMarker(coords[0], { radius: 8, color: '#ffffff', weight: 3, fillColor: '#2e7d4f', fillOpacity: 1 }).bindTooltip('Start').addTo(routeGroup)
  L.circleMarker(coords[coords.length - 1], { radius: 8, color: '#ffffff', weight: 3, fillColor: '#16252b', fillOpacity: 1 }).bindTooltip('Finish').addTo(routeGroup)
}

const fitAll = () => {
  if (!map || !props.track) return
  map.fitBounds(L.latLngBounds(ll()), { padding: [40, 40] })
}

const applySplit = () => {
  if (!map) return
  if (splitLayer) { splitLayer.remove(); splitLayer = null }
  const t = props.track, s = props.split
  if (!s) return
  const seg = t.pts.slice(findIdx(t.pts, s.from), findIdx(t.pts, s.to) + 1).map((p) => [p.lat, p.lon])
  splitLayer = L.polyline(seg, { color: '#312e81', weight: 7, lineCap: 'round' }).addTo(map)
  map.fitBounds(splitLayer.getBounds(), { padding: [60, 60], maxZoom: 17 })
}

const applyPreview = () => {
  if (!map || !props.track) return
  if (props.previewIdx == null) {
    if (hoverMarker) hoverMarker.remove()
    return
  }
  const p = props.track.pts[props.previewIdx]
  if (!p) return
  if (!hoverMarker) {
    hoverMarker = L.circleMarker([0, 0], { radius: 8, color: '#ffffff', weight: 3, fillColor: '#16252b', fillOpacity: 1 })
  }
  hoverMarker.setLatLng([p.lat, p.lon])
  if (!map.hasLayer(hoverMarker)) hoverMarker.addTo(map)
  if (props.follow && !map.getBounds().pad(-0.15).contains([p.lat, p.lon])) map.panTo([p.lat, p.lon])
}

onMounted(() => {
  map = L.map(el.value, { zoomControl: false })
  L.control.zoom({ position: 'bottomright' }).addTo(map)
  hoverMarker = L.circleMarker([0, 0], { radius: 8, color: '#ffffff', weight: 3, fillColor: '#16252b', fillOpacity: 1 })
  applyTiles()
  fitAll()
  drawRoute()
})

onBeforeUnmount(() => {
  if (map) { map.remove(); map = null }
  tileLayer = routeGroup = splitLayer = hoverMarker = null
})

watch(() => props.track, () => { fitAll(); drawRoute() })
watch(() => props.colorBy, drawRoute)
watch(() => props.tileMode, applyTiles)
watch(() => props.split, applySplit)
watch(() => props.previewIdx, applyPreview)

const refreshSize = () => map?.invalidateSize()
defineExpose({ refreshSize })
</script>

<template>
  <div ref="el" class="h-full w-full"></div>
</template>

<style scoped>
:deep(.km-pin) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 9999px;
  background: #ffffff;
  color: #16252b;
  border: 2px solid #0e1f26;
  font: 700 10px/1 'Barlow Semi Condensed', sans-serif;
}

:deep(.leaflet-container) {
  background: #dde5e8;
  font-family: inherit;
}

:deep(.leaflet-control-attribution) {
  font-size: 9px;
}
</style>