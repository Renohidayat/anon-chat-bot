const express = require('express');
const { Telegraf } = require('telegraf');
const config = require('../src/config');
const { connectMongo } = require('../src/db/mongo');
const { registerStartHandlers } = require('../src/handlers/start');
const { registerChatHandler } = require('../src/handlers/chat');
const { registerPremiumHandlers } = require('../src/handlers/premium');
const { registerGenderHandlers } = require('../src/handlers/gender');
const { registerReportHandlers } = require('../src/handlers/report');
const webhookRouter = require('../src/services/webhook');
const { setBot } = require('../src/services/webhook');
const { rateLimiter } = require('../src/middleware/rateLimiter');

// Initialize Telegraf
const bot = new Telegraf(config.BOT_TOKEN);

bot.catch((err, ctx) => {
  console.error(`Bot error for update ${ctx.updateType}:`, err.message);
  ctx.reply('❌ Terjadi kesalahan. Coba lagi nanti.').catch(() => {});
});

bot.use(rateLimiter);

registerStartHandlers(bot);
registerPremiumHandlers(bot);
registerGenderHandlers(bot);
registerReportHandlers(bot);
registerChatHandler(bot);

setBot(bot);

const app = express();

// Middleware asinkron untuk memastikan MongoDB connect di Serverless sebelum routing
app.use(async (req, res, next) => {
  try {
    await connectMongo();
    next();
  } catch (err) {
    console.error('Failed to connect to MongoDB in Serverless:', err);
    res.status(500).send('Database Error');
  }
});

// RonzzPay webhook (harus dipanggil sblm express.json)
app.use('/api/webhook/ronzzpay', webhookRouter);

// Telegram webhook
app.use(bot.webhookCallback('/api/webhook/telegram'));

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true }));

module.exports = app;
