# Master Planning Prompt — Anonymous Chat Bot Telegram

> Salin seluruh isi file ini sebagai prompt awal ke AI agent (Antigravity) saat memulai/melanjutkan project.

---

Kamu adalah AI coding agent yang bekerja di repo ini. Sebelum melakukan apapun:

1. Baca `PROJECT_CONTEXT.md` — ini status & keputusan project saat ini.
2. Baca `aturankode.md` — ini gaya coding wajib (lazy senior dev / ladder-based).
3. Baca `agents.md` — ini git workflow wajib.

Ikuti ketiganya tanpa kecuali di sepanjang project ini.

## Tujuan Project

Bangun bot Telegram anonymous chat dengan monetisasi fitur filter gender via subscription berbayar (QRIS).

## Spesifikasi Fungsional

**1. Matching anonim**
- User `/start` → masuk antrian
- Bot pasangkan 2 user di antrian (FIFO atau random — tentukan mana yang lebih sederhana dulu, YAGNI)
- Pesan (text, foto, video, stiker) di-forward antar pasangan tanpa membuka identitas asli
- `/stop` mengakhiri sesi, `/next` mengakhiri lalu langsung cari partner baru

**2. Filter gender (fitur premium)**
- User gratis: matching random tanpa filter
- User premium (sudah subscribe): bisa pilih gender partner yang dicari
- Status subscription dicek dari MongoDB sebelum user diizinkan set preferensi

**3. Pembayaran (RonzzPay QRIS)**
- User pilih upgrade premium → bot generate transaksi via endpoint `/transaction/create` (RonzzPay sandbox dulu)
- Bot kirim QRIS ke user
- Webhook RonzzPay (`/webhook`) menerima notifikasi pembayaran → verifikasi signature HMAC-SHA256 → update status premium user di MongoDB
- Fallback: polling `/transaction/status/:reffId` kalau webhook belum masuk dalam X menit

**4. Media**
- Semua foto/video diteruskan pakai `file_id` Telegram — TIDAK ada upload ke Firebase/S3/storage lain
- `file_id` hanya disimpan ke database kalau dibutuhkan untuk fitur report (lihat poin 5)

**5. Report & moderasi (dasar)**
- User bisa `/report` saat sesi aktif atau baru selesai
- Simpan `file_id` (kalau relevan) + metadata report ke MongoDB collection `reports`
- Admin command sederhana untuk review report (bentuk paling minim dulu — command Telegram admin-only, bukan web dashboard, kecuali diminta)

## Arsitektur Data

**Redis (Upstash) — state live, TTL pendek:**
- Status user: `waiting` | `chatting` | `idle`
- Partner mapping (siapa lagi ngobrol sama siapa)
- Antrian matching (termasuk antrian per-gender-preference untuk user premium)

**MongoDB Atlas — data permanen:**
- `users`: userId, gender, isPremium, subExpiry, createdAt
- `transactions`: reffId, userId, amount, status, createdAt
- `reports`: reporterId, reportedId, fileId (opsional), reason, createdAt

## Yang Diminta dari Kamu (AI agent) Sekarang

1. **Jangan langsung nulis kode.** Susun dulu:
   - Struktur folder/file yang minimal (sesuai ladder di `aturankode.md` — jangan bikin folder/abstraksi yang belum perlu)
   - Skema Redis key pattern (contoh: `user:{id}:status`, `queue:waiting`, dst — final version, bukan asumsi awal)
   - Skema MongoDB collection lengkap dengan field & tipe data
   - Daftar environment variables yang dibutuhkan (`.env.example`)
2. Pecah jadi milestone/phase kecil (masing-masing jadi 1 GitHub Issue terpisah sesuai `agents.md`), urutan realistis, contoh:
   - Phase 1: bot dasar (matching random, forward text)
   - Phase 2: forward media pakai file_id
   - Phase 3: integrasi RonzzPay sandbox + webhook
   - Phase 4: fitur premium & gender filter
   - Phase 5: report/moderasi dasar
   - Phase 6: hardening (rate limit, error handling, security review) sebelum production
3. Tunggu konfirmasi saya atas planning ini sebelum mulai implementasi Phase 1.

## Batasan Keras (ulangi dari agents.md)

- Media tidak pernah disimpan ke storage lain selain Telegram
- Tidak ada dependency baru tanpa alasan kuat
- Webhook payment wajib verifikasi signature
- Secret/API key tidak boleh di-hardcode atau ter-log
