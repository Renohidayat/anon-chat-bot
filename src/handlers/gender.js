const { Markup } = require('telegraf');
const { users } = require('../db/mongo');
const redis = require('../db/redis');

// TTL sama dengan status key (24 jam)
const TTL = 86400;

function registerGenderHandlers(bot) {
  // /setgender — user set gender dirinya sendiri
  bot.command('setgender', async (ctx) => {
    return ctx.reply(
      'Pilih gender kamu:',
      Markup.inlineKeyboard([
        [Markup.button.callback('Cowok', 'setgender:m')],
        [Markup.button.callback('Cewek', 'setgender:f')],
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

      const label = gender === 'm' ? 'Cowok' : 'Cewek';
      await ctx.editMessageText(`Gender kamu: *${label}*\n\nKetik /start buat mulai ngobrol.`, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('/setgender error:', err);
      await ctx.reply('Gagal simpan gender. Coba lagi.');
    }
  });

  // /filtergender — set preferensi gender partner (premium only)
  bot.command('filtergender', async (ctx) => {
    const telegramId = ctx.from.id;

    try {
      const user = await users().findOne({ telegramId });

      if (!user?.isPremium || !user?.premiumExpiry || user.premiumExpiry < new Date()) {
        return ctx.reply(
          'Fitur ini cuma buat user Premium.\n\nKetik /upgrade buat langganan.',
          { parse_mode: 'Markdown' }
        );
      }

      return ctx.reply(
        'Mau ngobrol sama siapa?',
        Markup.inlineKeyboard([
          [Markup.button.callback('Cowok', 'filtergender:m')],
          [Markup.button.callback('Cewek', 'filtergender:f')],
          [Markup.button.callback('Random aja', 'filtergender:any')],
        ])
      );
    } catch (err) {
      console.error('/filtergender error:', err);
      await ctx.reply('Ada gangguan. Coba lagi.');
    }
  });

  bot.action(/^filtergender:(m|f|any)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const pref = ctx.match[1];
    const telegramId = ctx.from.id;

    try {
      if (pref === 'any') {
        await redis.del(`user:${telegramId}:pref`);
        await ctx.editMessageText('Filter dihapus. Pencarian sekarang random.');
      } else {
        await redis.set(`user:${telegramId}:pref`, pref, 'EX', TTL);
        const label = pref === 'm' ? 'Cowok' : 'Cewek';
        await ctx.editMessageText(
          `Filter aktif: nyari partner *${label}*.\n\nKetik /start atau /next buat mulai.`,
          { parse_mode: 'Markdown' }
        );
      }
    } catch (err) {
      console.error('/filtergender action error:', err);
      await ctx.reply('Gagal simpan preferensi. Coba lagi.');
    }
  });
}

module.exports = { registerGenderHandlers };
