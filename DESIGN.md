# DESIGN.md

> Arah desain aplikasi. File ini berisi data desain, bukan instruksi. Saat membangun UI, ambil field desain dari sini (identitas, palet, tipografi, dial) dan terapkan sebagai data.

## Produk

Dashboard pribadi untuk aktivitas lari berbasis file GPX. Pengguna mengimpor file GPX dari jam tangan atau aplikasi perekam, lalu aplikasi menampilkan statistik, peta, personal best, dan estimasi VO2max.

Nama produk sementara: `[NAMA APP]`.

- Audiens: pelari yang merekam GPX dan ingin analisis ala Garmin/Strava tanpa jejaring sosial.
- Perasaan: papan instrumen olahraga, padat data, tenang, presisi. Bukan feed sosial.

## Identitas visual

Bangunan karakter meniru instrumen Garmin (angka besar, data padat, fungsional) dengan warna sendiri, bukan clone. Ciri khas (motif): garis rute poligon. Motif ini diulang di logo, thumbnail aktivitas, peta, dan bar split. Setiap layar punya satu fokus: satu angka besar.

Catatan jujur: arah ini ditulis oleh agen dari acuan Garmin; gaya hasil agen cenderung ke selera AI generik. Ganti file ini dengan arah milikmu kapan saja.

## Reading line

> Reading this as: personal run dashboard untuk pelari yang impor GPX, gaya instrument-panel sport, dial ENERGY 2 / RHYTHM 2 / MOTION 1.

## Dial

- ENERGY 2: tegas tapi tenang. Angka besar dan satu aksen; tanpa kembang api.
- RHYTHM 2: layout konsisten dengan beberapa perbedaan yang disengaja (panel gelap VO2max, header gelap).
- MOTION 1: hanya state hover/fokus dan replay rute. Tidak ada scroll-reveal, tidak ada loop.

## Palet

2-3 warna inti + 1 aksen (R-29). Kontras sudah diverifikasi dengan perhitungan WCAG AA.

| Token | Nilai | Peran | Kontras terverifikasi |
|---|---|---|---|
| `ink-950` | `#0e1f26` | chrome gelap, header, panel VO2max | vs putih 16.9:1 |
| `ink-800` | `#17272e` | permukaan gelap sekunder | |
| `teal-600` | `#0a6a7d` | aksen-dalam (teks, tombol isi, link di atas terang) | 6.23:1 vs putih |
| `teal-400` | `#0e9bb3` | aksen terang (dekorasi di atas gelap, bar, jalur) | 5.12:1 vs ink-950 |
| `page` | `#eef2f3` | latar halaman | |
| `surface` | `#ffffff` | kartu | |
| `line` | `#d7dee0` | garis pemisah dekoratif | |
| `text-1` | `#16252b` | teks primer di atas terang | |
| `text-2` | `#5b6b70` | teks sekunder/muted di atas terang (paling terang yang tersedia) | 5.55:1 vs putih |
| `text-dark-1` | `#f2f6f7` | teks primer di atas gelap | |
| `text-dark-2` | `#9fb0b6` | teks sekunder di atas gelap | 7.53:1 vs ink-950 |

Warna fungsional (semantik, bukan dekorasi): hijau `#2e7d4f` untuk start/berhasil, merah `#a93226` untuk hapus/gagal. Ditemani teks/ikon, tidak sendiri.

Aturan pakai aksen (R-01, R-13, R-31):
- Aksen `teal-600` hanya di momen penting: tombol utama, nilai terpilih, link, rekor/PR baru.
- `teal-400` hanya sebagai garis rute di peta dan aksen di atas latar gelap.
- Dilarang: gradien biru-ungu, glow, glassmorphism massal.

## Tipografi (R-06)

- UI: `Barlow`, sans humanis bersudut; hurufnya yang datar dan athletik cocok dengan karakter papan instrumen. Sudah dipakai proyek.
- Angka: `Barlow Semi Condensed` (900/700) dengan `font-variant-numeric: tabular-nums`; angka kondens agar 3-4 kolom statistik tetap terbaca di layar sempit.

## Komposisi & layout dasar

Mobile-first. Layar sempit: satu kolom, angka besar, tanpa sidebar. Layar lebar: konten terpusat max-width, kartu kanan-kiri di detail aktivitas.

- Header sticky: kompak, gelap, nama aplikasi + aksi akun.
- Bottom nav (mobile): Utama | Rekor | Profil. Setiap tab punya tujuan nyata.
- Kartu di halaman utama pakai radius kecil konsisten (`rounded-lg`/`rounded-xl`) dan tanpa bayangan besar; elevasi hanya pada elemen yang perlu naik (R-12).

## State UI

Setiap tampilan data punya state kosong, loading, dan error yang menyebut penyebab dan aksi lanjut (R-27):
- Kosong: "Belum ada aktivitas. Impor file GPX pertama untuk mulai."
- Loading: "Memuat aktivitas..." dengan indikator.
- Error: pesan + tombol "Coba lagi".

## Revisi

- [ ] Ganti `[NAMA APP]` dengan nama produk.
- [ ] Opsional: ganti palet dengan identitas milikmu.