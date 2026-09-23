const { users } = require('../db/mongo');
const matching = require('../services/matching');
const { saveLastPartner } = require('./report');

function registerStartHandlers(bot) {
  bot.command('start', async (ctx) => {
    const telegramId = ctx.from.id;

    try {
      // Upsert user in MongoDB
      const user = await users().findOneAndUpdate(
        { telegramId },
        {
          $setOnInsert: { telegramId, gender: null, isPremium: false, premiumExpiry: null, isBanned: false, createdAt: new Date() },
          $set: { updatedAt: new Date() },
        },
        { upsert: true, returnDocument: 'after' },
      );

      // Cek ban
      if (user?.isBanned) {
        return ctx.reply('⛔ Akun kamu telah diblokir karena melanggar aturan.');
      }

      const status = await matching.getStatus(telegramId);
      if (status === 'waiting') return ctx.reply('⏳ Kamu sudah di antrian. Tunggu partner ya...');
      if (status === 'chatting') return ctx.reply('💬 Kamu sedang chatting. Ketik /next untuk ganti partner, atau /stop untuk berhenti.');

      const partnerId = await matching.findAndPair(telegramId);

      if (partnerId) {
        const msg = '🎉 Partner ditemukan! Mulai chat sekarang.\nKetik /next untuk ganti partner, /stop untuk berhenti.';
        await ctx.reply(msg);
        await ctx.telegram.sendMessage(partnerId, msg);
      } else {
        await matching.enqueue(telegramId);
        await ctx.reply('🔍 Mencari partner... Tunggu sebentar ya.');
      }
    } catch (err) {
      console.error('/start error:', err);
      await ctx.reply('❌ Terjadi kesalahan. Coba lagi nanti.');
    }
  });

  bot.command('stop', async (ctx) => {
    const telegramId = ctx.from.id;

    try {
      const status = await matching.getStatus(telegramId);

      if (status === 'waiting') {
        await matching.dequeue(telegramId);
        return ctx.reply('👋 Kamu keluar dari antrian.');
      }

      if (status === 'chatting') {
        const partnerId = await matching.unpair(telegramId);
        await saveLastPartner(telegramId, partnerId);
        await ctx.reply('👋 Sesi chat berakhir.');
        if (partnerId) {
          await ctx.telegram.sendMessage(partnerId, '👋 Partner meninggalkan chat. Ketik /start untuk mencari partner baru.');
        }
        return;
      }

      await ctx.reply('Kamu tidak sedang chat. Ketik /start untuk mulai.');
    } catch (err) {
      console.error('/stop error:', err);
      await ctx.reply('❌ Terjadi kesalahan. Coba lagi nanti.');
    }
  });

  bot.command('next', async (ctx) => {
    const telegramId = ctx.from.id;

    try {
      const status = await matching.getStatus(telegramId);

      if (status === 'chatting') {
        const oldPartnerId = await matching.unpair(telegramId);
        await saveLastPartner(telegramId, oldPartnerId);
        if (oldPartnerId) {
          await ctx.telegram.sendMessage(oldPartnerId, '👋 Partner meninggalkan chat. Ketik /start untuk mencari partner baru.');
        }
      } else if (status === 'waiting') {
        await matching.dequeue(telegramId);
      }

      const partnerId = await matching.findAndPair(telegramId);

      if (partnerId) {
        const msg = '🎉 Partner baru ditemukan! Mulai chat sekarang.\nKetik /next untuk ganti partner, /stop untuk berhenti.';
        await ctx.reply(msg);
        await ctx.telegram.sendMessage(partnerId, msg);
      } else {
        await matching.enqueue(telegramId);
        await ctx.reply('🔍 Mencari partner baru... Tunggu sebentar ya.');
      }
    } catch (err) {
      console.error('/next error:', err);
      await ctx.reply('❌ Terjadi kesalahan. Coba lagi nanti.');
    }
  });
}

module.exports = { registerStartHandlers };
