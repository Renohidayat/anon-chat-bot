const redis = require('../db/redis');

const STATUS_KEY = (id) => `user:${id}:status`;
const PARTNER_KEY = (id) => `user:${id}:partner`;
const QUEUE_GENERAL = 'queue:general';
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

async function enqueue(telegramId) {
  await redis.rpush(QUEUE_GENERAL, String(telegramId));
  await setStatus(telegramId, 'waiting');
}

/**
 * Pop candidates from queue until we find a valid one, then pair.
 * Returns partnerId if matched, null if queue empty.
 *
 * ponytail: O(n) worst case scanning stale entries — queue is naturally
 * small and TTL on status keys auto-expires abandoned users.
 */
async function findAndPair(telegramId) {
  while (true) {
    const candidateId = await redis.lpop(QUEUE_GENERAL);
    if (!candidateId) return null;
    if (candidateId === String(telegramId)) continue;

    const status = await redis.get(STATUS_KEY(candidateId));
    if (status !== 'waiting') continue;

    const partnerId = Number(candidateId);
    await redis.set(PARTNER_KEY(telegramId), String(partnerId), 'EX', TTL);
    await redis.set(PARTNER_KEY(partnerId), String(telegramId), 'EX', TTL);
    await setStatus(telegramId, 'chatting');
    await setStatus(partnerId, 'chatting');

    return partnerId;
  }
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
  await redis.lrem(QUEUE_GENERAL, 0, String(telegramId));
  await setStatus(telegramId, 'idle');
}

module.exports = { setStatus, getStatus, getPartner, enqueue, findAndPair, unpair, dequeue };
