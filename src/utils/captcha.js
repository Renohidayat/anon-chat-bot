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

module.exports = { generateCaptcha };
