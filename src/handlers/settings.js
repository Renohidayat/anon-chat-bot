const { Markup } = require('telegraf');
const { users } = require('../db/mongo');
const redis = require('../db/redis');

const AGE_AWAITING_KEY = (id) => `user:${id}:awaiting_age`;

function registerSettingsHandlers(bot) {
  // /settings — tampilkan profil user
  bot.command('settings', async (ctx) => {
    const telegramId = ctx.from.id;

    try {
      const user = await users().findOne({ telegramId });
      if (!user) {
        return ctx.reply('Kamu belum terdaftar. Ketik /start dulu.');
      }

      const genderLabel = user.gender === 'm' ? 'Cowok' : user.gender === 'f' ? 'Cewek' : 'Belum diset';
      const ageLabel = user.age ? `${user.age} tahun` : 'Belum diisi';
      const premiumLabel = (user.isPremium && user.premiumExpiry > new Date())
        ? `Aktif (sampai ${user.premiumExpiry.toLocaleDateString('id-ID')})`
        : 'Nggak aktif';

      const text = [
        '*Profil Kamu*\n',
        `Gender: ${genderLabel}`,
        `Umur: ${ageLabel}`,
        `Premium: ${premiumLabel}`,
      ].join('\n');

      await ctx.reply(text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('Ubah Gender', 'settings:gender')],
          [Markup.button.callback('Ubah Umur', 'settings:age')],
        ]),
      });
    } catch (err) {
      console.error('/settings error:', err);
      await ctx.reply('Ada gangguan. Coba lagi.');
    }
  });

  // Callback: ubah gender dari settings
  bot.action('settings:gender', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply(
      'Pilih gender kamu:',
      Markup.inlineKeyboard([
        [Markup.button.callback('Cowok', 'setgender:m')],
        [Markup.button.callback('Cewek', 'setgender:f')],
      ])
    );
  });

  // Callback: mulai input umur dari settings
  bot.action('settings:age', async (ctx) => {
    await ctx.answerCbQuery();
    await redis.set(AGE_AWAITING_KEY(ctx.from.id), '1', 'EX', 120);
    await ctx.reply('Ketik umur kamu (angka, 13-99):');
  });

  // Text handler: tangkap input umur
  bot.on('text', async (ctx, next) => {
    if (ctx.message.text.startsWith('/')) return next();

    const telegramId = ctx.from.id;
    const awaiting = await redis.get(AGE_AWAITING_KEY(telegramId));
    if (!awaiting) return next();

    const age = parseInt(ctx.message.text, 10);

    if (isNaN(age) || age < 13 || age > 99) {
      return ctx.reply('Umur harus angka antara 13 sampai 99. Coba lagi:');
    }

    try {
      await redis.del(AGE_AWAITING_KEY(telegramId));
      await users().updateOne(
        { telegramId },
        { $set: { age, updatedAt: new Date() } }
      );
      await ctx.reply(`Umur kamu disimpan: *${age} tahun*.\n\nSemua profil sudah lengkap!`, { 
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('Cari Partner 🔍', 'start_search')]
        ])
      });
    } catch (err) {
      console.error('set age error:', err);
      await ctx.reply('Gagal simpan umur. Coba lagi.');
    }
  });
}

module.exports = { registerSettingsHandlers };
