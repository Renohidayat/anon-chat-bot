const express = require('express');
const { verifySignature, getTransactionStatus } = require('./payment');
const { transactions, users } = require('../db/mongo');
const config = require('../config');

const router = express.Router();

/**
 * POST /ronzzpay-webhook
 *
 * WAJIB: route ini di-mount dengan express.raw({ type: 'application/json' })
 * supaya rawBody tersedia sebagai Buffer untuk verifikasi HMAC.
 *
 * Event yang diproses: transaction.success | transaction.failed | transaction.expired
 */
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  // Wajib 200 lebih dulu kalau gagal, supaya RonzzPay tidak retry terus
  // Tapi kita validate dulu sebelum respons

  const sig = req.headers['x-signature'];
  if (!verifySignature(req.body, sig)) {
    console.error('Webhook: invalid signature');
    return res.status(401).json({ success: false });
  }

  let payload;
  try {
    payload = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(400).json({ success: false });
  }

  // Respond 200 immediately — proses async agar tidak timeout
  res.status(200).json({ success: true });

  const { event, data } = payload;
  if (!data?.reff_id) return;

  try {
    await processWebhookEvent(event, data);
  } catch (err) {
    console.error('Webhook processing error:', err.message);
  }
});

/**
 * Update DB berdasarkan event dari RonzzPay.
 * Di-export juga supaya bisa dipanggil dari fallback polling.
 */
async function processWebhookEvent(event, data) {
  const { reff_id, status } = data;

  // Update transaction record
  await transactions().updateOne(
    { reffId: reff_id },
    { $set: { status, paidAt: event === 'transaction.success' ? new Date() : null } }
  );

  if (event !== 'transaction.success') return;

  // Cari telegramId dari transaksi
  const trx = await transactions().findOne({ reffId: reff_id });
  if (!trx) return;

  // Hitung expiry: sekarang + PREMIUM_DURATION_DAYS hari
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + config.PREMIUM_DURATION_DAYS);

  await users().updateOne(
    { telegramId: trx.telegramId },
    { $set: { isPremium: true, premiumExpiry: expiry, updatedAt: new Date() } }
  );

  console.log(`Premium activated for user ${trx.telegramId} until ${expiry.toISOString()}`);

  // Beri tahu user via bot (bot instance diset via setBot())
  if (_bot) {
    const until = expiry.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    await _bot.telegram.sendMessage(
      trx.telegramId,
      `✅ Pembayaran diterima! Premium aktif sampai *${until}*.\n\nGunakan /filtergender untuk mengaktifkan filter gender.`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }
}

// Bot instance — diset dari bot.js setelah init
let _bot = null;
function setBot(botInstance) { _bot = botInstance; }

module.exports = router;
module.exports.processWebhookEvent = processWebhookEvent;
module.exports.setBot = setBot;
