const { Telegraf } = require('telegraf');
const config = require('./config');
const { connectMongo } = require('./db/mongo');
const { registerStartHandlers } = require('./handlers/start');
const { registerChatHandler } = require('./handlers/chat');

const bot = new Telegraf(config.BOT_TOKEN);

registerStartHandlers(bot);
registerChatHandler(bot);

async function main() {
  await connectMongo();
  console.log('MongoDB connected');
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
