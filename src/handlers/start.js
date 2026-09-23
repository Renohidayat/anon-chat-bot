const { Markup } = require('telegraf');
const { users } = require('../db/mongo');
const matching = require('../services/matching');
const { saveLastPartner } = require('./report');

/**
 * Generate soal math captcha sederhana.
 * Returns { question, answer, options (4 pilihan acak termasuk jawaban benar) }
 */
function generateCaptcha() {
  const ops = [
    { symbol: '+', fn: (a, b) => a + b },
    { symbol: '-', fn: (a, b) => a - b },
    { symbol: '×', fn: (a, b) => a * b },
  ];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a, b, answer;

  if (op.symbol === '×') {
    a = Math.floor(Math.random() * 9) + 2; // 2-10
    b = Math.floor(Math.random() * 9) + 2;
  } else if (op.symbol === '-') {
    a = Math.floor(Math.random() * 41) + 10; // 10-50
    b = Math.floor(Math.random() * a);        // 0 sampai a-1
  } else {
    a = Math.floor(Math.random() * 41) + 10;
    b = Math.floor(Math.random() * 41) + 10;
  }
  answer = op.fn(a, b);

  // Generate 3 jawaban salah yang unik
  const wrongSet = new Set();
  while (wrongSet.size < 3) {
    const offset = Math.floor(Math.random() * 11) - 5; // -5 sampai +5
    const wrong = answer + (offset === 0 ? 6 : offset);
    if (wrong !== answer && wrong >= 0) wrongSet.add(wrong);
  }

  // Acak urutan pilihan
  const options = [answer, ...wrongSet].sort(() => Math.random() - 0.5);
  return { question: `${a} ${op.symbol} ${b} = ?`, answer, options };
}

function registerStartHandlers(bot) {
  // Captcha callback handler
  bot.action(/^captcha:(\d+):(-?\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const expectedAnswer = parseInt(ctx.match[1], 10);
    const userAnswer = parseInt(ctx.match[2], 10);
    const telegramId = ctx.from.id;

    if (userAnswer === expectedAnswer) {
      // Verifikasi berhasil
      await users().updateOne(
        { telegramId },
        { $set: { isVerified: true, updatedAt: new Date() } }
      );
      await ctx.editMessageText('Verifikasi berhasil! Ketik /start buat mulai.');
    } else {
      // Salah, kasih soal baru
      const cap = generateCaptcha();
      const buttons = cap.options.map(opt =>
        Markup.button.callback(String(opt), `captcha:${cap.answer}:${opt}`)
      );
      await ctx.editMessageText(
        `Salah, coba lagi.\n\n*${cap.question}*`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([buttons]),
        }
      );
    }
  });

  bot.command('start', async (ctx) => {
    const telegramId = ctx.from.id;

    try {
      // Upsert user in MongoDB
      const user = await users().findOneAndUpdate(
        { telegramId },
        {
          $setOnInsert: { telegramId, gender: null, age: null, isPremium: false, premiumExpiry: null, isBanned: false, isVerified: false, createdAt: new Date() },
          $set: { updatedAt: new Date() },
        },
        { upsert: true, returnDocument: 'after' },
      );

      // Cek ban
      if (user?.isBanned) {
        return ctx.reply('Akun kamu diblokir karena melanggar aturan. Hubungi admin kalau merasa ini salah.');
      }

      // Captcha untuk user baru
      if (!user?.isVerified) {
        const cap = generateCaptcha();
        const buttons = cap.options.map(opt =>
          Markup.button.callback(String(opt), `captcha:${cap.answer}:${opt}`)
        );
        return ctx.reply(
          `Sebelum mulai, jawab dulu buat buktiin kamu bukan bot.\n\n*${cap.question}*`,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([buttons]),
          }
        );
      }

      // Onboarding: Wajib pilih gender
      if (!user?.gender) {
        return ctx.reply(
          'Halo! Sebelum mulai, pilih dulu gender kamu:',
          Markup.inlineKeyboard([
            [Markup.button.callback('Cowok', 'setgender:m')],
            [Markup.button.callback('Cewek', 'setgender:f')],
          ])
        );
      }

      const status = await matching.getStatus(telegramId);
      if (status === 'waiting') return ctx.reply('Masih nyari nih, tunggu bentar ya..');
      if (status === 'chatting') return ctx.reply('Kamu lagi ngobrol. Ketik /next buat ganti partner, /stop buat selesai.');

      const partnerId = await matching.findAndPair(telegramId);

      if (partnerId) {
        const msg = 'Ketemu! Langsung aja sapa duluan 👋\nKetik /next kalau mau ganti, /stop kalau mau berhenti.';
        await ctx.reply(msg);
        await ctx.telegram.sendMessage(partnerId, msg);
      } else {
        await matching.enqueue(telegramId);
        await ctx.reply('Lagi nyari temen ngobrol, tunggu bentar ya..');
      }
    } catch (err) {
      console.error('/start error:', err);
      await ctx.reply('Waduh, ada gangguan. Coba lagi ya.');
    }
  });

  bot.command('stop', async (ctx) => {
    const telegramId = ctx.from.id;

    try {
      const status = await matching.getStatus(telegramId);

      if (status === 'waiting') {
        await matching.dequeue(telegramId);
        return ctx.reply('Oke, kamu udah keluar dari antrean. Ketik /start kalau mau nyari lagi.');
      }

      if (status === 'chatting') {
        const partnerId = await matching.unpair(telegramId);
        await saveLastPartner(telegramId, partnerId);
        await ctx.reply('Obrolan selesai. Mau cari lagi? Ketik /start');
        if (partnerId) {
          await ctx.telegram.sendMessage(partnerId, 'Partner kamu udah pergi. Ketik /start buat cari temen baru.');
        }
        return;
      }

      await ctx.reply('Kamu lagi nggak ngobrol sama siapa-siapa. Ketik /start buat mulai.');
    } catch (err) {
      console.error('/stop error:', err);
      await ctx.reply('Waduh, ada gangguan. Coba lagi ya.');
    }
  });

  bot.command('next', async (ctx) => {
    const telegramId = ctx.from.id;

    try {
      const status = await matching.getStatus(telegramId);

      if (status === 'chatting') {
        const oldPartnerId = await matching.unpair(telegramId);
        await saveLastPartner(telegramId, oldPartnerId);
        if (oldPartnerId) {
          await ctx.telegram.sendMessage(oldPartnerId, 'Partner kamu udah pergi. Ketik /start buat cari temen baru.');
        }
      } else if (status === 'waiting') {
        await matching.dequeue(telegramId);
      }

      const partnerId = await matching.findAndPair(telegramId);

      if (partnerId) {
        const msg = 'Ketemu! Langsung aja sapa duluan 👋\nKetik /next kalau mau ganti, /stop kalau mau berhenti.';
        await ctx.reply(msg);
        await ctx.telegram.sendMessage(partnerId, msg);
      } else {
        await matching.enqueue(telegramId);
        await ctx.reply('Lagi nyari partner baru, tunggu bentar ya..');
      }
    } catch (err) {
      console.error('/next error:', err);
      await ctx.reply('Waduh, ada gangguan. Coba lagi ya.');
    }
  });

}

module.exports = { registerStartHandlers };
