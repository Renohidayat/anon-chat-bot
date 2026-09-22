const matching = require('../services/matching');

function registerChatHandler(bot) {
  // copyMessage handles all types: text, photo, video, sticker, voice, animation, document, etc.
  bot.on('message', async (ctx) => {
    if (ctx.message.text && ctx.message.text.startsWith('/')) return;

    const telegramId = ctx.from.id;

    try {
      const partnerId = await matching.getPartner(telegramId);

      if (!partnerId) {
        return ctx.reply('Kamu belum terhubung dengan partner. Ketik /start untuk mulai.');
      }

      await ctx.telegram.copyMessage(partnerId, ctx.chat.id, ctx.message.message_id);
    } catch (err) {
      if (err.code === 403) {
        // Partner blocked the bot
        await matching.unpair(telegramId);
        return ctx.reply('❌ Partner tidak bisa dihubungi. Ketik /start untuk mencari partner baru.');
      }
      console.error('Forward error:', err);
      await ctx.reply('❌ Gagal mengirim pesan. Coba lagi.');
    }
  });
}

module.exports = { registerChatHandler };
