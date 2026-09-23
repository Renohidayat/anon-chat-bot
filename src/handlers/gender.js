const { Markup } = require('telegraf');
const { users } = require('../db/mongo');
const redis = require('../db/redis');

// TTL sama dengan status key (24 jam)
const TTL = 86400;

function registerGenderHandlers(bot) {
  // /setgender — user set gender dirinya sendiri
  bot.command('setgender', async (ctx) => {
    return ctx.reply(
      '👤 Pilih gender kamu:',
      Markup.inlineKeyboard([
        [Markup.button.callback('🙍‍♂️ Laki-laki', 'setgender:m')],
        [Markup.button.callback('🙍‍♀️ Perempuan', 'setgender:f')],
      ])
    );
  });

  bot.action(/^setgender:(m|f)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const gender = ctx.match[1];
    const telegramId = ctx.from.id;

    try {
      await users().updateOne(
        { telegramId },
        { $set: { gender, updatedAt: new Date() } }
      );
      await redis.set(`user:${telegramId}:gender`, gender);

      const label = gender === 'm' ? 'Laki-laki 🙍‍♂️' : 'Perempuan 🙍‍♀️';
      await ctx.editMessageText(`✅ Gender kamu diset ke: *${label}*`, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('/setgender error:', err);
      await ctx.reply('❌ Gagal menyimpan gender. Coba lagi.');
    }
  });

  // /filtergender — set preferensi gender partner (premium only)
  bot.command('filtergender', async (ctx) => {
    const telegramId = ctx.from.id;

    try {
      const user = await users().findOne({ telegramId });

      if (!user?.isPremium || !user?.premiumExpiry || user.premiumExpiry < new Date()) {
        return ctx.reply(
          '⭐ Fitur ini khusus untuk pengguna *Premium*.\n\nKetik /upgrade untuk berlangganan.',
          { parse_mode: 'Markdown' }
        );
      }

      return ctx.reply(
        '🔍 Pilih gender partner yang kamu cari:',
        Markup.inlineKeyboard([
          [Markup.button.callback('🙍‍♂️ Laki-laki', 'filtergender:m')],
          [Markup.button.callback('🙍‍♀️ Perempuan', 'filtergender:f')],
          [Markup.button.callback('🎲 Random (hapus filter)', 'filtergender:any')],
        ])
      );
    } catch (err) {
      console.error('/filtergender error:', err);
      await ctx.reply('❌ Terjadi kesalahan. Coba lagi.');
    }
  });

  bot.action(/^filtergender:(m|f|any)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const pref = ctx.match[1];
    const telegramId = ctx.from.id;

    try {
      if (pref === 'any') {
        await redis.del(`user:${telegramId}:pref`);
        await ctx.editMessageText('🎲 Filter gender dihapus. Kamu akan di-match secara random.');
      } else {
        await redis.set(`user:${telegramId}:pref`, pref, 'EX', TTL);
        const label = pref === 'm' ? 'Laki-laki 🙍‍♂️' : 'Perempuan 🙍‍♀️';
        await ctx.editMessageText(
          `✅ Filter diset: hanya cari partner *${label}*.\n\nKetik /start atau /next untuk mulai mencari.`,
          { parse_mode: 'Markdown' }
        );
      }
    } catch (err) {
      console.error('/filtergender action error:', err);
      await ctx.reply('❌ Gagal menyimpan preferensi. Coba lagi.');
    }
  });
}

module.exports = { registerGenderHandlers };
