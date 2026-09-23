const express = require('express');
const { Telegraf } = require('telegraf');
const config = require('./config');
const { connectMongo } = require('./db/mongo');
const redis = require('./db/redis');
const { registerStartHandlers } = require('./handlers/start');
const { registerChatHandler } = require('./handlers/chat');
const { registerPremiumHandlers } = require('./handlers/premium');
const { registerGenderHandlers } = require('./handlers/gender');
const { registerReportHandlers } = require('./handlers/report');
const { registerInfoHandlers } = require('./handlers/info');
const { registerSettingsHandlers } = require('./handlers/settings');
const webhookRouter = require('./services/webhook');
const { setBot } = require('./services/webhook');
const { rateLimiter } = require('./middleware/rateLimiter');

const bot = new Telegraf(config.BOT_TOKEN);

// Global error handler — jangan expose stack trace ke user
bot.catch((err, ctx) => {
  console.error(`Bot error for update ${ctx.updateType}:`, err.message);
  ctx.reply('Ada gangguan. Coba lagi ya.').catch(() => {});
});

// Rate limiter — pasang sebelum semua handler
bot.use(rateLimiter);

// Handlers (urutan penting: commands sebelum generic message handler)
registerStartHandlers(bot);
registerInfoHandlers(bot);
registerSettingsHandlers(bot);
registerPremiumHandlers(bot);
registerGenderHandlers(bot);
registerReportHandlers(bot);
registerChatHandler(bot);

async function main() {
  await connectMongo();
  console.log('MongoDB connected');

  setBot(bot);

  const app = express();

  // RonzzPay webhook — WAJIB raw body sebelum json parser
  app.use('/ronzzpay-webhook', webhookRouter);

  // JSON parser untuk route lain
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ ok: true }));

  // Express error handler — jangan expose internal error ke response
  app.use((err, _req, res, _next) => {
    console.error('Express error:', err.message);
    res.status(500).json({ ok: false });
  });

  const server = app.listen(config.PORT, () => {
    console.log(`Express listening on port ${config.PORT}`);
  });

  // Set menu commands di Telegram
  await bot.telegram.setMyCommands([
    { command: 'start', description: 'Cari temen ngobrol' },
    { command: 'stop', description: 'Berhenti / keluar antrean' },
    { command: 'next', description: 'Ganti partner' },
    { command: 'settings', description: 'Lihat & edit profil' },
    { command: 'setgender', description: 'Ubah gender' },
    { command: 'filtergender', description: 'Pilih gender partner (Premium)' },
    { command: 'upgrade', description: 'Langganan Premium' },
    { command: 'report', description: 'Laporkan partner' },
    { command: 'rules', description: 'Aturan chat' },
    { command: 'help', description: 'Bantuan' },
  ]);

  console.log('Starting bot (polling mode)...');
  bot.launch();
  console.log('Bot is running');

  // Graceful shutdown
  async function shutdown(signal) {
    console.log(`${signal} received, shutting down...`);
    bot.stop(signal);
    server.close();
    await redis.quit();
    console.log('Shutdown complete');
    process.exit(0);
  }

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
