# Anon Chat Bot

Anon Chat Bot adalah bot Telegram untuk obrolan anonim (anonymous chat) yang dikembangkan menggunakan Node.js dan Telegraf. Bot ini mendukung pengiriman teks, gambar, video, stiker, dan dokumen antar pengguna secara real-time. Dilengkapi dengan sistem antrean, moderasi, rate-limiting, serta integrasi pembayaran QRIS menggunakan RonzzPay untuk fitur Premium.

## Fitur Utama

- **Anonymous Matching**: Mencocokkan dua pengguna secara acak untuk mengobrol.
- **Media Forwarding**: Mendukung pesan teks dan media (foto, video, stiker, voice note).
- **Anti-Spam & Rate Limiter**: Mencegah flood/spam dengan memblokir pengguna secara otomatis dan memberikan verifikasi Captcha.
- **Premium (Gender Filter)**: Pengguna berbayar dapat memilih preferensi gender (Pria/Wanita) saat mencari partner.
- **Pembayaran QRIS Otomatis**: Integrasi API RonzzPay (mode sandbox dan production) lengkap dengan webhook untuk aktivasi otomatis.
- **Sistem Laporan (Report)**: Pengguna dapat melaporkan partner yang melanggar aturan.
- **Admin Panel**: Perintah khusus admin untuk memantau laporan dan memblokir (banned) pengguna nakal.

## Prasyarat

- Node.js versi 18 atau lebih baru.
- MongoDB (Atlas atau lokal) untuk menyimpan data profil dan transaksi.
- Redis (Upstash atau lokal) untuk antrean pencarian (queueing) dan rate limiting.
- Token Bot Telegram (dapatkan dari @BotFather).
- API Key RonzzPay (jika ingin mengaktifkan fitur premium).

## Instalasi

1. Clone repositori ini:
   ```bash
   git clone https://github.com/Renohidayat/anon-chat-bot.git
   cd anon-chat-bot
   ```

2. Instal dependensi:
   ```bash
   npm install
   ```

3. Konfigurasi Environment:
   Copy file `.env.example` menjadi `.env` dan isi variabel yang dibutuhkan:
   ```bash
   cp .env.example .env
   ```

## Penggunaan

### Menjalankan secara Lokal (Polling Mode)

Untuk tahap pengembangan (development), bot dapat dijalankan menggunakan metode polling:

```bash
npm run dev
```

### Menjalankan di Server (Webhook Mode)

Bot dirancang agar kompatibel dengan arsitektur serverless (seperti Vercel). Jika menggunakan webhook, Anda harus mendaftarkan URL endpoint ke Telegram.

Gunakan script bawaan untuk mendaftarkan webhook:
```bash
node scripts/set-webhook.js https://url-server-anda.com/api/webhook/telegram
```

## Daftar Perintah (Commands)

### Pengguna Umum
- `/start` - Mulai mencari partner obrolan
- `/stop` - Keluar dari obrolan saat ini atau keluar dari antrean
- `/next` - Ganti partner obrolan
- `/settings` - Melihat profil, mengubah gender, dan umur
- `/setgender` - Mengatur identitas gender
- `/filtergender` - Mengatur preferensi pencarian gender (hanya untuk Premium)
- `/upgrade` - Melakukan pembayaran QRIS untuk berlangganan Premium
- `/report` - Melaporkan partner (bisa dilakukan saat chat aktif atau 5 menit setelah obrolan berakhir)

### Admin (Hanya untuk Telegram ID yang terdaftar)
- `/reports` - Melihat daftar laporan yang belum diproses
- `/review <reportId> <dismiss|warn|ban>` - Memproses laporan dan menindak pelanggar
- `/unpremium <telegramId>` - Mencabut status Premium pengguna secara manual

## Struktur Folder

- `/api` - Entry point untuk serverless backend (Vercel).
- `/scripts` - Script utilitas (misal: set-webhook).
- `/src/db` - Koneksi dan skema database (MongoDB & Redis).
- `/src/handlers` - Logika penanganan pesan dan perintah Telegram.
- `/src/middleware` - Middleware sistem (misal: rate limiter).
- `/src/services` - Layanan inti (matching engine, integrasi payment, dan webhook).
- `/src/utils` - Fungsi utilitas pendukung (misal: generator Captcha).

## Deployment

Proyek ini telah dikonfigurasi untuk langsung dapat di-deploy ke **Vercel** (`vercel.json`). Pastikan Anda memasukkan semua variabel `.env` di pengaturan Vercel Dashboard sebelum melakukan deploy. Webhook RonzzPay dan Telegram secara otomatis akan diarahkan ke path `/api/webhook/ronzzpay` dan `/api/webhook/telegram`.

## Lisensi

Proyek ini menggunakan lisensi MIT. Anda bebas menggunakan dan memodifikasi proyek ini.
