const redis = require('../db/redis');

// Batas pesan per user per window
const MAX_MESSAGES = 5;       // maks 5 pesan
const WINDOW_SEC = 3;         // dalam 3 detik
const BLOCK_SEC = 10;         // di-throttle 10 detik setelah melewati batas

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
  // Hanya rate-limit pesan biasa, bukan command
  const isRegularMessage = ctx.message && !ctx.message.text?.startsWith('/');
  if (!isRegularMessage) return next();

  const userId = ctx.from?.id;
  if (!userId) return next();

  try {
    // Cek apakah sedang di-block
    const blocked = await redis.get(BLOCK_KEY(userId));
    if (blocked) {
      return ctx.reply('⏳ Kamu mengirim pesan terlalu cepat. Tunggu sebentar.').catch(() => {});
    }

    // Increment counter
    const count = await redis.incr(RATE_KEY(userId));
    if (count === 1) {
      await redis.expire(RATE_KEY(userId), WINDOW_SEC);
    }

    if (count > MAX_MESSAGES) {
      await redis.set(BLOCK_KEY(userId), '1', 'EX', BLOCK_SEC);
      return ctx.reply('⚠️ Terlalu banyak pesan. Tunggu 10 detik.').catch(() => {});
    }
  } catch (err) {
    // Jangan block user kalau Redis error
    console.error('rateLimiter error:', err.message);
  }

  return next();
}

module.exports = { rateLimiter };
