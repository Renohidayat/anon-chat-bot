const { Markup } = require('telegraf');
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

      // Onboarding: Wajib pilih gender
      if (!user?.gender) {
        return ctx.reply(
          '👋 Selamat datang! Sebelum mulai, pilih gender profil kamu dulu ya:',
          Markup.inlineKeyboard([
            [Markup.button.callback('🙍‍♂️ Laki-laki', 'setgender:m')],
            [Markup.button.callback('🙍‍♀️ Perempuan', 'setgender:f')],
          ])
        );
      }

      const status = await matching.getStatus(telegramId);
      if (status === 'waiting') return ctx.reply('⏳ Sedang mencari partner...');
      if (status === 'chatting') return ctx.reply('💬 Sesi chat sedang berlangsung.\nKetik /next untuk ganti, /stop untuk akhiri.');

      const partnerId = await matching.findAndPair(telegramId);

      if (partnerId) {
        const msg = '🎉 Terhubung!\nSilakan sapa partner kamu. Ketik /next untuk ganti, /stop untuk berhenti.';
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
        return ctx.reply('👋 Kamu keluar dari antrean pencarian.');
      }

      if (status === 'chatting') {
        const partnerId = await matching.unpair(telegramId);
        await saveLastPartner(telegramId, partnerId);
        await ctx.reply('👋 Obrolan berakhir.');
        if (partnerId) {
          await ctx.telegram.sendMessage(partnerId, '👋 Partner telah mengakhiri obrolan. Ketik /start untuk mencari teman baru.');
        }
        return;
      }

      await ctx.reply('Kamu sedang tidak dalam obrolan 💬\nKetik /start untuk mencari partner.');
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
          await ctx.telegram.sendMessage(oldPartnerId, '👋 Partner telah mengakhiri obrolan. Ketik /start untuk mencari teman baru.');
        }
      } else if (status === 'waiting') {
        await matching.dequeue(telegramId);
      }

      const partnerId = await matching.findAndPair(telegramId);

      if (partnerId) {
        const msg = '🎉 Terhubung!\nSilakan sapa partner kamu. Ketik /next untuk ganti, /stop untuk berhenti.';
        await ctx.reply(msg);
        await ctx.telegram.sendMessage(partnerId, msg);
      } else {
        await matching.enqueue(telegramId);
        await ctx.reply('🔍 Mencari partner... Tunggu sebentar ya.');
      }
    } catch (err) {
      console.error('/next error:', err);
      await ctx.reply('❌ Terjadi kesalahan. Coba lagi nanti.');
    }
  });
}

module.exports = { registerStartHandlers };
