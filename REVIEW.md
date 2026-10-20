# Pisahkan HR Maks Personal dan HR Maks Aktivitas, lalu perbaiki kalkulasi HR Zone

## Latar belakang

Saat ini aplikasi menggunakan HR maksimum yang tercatat pada aktivitas GPX (`track.maxHR`) sebagai fallback untuk menghitung HR Zone.

Pendekatan ini kurang tepat karena **HR Maks Aktivitas tidak sama dengan HR Maks Personal**.

Contoh:
- HR Maks Personal pengguna: 190 bpm.
- HR Maks yang tercatat saat aktivitas A: 165 bpm.
- HR Maks yang tercatat saat aktivitas B: 182 bpm.

Ketiga nilai tersebut memiliki fungsi berbeda. HR Maks Personal merupakan acuan untuk menentukan zona latihan, sedangkan HR Maks Aktivitas adalah hasil pengukuran tertinggi pada satu aktivitas tertentu.

Tujuan perubahan ini adalah memisahkan kedua nilai tersebut dan memastikan seluruh perhitungan HR Zone menggunakan acuan yang benar.

## 1. Perubahan struktur data

### A. Tabel `profiles`

Tambahkan kolom:

```sql
max_hr numeric
```

Kolom ini menyimpan HR Maks Personal pengguna.

Buat migrasi yang aman dan dapat dijalankan berulang:

```sql
alter table public.profiles
add column if not exists max_hr numeric;
```

Jangan menghapus atau mengubah kolom profil lainnya.

### B. Tabel `tracks`

Pertahankan kolom berikut:

| Kolom | Fungsi |
|---|---|
| `max_hr` | HR Maks Aktivitas, dihitung dari data HR dalam file GPX |
| `hr_max_set` | Kolom lama untuk pengaturan HR maks per aktivitas |

`tracks.max_hr` harus tetap menyimpan nilai maksimum HR yang benar-benar tercatat dalam aktivitas.

Jangan mengganti nilai `tracks.max_hr` dengan HR Maks Personal dari profil.

Kolom `hr_max_set` boleh tetap ada untuk kompatibilitas data lama, tetapi tidak lagi menjadi sumber utama HR Zone setelah perubahan ini.

## 2. Perubahan halaman Profil

File utama: `src/components/ProfileView.vue`

Tambahkan input baru pada bagian Profil Atlet:

- Label: **HR Maks Personal (bpm)**
- Tipe input: number.
- Nilai awal: `profile.max_hr`, atau kosong jika belum tersedia.
- Rentang validasi: 80–250 bpm.
- Boleh dikosongkan untuk menggunakan estimasi berdasarkan umur.

Tambahkan `max_hr` ke:
- Object `form`.
- Watcher yang mengisi form dari `props.profile`.
- Payload pada fungsi `submit()`.
- Validasi sebelum payload dikirim.

Contoh payload:

```js
const payload = {
  display_name: form.display_name.trim() || null,
  age: form.age ? Number(form.age) : null,
  gender: form.gender || null,
  weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
  height_cm: form.height_cm ? Number(form.height_cm) : null,
  max_hr: form.max_hr ? Number(form.max_hr) : null,
}
```

Sesuaikan dengan struktur kode yang sebenarnya, jangan menyalin contoh secara membabi buta.

Tambahkan keterangan singkat di bawah input:

"HR Maks Personal digunakan sebagai acuan perhitungan zona detak jantung. Isi berdasarkan hasil pengukuran maksimal atau gunakan estimasi."

Jangan mengubah desain halaman Profil secara besar-besaran.

## 3. Aturan penentuan HR Maks Personal

Buat satu aturan yang konsisten untuk mendapatkan HR Maks Personal.

Prioritas:

1. Gunakan `profile.max_hr` jika pengguna mengisinya.
2. Jika kosong dan umur tersedia, gunakan estimasi:

```js
208 - (0.7 * age)
```

