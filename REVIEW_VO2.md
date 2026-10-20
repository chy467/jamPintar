# Review dan Perbaikan Kalkulasi VO2max, Recovery Time, dan Prediksi Riegel

## Latar belakang

Aplikasi jamPintar memiliki beberapa fitur estimasi performa olahraga:

1. VO2max menggunakan pendekatan persamaan ACSM.
2. Recovery Time untuk memperkirakan waktu pemulihan setelah aktivitas.
3. Prediksi waktu lomba menggunakan rumus Riegel.

Ketiga fitur tersebut sudah memiliki fungsi masing-masing, tetapi perlu diperiksa kembali agar:
- Tidak menggunakan sampel GPS yang tidak representatif.
- Tidak menghasilkan estimasi dari data yang tidak valid.
- Tidak memilih sumber aktivitas yang keliru.
- Tidak menampilkan angka dengan tingkat kepastian yang seolah-olah merupakan hasil pengukuran laboratorium.

Tujuan issue ini adalah memperbaiki logika perhitungan tanpa mengubah konsep dan desain utama aplikasi.

---

# BAGIAN A: VO2MAX

## 1. Prinsip perhitungan

Gunakan persamaan ACSM Running Equation:

```js
VO2 = 3.5 + (0.2 * speed) + (0.9 * speed * grade)
```

Keterangan:
- `VO2`: estimasi kebutuhan oksigen dalam ml/kg/min.
- `speed`: kecepatan dalam meter per menit.
- `grade`: kemiringan lintasan dalam bentuk desimal.

Konversi kecepatan:

```js
const speedMPerMin = speedMPerSec * 60
```

Konversi grade:

```js
const grade = elevationGain / horizontalDistance
```

Contoh:
- Elevation gain: 10 meter.
- Horizontal distance: 1000 meter.
- Grade: 0.01 atau 1%.

**Catatan penting:** Persamaan ACSM memperkirakan kebutuhan oksigen pada kecepatan dan kemiringan tertentu. Hasilnya bukan pengukuran langsung VO2max seseorang.

Karena aplikasi tidak memiliki data tes VO2max laboratorium, hasil tetap harus diberi label sebagai estimasi.

## 2. Perbaikan pemilihan segmen

Periksa fungsi perhitungan VO2max di `src/lib/performance.js`.

Saat ini terdapat pemilihan segmen berdasarkan kecepatan terbaik (`bestSpeedMperMin`). Perlu dipastikan bahwa segmen yang dipilih benar-benar cukup panjang untuk merepresentasikan usaha berkelanjutan.

Ketentuan:

- Gunakan segmen dengan durasi minimal 600 detik (10 menit).
- Jangan menggunakan segmen berdurasi kurang dari 600 detik untuk perhitungan estimasi VO2max ini.
- Gunakan kecepatan rata-rata segmen, bukan kecepatan GPS tertinggi sesaat.
- Jangan mengambil satu titik GPS tercepat sebagai representasi kemampuan aerobik.
- Jika tersedia beberapa segmen yang memenuhi syarat, gunakan segmen yang paling representatif berdasarkan kecepatan rata-rata dan validitas datanya.

Contoh:

| Segmen | Durasi | Kecepatan | Status |
|---|---:|---:|---|
| A | 120 detik | 4.0 m/s | Ditolak |
| B | 300 detik | 3.8 m/s | Ditolak |
| C | 600 detik | 3.2 m/s | Dapat digunakan |
| D | 900 detik | 3.0 m/s | Dapat digunakan |

Segmen A dan B tidak boleh menjadi sumber estimasi meskipun kecepatannya lebih tinggi.

## 3. Validasi data GPS

Sebelum menghitung kecepatan dan grade, lakukan validasi terhadap data segmen.

Abaikan:
- Timestamp kosong atau tidak valid.
- Interval waktu nol atau negatif.
- Jarak GPS nol atau negatif.
- Lonjakan kecepatan yang tidak masuk akal.
- Jeda GPS yang terlalu panjang.
- Segmen yang memiliki data terlalu sedikit untuk dihitung.

Jangan menghubungkan dua titik GPS yang terpisah oleh jeda panjang seolah-olah pengguna bergerak secara kontinu.

Gunakan batas kecepatan yang konsisten dengan validasi GPS yang sudah digunakan aplikasi. Jangan membuat aturan validasi berbeda tanpa alasan.

## 4. Perlakuan terhadap elevasi

