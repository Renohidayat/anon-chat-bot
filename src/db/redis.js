const Redis = require('ioredis');
const config = require('../config');

const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  retryStrategy(times) {
    if (times > 3) return null; // Stop retrying after 3 attempts
    return Math.min(times * 200, 2000);
  },
});

redis.on('error', (err) => console.error('Redis error:', err.message));

// Auto-connect (non-blocking)
redis.connect().catch(() => {});

module.exports = redis;
