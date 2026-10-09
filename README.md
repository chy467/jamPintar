# JamPintar

Dashboard lari dari file GPX. Mobile-first, gaya Garmin: peta + replay interaktif, split per kilometer, personal best ala Strava, estimasi VO2max, dan prediksi waktu balapan (persamaan Riegel).

Dibangun dengan Vue 3, Vite, Tailwind CSS v4 (PostCSS), Leaflet, dan Supabase untuk autentikasi serta penyimpanan.

## Fitur

- Login/registrasi email via Supabase Auth, plus ganti email/password dari halaman Profil.
- Impor satu atau banyak file GPX (jam tangan / aplikasi perekam).
- Peta interaktif: replay rute dengan slider, mode warna pace/HR, pilih peta/satelit, sorotan split.
- Grafik pace, detak jantung, dan elevasi; sebaris info posisi.
- Split per kilometer dengan penanda km tercepat.
- Zona detak jantung dengan HR maks yang bisa diatur per aktivitas (di tab Ringkasan), termasuk HR istirahat untuk estimasi VO2max pendetakan-jantung.
- Personal best untuk 1 km, 1 mil, 5K, 10K, half, dan marathon + aktivitas terpanjang.
- Estimasi VO2max (metode performa ACSM atau metode detak jantung Uth) dan kategori sesuai tabel The Cooper Institute.
- Profil atlet: umur, jenis kelamin, berat badan, tinggi badan (siap dipakai untuk hitung kalori dan rasio VO2/berat).
- Prediksi waktu balapan (Riegel) dari rekor 5K-21,1K terbaru.

## Setup

### 1. Proyek

```sh
npm install
```

### 2. Supabase

1. Buat proyek di [supabase.com](https://supabase.com).
2. Buka **SQL Editor**, jalankan isi `supabase/schema.sql` (membuat tabel `profiles`, `tracks`, serta kebijakan RLS).
3. Ambil nilai URL proyek dan **anon/publishable key** di *Settings > API*.
4. Buat file `.env` di root:

```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJxxx
```

`.env` sudah tidak diikutsertakan Git. Tanpa file ini, aplikasi tetap berjalan dan menampilkan panduan konfigurasi di halaman login.

### 3. Jalankan lokal

```sh
npm run dev
```

Build produksi:

```sh
npm run build
```

## Deploy ke GitHub Pages

1. Pastikan `base` di `vite.config.js` sama dengan nama repo, misalnya `/my-strava-dashboard/` untuk halaman `https://<user>.github.io/my-strava-dashboard/`.
2. Jalan akan memublikasikan langsung ke branch `gh-pages`:

```sh
npm run deploy
```

Tambahan skrip:

```json
"deploy": "npm run build && npx gh-pages -d dist"
```

## Struktur

- `src/App.vue` - orkestrator: sesi auth, data, navigasi antar view.
- `src/components/` - `AuthView`, `HomeView`, `RecordsView`, `ProfileView`, `ActivityView`, `TrackMap`, `AppHeader`, `BottomNav`.
- `src/lib/gpx.js` - parsing dan kalkulasi GPX (pace, elevasi, split, zona HR).
- `src/lib/performance.js` - personal best, VO2max, kategori Cooper, prediksi Riegel.
- `src/lib/format.js` - format pace/durasi/tanggal dalam Bahasa Indonesia.
- `supabase/schema.sql` - skema database lengkap dengan RLS.