Data elevasi berasal dari GPX dan sumber aplikasi/perangkat asal.

Untuk issue ini:
- Pertahankan sumber elevasi yang sekarang.
- Jangan menambahkan sistem kalibrasi elevasi baru.
- Jangan mengubah algoritma elevasi aplikasi.
- Jika data elevasi tidak tersedia atau tidak valid, gunakan `grade = 0` untuk persamaan ACSM.
- Hindari pembagian dengan jarak nol.

Jangan membuat estimasi grade negatif atau positif dari data yang tidak valid.

## 5. Jika data tidak memenuhi syarat

Jika tidak ada segmen valid dengan durasi minimal 600 detik:
- Jangan menghasilkan VO2max baru dari aktivitas tersebut.
- Jangan mengisi angka default atau angka buatan.
- Tampilkan pesan bahwa durasi atau kualitas data aktivitas belum mencukupi.
- Jika aplikasi menyimpan riwayat estimasi sebelumnya, jangan menghapus riwayat tersebut hanya karena aktivitas terbaru tidak memenuhi syarat.

## 6. Label dan interpretasi

Gunakan label seperti:

**Estimasi VO2max**

Tambahkan keterangan bahwa hasil dihitung berdasarkan kecepatan dan kemiringan lintasan, bukan hasil tes laboratorium.

Jangan menyatakan angka ini sebagai VO2max terukur.

---

# BAGIAN B: RECOVERY TIME

## 1. Prinsip perhitungan

Recovery Time merupakan estimasi waktu pemulihan setelah aktivitas.

Ini bukan hasil pengukuran fisiologis dan bukan rekomendasi medis.

Pertahankan konsep Recovery Time yang sudah ada, termasuk tambahan jam manual yang sengaja digunakan sebagai elemen motivasi/gamifikasi.

**Jangan menghapus, mengurangi, atau mengubah fungsi tambahan jam manual yang sudah ada.**

## 2. Pisahkan Base Recovery dan Extra Recovery

Perhitungan sebaiknya memiliki dua komponen yang jelas:

1. Base Recovery: estimasi dasar berdasarkan aktivitas.
2. Extra Recovery: tambahan jam yang ditentukan oleh logika/manual setting aplikasi.

Hasil akhir:

```js
totalRecoveryHours = baseRecoveryHours + extraRecoveryHours
```

Pastikan tambahan jam tidak dihitung dua kali.

Jika aplikasi saat ini sudah memiliki struktur perhitungan yang berbeda, pertahankan struktur tersebut selama hasil akhirnya tetap mengikuti prinsip di atas.

## 3. Rumus dasar yang disarankan

Gunakan pendekatan sederhana:

```js
baseRecoveryHours = durationHours * 12 * intensityFactor
```

Faktor intensitas:

| Intensitas | Faktor |
|---|---:|
| Easy | 0.7 |
| Moderate | 1.0 |
| Hard | 1.3 |
| Very Hard | 1.6 |

Contoh:

Aktivitas:
- Durasi: 1 jam.
- Intensitas: Hard.
- Extra Recovery: 6 jam.

Perhitungan:

```js
baseRecoveryHours = 1 * 12 * 1.3
// 15.6 jam

totalRecoveryHours = 15.6 + 6
// 21.6 jam
```

Angka faktor di atas merupakan heuristik aplikasi, bukan standar fisiologis yang tervalidasi.

Jika kode sekarang sudah memiliki klasifikasi intensitas yang digunakan fitur lain, manfaatkan klasifikasi tersebut daripada membuat klasifikasi baru yang saling bertentangan.

## 4. Validasi input

Pastikan:
- Durasi aktivitas tidak negatif.
- Durasi kosong atau tidak valid tidak menghasilkan `NaN`.
- Extra Recovery tidak negatif.
- Faktor intensitas memiliki fallback yang jelas.
- Hasil akhir berupa angka yang valid.

Jika aktivitas tidak memiliki durasi valid, jangan menghasilkan Recovery Time yang seolah-olah akurat.

## 5. Perilaku UI

Tampilkan hasil dengan jelas.

Contoh:

- Base Recovery: 15 jam 36 menit.
- Extra Recovery: 6 jam.
- Total Recovery: 21 jam 36 menit.

Jika desain saat ini hanya menampilkan total, tidak wajib mengubah layout besar-besaran. Namun komponen perhitungan harus tetap terpisah agar mudah diperiksa.

