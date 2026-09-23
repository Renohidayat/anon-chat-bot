const redis = require('../db/redis');
const { users } = require('../db/mongo');
const { generateCaptcha } = require('../utils/captcha');
const { Markup } = require('telegraf');

// Batas pesan per user per window
const MAX_MESSAGES = 5;       // maks 5 pesan
const WINDOW_SEC = 3;         // dalam 3 detik
const BLOCK_SEC = 86400;      // blokir 24 jam atau sampai captcha dijawab

const RATE_KEY = (id) => `ratelimit:${id}`;
const BLOCK_KEY = (id) => `ratelimit:blocked:${id}`;

/**
 * Middleware rate limiter untuk bot Telegraf.
 * Pakai Redis counter + TTL — tidak persistent, tidak butuh state lokal.
 *
 * ponytail: global lock per user, bukan per endpoint — cukup untuk
 * anti-spam pesan. Upgrade path: sliding window dengan Redis ZADD.
 */
async function rateLimiter(ctx, next) {
  const userId = ctx.from?.id;
  if (!userId) return next();

  try {
    // Cek apakah sedang di-block karena belum jawab captcha
    const blocked = await redis.get(BLOCK_KEY(userId));
    if (blocked) {
      // Jika mencoba aksi lain saat diblokir, ingatkan (kecuali jawab captcha)
      if (ctx.message?.text?.startsWith('/') || (ctx.callbackQuery && !ctx.callbackQuery.data?.startsWith('captcha:'))) {
        return ctx.reply('Kamu masih diblokir karena spam. Selesaikan pertanyaan matematika sebelumnya dulu.').catch(() => {});
      }
      
      // Biarkan callback captcha lolos, abaikan yang lain
      if (!(ctx.callbackQuery && ctx.callbackQuery.data?.startsWith('captcha:'))) {
        return;
      }
    }

    // Skip command dan callback query untuk rate limiting penambahan counter
    if (ctx.message?.text?.startsWith('/') || ctx.callbackQuery) return next();

    const isRegularMessage = ctx.message;
    if (!isRegularMessage) return next();

    // Increment counter
    const count = await redis.incr(RATE_KEY(userId));
    if (count === 1) {
      await redis.expire(RATE_KEY(userId), WINDOW_SEC);
    }

    if (count > MAX_MESSAGES) {
      await redis.set(BLOCK_KEY(userId), '1', 'EX', BLOCK_SEC);
      await users().updateOne({ telegramId: userId }, { $set: { isVerified: false } });
      
      const cap = generateCaptcha();
      const buttons = cap.options.map(opt =>
        Markup.button.callback(String(opt), `captcha:${cap.answer}:${opt}`)
      );
      return ctx.reply(
        `Terdeteksi ngirim pesan terlalu cepat (spam).\n\nKamu diblokir sementara. Jawab soal ini buat buka blokir:\n\n*${cap.question}*`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([buttons]),
        }
      ).catch(() => {});
    }
  } catch (err) {
    // Jangan block user kalau Redis error
    console.error('rateLimiter error:', err.message);
  }

  return next();
}

module.exports = { rateLimiter };
