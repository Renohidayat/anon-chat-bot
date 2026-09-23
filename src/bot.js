const express = require('express');
const { Telegraf } = require('telegraf');
const config = require('./config');
const { connectMongo } = require('./db/mongo');
const { registerStartHandlers } = require('./handlers/start');
const { registerChatHandler } = require('./handlers/chat');
const { registerPremiumHandlers } = require('./handlers/premium');
const { registerGenderHandlers } = require('./handlers/gender');
const webhookRouter = require('./services/webhook');
const { setBot } = require('./services/webhook');

const bot = new Telegraf(config.BOT_TOKEN);

registerStartHandlers(bot);
registerPremiumHandlers(bot);
registerGenderHandlers(bot);
registerChatHandler(bot);

async function main() {
  await connectMongo();
  console.log('MongoDB connected');

  // Inject bot instance into webhook handler (untuk kirim notif ke user)
  setBot(bot);

  const app = express();

  // RonzzPay webhook — WAJIB raw body sebelum json parser
  // (verifikasi HMAC butuh Buffer, bukan parsed object)
  app.use('/ronzzpay-webhook', webhookRouter);

  // JSON parser untuk route lain (jika ada di masa depan)
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ ok: true }));

  app.listen(config.PORT, () => {
    console.log(`Express listening on port ${config.PORT}`);
  });

  console.log('Starting bot (polling mode)...');
  bot.launch();
  console.log('Bot is running');
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
