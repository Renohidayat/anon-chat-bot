# AGENTS.md — Anonymous Chat Bot (Telegram)

Instruksi ini mengikat untuk setiap AI agent (Antigravity, Claude, atau lainnya) yang bekerja di repo ini. Baca `aturankode.md` untuk gaya coding, dan `PROJECT_CONTEXT.md` untuk status project saat ini — **sebelum** memulai task apapun.

## Ringkasan Project

Bot Telegram anonymous chat dengan matching acak antar user, filter gender berbayar (subscription via QRIS), forward media pakai `file_id` Telegram (tanpa upload ulang ke storage lain), status live di Redis, data permanen di MongoDB.

## Tech Stack (locked-in, jangan diganti tanpa diskusi)

- Runtime: Node.js
- Bot framework: Telegraf (atau node-telegram-bot-api — pilih satu, konsisten di seluruh repo)
- State live (queue, status waiting/chatting, partner_id): **Upstash Redis**
- Data permanen (users, subscriptions, transactions, reports): **MongoDB Atlas**
- Media: **Telegram file_id** — tidak ada Firebase Storage / S3 / upload ulang ke storage eksternal
- Payment: **RonzzPay** (QRIS), sandbox dulu → production setelah tervalidasi

## Git Workflow (wajib tiap task)

1. Pastikan ada GitHub Issue (buat kalau belum ada)
2. Branch dari `develop`: `feature/<no-issue>-<slug>`
3. Conventional Commits
4. Push → Pull Request ke `develop`, deskripsi lengkap, "Closes #<no>"
5. `main` hanya menerima merge dari `develop`

## Definition of Done (sebelum PR dibuka)

- [ ] Kode ikut `aturankode.md` (ladder dijalankan, tidak ada abstraksi/dependency yang tidak diminta)
- [ ] Self-check/test kecil ada untuk logika non-trivial
- [ ] `.env` / secret tidak ter-commit
- [ ] Webhook RonzzPay (kalau tersentuh) tetap verifikasi HMAC-SHA256 signature
- [ ] `PROJECT_CONTEXT.md` diupdate kalau ada keputusan arsitektur baru
- [ ] PR description: apa yang berubah, kenapa, cara test manual

## Batasan Keras

- Jangan pernah simpan file media (foto/video) ke database atau storage lain — hanya `file_id`.
- Jangan panggil endpoint production RonzzPay dari branch selain `develop`/`main` yang sudah direview.
- Jangan expose API key / token di log atau response error ke user.