Jangan mengubah konsep tambahan jam manual yang memang sengaja dibuat lebih besar oleh pemilik aplikasi.

Jangan menyebut hasilnya sebagai waktu pemulihan medis atau waktu tubuh benar-benar pulih.

---

# BAGIAN C: PREDIKSI RIEGEL

## 1. Prinsip rumus

Pertahankan rumus Riegel:

```js
T2 = T1 * Math.pow(D2 / D1, 1.06)
```

Keterangan:
- `T1`: waktu tempuh aktual pada jarak referensi.
- `D1`: jarak referensi.
- `T2`: estimasi waktu pada jarak target.
- `D2`: jarak target.
- `1.06`: eksponen Riegel.

Rumus dasarnya tidak perlu diganti.

Masalah utama yang harus diperiksa adalah pemilihan aktivitas sumber untuk prediksi.

## 2. Pemilihan aktivitas referensi

Jangan selalu menggunakan aktivitas dengan pace tercepat sebagai dasar seluruh prediksi.

Pace tercepat belum tentu menggambarkan kemampuan pengguna untuk mempertahankan performa pada jarak yang lebih panjang.

Contoh:

| Aktivitas | Jarak | Waktu | Pace |
|---|---:|---:|---:|
| A | 1 km | 5 menit | 5:00/km |
| B | 3 km | 18 menit | 6:00/km |
| C | 5 km | 32 menit | 6:24/km |
| D | 8 km | 54 menit | 6:45/km |

Jika target prediksi adalah 10 km, aktivitas 1 km tidak seharusnya otomatis dipilih hanya karena memiliki pace tercepat.

## 3. Aturan pemilihan sumber

Gunakan aktivitas aktual yang memiliki jarak dan durasi valid.

Rekomendasi aturan:

- Prediksi target di bawah 5 km: aktivitas referensi minimal 1 km.
- Prediksi target 5 km atau lebih: prioritaskan aktivitas referensi minimal 3 km.
- Prediksi target 10 km atau lebih: prioritaskan aktivitas referensi minimal 5 km jika tersedia.
- Jangan gunakan aktivitas yang jaraknya lebih kecil daripada batas minimum yang relevan jika masih tersedia sumber yang lebih representatif.
- Jika tidak ada aktivitas yang memenuhi batas minimum, gunakan kandidat terbaik yang tersedia dan tampilkan bahwa estimasi memiliki keterbatasan data.

Pemilihan kandidat harus mempertimbangkan:
- Jarak aktual.
- Durasi aktual.
- Validitas timestamp.
- GPS gap.
- Data yang tidak masuk akal.
- Apakah aktivitas memiliki jeda panjang yang membuat waktu tempuh tidak representatif.

Jangan menggunakan data aktivitas yang rusak atau tidak lengkap hanya karena pace-nya paling cepat.

## 4. Pemilihan waktu referensi

Gunakan waktu aktual aktivitas yang konsisten dengan definisi waktu yang sudah dipakai aplikasi.

Pastikan:
- Jarak dan waktu berasal dari aktivitas yang sama.
- Satuan jarak dan waktu konsisten.
- Tidak ada pembagian dengan jarak nol.
- Tidak ada waktu negatif atau kosong.
- Tidak terjadi kesalahan konversi detik, menit, dan jam.

Jangan mencampur jarak dari satu aktivitas dengan waktu dari aktivitas lain.

## 5. Perhitungan prediksi

Gunakan:

```js
function riegelPredict(timeSeconds, sourceDistance, targetDistance) {
  if (
    !Number.isFinite(timeSeconds) ||
    !Number.isFinite(sourceDistance) ||
    !Number.isFinite(targetDistance) ||
    timeSeconds <= 0 ||
    sourceDistance <= 0 ||
    targetDistance <= 0
  ) {
    return null
  }

  return timeSeconds * Math.pow(
    targetDistance / sourceDistance,
    1.06
  )
}
```

Sesuaikan nama fungsi dan satuan dengan implementasi yang sudah ada.

Jangan membuat fungsi duplikat jika fungsi sejenis sudah tersedia.

## 6. Perilaku UI

Tampilkan prediksi sebagai estimasi, bukan jaminan hasil lomba.

Jika memungkinkan, tampilkan jarak dan waktu aktivitas referensi yang digunakan.

Contoh:

"Prediksi 10 km berdasarkan aktivitas referensi 5 km dengan waktu 32:00."