3. Jika keduanya tidak tersedia, HR Zone tidak dapat dihitung. Tampilkan keterangan bahwa pengguna perlu mengisi umur atau HR Maks Personal.

Penting:
- Jangan pernah menggunakan `track.maxHR` sebagai fallback HR Maks Personal.
- Jangan menggunakan `track.hrMaxSet` sebagai fallback HR Maks Personal.
- Jangan otomatis mengubah HR Maks Personal ketika pengguna mengimpor aktivitas baru.
- Jangan otomatis mengambil HR tertinggi dari aktivitas sebagai HR Maks Personal.

Jika menggunakan estimasi berdasarkan umur, tampilkan bahwa nilai tersebut merupakan estimasi, bukan hasil pengukuran.

Sebaiknya buat helper terpusat untuk mendapatkan nilai HR Maks Personal agar komponen lain tidak membuat aturan fallback sendiri-sendiri.

## 4. Perbaikan kalkulasi HR Zone

File utama: `src/lib/gpx.js`

Perbaiki fungsi `zoneDuration()`.

### Sumber HR Maks

Fungsi harus menerima HR Maks Personal sebagai parameter atau menerima data yang memungkinkan fungsi mendapatkan nilai tersebut secara eksplisit.

Contoh:

```js
zoneDuration(track, personalMaxHR)
```

Jangan lagi menggunakan:

```js
track?.hrMaxSet || track?.maxHR
```

untuk menentukan HR Maks Personal.

### Pembagian zona

Gunakan pembagian lima zona berdasarkan persentase HR Maks Personal:

| Zona | Persentase HR Maks | Keterangan |
|---|---:|---|
| Z1 | Di bawah 60% | Pemanasan / sangat ringan |
| Z2 | 60% sampai kurang dari 70% | Mudah |
| Z3 | 70% sampai kurang dari 80% | Aerobik |
| Z4 | 80% sampai kurang dari 90% | Ambang |
| Z5 | 90% sampai 100% atau lebih | Maksimum |

Gunakan batas yang konsisten agar tidak ada HR yang masuk ke dua zona sekaligus atau tidak masuk ke zona mana pun.

### Perhitungan durasi zona

Saat ini perhitungan durasi menggunakan jumlah interval waktu antar titik GPX. Pertahankan pendekatan berbasis durasi, tetapi periksa validitas intervalnya.

Ketentuan:
- Gunakan selisih waktu antara titik sebelumnya dan titik sekarang.
- Gunakan HR pada titik yang mewakili interval tersebut secara konsisten.
- Abaikan sampel HR kosong, nol, negatif, atau tidak valid.
- Abaikan interval dengan durasi nol atau negatif.
- Hindari interval yang terlalu panjang akibat jeda atau data GPX yang terputus. Batasi interval yang dihitung, misalnya maksimal 10 detik.
- Persentase durasi zona dihitung dari total durasi interval yang memiliki sampel HR valid, bukan dari seluruh durasi aktivitas.

Pastikan total durasi semua zona tidak melebihi total durasi sampel HR valid.

## 5. Perubahan halaman Detail Aktivitas

File utama: `src/components/ActivityView.vue`

### A. HR Maks Aktivitas

Bagian ringkasan detak jantung tetap menampilkan:

- HR rata-rata.
- HR maksimum aktivitas.

Label HR maksimum harus jelas, misalnya **HR Maks Aktivitas**.

Nilai ini berasal dari data GPX aktivitas tersebut (`track.maxHR`).

### B. Zona detak jantung

Perhitungan zona harus menggunakan HR Maks Personal dari profil, bukan HR Maks Aktivitas.

Contoh:

```js
const zones = computed(() =>
  zoneDuration(props.track, personalMaxHR.value)
)
```

Sesuaikan implementasinya dengan helper yang dibuat.

### C. Keterangan sumber HR Maks

Pada bagian Zona Detak Jantung, tampilkan acuan yang digunakan.

