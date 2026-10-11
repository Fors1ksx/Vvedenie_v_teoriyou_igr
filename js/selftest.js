/*
 * Самопроверка решателей и вариантов.
 * Node:    node tests/run-selftest.js
 * Браузер: http://localhost:8000/test.html
 */
(function (root) {
  'use strict';

  const isNode = typeof module === 'object' && module.exports;
  const S = isNode ? require('./solvers.js') : root.GTSolvers;
  const V = isNode ? require('./variants.js') : root.GTVariants;

  const near = (a, b, tol = 0.01) => Math.abs(a - b) <= tol + 1e-12;
  const vecNear = (a, b, tol = 0.01) => a.length === b.length && a.every((t, i) => near(t, b[i], tol));
  const fmt = x => (Number.isInteger(x) ? String(x) : x.toFixed(4)).replace('.', ',');
  const fmtV = a => '(' + a.map(fmt).join('; ') + ')';

  function run() {
    const results = [];
    const check = (name, ok, details = '') => results.push({ name, ok: !!ok, details });

    /* --- 4 вар: эталоны со скриншотов --- */
    const a = V.analyzeVariant(4);
    const s1 = a.step1;
    check('4 вар, шаг 1: цена игры 1,5', near(s1.value, 1.5), 'v = ' + fmt(s1.value));
    check('4 вар, шаг 1: 2 оптимальные стратегии, номера 3 и 4', s1.optimal.map(i => i + 1).join() === '3,4',
      'номера: ' + s1.optimal.map(i => i + 1).join(', '));
    check('4 вар, шаг 1: Sb* = (0,5; 0,5)', vecNear(s1.sb, [0.5, 0.5]), 'Sb* = ' + fmtV(s1.sb));
    check('4 вар, шаг 1: Sa* = (0; 0; 0,25; 0,75; 0)', vecNear(s1.sa, [0, 0, 0.25, 0.75, 0]), 'Sa* = ' + fmtV(s1.sa));

    const t = a.step2;
    check('4 вар, шаг 2: сокращение однозначно и даёт 3×3',
      !a.problems.some(p => p.startsWith('Шаг 2')),
      'строки ' + t.rows.map(i => i + 1).join(',') + ', столбцы ' + t.cols.map(i => i + 1).join(','));
    check('4 вар, шаг 2: итог = [[3,2,0],[3,-2,1],[1,2,2]]',
      JSON.stringify(a.step3Matrix) === JSON.stringify([[3, 2, 0], [3, -2, 1], [1, 2, 2]]),
      JSON.stringify(a.step3Matrix));
    check('4 вар, шаг 2: пример порядка вычёркивания', true, S.reduceGreedy(a.variant.step2).steps.join('; '));

    const d = a.step3;
    check('4 вар, шаг 3: DetC=-28, C1=-8, C2=-2, C3=-8',
      d.Y.det === -28 && d.Y.dets.join() === '-8,-2,-8', `DetC=${d.Y.det}, Cj=${d.Y.dets.join(', ')}`);
    check('4 вар, шаг 3: цена 1,56; Y = (0,44; 0,11; 0,44)',
      near(d.value, 1.56) && vecNear(d.Y.strategy, [0.44, 0.11, 0.44]), `v=${fmt(d.value)}, Y=${fmtV(d.Y.strategy)}`);
    check('4 вар, шаг 3: DetC~=-28, C1~=-3, C2~=-2, C3~=-13',
      d.X.det === -28 && d.X.dets.join() === '-3,-2,-13', `DetC~=${d.X.det}, Cj~=${d.X.dets.join(', ')}`);
    check('4 вар, шаг 3: X = (0,167; 0,111; 0,722)',
      vecNear(d.X.strategy, [0.167, 0.111, 0.722]), 'X=' + fmtV(d.X.strategy));

    /* --- 4 вар, шаг 4: симплекс-метод --- */
    const C4 = a.step3Matrix;
    const pathStr = p => p.map(o => `(${o.c + 1},${o.r + 1})`).join('→');
    const tableNear = (T, E, tol) => T.length === E.length && T.every((r, i) => vecNear(r, E[i], tol));
    check('4 вар, шаг 4: сдвиг 2 и 2,5 принимаются, 0, 1 и 1,5 — нет',
      S.shiftProblem(C4, 2) === null && S.shiftProblem(C4, 2.5) === null &&
      [0, 1, 1.5].every(k => S.shiftProblem(C4, k) !== null));
    const sx = S.solveSimplex(C4, 2);
    check('4 вар, шаг 4: сдвинутая матрица [[5,4,2],[5,0,3],[3,4,4]]',
      JSON.stringify(sx.A) === '[[5,4,2],[5,0,3],[3,4,4]]', JSON.stringify(sx.A));
    check('4 вар, шаг 4: стартовая W-таблица', JSON.stringify(S.simplexStartW(sx.A)) ===
      JSON.stringify([[5, 4, 2, 1, 0, 0, 1], [5, 0, 3, 0, 1, 0, 1], [3, 4, 4, 0, 0, 1, 1], [-1, -1, -1, 0, 0, 0, 0]]));
    check('4 вар, шаг 4: W-путь (столбец,строка) (1,1)→(3,2)→(2,3)', pathStr(sx.w.path) === '(1,1)→(3,2)→(2,3)', pathStr(sx.w.path));
    check('4 вар, шаг 4: W = (0,125; 0,03125; 0,125), ΣW = 0,28125',
      vecNear(sx.W, [0.125, 0.03125, 0.125], 1e-9) && near(sx.sumW, 0.28125, 1e-9), `W=${fmtV(sx.W)}`);
    check('4 вар, шаг 4: стартовая Z-таблица', JSON.stringify(S.simplexStartZ(sx.A)) ===
      JSON.stringify([[-5, -5, -3, 1, 0, 0, -1], [-4, 0, -4, 0, 1, 0, -1], [-2, -3, -4, 0, 0, 1, -1], [1, 1, 1, 0, 0, 0, 0]]));
    check('4 вар, шаг 4: Z-путь (1,1)→(2,3)→(3,2)', pathStr(sx.z.path) === '(1,1)→(2,3)→(3,2)', pathStr(sx.z.path));
    check('4 вар, шаг 4: итоговая Z-таблица совпадает со скриншотом (±0,0001)', tableNear(sx.z.T, [
      [1, 0, 0, -0.1875, -0.1719, 0.3125, 0.0469],
      [0, 0, 1, 0.1875, -0.0781, -0.3125, 0.2031],
      [0, 1, 0, -0.125, 0.2188, -0.125, 0.0313],
      [0, 0, 0, 0.125, 0.0312, 0.125, -0.2812]], 1.1e-4));
    check('4 вар, шаг 4: цена 1,556, Y и X совпадают с шагом 3',
      near(sx.value, d.value, 1e-9) && vecNear(sx.Y, d.Y.strategy, 1e-9) && vecNear(sx.X, d.X.strategy, 1e-9),
      `v=${fmt(sx.value)}, Y=${fmtV(sx.Y)}, X=${fmtV(sx.X)}`);
    check('4 вар, шаг 4: на скриншоте приняты 1,57; X1=0,168; X3=0,725 (допуск ±0,02)',
      near(1.57, sx.value, 0.02) && near(0.168, sx.X[0], 0.02) && near(0.725, sx.X[2], 0.02));

    /* --- 4 вар, шаг 5: Браун–Робинсон --- */
    const br = S.brownRobinson(C4, 0);
    const brRef = [
      { i: 0, B: [3, 2, 0], j: 2, A: [0, 1, 2], low: 0, high: 2, v: 1 },
      { i: 2, B: [4, 4, 2], j: 2, A: [0, 2, 4], low: 1, high: 2, v: 1.5 },
      { i: 2, B: [5, 6, 4], j: 2, A: [0, 3, 6], low: 1.333, high: 2, v: 1.667 },
    ];
    check('4 вар, шаг 5: первые 3 итерации совпадают со скриншотом',
      brRef.every((r, k) => {
        const x = br.rows[k];
        return x.i === r.i && x.j === r.j && vecNear(x.B, r.B, 1e-9) && vecNear(x.A, r.A, 1e-9) &&
          near(x.low, r.low, 0.001) && near(x.high, r.high, 0.001) && near(x.v, r.v, 0.001);
      }));
    const brShot = brRef.map((r, k) => (k === 2 ? { ...r, v: 1.665 } : r));
    check('4 вар, шаг 5: строки со скриншота (V=1,665) принимаются', S.checkBrownRows(C4, 0, brShot) === null);
    const brBad = brRef.map((r, k) => (k === 1 ? { ...r, B: [4, 5, 2] } : r));
    const bad1 = S.checkBrownRows(C4, 0, brBad);
    check('4 вар, шаг 5: ошибка в B2 второй строки находится', bad1 && bad1.row === 1 && bad1.field === 'B1', JSON.stringify(bad1));
    const Ct = [[0, 0, 1], [1, 0, 0], [0, 1, 0]];
    const tieRows = j1 => S.brownRobinson(Ct, 0, { prefix: [{ i: 0, j: j1 }], maxIter: 3, eps: -1 }).rows;
    check('Шаг 5: при ничьей в argmin принимается любой из равных, дальше — относительно выбора',
      [0, 1].every(j1 => S.checkBrownRows(Ct, 0, tieRows(j1)) === null) && S.checkBrownRows(Ct, 0, tieRows(2)) !== null);
    check(`4 вар, шаг 5: 200 итераций → V≈${fmt(br.value)} (LowV=${fmt(br.low)}, HighV=${fmt(br.high)})`,
      br.low <= d.value + 1e-9 && d.value <= br.high + 1e-9);

    /* --- 2×n --- */
    const g = S.solve2xN([[2, 3, 11], [7, 5, 2]]);
    check('2×n: [[2,3,11],[7,5,2]] → v=49/11, Sa=(3/11; 8/11), Sb=(0; 9/11; 2/11)',
      near(g.value, 49 / 11, 1e-9) && vecNear(g.sa, [3 / 11, 8 / 11], 1e-9) && vecNear(g.sb, [0, 9 / 11, 2 / 11], 1e-9),
      `v=${fmt(g.value)}, Sa=${fmtV(g.sa)}, Sb=${fmtV(g.sb)}`);
    const mp = S.solve2xN([[1, -1], [-1, 1]]);
    check('2×n: «орлянка» → v=0, (0,5; 0,5)', near(mp.value, 0, 1e-9) && vecNear(mp.sa, [0.5, 0.5], 1e-9),
      `v=${fmt(mp.value)}`);
    const sp = S.solve2xN([[3, 5], [1, 2]]);
    check('2×n: седловая точка [[3,5],[1,2]] → v=3, чистые стратегии',
      near(sp.value, 3, 1e-9) && vecNear(sp.sa, [1, 0], 1e-9) && vecNear(sp.sb, [1, 0], 1e-9), `v=${fmt(sp.value)}`);

    /* --- Случайные игры: сравнение с перебором по сетке + проверка равновесия --- */
    let rng = 12345;
    const rnd = () => { rng = (rng * 1103515245 + 12345) % 2147483648; return rng / 2147483648; };
    const ri = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
    let bad = 0, total = 0;
    for (let k = 0; k < 400; k++) {
      const m = ri(2, 6);
      const A = S.range(m).map(() => [ri(-8, 8), ri(-8, 8)]);
      const s = S.solveMx2(A);
      let brute = Infinity;
      for (let i = 0; i <= 10000; i++) {
        const x = i / 10000;
        brute = Math.min(brute, Math.max(...A.map(r => r[0] * (1 - x) + r[1] * x)));
      }
      total++;
      if (!near(s.value, brute, 2e-3) || !S.verifyEquilibrium(A, s.sa, s.sb, s.value).ok) bad++;

      const B = [S.range(m).map(() => ri(-8, 8)), S.range(m).map(() => ri(-8, 8))];
      const s2 = S.solve2xN(B);
      let brute2 = -Infinity;
      for (let i = 0; i <= 10000; i++) {
        const p = i / 10000;
        brute2 = Math.max(brute2, Math.min(...B[0].map((_, j) => B[0][j] * (1 - p) + B[1][j] * p)));
      }
      total++;
      if (!near(s2.value, brute2, 2e-3) || !S.verifyEquilibrium(B, s2.sa, s2.sb, s2.value).ok) bad++;
    }
    check('Случайные игры m×2 и 2×n (800 шт.): совпадение с перебором и равновесие', bad === 0,
      `ошибок: ${bad} из ${total}`);

    /* --- Все варианты --- */
    V.VARIANTS.forEach(n => {
      const r = V.analyzeVariant(n);
      check(`${n} вар: задача корректна на всех шагах`, r.problems.length === 0,
        r.problems.length ? r.problems.join('; ') :
          `шаг 1: v=${fmt(r.step1.value)}, опт. ${r.step1.optimal.map(i => i + 1).join(',')}; ` +
          `шаг 3: C=${JSON.stringify(r.step3Matrix)}, v=${fmt(r.step3.value)}`);

      // Решение 3×3, дополненное нулями, должно быть равновесием и в исходной игре 10×6.
      const M = r.variant.step2;
      const x = new Array(M.length).fill(0), y = new Array(M[0].length).fill(0);
      r.step2.rows.forEach((row, i) => { x[row] = r.step3.X.strategy[i]; });
      r.step2.cols.forEach((col, j) => { y[col] = r.step3.Y.strategy[j]; });
      const eq = S.verifyEquilibrium(M, x, y, r.step3.value);
      check(`${n} вар: решение 3×3 — равновесие исходной игры 10×6`, eq.ok, eq.problems.join('; '));

      // Шаг 4: обе стороны симплекс-метода дают то, что и шаг 3, при любом выборе среди равных.
      const C = r.step3Matrix, s3 = r.step3;
      let k0 = 0;
      while (S.shiftProblem(C, k0) !== null && k0 < 50) k0++;
      const sameAs3 = s => s.ok && near(s.value, s3.value, 1e-9) && vecNear(s.Y, s3.Y.strategy, 1e-9) && vecNear(s.X, s3.X.strategy, 1e-9);
      const s4 = S.solveSimplex(C, k0);
      const outW = S.allSimplexOutcomes(S.simplexStartW(s4.A), 'primal', C.length);
      const outZ = S.allSimplexOutcomes(S.simplexStartZ(s4.A), 'dual', C.length);
      const allSame = (outs, ref) => outs.every(o => o && vecNear(o, ref, 1e-9));
      check(`${n} вар, шаг 4: сдвиг ${k0}; W- и Z-стороны совпадают с шагом 3; путей при ничьих: ${outW.length} и ${outZ.length}`,
        sameAs3(s4) && allSame(outW, s4.W) && allSame(outZ, s4.Z) && sameAs3(S.solveSimplex(C, k0 + 1.5)),
        `v=${fmt(s4.value)}, Y=${fmtV(s4.Y)}, X=${fmtV(s4.X)}`);

      // Шаг 5: LowV <= v <= HighV на каждой итерации при любой стартовой строке.
      const inv = S.range(C.length).every(st => S.brownRobinson(C, st, { eps: -1 }).rows
        .every(row => row.low <= s3.value + 1e-9 && s3.value <= row.high + 1e-9));
      const b5 = S.brownRobinson(C, 0);
      check(`${n} вар, шаг 5: LowV ≤ v ≤ HighV на всех 200 итерациях; оценка V≈${fmt(b5.value)} при v=${fmt(s3.value)}`, inv);
    });

    return results;
  }

  const api = { run };
  if (isNode) module.exports = api;
  else root.GTSelfTest = api;
})(typeof window !== 'undefined' ? window : globalThis);
