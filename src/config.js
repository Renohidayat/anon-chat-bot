require('dotenv').config();

const required = ['BOT_TOKEN', 'MONGODB_URI', 'REDIS_URL'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

// RonzzPay required only when payment feature is used
if (process.env.RONZZPAY_API_KEY && !process.env.RONZZPAY_WEBHOOK_URL) {
  console.warn('Warning: RONZZPAY_API_KEY set but RONZZPAY_WEBHOOK_URL missing — webhook fallback polling will be used');
}

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  MONGODB_URI: process.env.MONGODB_URI,
  REDIS_URL: process.env.REDIS_URL,
  ADMIN_IDS: (process.env.ADMIN_IDS || '').split(',').filter(Boolean).map(Number),
  PREMIUM_PRICE: Number(process.env.PREMIUM_PRICE) || 10000,
  PREMIUM_DURATION_DAYS: Number(process.env.PREMIUM_DURATION_DAYS) || 30,
  PORT: Number(process.env.PORT) || 3000,
  RONZZPAY_API_KEY: process.env.RONZZPAY_API_KEY || '',
  RONZZPAY_BASE_URL: process.env.RONZZPAY_BASE_URL || 'https://pg.ronzzyt.id',
  RONZZPAY_WEBHOOK_URL: process.env.RONZZPAY_WEBHOOK_URL || '',
};