Contoh jika pengguna mengisi sendiri:

"Zona dihitung berdasarkan HR Maks Personal 190 bpm."

Contoh jika menggunakan estimasi umur:

"Zona dihitung berdasarkan estimasi HR Maks Personal 190 bpm."

Jika belum ada HR Maks Personal dan umur, jangan menampilkan zona dengan angka yang keliru. Tampilkan pesan:

"Isi HR Maks Personal atau umur pada Profil untuk melihat zona detak jantung."

### D. Pengaturan HR aktivitas lama

Saat ini halaman aktivitas memiliki pengaturan HR Istirahat dan informasi HR maksimum yang diambil otomatis dari GPX.

Sesuaikan teks dan alur UI agar tidak lagi memberi kesan bahwa HR Maks Aktivitas digunakan sebagai HR Maks Personal.

Pengaturan HR Istirahat (`resting_hr`) tetap berada di aktivitas untuk kompatibilitas perhitungan yang sudah menggunakannya. Jangan menghapus atau mengubah fungsinya dalam issue ini.

Jika input HR Maks Aktivitas manual masih ada di bagian lain, pertahankan fungsinya sebagai data aktivitas saja dan jangan hubungkan ke profil.

## 6. Integrasi penyimpanan profil

Periksa alur penyimpanan profil di `src/App.vue` dan seluruh fungsi yang membaca atau mengirim data profil ke Supabase.

Pastikan:
- `max_hr` ikut dimuat ketika profil diambil dari Supabase.
- `max_hr` ikut disimpan ketika profil diperbarui.
- Nilai `null` dapat disimpan ketika input dikosongkan.
- Setelah penyimpanan berhasil, nilai profil terbaru langsung tersedia untuk komponen Detail Aktivitas.
- Tidak ada field profil lain yang hilang ketika payload diperbarui.

Periksa juga pemetaan nama kolom database ke properti JavaScript. Gunakan satu nama yang konsisten: `max_hr` pada database dan `max_hr` pada object profil, kecuali ada pola pemetaan yang sudah digunakan aplikasi.

## 7. Kompatibilitas data aktivitas lama

Perubahan ini tidak boleh merusak aktivitas GPX yang sudah tersimpan.

Ketentuan:
- Jangan mengubah nilai `tracks.max_hr` yang sudah ada.
- Jangan menghapus data `tracks.hr_max_set`.
- Aktivitas lama tetap dapat dibuka.
- Aktivitas lama akan menggunakan HR Maks Personal yang saat ini tersimpan di profil untuk menghitung ulang HR Zone.
- Jika profil belum memiliki HR Maks Personal, gunakan estimasi berdasarkan umur jika tersedia.
- Jangan melakukan migrasi nilai `tracks.max_hr` ke `profiles.max_hr`, karena HR Maks Aktivitas bukan HR Maks Personal.

## 8. Batasan perubahan

Fokus issue ini hanya pada pemisahan HR Maks Personal dan HR Maks Aktivitas serta perbaikan perhitungan HR Zone.

Jangan:
- Mengubah rumus VO2max.
- Mengubah algoritma Recovery Time.
- Mengubah rumus prediksi Riegel.
- Mengubah perhitungan elevasi.
- Mengubah proses impor GPX.
- Mengubah algoritma deteksi duplikasi aktivitas.
- Mengubah desain halaman secara keseluruhan.
- Menghapus data lama atau melakukan reset database.

Jangan melakukan refactor besar pada file yang tidak berkaitan.

## 9. Acceptance Criteria / Kriteria keberhasilan

Implementasi dianggap selesai jika seluruh kondisi berikut terpenuhi:

