# PANDUAN AGENT AI & OVERVIEW PROYEK (JAM PINTAR)

Selamat datang di repository **JamPintar** (`my-strava-dashboard`). Dokumentasi ini dibuat khusus sebagai panduan utama bagi Agent AI (maupun pengembang manusia) yang melanjutkan pengerjaan proyek ini.

---

## 1. TUJUAN PROYEK (PROJECT PURPOSE)

**JamPintar** adalah *dashboard lari pribadi* (personal running dashboard) berbasis file GPX yang didesain dengan pendekatan **mobile-first** dan bergaya **papan instrumen Garmin**.

### Latar Belakang & Masalah
Banyak pelari yang merekam data lari menggunakan jam tangan pintar (Garmin, Coros, Apple Watch) atau aplikasi perekam, namun menginginkan analisis data lari mendalam tanpa keramaian / gangguan sosial media (seperti Strava feed, komentar, ketiadaan privasi).

### Tujuan Utama
1. **Analisis Lari Mandiri & Privat**: Mengolah file GPX secara lokal/klien lalu menyimpannya secara aman di Supabase milik pengguna.
2. **Visualisasi Berbasis Instrumen Olahraga**: Menampilkan statistik penting (Pace, HR, Elevasi, Split, VO2max, Rekor Pribadi) dengan tampilan padat data, bersih, dan fungsional.
3. **Fitur Kunci**:
   - **Impor GPX**: Mendukung pengunggahan satu atau banyak file GPX sekaligus.
   - **Peta & Replay Interaktif**: Menggunakan Leaflet untuk memetakan rute, replay pergerakan dengan slider, toggle mode peta/satelit, serta penyorotan split kilometer.
   - **Grafik & Split**: Grafik Pace, Detak Jantung (HR), Elevasi, serta split per kilometer (dengan indikator km tercepat).
   - **Zona Detak Jantung**: Perhitungan zona HR berbasis HR Maksimum yang dapat disesuaikan per aktivitas.
   - **Personal Best (PB)**: Deteksi rekor terbaik untuk 1 km, 1 mil, 5K, 10K, Half Marathon, Marathon, serta aktivitas terpanjang.
   - **Estimasi VO2max**: Kalkulasi berbasis performa ACSM atau detak jantung Uth, dilengkapi kategori kebugaran Institut Cooper.
   - **Prediksi Waktu Balapan**: Formula Riegel untuk memprediksi potensi waktu tempuh 5K - 42.2K berdasarkan rekor terbaru.
   - **Profil Atlet & Keamanan**: Manajemen data profil (umur, berat, tinggi, gender, HR maks) dan autentikasi akun via Supabase Auth.

---

## 2. ARSITEKTUR DAN CARA KERJA SISTEM

### Tech Stack
- **Framework**: Vue 3 (Composition API dengan `<script setup>`)
- **Build Tool**: Vite
- **Styling**: Tailwind CSS v4 (PostCSS)
- **Peta**: Leaflet.js
- **Backend & Database**: Supabase (PostgreSQL + Row Level Security & Supabase Auth)
- **Deployment**: GitHub Pages (`gh-pages`)

### Struktur Direktori & Komponen

```text
my-strava-dashboard/
├── public/                 # Aset statis (favicon, dll)
├── src/
│   ├── assets/
│   │   └── main.css        # Import Tailwind CSS & style kustom
│   ├── components/
│   │   ├── AppHeader.vue   # Header sticky (Navigasi, Nama App, Akun)
│   │   ├── BottomNav.vue   # Navigasi bawah mobile (Utama | Rekor | Profil)
│   │   ├── AuthView.vue    # Halaman Login/Register + Fallback jika .env belum diisi
│   │   ├── HomeView.vue    # Halaman Utama: Upload GPX & Daftar Aktivitas
│   │   ├── ActivityView.vue# Detail Aktivitas: Grafik, Split, Replay, Zona HR
│   │   ├── TrackMap.vue    # Komponen Peta Leaflet + Slider Replay
│   │   ├── RecordsView.vue # Rekor Pribadi (PB), VO2max, & Prediksi Waktu Lari
│   │   ├── ProfileView.vue # Form Profil Atlet & Pengaturan Keamanan Akun
│   │   └── ToastHost.vue   # Host Notifikasi Toast
│   ├── lib/
│   │   ├── gpx.js          # Parser GPX, hitung distance/pace/elevation/split/HR
│   │   ├── performance.js  # Algoritma PB, VO2max (ACSM & Uth), Riegel Predictor
│   │   ├── format.js       # Formatter durasi, pace, tanggal (Bahasa Indonesia)
│   │   ├── supabaseClient.js# Inisialisasi Supabase SDK
│   │   ├── toast.js        # Event bus untuk notifikasi toast
│   │   └── performance.js  # Logika pembantu performa
│   ├── App.vue             # Central Orchestrator & State Management
│   └── main.js             # Entry point Vue 3
├── supabase/
│   └── schema.sql          # Skema database Supabase & aturan RLS
├── AGENTS.md               # Instruksi Agent & Anti-slop rules
├── AGENT_GUIDE.md          # Dokumen ini (Panduan Agent Baru & Overview)
├── DESIGN.md               # Pedoman Desain Visual & Token Warna
├── README.md               # Dokumentasi setup & penggunaan dasar
├── vite.config.js          # Konfigurasi Vite & Base URL Deployment
└── package.json            # Dependensi & skrip proyek
```

