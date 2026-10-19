<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { supabase } from './lib/supabaseClient'
import { toast } from './lib/toast'
import { parseGPX, buildTrack, routeThumb } from './lib/gpx'
import { summarizeVO2 } from './lib/performance'
import AppHeader from './components/AppHeader.vue'
import BottomNav from './components/BottomNav.vue'
import AuthView from './components/AuthView.vue'
import HomeView from './components/HomeView.vue'
import RecordsView from './components/RecordsView.vue'
import ProfileView from './components/ProfileView.vue'
import ActivityView from './components/ActivityView.vue'
import ToastHost from './components/ToastHost.vue'

const user = ref(null)
const view = ref('home')
const tracks = ref([])
const profile = ref(null)
const selectedTrack = ref(null)
const loading = ref(true)
const error = ref('')
const importing = ref(false)
const importError = ref('')
const savingProfile = ref(false)
const ready = ref(!supabase)

let authListener = null

const vo2 = computed(() => summarizeVO2(tracks.value, profile.value))

const resetData = () => {
  tracks.value = []
  profile.value = null
  selectedTrack.value = null
  view.value = 'home'
  loading.value = false
  error.value = ''
  importError.value = ''
}

const num = (v) => (v == null ? null : Number(v))

const mapRow = (t) => {
  const pts = t.points || []
  return {
    id: t.id,
    title: t.title,
    date: t.date,
    distance: num(t.distance_m),
    duration: num(t.duration_s),
    avgPace: num(t.avg_pace_s_per_km),
    elevGain: num(t.elev_gain_m),
    elevLoss: num(t.elev_loss_m),
    minEle: num(t.min_ele_m),
    maxEle: num(t.max_ele_m),
    avgHR: num(t.avg_hr),
    maxHR: num(t.max_hr),
    avgCad: num(t.avg_cad),
    restingHr: num(t.resting_hr),
    hrMaxSet: num(t.hr_max_set),
    pts,
    thumb: pts.length ? routeThumb(pts) : '',
  }
}

const loadTracks = async () => {
  if (!user.value) return
  const { data, error: err } = await supabase
    .from('tracks')
    .select('*')
    .order('date', { ascending: false })
  if (err) throw new Error(err.message)
  tracks.value = (data || []).map(mapRow).sort((a, b) => b.date.localeCompare(a.date))
}

const loadProfile = async () => {
  if (!user.value) return { data: null }
  const { data } = await supabase.from('profiles').select('*').eq('id', user.value.id).maybeSingle()
  profile.value = data || null
  return { data }
}

const refresh = async () => {
  loading.value = true
  error.value = ''
  try {
    await Promise.all([loadTracks(), loadProfile()])
  } catch (e) {
    error.value = e.message || 'Gagal memuat data dari Supabase.'
  } finally {
    loading.value = false
  }
}

const loadSession = async () => {
  try {
    if (!supabase) { ready.value = true; return }
    const { data } = await supabase.auth.getSession()
    user.value = data.session?.user ?? null
    if (user.value) await refresh()
  } catch {
    error.value = 'Gagal memuat sesi dari Supabase.'
  } finally {
    ready.value = true
  }
}

onMounted(loadSession)

authListener = supabase?.auth.onAuthStateChange((_event, session) => {
  const u = session?.user ?? null
  if (u && !user.value) { user.value = u; refresh() }
  else if (!u && user.value) { user.value = null; resetData() }
})

const logout = async () => {
  await supabase?.auth.signOut()
  resetData()
}

const saveProfile = async (payload) => {
  savingProfile.value = true
  try {
    const { error: err } = await supabase.from('profiles').upsert({ id: user.value.id, ...payload, updated_at: new Date().toISOString() })
    if (err) throw new Error(err.message)
    profile.value = { ...(profile.value || { id: user.value.id }), ...payload }
    toast('Profil tersimpan.', 'success', 2500)
  } catch (e) {
    toast(e.message, 'error')
  } finally {
    savingProfile.value = false
  }
}

const toRow = (t) => ({
  user_id: user.value.id,
  title: t.title,
  date: t.date,
  distance_m: t.distance,
  duration_s: t.duration,
  avg_pace_s_per_km: t.avgPace,
  elev_gain_m: t.elevGain,
  elev_loss_m: t.elevLoss,
  min_ele_m: t.minEle,
  max_ele_m: t.maxEle,
  avg_hr: t.avgHR,
  max_hr: t.maxHR,
  avg_cad: t.avgCad,
  resting_hr: t.restingHr ?? null,
  hr_max_set: t.hrMaxSet ?? null,
  points: t.pts,
})

