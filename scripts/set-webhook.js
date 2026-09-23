require('dotenv').config();
const { Telegraf } = require('telegraf');

const token = process.env.BOT_TOKEN;
const args = process.argv.slice(2);

if (!token) {
  console.error('Error: BOT_TOKEN is missing in .env file');
  process.exit(1);
}

const url = args[0];
if (!url) {
  console.error('Usage: node scripts/set-webhook.js <YOUR_VERCEL_URL>');
  console.error('Example: node scripts/set-webhook.js https://my-bot.vercel.app');
  process.exit(1);
}

const bot = new Telegraf(token);
const webhookUrl = `${url.replace(/\/$/, '')}/api/webhook/telegram`;

bot.telegram.setWebhook(webhookUrl)
  .then((success) => {
    if (success) {
      console.log(`✅ Webhook successfully set to: ${webhookUrl}`);
      console.log(`Jangan lupa atur RONZZPAY_WEBHOOK_URL di Vercel menjadi: ${url.replace(/\/$/, '')}/api/webhook/ronzzpay`);
    } else {
      console.log('❌ Failed to set webhook');
    }
  })
  .catch((err) => {
    console.error('❌ Error setting webhook:', err.message);
  });
