const { Markup } = require('telegraf');
const { createQrisTransaction, getTransactionStatus } = require('../services/payment');
const { processWebhookEvent } = require('../services/webhook');
const { transactions, users } = require('../db/mongo');
const config = require('../config');

// Interval dan batas polling fallback
const POLL_INTERVAL_MS = 30_000; // 30 detik
const POLL_MAX_ATTEMPTS = 20;    // 20x = 10 menit

function registerPremiumHandlers(bot) {
  // /upgrade — mulai flow pembayaran
  bot.command('upgrade', async (ctx) => {
    if (!config.RONZZPAY_API_KEY) {
      return ctx.reply('❌ Fitur premium belum tersedia. Coba lagi nanti.');
    }

    const telegramId = ctx.from.id;

    try {
      // Cek apakah sudah premium
      const user = await users().findOne({ telegramId });
      if (user?.isPremium && user?.premiumExpiry > new Date()) {
        const until = user.premiumExpiry.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
        return ctx.reply(`✅ Kamu sudah premium sampai *${until}*!`, { parse_mode: 'Markdown' });
      }

      await ctx.reply('⏳ Membuat transaksi QRIS...');

      const webhookUrl = config.RONZZPAY_WEBHOOK_URL ? `${config.RONZZPAY_WEBHOOK_URL}/ronzzpay-webhook` : '';
      const data = await createQrisTransaction(
        config.PREMIUM_PRICE,
        `Premium ${config.PREMIUM_DURATION_DAYS} hari - @${ctx.from.username || telegramId}`,
        webhookUrl
      );

      // Simpan ke MongoDB
      await transactions().insertOne({
        reffId: data.reff_id,
        telegramId,
        amount: data.amount,
        status: 'pending',
        paidAt: null,
        createdAt: new Date(),
      });

      const expiredAt = data.expired_at ? `⏳ Berlaku hingga: *${data.expired_at}*` : '';
      const caption =
        `⭐ *Premium Membership*\n\n` +
        `🏷️ Harga: *Rp ${config.PREMIUM_PRICE.toLocaleString('id-ID')}*\n` +
        `📆 Durasi: *${config.PREMIUM_DURATION_DAYS} hari*\n` +
        (expiredAt ? `${expiredAt}\n` : '') +
        `\n📱 _Scan QR Code ini menggunakan M-Banking atau E-Wallet (OVO, GoPay, Dana, dll)._`;

      // Kirim QR image dari URL yang RonzzPay berikan
      await ctx.replyWithPhoto(data.qr_image, {
        caption,
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✅ Saya sudah bayar', `check_payment:${data.reff_id}`)],
          [Markup.button.callback('❌ Batal', 'cancel_payment')],
        ]),
      });

      // Jalankan fallback polling kalau RONZZPAY_WEBHOOK_URL tidak diset
      if (!webhookUrl) {
        startFallbackPolling(bot, telegramId, data.reff_id);
      }

    } catch (err) {
      console.error('/upgrade error:', err.message);
      await ctx.reply(`❌ Gagal membuat transaksi: ${err.message}`);
    }
  });

  // Callback: user klik "Saya sudah bayar" — manual cek status
  bot.action(/^check_payment:(.+)$/, async (ctx) => {
    const reffId = ctx.match[1];

    try {
      const data = await getTransactionStatus(reffId);

      if (data.status === 'success') {
        await processWebhookEvent('transaction.success', { reff_id: reffId, status: 'success' });
        await ctx.answerCbQuery('Berhasil!');
        await ctx.editMessageCaption('✅ Pembayaran Berhasil! Fitur Premium sudah aktif.').catch(() => {});
      } else if (data.status === 'failed' || data.status === 'expired') {
        await transactions().updateOne({ reffId }, { $set: { status: data.status } });
        await ctx.answerCbQuery('Gagal/Expired');
        await ctx.editMessageCaption(`❌ Transaksi ${data.status}. Ketik /upgrade untuk coba lagi.`).catch(() => {});
      } else {
        // Status masih pending
        await ctx.answerCbQuery('⏳ Belum terbayar. Cek kembali nanti.', { show_alert: true });
      }
    } catch (err) {
      console.error('check_payment error:', err.message);
      await ctx.answerCbQuery('❌ Gagal mengecek status ke server. Coba lagi.', { show_alert: true });
    }
  });

  // Callback: user klik "Batal"
  bot.action('cancel_payment', async (ctx) => {
    await ctx.answerCbQuery('Dibatalkan.');
    await ctx.editMessageCaption('❌ Transaksi dibatalkan.').catch(() => {});
  });
}

/**
 * Fallback polling: tiap 30 detik selama maks 10 menit.
 * Dipakai saat RONZZPAY_WEBHOOK_URL tidak tersedia (dev lokal).
 *
 * ponytail: setInterval per-user — tidak skalabel untuk banyak transaksi
 * bersamaan. Upgrade path: Redis sorted set + single global poller.
 */
function startFallbackPolling(bot, telegramId, reffId) {
  let attempts = 0;

  const timer = setInterval(async () => {
    attempts++;
    if (attempts > POLL_MAX_ATTEMPTS) {
      clearInterval(timer);
      await transactions().updateOne({ reffId }, { $set: { status: 'expired' } });
      await bot.telegram.sendMessage(telegramId, '⏰ Waktu pembayaran habis. Ketik /upgrade untuk coba lagi.').catch(() => {});
      return;
    }

    try {
      const data = await getTransactionStatus(reffId);
      if (data.status === 'success') {
        clearInterval(timer);
        await processWebhookEvent('transaction.success', { reff_id: reffId, status: 'success' });
      } else if (data.status === 'failed' || data.status === 'expired') {
        clearInterval(timer);
        await transactions().updateOne({ reffId }, { $set: { status: data.status } });
        await bot.telegram.sendMessage(telegramId, `❌ Transaksi ${data.status}. Ketik /upgrade untuk coba lagi.`).catch(() => {});
      }
    } catch (err) {
      console.error('Fallback polling error:', err.message);
    }
  }, POLL_INTERVAL_MS);
}

module.exports = { registerPremiumHandlers };
