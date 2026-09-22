const { reports, users } = require('../db/mongo');
const { getPartner } = require('../services/matching');
const redis = require('../db/redis');
const config = require('../config');

// Waktu maksimal user bisa report setelah sesi berakhir (5 menit)
const REPORT_WINDOW_MS = 5 * 60 * 1000;
const RECENT_SESSION_KEY = (id) => `user:${id}:last_partner`;
const RECENT_SESSION_TTL = 300; // 5 menit

function registerReportHandlers(bot) {
  // /report — laporkan partner saat ini atau partner terakhir
  bot.command('report', async (ctx) => {
    const telegramId = ctx.from.id;

    try {
      // Cek partner aktif dulu
      let reportedId = await getPartner(telegramId);

      // Kalau tidak ada partner aktif, cek sesi terakhir (dalam 5 menit)
      if (!reportedId) {
        const lastPartner = await redis.get(RECENT_SESSION_KEY(telegramId));
        if (!lastPartner) {
          return ctx.reply('❌ Tidak ada partner yang bisa dilaporkan. Fitur ini hanya bisa digunakan saat chatting atau dalam 5 menit setelah sesi berakhir.');
        }
        reportedId = Number(lastPartner);
      }

      // Simpan reportedId sementara di Redis untuk langkah berikutnya
      await redis.set(`user:${telegramId}:reporting`, String(reportedId), 'EX', 120);

      await ctx.reply(
        '⚠️ Kamu akan melaporkan partner ini.\n\nTulis alasan singkat laporanmu (atau ketik /cancel untuk batal):'
      );

    } catch (err) {
      console.error('/report error:', err);
      await ctx.reply('❌ Terjadi kesalahan. Coba lagi.');
    }
  });

  // Tangkap alasan report (teks bebas setelah /report)
  bot.on('text', async (ctx, next) => {
    if (ctx.message.text.startsWith('/')) return next();

    const telegramId = ctx.from.id;
    const reportingKey = `user:${telegramId}:reporting`;
    const reportedIdStr = await redis.get(reportingKey);

    if (!reportedIdStr) return next(); // Bukan dalam alur report

    const reportedId = Number(reportedIdStr);
    const reason = ctx.message.text.slice(0, 500); // Batas 500 karakter

    try {
      await redis.del(reportingKey);

      await reports().insertOne({
        reporterTelegramId: telegramId,
        reportedTelegramId: reportedId,
        reason,
        fileIds: [],
        sessionEndedAt: new Date(),
        reviewedBy: null,
        reviewedAt: null,
        action: null,
        createdAt: new Date(),
      });

      await ctx.reply('✅ Laporan berhasil dikirim. Terima kasih, tim kami akan meninjau laporan ini.');
    } catch (err) {
      console.error('Report submission error:', err);
      await ctx.reply('❌ Gagal mengirim laporan. Coba lagi.');
    }
  });

  // --- Admin commands ---

  // /reports — list 10 laporan terbaru yang belum diulas (admin only)
  bot.command('reports', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;

    try {
      const list = await reports()
        .find({ action: null })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray();

      if (list.length === 0) {
        return ctx.reply('✅ Tidak ada laporan yang belum diulas.');
      }

      const text = list.map((r, i) => {
        const date = r.createdAt.toLocaleDateString('id-ID');
        return `${i + 1}. ID: \`${r._id}\`\n   Reporter: ${r.reporterTelegramId}\n   Reported: ${r.reportedTelegramId}\n   Alasan: ${r.reason}\n   Tanggal: ${date}`;
      }).join('\n\n');

      await ctx.reply(`📋 *Laporan Pending (${list.length}):*\n\n${text}`, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('/reports error:', err);
      await ctx.reply('❌ Gagal mengambil daftar laporan.');
    }
  });

  // /review <reportId> <dismiss|warn|ban> — tindak laporan (admin only)
  // Contoh: /review 64a1b2c3d4e5f6g7 ban
  bot.command('review', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;

    const args = ctx.message.text.split(' ').slice(1);
    if (args.length < 2) {
      return ctx.reply('Usage: /review <reportId> <dismiss|warn|ban>');
    }

    const [reportId, action] = args;
    if (!['dismiss', 'warn', 'ban'].includes(action)) {
      return ctx.reply('Action harus: dismiss, warn, atau ban');
    }

    try {
      const { ObjectId } = require('mongodb');
      const report = await reports().findOneAndUpdate(
        { _id: new ObjectId(reportId) },
        {
          $set: {
            action,
            reviewedBy: ctx.from.id,
            reviewedAt: new Date(),
          },
        },
        { returnDocument: 'after' }
      );

      if (!report) {
        return ctx.reply('❌ Report tidak ditemukan.');
      }

      if (action === 'ban') {
        await users().updateOne(
          { telegramId: report.reportedTelegramId },
          { $set: { isBanned: true, updatedAt: new Date() } }
        );

        // Beri tahu user yang di-ban
        await bot.telegram.sendMessage(
          report.reportedTelegramId,
          '⛔ Akun kamu telah diblokir oleh admin karena melanggar aturan.'
        ).catch(() => {});
      }

      await ctx.reply(`✅ Report \`${reportId}\` ditandai sebagai *${action}*.`, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('/review error:', err);
      await ctx.reply('❌ Gagal memproses review. Pastikan reportId valid.');
    }
  });
}

/**
 * Simpan last_partner setelah sesi berakhir, supaya user bisa /report dalam 5 menit.
 * Dipanggil dari start.js saat /stop atau /next.
 */
async function saveLastPartner(telegramId, partnerId) {
  if (!partnerId) return;
  await redis.set(RECENT_SESSION_KEY(telegramId), String(partnerId), 'EX', RECENT_SESSION_TTL);
  await redis.set(RECENT_SESSION_KEY(partnerId), String(telegramId), 'EX', RECENT_SESSION_TTL);
}

function isAdmin(telegramId) {
  return config.ADMIN_IDS.includes(telegramId);
}

module.exports = { registerReportHandlers, saveLastPartner };
