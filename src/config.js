require('dotenv').config();

const required = ['BOT_TOKEN', 'MONGODB_URI', 'REDIS_URL'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  MONGODB_URI: process.env.MONGODB_URI,
  REDIS_URL: process.env.REDIS_URL,
  ADMIN_IDS: (process.env.ADMIN_IDS || '').split(',').filter(Boolean).map(Number),
  PREMIUM_PRICE: Number(process.env.PREMIUM_PRICE) || 10000,
  PREMIUM_DURATION_DAYS: Number(process.env.PREMIUM_DURATION_DAYS) || 30,
  PORT: Number(process.env.PORT) || 3000,
};
