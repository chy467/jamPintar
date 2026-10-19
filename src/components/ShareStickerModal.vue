<script setup>
import { ref, watch, onMounted, computed, nextTick } from 'vue'
import { STICKER_TEMPLATES, renderSticker } from '../lib/stickerCanvas'
import { toast } from '../lib/toast'

const props = defineProps({
  track: { type: Object, required: true },
})
const emit = defineEmits(['close'])

const canvasRef = ref(null)
const fileInputRef = ref(null)
const imageSrc = ref(null)
const aspectRatio = ref('story') // 'story' | 'square'
const selectedTemplate = ref(STICKER_TEMPLATES[0].id)
const colorTheme = ref('light') // 'light' (white text) | 'dark' (dark text)
const showMap = ref(true)
const showSplits = ref(false)
const rendering = ref(false)

const templates = STICKER_TEMPLATES

const canNativeShare = computed(() => {
  return typeof navigator !== 'undefined' && !!navigator.share && !!navigator.canShare
})

const redraw = async () => {
  if (!canvasRef.value) return
  rendering.value = true
  try {
    await renderSticker({
      canvas: canvasRef.value,
      track: props.track,
      imageSrc: imageSrc.value,
      aspectRatio: aspectRatio.value,
      templateId: selectedTemplate.value,
      options: {
        colorTheme: colorTheme.value,
        showMap: showMap.value,
        showSplits: showSplits.value,
      },
    })
  } catch (err) {
    console.error('Render sticker error:', err)
  } finally {
    rendering.value = false
  }
}

watch([aspectRatio, selectedTemplate, colorTheme, showMap, showSplits], () => {
  redraw()
})

const onFileSelected = (e) => {
  const file = e.target.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    toast('Pilih file gambar yang valid (JPG, PNG, WebP).', 'error')
    return
  }

  const reader = new FileReader()
  reader.onload = (event) => {
    imageSrc.value = event.target.result
    redraw()
  }
  reader.readAsDataURL(file)
}

const clearPhoto = () => {
  imageSrc.value = null
  if (fileInputRef.value) fileInputRef.value.value = ''
  redraw()
}

const downloadImage = () => {
  if (!canvasRef.value) return
  try {
    const link = document.createElement('a')
    const cleanTitle = (props.track.title || 'lari').replace(/[^a-z0-9]/gi, '_').toLowerCase()
    link.download = `stiker_${cleanTitle}_${Date.now()}.png`
    link.href = canvasRef.value.toDataURL('image/png')
    link.click()
    toast('Stiker berhasil diunduh!')
  } catch {
    toast('Gagal mengunduh gambar.', 'error')
  }
}

const shareNative = async () => {
  if (!canvasRef.value) return
  try {
    canvasRef.value.toBlob(async (blob) => {
      if (!blob) return
      const file = new File([blob], 'activity-story.png', { type: 'image/png' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: props.track.title || 'Aktivitas Lari',
          text: `Hasil lari saya di JamPintar: ${(props.track.distance / 1000).toFixed(2)} km!`,
        })
      } else {
        downloadImage()
      }
    }, 'image/png')
  } catch (err) {
    if (err.name !== 'AbortError') {
      downloadImage()
    }
  }
}

onMounted(() => {
  nextTick(() => {
    redraw()
  })
})
</script>

