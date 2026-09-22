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

- Fase: **Development — Phase 6 (Hardening)**
- Terakhir diupdate: 2026-09-23

## Keputusan Arsitektur yang Sudah Dibuat

- Redis + MongoDB dipilih (bukan Firestore) — alasan: Firestore free tier ada limit read/write harian ketat, kurang cocok untuk bot chat yang write-heavy
- Media pakai `file_id` Telegram, bukan Firebase Storage — hemat biaya & lebih cepat, storage 100% ditanggung Telegram
- Payment: RonzzPay (perlu verifikasi legalitas/izin PJP sebelum go production)

## Yang Belum Diputuskan / TODO

- [ ] Pilih bot framework final: Telegraf vs node-telegram-bot-api
- [ ] Skema Redis (key pattern untuk queue & status)
- [ ] Skema MongoDB collections (users, subscriptions, transactions, reports)
- [ ] Alur webhook RonzzPay → update status premium
- [ ] Sistem report/block untuk moderasi
- [ ] Rate limiting anti-spam
- [ ] Kebijakan usia minimum & ToS (cek kepatuhan Telegram ToS)
- [ ] Verifikasi legalitas RonzzPay sebagai PJP

## Cara Melanjutkan

1. Baca file ini + `aturankode.md` + `agents.md`
2. Cek GitHub Issues yang masih open untuk lihat task yang sedang berjalan
3. Ikuti Git Workflow di `agents.md` untuk task baru
4. Update bagian "Status Saat Ini" di file ini setelah selesai kerja
