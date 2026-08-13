# BPN Report Studio

Aplikasi web statis untuk membuat dan mengelola rekaman **Bukti Penerimaan
Negara (BPN)** — Pajak, Bea Cukai, dan PNBP — langsung di peramban, tanpa
server, tanpa database, dan tanpa proses build. Nama field mengikuti
konvensi *Crystal Field* yang sudah dipakai di sistem pelaporan internal
(lihat tabel lengkap di bawah), sehingga data yang dibuat/diimpor di sini
siap dipetakan langsung ke sistem tersebut tanpa lapisan terjemahan.

> **Catatan penting:** Dokumen yang dihasilkan aplikasi ini adalah rekaman
> internal untuk keperluan pencatatan/dokumentasi organisasi Anda sendiri —
> **bukan** dokumen resmi yang diterbitkan oleh negara. Keabsahan sebuah
> setoran hanya dapat diverifikasi melalui NTPN pada sistem resmi
> Kementerian Keuangan. Setiap pratinjau dan PDF yang dibuat menampilkan
> keterangan ini secara jelas.

## Menjalankan

Tidak ada langkah instalasi, dan **tidak perlu server**. Cukup dobel-klik
`index.html` — semua skrip dimuat sebagai `<script>` biasa (bukan ES
module) yang dipublikasikan ke satu namespace global `window.BPN`, sehingga
tidak terganjal pembatasan CORS yang biasanya memblokir `import`/`export`
saat halaman dibuka lewat `file://`.

Kalau lebih suka menjalankan lewat server statis (opsional, sama-sama
berfungsi):

```bash
python3 -m http.server 8080
# lalu buka http://localhost:8080
```

Kompatibel dengan **GitHub Pages**: cukup dorong (push) folder ini ke
sebuah repositori dan aktifkan Pages pada branch tersebut. Routing memakai
hash (`#/dashboard`, `#/create`, dst.) sehingga tidak memerlukan aturan
rewrite di server manapun.