const onFiles = async (fileList) => {
  if (!fileList?.length || importing.value) return
  importing.value = true
  importError.value = ''
  toast(`Mengimpor ${fileList.length} ${fileList.length > 1 ? 'file' : 'file'}...`, 'info', 2500)
  const failures = []
  let done = 0
  for (const file of fileList) {
    try {
      const text = await file.text()
      const { raw, name } = parseGPX(text)
      const track = buildTrack(raw, name || file.name.replace(/\.gpx$/i, ''))
      const { error } = await supabase.from('tracks').insert(toRow(track))
      if (error) throw new Error(error.message)
      done++
    } catch (e) {
      failures.push(`${file.name}: ${e.message}`)
    }
  }
  if (done) await refresh()
  importing.value = false
  if (failures.length) {
    importError.value = failures[0]
    toast(done ? `${done} ditambahkan, ${failures.length} gagal.` : `${failures.length} file gagal diimpor.`, 'error', 6000)
  } else if (done) {
    toast(`${done} ${done > 1 ? 'aktivitas' : 'aktivitas'} berhasil diimpor.`, 'success')
  }
}

const quickDeleteTrack = async (t) => {
  const { error } = await supabase.from('tracks').delete().eq('id', t.id)
  if (error) { toast(error.message, 'error'); importError.value = error.message; return }
  tracks.value = tracks.value.filter((x) => x.id !== t.id)
  toast('Aktivitas dihapus.', 'success', 2500)
}

const confirmTrackDelete = async (track) => {
  if (!window.confirm(`Hapus "${track.title}"? Tindakan ini tidak bisa dibatalkan.`)) return
  const { error } = await supabase.from('tracks').delete().eq('id', track.id)
  if (error) { toast(error.message, 'error'); return }
  await refresh()
  view.value = 'home'
  selectedTrack.value = null
  toast('Aktivitas dihapus.', 'success', 2500)
}

const applyTrackSettings = ({ restingHr, hrMaxSet }) => {
  const i = tracks.value.findIndex((t) => t.id === selectedTrack.value?.id)
  if (i < 0) return
  const next = { ...tracks.value[i], restingHr, hrMaxSet }
  tracks.value.splice(i, 1, next)
  selectedTrack.value = next
}

const nav = (v) => { view.value = v }
const openTrack = (t) => {
  const tr = typeof t === 'string' ? tracks.value.find((x) => x.id === t) : t
  if (!tr) return
  selectedTrack.value = tr
  view.value = 'activity'
}
const backFromActivity = () => { view.value = 'home'; selectedTrack.value = null }

onBeforeUnmount(() => authListener?.data?.subscription.unsubscribe())
</script>

<template>
  <AppHeader v-if="user" :user="user" :display-name="profile?.display_name" @logout="logout" />
  <ToastHost />

  <div v-if="!ready" class="flex min-h-screen items-center justify-center bg-page">
    <span class="h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" aria-hidden="true"></span>
  </div>

  <AuthView v-else-if="!user" />

  <template v-else>
    <HomeView
      v-if="view === 'home'"
      :tracks="tracks"
      :profile="profile"
      :vo2="vo2"
      :loading="loading"
      :error="error"
      :importing="importing"
      :import-error="importError"
      @open="openTrack"
      @files="onFiles"
      @nav="nav"
      @retry="refresh"
      @quickdelete="quickDeleteTrack"
    />

    <RecordsView
      v-else-if="view === 'records'"
      :tracks="tracks"
      :profile="profile"
      :vo2="vo2"
      :loading="loading"
      :error="error"
      @open="openTrack"
      @nav="nav"
    />

    <ProfileView
      v-else-if="view === 'profile'"
      :profile="profile"
      :email="user.user_metadata?.email || user.email"
      :saving="savingProfile"
      @save="saveProfile"
      @logout="logout"
    />

    <ActivityView
      v-else-if="view === 'activity' && selectedTrack"
      :key="selectedTrack.id"
      :track="selectedTrack"
      :tracks="tracks"
      :profile="profile"
      @back="backFromActivity"
      @delete="confirmTrackDelete"
      @settings="applyTrackSettings"
    />

    <BottomNav v-if="['home', 'records', 'profile'].includes(view)" :view="view" @navigate="nav" />
  </template>
</template>