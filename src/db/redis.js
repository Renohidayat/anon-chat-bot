const Redis = require('ioredis');
const config = require('../config');

const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: false,
});

redis.on('error', (err) => console.error('Redis error:', err.message));

module.exports = redis;
