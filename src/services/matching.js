const redis = require('../db/redis');

const STATUS_KEY = (id) => `user:${id}:status`;
const PARTNER_KEY = (id) => `user:${id}:partner`;
const PREF_KEY = (id) => `user:${id}:pref`;
const GENDER_KEY = (id) => `user:${id}:gender`;
const QUEUE_GENERAL = 'queue:general';
const QUEUE_GENDER = (g) => `queue:gender:${g}`;

const TTL = 86400; // 24 hours

async function setStatus(telegramId, status) {
  await redis.set(STATUS_KEY(telegramId), status, 'EX', TTL);
}

async function getStatus(telegramId) {
  return await redis.get(STATUS_KEY(telegramId));
}

async function getPartner(telegramId) {
  const id = await redis.get(PARTNER_KEY(telegramId));
  return id ? Number(id) : null;
}

async function getUserGender(telegramId) {
  return await redis.get(GENDER_KEY(telegramId));
}

async function getUserPref(telegramId) {
  return await redis.get(PREF_KEY(telegramId));
}

/**
 * Pasangkan dua user dan update semua key yang diperlukan.
 */
async function pair(userA, userB) {
  await redis.set(PARTNER_KEY(userA), String(userB), 'EX', TTL);
  await redis.set(PARTNER_KEY(userB), String(userA), 'EX', TTL);
  await setStatus(userA, 'chatting');
  await setStatus(userB, 'chatting');
}

/**
 * Pop kandidat dari queue tertentu, validasi status, lalu return ID-nya.
 * Return null kalau queue kosong atau tidak ada kandidat valid.
 *
 * ponytail: O(n) scan kalau banyak stale entries. Upgrade path: TTL
 * pada queue member via Redis ZADD + expiry score.
 */
async function popValidCandidate(queueKey, excludeId) {
  while (true) {
    const candidateId = await redis.lpop(queueKey);
    if (!candidateId) return null;
    if (candidateId === String(excludeId)) continue;
    const status = await redis.get(STATUS_KEY(candidateId));
    if (status !== 'waiting') continue;
    return Number(candidateId);
  }
}

/**
 * Masukkan user ke antrian yang sesuai (gender-specific atau general).
 * Kalau punya preferensi gender, masuk ke queue gender target-nya
 * (karena kita butuh partner dengan gender = preferensi user).
 */
async function enqueue(telegramId) {
  const pref = await getUserPref(telegramId);
  const gender = await getUserGender(telegramId);

  if (pref && (pref === 'm' || pref === 'f')) {
    // User premium dengan preferensi: masuk ke queue gender dirinya
    // agar user lain yang preferensinya cocok bisa menemukannya
    if (gender && (gender === 'm' || gender === 'f')) {
      await redis.rpush(QUEUE_GENDER(gender), String(telegramId));
    } else {
      // Gender belum diset: masuk general saja
      await redis.rpush(QUEUE_GENERAL, String(telegramId));
    }
  } else {
    await redis.rpush(QUEUE_GENERAL, String(telegramId));
  }

  await setStatus(telegramId, 'waiting');
}

/**
 * Cari partner dan pasangkan.
 * Urutan pencarian untuk user dengan preferensi:
 *   1. queue:gender:{pref} (kandidat yang gender-nya sesuai preferensi)
 *   2. queue:general (fallback)
 *
 * Returns partnerId kalau berhasil, null kalau tidak ada kandidat.
 */
async function findAndPair(telegramId) {
  const pref = await getUserPref(telegramId);

  let partnerId = null;

  // Cari dari gender queue dulu kalau ada preferensi
  if (pref && (pref === 'm' || pref === 'f')) {
    partnerId = await popValidCandidate(QUEUE_GENDER(pref), telegramId);
  }

  // Fallback ke general queue
  if (!partnerId) {
    partnerId = await popValidCandidate(QUEUE_GENERAL, telegramId);
  }

  if (!partnerId) return null;

  await pair(telegramId, partnerId);
  return partnerId;
}

async function unpair(telegramId) {
  const partnerId = await getPartner(telegramId);

  await redis.del(PARTNER_KEY(telegramId));
  await setStatus(telegramId, 'idle');

  if (partnerId) {
    await redis.del(PARTNER_KEY(partnerId));
    await setStatus(partnerId, 'idle');
  }

  return partnerId;
}

async function dequeue(telegramId) {
  const gender = await getUserGender(telegramId);
  // Hapus dari semua queue yang mungkin
  await redis.lrem(QUEUE_GENERAL, 0, String(telegramId));
  if (gender) await redis.lrem(QUEUE_GENDER(gender), 0, String(telegramId));
  await setStatus(telegramId, 'idle');
}

module.exports = {
  setStatus,
  getStatus,
  getPartner,
  getUserGender,
  getUserPref,
  enqueue,
  findAndPair,
  unpair,
  dequeue,
};