1. Pengguna dapat mengisi dan menyimpan HR Maks Personal pada halaman Profil.
2. Nilai HR Maks Personal tersimpan di `profiles.max_hr`.
3. Nilai tersebut tetap tersedia setelah logout dan login kembali.
4. HR Maks Aktivitas tetap berasal dari data HR dalam GPX.
5. HR Maks Aktivitas tidak otomatis mengubah HR Maks Personal.
6. HR Zone menggunakan HR Maks Personal, bukan HR Maks Aktivitas.
7. Jika HR Maks Personal kosong tetapi umur tersedia, aplikasi menggunakan estimasi `208 - (0.7 × umur)`.
8. Jika keduanya kosong, zona tidak dihitung dan aplikasi menampilkan keterangan yang sesuai.
9. Durasi zona dihitung berdasarkan interval HR valid, bukan sekadar jumlah titik GPX.
10. Aktivitas lama tetap dapat dibuka dan menampilkan data seperti sebelumnya.
11. Tidak ada perubahan pada fitur VO2max, Recovery, Riegel, elevasi, dan impor GPX.
12. `npm run build` berhasil tanpa error.

## 10. Skenario pengujian wajib

Gunakan data simulasi berikut untuk memastikan pemisahan nilai bekerja dengan benar.

### Skenario A: HR Maks Personal diisi manual

Profil:
- Umur: 30 tahun.
- HR Maks Personal: 190 bpm.

Aktivitas:
- HR rata-rata: 150 bpm.
- HR Maks Aktivitas: 180 bpm.

Hasil yang diharapkan:
- Ringkasan aktivitas menampilkan HR Maks Aktivitas 180 bpm.
- HR Zone menggunakan acuan 190 bpm.
- Rentang Z2 adalah 114 sampai 132 bpm.
- Rentang Z3 adalah 133 sampai 151 bpm.
- Rentang Z4 adalah 152 sampai 170 bpm.
- Rentang Z5 dimulai dari 171 bpm.

### Skenario B: HR Maks Personal kosong

Profil:
- Umur: 30 tahun.
- HR Maks Personal: kosong.

Hasil yang diharapkan:
- HR Maks Personal dihitung dengan estimasi `208 - (0.7 × 30) = 187 bpm`.
- HR Zone menggunakan 187 bpm.
- UI memberi keterangan bahwa acuan tersebut merupakan estimasi.

### Skenario C: HR Maks Personal dan umur kosong

Profil:
- Umur: kosong.
- HR Maks Personal: kosong.

Hasil yang diharapkan:
- HR Zone tidak dihitung.
- Tidak menggunakan HR Maks Aktivitas sebagai pengganti.
- UI menampilkan instruksi untuk melengkapi Profil.

### Skenario D: Dua aktivitas berbeda

Profil:
- HR Maks Personal: 190 bpm.

Aktivitas 1:
- HR Maks Aktivitas: 160 bpm.

Aktivitas 2:
- HR Maks Aktivitas: 185 bpm.

Hasil yang diharapkan:
- Kedua aktivitas menggunakan HR Maks Personal 190 bpm untuk HR Zone.
- Masing-masing aktivitas tetap menampilkan HR Maks Aktivitas sesuai data GPX-nya.
- Membuka atau mengubah satu aktivitas tidak mengubah HR Maks Personal di profil.

### Skenario E: Sampel HR tidak valid

Data GPX memiliki beberapa titik dengan:
- HR kosong.
- HR = 0.
- Interval waktu negatif atau nol.
- Interval waktu yang terlalu panjang.

Hasil yang diharapkan:
- Sampel dan interval tidak valid tidak masuk ke kalkulasi durasi zona.
- Tidak terjadi durasi negatif.
- Persentase zona tidak menghasilkan NaN atau Infinity.

---

**Catatan implementasi:** Sebelum mengubah kode, telusuri semua referensi `hrMaxSet`, `maxHR`, `restingHr`, dan `hr_max_set` di seluruh project. Pastikan perubahan tidak meninggalkan referensi lama yang menyebabkan UI dan kalkulasi menggunakan sumber HR Maks yang berbeda.