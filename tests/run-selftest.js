// Запуск: node tests/run-selftest.js
const path = require('path');
const V = require(path.join(__dirname, '..', 'js', 'variants.js'));
const results = require(path.join(__dirname, '..', 'js', 'selftest.js')).run();

for (const r of results) {
  console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.details ? '\n       ' + r.details : ''}`);
}

if (process.argv.includes('--dump')) {
  for (const n of V.VARIANTS) {
    const v = V.getVariant(n);
    console.log(`\n=== ${n} вар ===\nШаг 1: ${JSON.stringify(v.step1)}\nШаг 2:`);
    v.step2.forEach(row => console.log('  ' + row.map(t => String(t).padStart(5)).join('')));
  }
}

const failed = results.filter(r => !r.ok).length;
console.log(`\nИтого: ${results.length - failed} OK, ${failed} FAIL`);
process.exit(failed ? 1 : 0);
