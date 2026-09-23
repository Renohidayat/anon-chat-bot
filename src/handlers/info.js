function registerInfoHandlers(bot) {
  bot.command('help', async (ctx) => {
    const text = [
      '*Daftar Command*\n',
      '/start — Cari temen ngobrol',
      '/stop — Berhenti / keluar antrean',
      '/next — Ganti partner',
      '/setgender — Ubah gender kamu',
      '/filtergender — Pilih gender partner (Premium)',
      '/settings — Lihat & edit profil',
      '/upgrade — Langganan Premium',
      '/report — Laporkan partner',
      '/rules — Aturan chat',
      '/terms — Syarat & ketentuan',
      '/help — Bantuan (halaman ini)',
    ].join('\n');

    await ctx.reply(text, { parse_mode: 'Markdown' });
  });

  bot.command('rules', async (ctx) => {
    const text = [
      '*Aturan Chat*\n',
      '1. Dilarang spam, flood, atau kirim pesan berulang.',
      '2. Dilarang SARA, ujaran kebencian, atau diskriminasi.',
      '3. Dilarang kirim konten dewasa / pornografi.',
      '4. Dilarang promosi, jualan, atau link mencurigakan.',
      '5. Dilarang mengancam atau intimidasi partner.',
      '6. Dilarang menyebarkan data pribadi orang lain.',
      '7. Hormati partner kamu, kalau nggak cocok tinggal /next.',
      '\nPelanggaran bisa bikin akun kamu diblokir permanen.',
    ].join('\n');

    await ctx.reply(text, { parse_mode: 'Markdown' });
  });

  bot.command('terms', async (ctx) => {
    const text = [
      '*Syarat & Ketentuan*\n',
      '• Bot ini menyediakan layanan chat anonim antar pengguna Telegram.',
      '• Dengan menggunakan bot ini, kamu setuju untuk mematuhi semua aturan (/rules).',
      '• Kami tidak menyimpan isi percakapan kamu. Pesan langsung diteruskan antar partner.',
      '• Data yang kami simpan: Telegram ID, gender, umur, dan status langganan.',
      '• Pembayaran Premium bersifat non-refundable.',
      '• Kami berhak memblokir akun yang melanggar aturan tanpa pemberitahuan.',
      '• Layanan ini disediakan apa adanya, tanpa jaminan ketersediaan 24/7.',
      '\nPertanyaan? Hubungi admin via /report.',
    ].join('\n');

    await ctx.reply(text, { parse_mode: 'Markdown' });
  });
}

module.exports = { registerInfoHandlers };
