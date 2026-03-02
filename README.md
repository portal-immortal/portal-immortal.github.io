# 🌀 Claude Logo — Sejarah & Filosofi

> Sebuah web interaktif yang mengeksplorasi sejarah, anatomi desain, dan filosofi di balik logo Claude dari Anthropic.

**🔗 Live Demo:** [your-username.github.io/nama-repo](https://your-username.github.io/nama-repo)

---

## ✨ Fitur

- **Hero animasi** — logo starburst interaktif yang bisa diklik, dengan tooltip makna tiap petal
- **Timeline sejarah** — perjalanan Anthropic dari stealth mode 2021 hingga sekarang
- **Asal nama "Claude"** — penghormatan kepada Claude Shannon, Bapak Teori Informasi
- **Anatomi logo interaktif** — klik tiap elemen untuk menyoroti bagian logo terkait
- **Sistem warna** — palet terra cotta lengkap, klik kartu untuk copy HEX code
- **6 kartu filosofi** — makna mendalam di balik setiap pilihan desain
- **Navigasi sticky** dengan highlight section aktif

---

## 🛠️ Teknologi

- Pure **HTML5 / CSS3 / Vanilla JavaScript** — tanpa framework, tanpa dependencies
- Font: [Playfair Display](https://fonts.google.com/specimen/Playfair+Display), [DM Mono](https://fonts.google.com/specimen/DM+Mono), [Syne](https://fonts.google.com/specimen/Syne) via Google Fonts
- Animasi: CSS keyframes + Intersection Observer API
- Single file, zero build step

---

## 🚀 Deploy ke GitHub Pages

### Langkah 1 — Buat Repository

```bash
git init
git remote add origin https://github.com/username/nama-repo.git
```

### Langkah 2 — Rename file

Rename `claude-logo-story.html` menjadi `index.html` supaya GitHub Pages langsung serve sebagai halaman utama.

```bash
mv claude-logo-story.html index.html
```

### Langkah 3 — Push ke GitHub

```bash
git add .
git commit -m "🌀 Initial commit: Claude logo interactive page"
git push -u origin main
```

### Langkah 4 — Aktifkan GitHub Pages

1. Buka repository di GitHub
2. Pergi ke **Settings → Pages**
3. Di bagian **Source**, pilih branch `main` dan folder `/ (root)`
4. Klik **Save**
5. Tunggu ~1-2 menit, lalu akses di `https://username.github.io/nama-repo`

---

## 📁 Struktur File

```
.
├── index.html      # Semua konten, style, dan script dalam satu file
└── README.md       # Dokumentasi ini
```

---

## 📖 Konten

Web ini membahas lima aspek utama logo Claude:

| Section | Topik |
|---|---|
| 🕰️ Sejarah | Perjalanan brand Anthropic dari 2021 — by Geist Studio |
| 🔤 Nama | Asal nama "Claude" dari Claude Shannon & Teori Informasi |
| 🎯 Anatomi | Starburst, terra cotta, titik pusat, simetri radial |
| 🎨 Warna | Sistem palet: terra cotta, warm cream, warm ink |
| 💡 Filosofi | Transparansi, human-centric, safety first, konsistensi |

---

## 📄 Lisensi

MIT License — bebas digunakan, dimodifikasi, dan didistribusikan.

---

*Dibuat dengan ❤️ · Konten berdasarkan riset brand Anthropic & Geist Studio*
