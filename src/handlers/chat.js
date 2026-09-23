const matching = require('../services/matching');
const { users } = require('../db/mongo');
const redis = require('../db/redis');

// Lazy premium expiry check: run at most once per hour per user
const EXPIRY_CHECK_KEY = (id) => `user:${id}:expiry_checked`;
const EXPIRY_CHECK_TTL = 3600; // 1 jam

async function lazyCheckPremiumExpiry(telegramId) {
  const alreadyChecked = await redis.get(EXPIRY_CHECK_KEY(telegramId));
  if (alreadyChecked) return;

  await redis.set(EXPIRY_CHECK_KEY(telegramId), '1', 'EX', EXPIRY_CHECK_TTL);

  const user = await users().findOne({ telegramId }, { projection: { isPremium: 1, premiumExpiry: 1 } });
  if (!user?.isPremium || !user?.premiumExpiry) return;

  if (user.premiumExpiry < new Date()) {
    // Premium expired — update DB dan hapus preferensi gender
    await users().updateOne({ telegramId }, { $set: { isPremium: false, updatedAt: new Date() } });
    await redis.del(`user:${telegramId}:pref`);
    console.log(`Premium expired for user ${telegramId}, filter removed`);
  }
}

function registerChatHandler(bot) {
  // copyMessage handles all types: text, photo, video, sticker, voice, animation, document, etc.
  bot.on('message', async (ctx) => {
    if (ctx.message.text && ctx.message.text.startsWith('/')) return;

    const telegramId = ctx.from.id;

    try {
      const partnerId = await matching.getPartner(telegramId);

      if (!partnerId) {
        return ctx.reply('Kamu belum ngobrol sama siapa-siapa. Ketik /start buat cari partner.');
      }

      // Cek expiry premium secara lazy (max 1x per jam, tidak blocking)
      lazyCheckPremiumExpiry(telegramId).catch((err) =>
        console.error('lazyCheckPremiumExpiry error:', err.message)
      );

      await ctx.telegram.copyMessage(partnerId, ctx.chat.id, ctx.message.message_id);
    } catch (err) {
      if (err.code === 403) {
        // Partner blocked the bot
        await matching.unpair(telegramId);
        return ctx.reply('Partner kamu kayaknya udah block bot ini. Ketik /start buat cari temen baru.');
      }
      console.error('Forward error:', err);
      await ctx.reply('Gagal kirim pesan. Coba lagi.');
    }
  });
}

module.exports = { registerChatHandler };