<template>
  <div class="fixed inset-0 z-[1200] flex items-center justify-center bg-black/75 p-3 backdrop-blur-xs sm:p-4" role="dialog" aria-modal="true" aria-labelledby="sticker-title">
    <div class="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-line px-5 py-3.5">
        <div>
          <h2 id="sticker-title" class="text-base font-bold text-text-1">Buat Stiker Aktivitas</h2>
          <p class="text-xs text-text-2">Bagikan rekap larimu dengan foto pribadi</p>
        </div>
        <button
          type="button"
          aria-label="Tutup"
          class="flex h-9 w-9 items-center justify-center rounded-lg text-text-2 transition hover:bg-page hover:text-text-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          @click="$emit('close')"
        >
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- Content Grid -->
      <div class="grid flex-1 gap-6 overflow-y-auto p-4 sm:p-6 lg:grid-cols-12">
        <!-- Canvas Preview Area (Col 7) -->
        <div class="flex flex-col items-center justify-center rounded-xl bg-ink-950/5 p-3 lg:col-span-7">
          <div
            :class="[
              'relative max-h-[500px] w-auto overflow-hidden rounded-xl border border-line bg-ink-950 shadow-md transition-all duration-300',
              aspectRatio === 'story' ? 'aspect-[9/16]' : 'aspect-square',
            ]"
          >
            <canvas ref="canvasRef" class="h-full w-full object-contain"></canvas>
            <div v-if="rendering" class="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-semibold text-white">
              Merender stiker...
            </div>
          </div>
          <p class="mt-2 text-center text-[11px] text-text-2">
            Pratinjau resolusi tinggi (1080p).
          </p>
        </div>

        <!-- Controls Area (Col 5) -->
        <div class="space-y-4 lg:col-span-5">
          <!-- 1. Ganti / Unggah Foto -->
          <div class="rounded-xl border border-line bg-page/50 p-3.5">
            <label class="block text-xs font-bold text-text-1">Foto Latar Belakang</label>
            <p class="text-[11px] text-text-2">Pilih foto dari kamera atau galeri</p>
            <input
              ref="fileInputRef"
              type="file"
              accept="image/*"
              class="hidden"
              @change="onFileSelected"
            />
            <div class="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                class="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-teal-600/90"
                @click="fileInputRef?.click()"
              >
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                <span>{{ imageSrc ? 'Ganti Foto' : 'Pilih Foto' }}</span>
              </button>
              <button
                v-if="imageSrc"
                type="button"
                class="rounded-lg border border-line bg-surface px-3 py-2 text-xs font-medium text-text-2 transition hover:bg-page hover:text-red-600"
                @click="clearPhoto"
              >
                Hapus
              </button>
            </div>
          </div>

          <!-- 2. Pilihan Format Rasio -->
          <div>
            <label class="block text-xs font-bold text-text-1">Format Rasio</label>
            <div class="mt-1.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                :class="[
                  'rounded-lg border py-2 text-xs font-semibold transition',
                  aspectRatio === 'story'
                    ? 'border-teal-600 bg-teal-50 text-teal-600'
                    : 'border-line bg-surface text-text-2 hover:bg-page',
                ]"
                @click="aspectRatio = 'story'"
              >
                Story 9:16
              </button>
              <button
                type="button"
                :class="[
                  'rounded-lg border py-2 text-xs font-semibold transition',
                  aspectRatio === 'square'
                    ? 'border-teal-600 bg-teal-50 text-teal-600'
                    : 'border-line bg-surface text-text-2 hover:bg-page',
                ]"
                @click="aspectRatio = 'square'"
              >
                Square 1:1
              </button>
            </div>
          </div>

          <!-- 3. Pilihan Desain / Template Layout -->
          <div>
            <label class="block text-xs font-bold text-text-1">Desain Template</label>
            <div class="mt-1.5 space-y-1.5">
              <button
                v-for="tpl in templates"
                :key="tpl.id"
                type="button"
                :class="[
                  'w-full rounded-lg border p-2.5 text-left transition',
                  selectedTemplate === tpl.id
                    ? 'border-teal-600 bg-teal-50/50'
                    : 'border-line bg-surface hover:bg-page',
                ]"
                @click="selectedTemplate = tpl.id"
              >
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-text-1">{{ tpl.name }}</span>
                  <span v-if="selectedTemplate === tpl.id" class="text-[10px] font-bold text-teal-600">Terpilih</span>
                </div>
                <p class="mt-0.5 text-[11px] text-text-2">{{ tpl.description }}</p>
              </button>
            </div>
          </div>

          <!-- 4. Penyesuaian Tema & Elemen -->
          <div class="space-y-2 border-t border-line pt-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-text-2">Warna Teks</span>
              <div class="flex rounded-md border border-line bg-surface p-0.5">
                <button
                  type="button"
                  :class="[
                    'rounded px-2.5 py-1 text-[11px] font-semibold transition',
                    colorTheme === 'light' ? 'bg-teal-600 text-white' : 'text-text-2 hover:text-text-1',
                  ]"
                  @click="colorTheme = 'light'"
                >
                  Putih
                </button>
                <button
                  type="button"
                  :class="[
                    'rounded px-2.5 py-1 text-[11px] font-semibold transition',
                    colorTheme === 'dark' ? 'bg-teal-600 text-white' : 'text-text-2 hover:text-text-1',
                  ]"
                  @click="colorTheme = 'dark'"
                >
                  Gelap
                </button>
              </div>
            </div>

            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-text-2">Tampilkan Peta Rute</span>
              <input
                v-model="showMap"
                type="checkbox"
                class="h-4 w-4 rounded accent-teal-600"
              />
            </div>

            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-text-2">Tampilkan Split Km</span>
              <input
                v-model="showSplits"
                type="checkbox"
                class="h-4 w-4 rounded accent-teal-600"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Aksi -->
      <div class="flex flex-wrap items-center justify-end gap-2.5 border-t border-line bg-page/40 px-5 py-3">
        <button
          type="button"
          class="rounded-lg border border-line bg-surface px-4 py-2.5 text-xs font-semibold text-text-2 transition hover:bg-page hover:text-text-1"
          @click="$emit('close')"
        >
          Batal
        </button>

        <button
          v-if="canNativeShare"
          type="button"
          class="flex items-center gap-1.5 rounded-lg border border-teal-600/40 bg-teal-50 px-4 py-2.5 text-xs font-bold text-teal-600 transition hover:bg-teal-100/60"
          @click="shareNative"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="18" cy="5" r="3"></circle>
            <circle cx="6" cy="12" r="3"></circle>
            <circle cx="18" cy="19" r="3"></circle>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
          </svg>
          <span>Bagikan</span>
        </button>

        <button
          type="button"
          class="flex items-center gap-1.5 rounded-lg bg-teal-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-teal-600/90"
          @click="downloadImage"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>Unduh Gambar</span>
        </button>
      </div>
    </div>
  </div>
</template>
