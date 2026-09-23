const axios = require('axios');
const crypto = require('crypto');
const config = require('../config');

const BASE_URL = config.RONZZPAY_BASE_URL;

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Log requests without leaking api_key value
api.interceptors.request.use((req) => {
  console.log(`--> ${req.method.toUpperCase()} ${req.baseURL}${req.url}`);
  return req;
});

api.interceptors.response.use(
  (res) => { console.log(`<-- ${res.status} ${res.config.url}`); return res; },
  (err) => {
    if (err.response) console.error(`<-- ${err.response.status}`, err.response.data?.message);
    else console.error(`ERR`, err.message);
    return Promise.reject(err);
  }
);

/**
 * Buat transaksi QRIS sandbox.
 * Returns: { reff_id, qr_image, qr_string, amount, expired_at }
 */
async function createQrisTransaction(amount, description, webhookUrl) {
  const payload = {
    api_key: config.RONZZPAY_API_KEY,
    code: 'qris',
    amount,
  };
  if (description) payload.description = description;
  if (webhookUrl) payload.webhook_url = webhookUrl;

  const endpoint = config.PAYMENT_MODE === 'production' ? '/transaction/create' : '/sandbox/transaction/create';
  const res = await api.post(endpoint, payload);
  if (!res.data.status) throw new Error(res.data.message || 'create transaction failed');
  return res.data.data;
}

/**
 * Cek status transaksi sandbox.
 * Returns: { reff_id, status, ... }
 */
async function getTransactionStatus(reffId) {
  const endpoint = config.PAYMENT_MODE === 'production' ? '/transaction/status' : '/sandbox/transaction/status';
  const res = await api.post(endpoint, {
    api_key: config.RONZZPAY_API_KEY,
    reff_id: reffId,
  });
  if (!res.data.status) throw new Error(res.data.message || 'status check failed');
  return res.data.data;
}

/**
 * Verifikasi HMAC-SHA256 signature dari header X-Signature.
 * Secret = api_key (dikonfirmasi dari sandbox source).
 * Timing-safe comparison untuk mencegah timing attack.
 *
 * @param {Buffer} rawBody - Raw request body (harus Buffer, bukan string/object)
 * @param {string} signatureHeader - Nilai header X-Signature
 * @returns {boolean}
 */
function verifySignature(rawBody, signatureHeader) {
  if (!signatureHeader || !rawBody || !config.RONZZPAY_API_KEY) return false;

  const expected = crypto
    .createHmac('sha256', config.RONZZPAY_API_KEY)
    .update(rawBody)
    .digest('hex');

  try {
    const sigBuf = Buffer.from(signatureHeader, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

module.exports = { createQrisTransaction, getTransactionStatus, verifySignature };