### Alur Data (Data Flow)
1. **Autentikasi & Sesi**: `App.vue` memantau sesi Supabase via `supabase.auth.onAuthStateChange`. Jika belum login, `AuthView.vue` ditampilkan.
2. **Pengolahan File GPX**:
   - File GPX diunggah di `HomeView.vue`.
   - `src/lib/gpx.js` memparsing XML GPX di browser untuk mengekstrak koordinat, elevasi, waktu, dan detak jantung.
   - Hasil kalkulasi awal disimpan ke tabel `tracks` di Supabase.
3. **Kalkulasi Performa & Statistik**:
   - `src/lib/performance.js` memproses seluruh data lintasan dari Supabase untuk menentukan Personal Best (PB), nilai VO2max (metode ACSM/Uth), dan Prediksi Riegel.
4. **Keamanan Data**:
   - Tabel `profiles` dan `tracks` dilindungi oleh **Row Level Security (RLS)** pada Supabase, sehingga setiap pengguna hanya dapat membaca dan menulis datanya sendiri.

---

## 3. PANDUAN PENGEMBANGAN UNTUK AGENT AI BARU

Ketika Anda (Agent AI baru) mengambil alih tugas atau melanjutkan pengerjaan proyek ini, ikuti standar berikut:

### A. Prinsip Desain & Visual (Wajib Patuhi `DESIGN.md`)
- **Gaya Visual**: *Instrument Panel Garmin*. Karakter padat data, bersih, dan mengutamakan keterbacaan angka (*tabular numbers*).
- **Palet Warna Utama**:
  - Chrome Gelap / Header: `ink-950` (`#0e1f26`)
  - Aksen Utama: `teal-600` (`#0a6a7d`) untuk tombol & elemen aktif di latar terang.
  - Aksen Terang: `teal-400` (`#0e9bb3`) untuk garis peta & elemen di atas latar gelap.
  - Latar Belakang: `page` (`#eef2f3`), Kartu: `surface` (`#ffffff`).
- **Aturan Desain**:
  - Dilarang membuat animasi scrolling yang berlebihan (*scroll-reveal* / loop).
  - Dilarang menggunakan gradien warna mencolok (biru-ungu/neon/glow/glassmorphism).
  - Selalu pastikan kontras warna memenuhi standar **WCAG AA**.

### B. Standar Pengodean (Coding Standards)
- **Bahasa Komunikasi & UI**: Gunakan **Bahasa Indonesia** untuk seluruh antarmuka pengguna (UI), pesan error, dan format tanggal/pace/jarak.
- **Vue 3 Best Practices**: Gunakan sintaks `<script setup>` dengan Composition API. Dilarang mencampur dengan Options API jika tidak terpaksa.
- **Pemisahan Logika & UI**:
  - Logika perhitungan matematis, parsing GPX, atau algoritma olahraga Wajib diletakkan di `src/lib/`.
  - Komponen Vue difokuskan untuk menangani *rendering* UI dan *state* interaktif.
- **Styling**: Gunakan kelas utilitas Tailwind CSS v4. Hindari membuat CSS kustom manual jika Tailwind menyediakannya.

### C. Kualitas Kode & Anti-Slop (`antislop`)
- Jangan menambahkan komentar generik / *AI slop* yang tidak berguna (seperti `// import vue`, `// handle click event`).
- Hanya tulis komentar jika menjelaskan logika bisnis atau kalkulasi matematis rumit.
- Pertahankan struktur kode yang rapi, ringkas, dan konsisten dengan gaya penulisan yang sudah ada.

---

## 4. CHECKLIST SERAH TERIMA (HANDOVER CHECKLIST)

Sebelum dan sesudah Anda melakukan perubahan pada proyek ini, lakukan langkah-langkah berikut:

1. **Memahami Konteks**:
   - [ ] Baca `AGENT_GUIDE.md` (file ini) untuk memahami struktur dan cara kerja proyek.
   - [ ] Baca `DESIGN.md` jika perubahan berkaitan dengan tampilan UI/CSS.
   - [ ] Baca `README.md` untuk konfigurasi `.env` dan skrip build.
2. **Pemeriksaan Status Repository**:
   - [ ] Periksa `git status` untuk memastikan workspace bersih atau ada pekerjaan yang tertunda dari sesi sebelumnya.
3. **Verifikasi Lingkungan Pengembangan**:
   - [ ] Pastikan file `.env` berisi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_PUBLISHABLE_KEY` (jika menguji koneksi database).
4. **Verifikasi Build & Kode**:
   - [ ] Jalankan `npm run build` untuk memastikan tidak ada error kompilasi atau kesalahan impor sebelum menyelesaikan sesi.
   - [ ] Pastikan tidak ada fungsi atau komponen yang rusak akibat refactoring.

---

*Dokumen ini diperbarui secara berkala sebagai panduan resmi pengembangan JamPintar oleh Agent AI.*