Jika sumber aktivitas tidak cukup representatif, tampilkan keterangan bahwa prediksi masih kasar.

Jangan mengubah desain halaman secara besar-besaran.

---

# BAGIAN D: INTEGRASI DAN KOMPATIBILITAS

## 1. Pemeriksaan fungsi terkait

Sebelum mengubah kode, telusuri:
- Semua pemanggilan fungsi VO2max.
- Semua pemanggilan fungsi Recovery Time.
- Semua pemanggilan fungsi prediksi Riegel.
- Semua komponen yang menampilkan hasil ketiga kalkulasi.
- Semua tempat yang menyimpan atau membaca hasil kalkulasi.

Pastikan perubahan tidak menghasilkan dua versi perhitungan berbeda antara halaman utama, detail aktivitas, dan statistik.

## 2. Data aktivitas lama

Aktivitas lama harus tetap bisa dibuka.

Jangan:
- Menghapus data GPX.
- Mengubah jarak atau durasi historis.
- Menghapus hasil kalkulasi yang tersimpan tanpa kebutuhan.
- Melakukan migrasi data besar.
- Mengubah format database jika tidak benar-benar diperlukan.

Jika kalkulasi dilakukan secara dinamis dari data aktivitas, pastikan aktivitas lama dapat dihitung ulang tanpa error.

## 3. Batasan perubahan

Fokus hanya pada VO2max, Recovery Time, dan Riegel.

Jangan:
- Mengubah perhitungan HR Zone.
- Mengubah HR Maks Personal.
- Mengubah HR Maks Aktivitas.
- Mengubah perhitungan elevasi.
- Mengubah proses impor GPX.
- Mengubah sistem deteksi duplikasi.
- Mengubah desain aplikasi secara keseluruhan.
- Melakukan refactor besar pada bagian yang tidak terkait.

Pertahankan nama file, API, dan struktur data yang sudah ada jika tidak ada alasan teknis kuat untuk mengubahnya.

---

# BAGIAN E: ACCEPTANCE CRITERIA

Implementasi dianggap selesai apabila:

### VO2max
1. Persamaan ACSM menggunakan satuan kecepatan dan grade yang benar.
2. Segmen di bawah 600 detik tidak digunakan untuk estimasi VO2max.
3. Kecepatan yang digunakan adalah kecepatan rata-rata segmen.
4. GPS gap dan timestamp tidak valid tidak menghasilkan estimasi palsu.
5. Grade menggunakan data elevasi yang tersedia dan menjadi 0 jika tidak valid.
6. Jika tidak ada segmen valid, aplikasi tidak menghasilkan angka VO2max baru.
7. UI memberi label bahwa nilai adalah estimasi.

### Recovery Time
1. Base Recovery dan Extra Recovery tidak tercampur dalam perhitungan.
2. Extra Recovery yang sudah ada tetap dipertahankan.
3. Total Recovery merupakan penjumlahan kedua komponen.
4. Input tidak valid tidak menghasilkan NaN atau angka negatif.
5. UI tidak menyatakan hasil sebagai ukuran medis.

### Riegel
1. Rumus Riegel tetap menggunakan eksponen 1.06.
2. Aktivitas referensi dipilih berdasarkan jarak dan validitas data, bukan hanya pace tercepat.
3. Jarak dan waktu referensi berasal dari aktivitas yang sama.
4. Kandidat yang rusak atau memiliki GPS gap tidak wajar tidak digunakan.
5. Prediksi yang kekurangan sumber data diberi keterangan bahwa hasil masih kasar.

### Umum
1. Tidak ada error saat membuka aktivitas lama.
2. Tidak ada kalkulasi menghasilkan NaN atau Infinity.
3. Tidak ada regresi pada fitur lain.
4. `npm run build` berhasil.
5. Perubahan tidak menyebabkan data aktivitas historis hilang.

---

# BAGIAN F: LAPORAN IMPLEMENTASI

Setelah selesai, berikan laporan singkat berisi:

1. File yang diubah.
2. Fungsi yang diperbaiki.
3. Rumus dan aturan yang diterapkan.
4. Perubahan perilaku UI jika ada.
5. Hasil pengujian setiap bagian.
6. Hal yang belum bisa diuji atau masih memiliki keterbatasan.

Jangan hanya menyatakan "selesai" tanpa menjelaskan apa yang benar-benar diubah.