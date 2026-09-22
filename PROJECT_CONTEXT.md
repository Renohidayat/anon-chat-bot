# PROJECT_CONTEXT.md — Baca Ini Duluan

> **Instruksi untuk AI agent:** setiap kali membuka project ini (termasuk di Antigravity), baca file ini dulu, lalu `aturankode.md`, lalu `agents.md`, sebelum melanjutkan pekerjaan apapun. File ini adalah "memori" project — update bagian "Status Saat Ini" dan "Keputusan Arsitektur" setiap kali ada progres atau keputusan baru, supaya sesi berikutnya tidak mulai dari nol.

## Ringkasan Project (jangan berubah kecuali didiskusikan ulang)

Bot Telegram anonymous chat:
- User dipasangkan acak (anonymous), bisa chat text + media
- Fitur premium (berbayar): filter gender partner yang dicari
- Pembayaran via QRIS lewat RonzzPay (mulai dari sandbox)
- Media foto/video **tidak** diupload ke storage eksternal — pakai `file_id` Telegram langsung
- Status live (waiting/chatting/partner) di Redis (Upstash)
- Data permanen (user, subscription, transaksi, report) di MongoDB Atlas

## Status Saat Ini

- Fase: **Development — Phase 1+2 (basic matching + media forward)**
- Terakhir diupdate: 2026-09-23

## Keputusan Arsitektur yang Sudah Dibuat

- Redis + MongoDB dipilih (bukan Firestore) — alasan: Firestore free tier ada limit read/write harian ketat, kurang cocok untuk bot chat yang write-heavy
- Media pakai `file_id` Telegram, bukan Firebase Storage — hemat biaya & lebih cepat, storage 100% ditanggung Telegram
- Payment: RonzzPay (perlu verifikasi legalitas/izin PJP sebelum go production)
- **Bot framework: Telegraf v4** — middleware pattern, ctx.copyMessage support, aktif maintenance
- **Matching: FIFO** via Redis LIST (RPUSH/LPOP) — lebih simple dan fair daripada random
- **Media forward: copyMessage()** — 1 API call cover semua tipe (text, photo, video, sticker, dll)
- **Dependencies (Phase 1):** telegraf, ioredis, mongodb, dotenv — tanpa Express (ditambah di Phase 3)
- **MongoDB: native driver** tanpa Mongoose — tidak butuh schema validation layer

## Yang Belum Diputuskan / TODO

- [x] Pilih bot framework final: Telegraf vs node-telegram-bot-api → **Telegraf v4**
- [x] Skema Redis (key pattern untuk queue & status) → lihat implementation_plan.md
- [x] Skema MongoDB collections (users, subscriptions, transactions, reports) → lihat implementation_plan.md
- [ ] Alur webhook RonzzPay → update status premium (Phase 3)
- [ ] Sistem report/block untuk moderasi (Phase 5)
- [ ] Rate limiting anti-spam (Phase 6)
- [ ] Kebijakan usia minimum & ToS (cek kepatuhan Telegram ToS)
- [ ] Verifikasi legalitas RonzzPay sebagai PJP

## Cara Melanjutkan

1. Baca file ini + `aturankode.md` + `agents.md`
2. Cek GitHub Issues yang masih open untuk lihat task yang sedang berjalan
3. Ikuti Git Workflow di `agents.md` untuk task baru
4. Update bagian "Status Saat Ini" di file ini setelah selesai kerja