> **Catatan penyimpanan:** aplikasi memeriksa apakah `localStorage`
> benar-benar bisa diakses saat dimuat. Pada sebagian kecil konfigurasi
> peramban (biasanya saat opsi privasi "Block third-party cookies and site
> data" aktif dan halaman dibuka lewat `file://`), akses tersebut bisa
> ditolak oleh peramban. Jika itu terjadi, aplikasi otomatis beralih ke
> penyimpanan sementara di memori (tetap berfungsi penuh selama tab
> terbuka) dan menampilkan pita peringatan kuning di bagian atas halaman.
> Menjalankan lewat server statis di atas menghilangkan kemungkinan ini
> sepenuhnya.

## Tumpukan Teknologi

- HTML5, CSS3, Bootstrap 5 (CDN)
- JavaScript vanilla (ES6+), tanpa framework, tanpa build tool — setiap
  berkas mempublikasikan API-nya ke namespace global `window.BPN` alih-alih
  memakai `import`/`export`, supaya aplikasi tetap jalan penuh saat dibuka
  langsung lewat `file://` (dobel-klik `index.html`), bukan cuma lewat
  server
- [jsPDF](https://github.com/parallax/jsPDF) (CDN) — satu-satunya
  dependensi runtime aplikasi, khusus untuk menyusun PDF (termasuk PDF
  gabungan multi-halaman saat unduh massal dari Dashboard); membangun
  encoder PDF dari nol berada di luar cakupan proyek ini
- `localStorage` peramban sebagai penyimpanan — tidak ada server maupun
  database

## Struktur Proyek

```
index.html                      Shell SPA: sidebar, topbar, mount point
assets/css/styles.css           Seluruh gaya visual (token warna/tipografi)
assets/js/
  app.js                        Bootstrap aplikasi, pendaftaran rute, tema
  config/
    config.js                   Metadata aplikasi, kunci storage, matriks paket
    billing-prefix.js           Deteksi jenis laporan + subtitle dari Kode Billing
    field-definition.js         Definisi field per grup (payment/deposit), id = Crystal Field
    report-definition.js        Pemetaan jenis laporan -> kumpulan field
  services/
    storage.js                  Lapisan penyimpanan (provider yang dapat ditukar)
    report.js                   Logika domain laporan, terbilang, ringkasan
    validation.js                Validasi field & laporan
    csv.js                       Parser/generator CSV universal (tanpa pustaka eksternal)
    pdf.js                       Penyusun PDF (jsPDF)
  components/
    form-engine.js               Perender form dinamis berbasis metadata
    data-table.js                Tabel laporan responsif
    toast.js / modal.js          Notifikasi & konfirmasi (Bootstrap)
    sidebar.js                   Status aktif navigasi
  views/
    dashboard.js, create-report.js, preview-report.js,
    data-io.js, settings.js, about.js
  utils/
    router.js                    Router hash, ramah GitHub Pages
    formatter.js                 Format mata uang/tanggal/Tanggal Cetak (WIB), escaping, id
    terbilang.js                 Angka -> huruf (Bahasa Indonesia)
templates/
  bpn-template.js                 Markup HTML kuitansi (dipakai preview & PDF)
data/
  sample-template-universal.csv   Templat CSV kosong, semua kolom, contoh 1 baris/jenis
  sample-data-filled.csv          Contoh data terisi (Pajak + Bea Cukai + PNBP)
  sample-backup.json              Contoh cadangan JSON
```

Tidak ada aturan bisnis yang di-hardcode di lapisan UI — setiap field,
setiap jenis laporan, dan setiap aturan validasi pola berasal dari
`config/` dan dibaca oleh `form-engine.js`, `csv.js`, dan `pdf.js`.

## Modul Aplikasi

| Modul | Lokasi |
|---|---|
| Dashboard | `#/dashboard` — statistik (kartu jenis laporan dapat diklik sebagai filter tabel), tabel semua laporan dengan pilih & unduh massal sebagai satu PDF gabungan |
| Buat Laporan | `#/create` — deteksi otomatis jenis dari Kode Billing, form dinamis, pratinjau langsung |
| Pratinjau Laporan | `#/preview/:id` |
| Generate PDF | tombol Unduh/Cetak pada halaman Pratinjau, atau unduh massal (satu PDF multi-halaman, satu laporan per halaman) dari Dashboard |
| Impor/Ekspor CSV | `#/data` — satu templat universal, drag & drop, mendukung banyak jenis dalam satu berkas |
| Impor/Ekspor JSON | `#/data` — cadangan penuh |
| Pengaturan | `#/settings` — tema, nama bank default, mata uang bawaan, pratinjau paket, hapus data |
| Tentang | `#/about` |

Tombol ikon rumah di topbar (di sebelah kiri judul halaman) selalu terlihat
di semua halaman dan langsung membawa kembali ke Dashboard dengan satu
klik.

## Deteksi Otomatis Jenis Laporan

Tidak ada dropdown jenis laporan. Jenis ditentukan dari digit pertama Kode
Billing (`config/billing-prefix.js`):

| Digit pertama | Jenis | Report Subtitle (teks statis pada kuitansi) |
|---|---|---|
| 0, 1, 2, 3 | Pajak | Penerimaan Pajak |
| 4, 5, 6 | Bea Cukai | Penerimaan Bea dan Cukai |
| 7, 8, 9 | PNBP | Penerimaan Negara Bukan Pajak |

## Daftar Field & Pemetaan Crystal Field

Setiap `id` field di `config/field-definition.js` **adalah** nama Crystal
Field/kolom itu sendiri (bukan nama internal terpisah yang perlu
dipetakan) — supaya data dari aplikasi ini bisa langsung dipakai oleh
sistem pelaporan yang sudah ada tanpa terjemahan. Validasi panjang,
wajib/opsional, dan tipe data di bawah mengikuti spesifikasi kolom yang
sama persis — diterapkan baik di form manual (Buat Laporan) maupun saat
impor CSV (setiap baris divalidasi dengan aturan yang identik). Urutan
dan pengelompokan field (Data Pembayaran vs Data Setoran) mengikuti
kuitansi BPN referensi organisasi — perhatikan bahwa Kode Billing
tergolong **Data Setoran**, meskipun halaman Buat Laporan tetap
memintanya lebih dulu (di luar form ini) untuk memicu deteksi otomatis
jenis laporan.

| Field | Column (= `id`) | Grup | Tipe | Panjang | Wajib | Format |
|---|---|---|---|---|:---:|---|
| Bank Name | `bankname` | header *(pojok kiri kuitansi)* | text | maks. 100 | ✅ | bebas |
| Report Subtitle *(teks statis, bukan input)* | — | header *(tengah, di bawah judul)* | — | — | — | lihat tabel deteksi di atas |
| Tanggal dan Jam Bayar | `localtransactiondatetime` | Data Pembayaran | datetime | 19, `yyyy-MM-dd HH:mm:ss` | ✅ | — |
| Tanggal Buku | `settlementdate` | Data Pembayaran | date | 10, `yyyy-MM-dd` | ✗ | — |
| Kode Cabang Bank | `branchcode` | Data Pembayaran | varchar | **tepat 6** | ✅ | angka |
| NTB | `retrievalreferencenumber` | Data Pembayaran | varchar | **tepat 12** | ✗ | angka |
| NTPN | `ntpn` | Data Pembayaran | varchar | **tepat 16** | ✗ | alfanumerik |
| STAN | `systemtraceauditnumber` | Data Pembayaran | varchar | **tepat 6** | ✅ | angka |
| Kode Billing | `billingnumber` | **Data Setoran** | varchar | **tepat 15** | ✅ | angka |
| NPWP | `npwp` | Data Setoran | varchar | **tepat 16**, tanpa titik/strip | ✗ | angka |
| ID Wajib Bayar | `idwajibbayar` | Data Setoran | varchar | maks. 20 | ✗ | angka |
| Nama Wajib Pajak / Nama Wajib Bayar | `namawp` | Data Setoran | varchar | maks. 200 | ✗ | teks *(satu kolom, label beda per jenis)* |
| Alamat | `alamatwp` | Data Setoran | varchar | maks. 50 | ✗ | teks |
| Jenis Dokumen | `jenisdokumen` | Data Setoran | varchar | maks. 2 | ✗ | **kode angka** |
| Nomor Dokumen | `nomordokumen` | Data Setoran | varchar | maks. 30 | ✗ | angka |
| Tanggal Dokumen *(Bea Cukai)* | `tanggaldokumen` | Data Setoran | date | 10, `yyyy-MM-dd` | ✗ | — |
| Kode KPPBC *(Bea Cukai)* | `kodekpbc` | Data Setoran | varchar | maks. 6 | ✗ | angka |
| Kementerian / Lembaga | `lembaga` | Data Setoran | varchar | maks. 3 | ✗ | **kode angka** |
| Unit Eselon I | `uniteselon` | Data Setoran | varchar | maks. 2 | ✗ | **kode angka** |
| Satuan Kerja | `kodesatker` | Data Setoran | varchar | maks. 6 | ✗ | **kode angka** |
| Jumlah Detail *(Pajak)* | `jumlahdetail` | Data Setoran | varchar | maks. 2 (nilai ≤ 99) | ✗ | angka |
| Jumlah Setoran | `transactionamount` | Data Setoran | float | — | ✅ | angka |
| Mata Uang | `currencycode` | Data Setoran | varchar | tepat 3 | ✅ | alfanumerik, default `IDR` |
| Terbilang *(otomatis dari `transactionamount`, dapat disunting manual di form — tidak menjadi kolom CSV)* | `terbilang` | Data Setoran | — | — | — | dihitung saat disimpan |
| Tanggal Cetak *(otomatis, `dd-MM-yyyy HH:mm:ss UTC+07:00` pada kuitansi)* | — | footer | — | — | — | dihitung saat render, tidak disimpan |

Kolom "Panjang" dengan tanda **tepat N** berarti *fixed length* — nilai
harus persis N karakter jika diisi, bukan sekadar batas maksimum. Field
kode seperti Jenis Dokumen, Kementerian/Lembaga, Unit Eselon I, dan
Satuan Kerja kini divalidasi sebagai kode angka (bukan teks bebas seperti
"PIB" atau nama kementerian) — isi dengan kode numerik sesuai tabel
referensi internal Anda.

Nama Wajib Pajak/Bayar (`namawp`) yang berlaku untuk ketiga jenis laporan
kini bersifat opsional mengikuti spesifikasi kolom, karena field yang
relevan per jenis laporan sudah otomatis ter-*gate* oleh deteksi Kode
Billing.

Tata letak kuitansi (pratinjau & PDF) mengikuti kuitansi BPN referensi
organisasi persis:
- Header 3 kolom — Bank Name di kiri, "BUKTI PENERIMAAN NEGARA" + Report
  Subtitle di tengah (bertumpuk), "Kementerian Keuangan" di kanan.
- "Data Pembayaran:" dirender 2 kolom sebaris — Tanggal dan Jam Bayar
  dengan NTB, Tanggal Buku dengan NTPN, Kode Cabang Bank dengan STAN.
- "Data Setoran:" satu kolom, kecuali Jumlah Setoran dan Mata Uang yang
  digabung satu baris. Field identitas tambahan (Jumlah Detail untuk
  Pajak; Tanggal Dokumen dan Kode KPPBC untuk Bea Cukai) tampil tepat
  sebelum baris Jumlah Setoran.

Di CSV, kolom mengikuti pola `payment_<id>` untuk field pembayaran dan
`deposit_<id>` untuk field setoran — mis. `deposit_billingnumber`,
`deposit_transactionamount`. Kolom `payment_localtransactiondatetime`
diekspor dalam format persis `yyyy-MM-dd HH:mm:ss` dan diterima kembali
saat impor baik dalam format itu maupun format bawaan input peramban.
Kolom bertipe tanggal (`payment_settlementdate`, `deposit_tanggaldokumen`)
juga dibersihkan otomatis dari komponen waktu yang kadang ikut terekspor
dari spreadsheet (mis. "2023-08-03 00:00:00.000" → "2023-08-03"). Kolom
`deposit_terbilang` **tidak** ada di templat/ekspor CSV — nilainya selalu
dihitung ulang otomatis dari `deposit_transactionamount` saat data
disimpan atau diimpor, jadi tidak perlu (dan tidak akan terpakai) diisi
manual.

Tampilan kuitansi (pratinjau & PDF) memakai format berbeda dari CSV,
mengikuti kuitansi BPN referensi organisasi persis: tanggal `dd/MM/yyyy`
(atau `dd/MM/yyyy HH:mm:ss` untuk Tanggal dan Jam Bayar), dan nominal
`1.000.000,00 IDR` (pemisah ribuan titik, dua desimal koma, kode mata
uang sebagai akhiran). Format `yyyy-MM-dd`/tanpa simbol mata uang tetap
dipakai khusus untuk data CSV/JSON, karena itu format pertukaran data,
bukan tampilan cetak.

## Kesiapan SaaS Masa Depan

Versi 1 tidak memiliki backend, akun, atau pembayaran — namun tiga titik
ekstensi berikut sengaja disiapkan agar migrasi tidak memerlukan
refaktor besar:

1. **`services/storage.js`** — seluruh akses data melalui satu
   `StorageProvider` (`LocalStorageProvider`). Menambahkan `CloudStorageProvider`
   yang mengimplementasikan antarmuka yang sama (REST/Supabase/Firebase) dan
   menukar satu baris `activeProvider` sudah cukup; tidak ada view yang
   memanggil `localStorage` secara langsung.
2. **`config/config.js`** — matriks paket (`Free`/`Premium`/`Enterprise`)
   dan `hasFeature()` sudah mendeskripsikan batasan fitur. Saat autentikasi
   sungguhan hadir, cukup ubah `getActivePlanId()` agar membaca dari sesi
   pengguna, bukan dari `settings` lokal.
3. **`services/pdf.js` & `services/csv.js`** — murni fungsi terhadap
   objek laporan, sehingga siap dipakai kembali oleh Cloud Function/REST
   endpoint tanpa perubahan jika logika ini suatu saat dipindah ke sisi
   server (misalnya untuk PDF massal berskala besar).

Tidak ada integrasi pembayaran (Stripe/Midtrans) yang diimplementasikan —
hanya titik ekstensi yang telah disiapkan sesuai permintaan.

## Data Sampel

Lihat folder `data/`: `sample-template-universal.csv` adalah templat CSV
kosong (kolom lengkap untuk ketiga jenis, satu baris contoh per jenis),
`sample-data-filled.csv` berisi contoh data terisi (Pajak + Bea Cukai +
PNBP dalam satu berkas), dan `sample-backup.json` adalah contoh cadangan
JSON — ketiganya dapat langsung diimpor lewat halaman Impor & Ekspor untuk
mencoba aplikasi dengan data terisi.
