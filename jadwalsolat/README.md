# 🕌 Waktu Sholat

Aplikasi jadwal sholat berbasis web — single file HTML, tanpa instalasi, tanpa backend. Buka langsung di browser.

---

## Fitur

- **Deteksi lokasi otomatis** via GPS browser
- **Jadwal 5 waktu sholat** — Subuh, Dzuhur, Ashar, Maghrib, Isya
- **Imsak** — muncul otomatis hanya di bulan Ramadan
- **Countdown real-time** ke waktu sholat berikutnya
- **Progress bar** antar dua waktu sholat
- **Tanggal Hijriyah** ditampilkan di bawah tanggal Masehi
- **Dukungan luar negeri** — otomatis beralih ke API internasional jika lokasi di luar Indonesia
- **Notifikasi browser** — pengingat 5 menit sebelum & tepat saat waktu masuk
- **Dark / Light mode** — toggle di topbar
- **Numeral Arab / Latin** — toggle di topbar
- **Responsif** — optimal di mobile maupun desktop

---

## Cara Pakai

1. Buka file `jadwal-solat.html` di browser (Chrome, Firefox, Safari, Edge)
2. Izinkan akses lokasi saat diminta
3. Jadwal sholat akan otomatis dimuat sesuai kota terdeteksi

> Tidak perlu koneksi khusus, tidak perlu server. Cukup file HTML dan koneksi internet untuk memanggil API.

---

## Arsitektur

```
jadwal-solat.html
│
├── CSS (inline)          — styling & tema, dark/light via CSS variables
├── HTML                  — struktur statis: topbar, jam, tanggal, container app
└── JavaScript (inline)
    ├── CONFIG            — daftar 5 waktu sholat + konstanta
    ├── STATE             — pData, isRamadan, imsakData, mode numeral/tema
    ├── CLOCK             — jam digital & tanggal Masehi, update tiap detik
    ├── THEME / NUMERAL   — toggle dark-light & angka Arab-Latin
    ├── GPS & GEOCODING   — navigator.geolocation → Nominatim reverse geocode
    ├── SEARCH CITY       — kandidat nama kota, escalate dari desa → kabupaten → provinsi
    ├── API (Indonesia)   — api.myquran.com — jadwal sholat + kalender Hijriyah
    ├── API (Luar Negeri) — api.aladhan.com — jadwal sholat + deteksi Ramadan
    ├── RENDER            — generate HTML kartu next prayer + list + imsak
    ├── COUNTDOWN         — interval 1 detik, hitung mundur & progress bar
    └── NOTIFIKASI        — Notification API, jadwalkan alert 5 menit sebelum & tepat waktu
```

---

## API yang Digunakan

| API | Kegunaan | Dokumentasi |
|-----|----------|-------------|
| [Nominatim (OpenStreetMap)](https://nominatim.org/release-docs/latest/api/Reverse/) | Reverse geocode koordinat GPS → nama wilayah | nominatim.org |
| [MyQuran API v3](https://api.myquran.com) | Jadwal sholat & kalender Hijriyah (Indonesia) | api.myquran.com |
| [Aladhan API](https://aladhan.com/prayer-times-api) | Jadwal sholat berdasarkan koordinat (luar Indonesia) | aladhan.com |

Semua API gratis dan tidak memerlukan API key.

---

## Logika Deteksi Lokasi

```
GPS (navigator.geolocation)
  │
  └─► Nominatim reverse geocode
        │
        ├─ country_code === 'id' ?
        │     YES → kumpulkan address levels (village → suburb → city → county → state)
        │           → cari kota di MyQuran API (escalate jika tidak ditemukan)
        │           → fetchToday(id) → fetchHijri() → render
        │
        └─ NO (luar negeri)
              → fetchAladhan(lat, lng) → deteksi Ramadan dari hijri date → render
```

**Kenapa ada escalation?**
Nominatim terkadang mengembalikan nama wilayah yang sangat spesifik (contoh: "Bojong Gede") yang tidak ada di database MyQuran. Sistem akan otomatis mencoba level yang lebih umum (Bogor, Jawa Barat) sampai ditemukan.

---

## Fitur Ramadan (Imsak)

- Deteksi Ramadan dilakukan otomatis dari response API Hijriyah (bulan ke-9)
- Row **Imsak** muncul di atas Subuh dengan styling khusus (border dashed, warna hijau)
- Di luar bulan Ramadan, baris Imsak tidak ditampilkan sama sekali
- Notifikasi Imsak (5 menit sebelum & tepat waktu) juga dijadwalkan otomatis saat Ramadan

---

## Notifikasi

Notifikasi menggunakan **Web Notifications API** bawaan browser.

| Waktu | Notifikasi |
|-------|-----------|
| 5 menit sebelum sholat | "🕌 [Nama] dalam 5 menit" |
| Tepat waktu sholat | "🕌 Waktu [Nama]" |
| 5 menit sebelum Imsak (Ramadan) | "🌙 Imsak dalam 5 menit" |
| Tepat Imsak (Ramadan) | "🌙 Waktu Imsak" |

> Notifikasi hanya berjalan selama tab browser terbuka. Tidak ada background service / service worker.

---

## Kompatibilitas Browser

| Browser | Status |
|---------|--------|
| Chrome 80+ | ✅ |
| Firefox 75+ | ✅ |
| Safari 14+ | ✅ |
| Edge 80+ | ✅ |
| Samsung Internet | ✅ |

> Fitur notifikasi tidak tersedia di Safari iOS (keterbatasan sistem operasi).

---

## Catatan Pengembangan

- Seluruh aplikasi adalah **single file HTML** — tidak ada dependency eksternal selain Google Fonts
- Tidak menggunakan framework JavaScript apapun
- Semua state disimpan di memori, tidak ada localStorage / cookie
- Timezone diasumsikan mengikuti perangkat pengguna; jadwal dari MyQuran menggunakan `tz=Asia/Jakarta`
- Untuk lokasi luar Indonesia, waktu ditampilkan sesuai timezone lokal perangkat

---

## Lisensi

Bebas digunakan dan dimodifikasi untuk keperluan pribadi maupun komersial.
