/*
 * Варианты заданий. «4 вар» — данные со скриншотов, остальные генерируются
 * детерминированно (seed = номер варианта) и проверяются решателями.
 */
(function (root) {
  'use strict';

  const S = (typeof module === 'object' && module.exports) ? require('./solvers.js') : root.GTSolvers;

  const FIXED = {
    4: {
      step1: [[-2, 0], [1, -1], [3, 0], [1, 2], [-2, -5]],
      step2: [
        [1, -1, 6, -6, -5, -4],
        [2, 4, 3, 1, -3, -2],
        [3, 3, 4, 2, 0, 4],
        [0, 4, -3, -2, -7, 0],
        [-3, 7, 7, -5, -6, 7],
        [3, 8, 7, -2, 1, 3],
        [0, 5, 0, 0, 0, 5],
        [2, 1, 3, 1, -6, 3],
        [1, 5, 1, 2, 2, 2],
        [2, 3, 2.6, 1.9, -1, 2],
      ],
    },
  };

  const VARIANTS = [1, 2, 3, 4, 5];
  const STEP1_ROWS = 5;
  const STEP2_ROWS = 10;
  const STEP2_COLS = 6;
  const CORE = 3;
  const NICE_DENOMINATORS = [2, 4, 5, 8, 10]; // ответы шага 1 — конечные десятичные дроби

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
  function sample(rng, n, k) {
    const a = S.range(n);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, k).sort((x, y) => x - y);
  }

  /* ---------- Шаг 1: игра m×2 ---------- */

  // Проблемы матрицы шага 1 (пустой список — задача корректна).
  function step1Problems(A) {
    const p = [];
    if (A.some(r => r.some(t => !Number.isInteger(t) || t < -8 || t > 8))) p.push('значения вне целых [-8; 8]');
    if (new Set(A.map(r => r.join(','))).size !== A.length) p.push('есть одинаковые строки');
    const s = S.solveMx2(A);
    if (s.degenerate) p.push('вырожденный случай: решение не единственно');
    if (!s.interior) p.push('есть седловая точка (минимум огибающей на краю)');
    if (s.optimal.length !== 2) p.push('число оптимальных стратегий не 2');
    if (!S.verifyEquilibrium(A, s.sa, s.sb, s.value).ok) p.push('решение не прошло проверку равновесия');
    return p;
  }

  function genStep1(rng) {
    for (let attempt = 0; attempt < 100000; attempt++) {
      const A = S.range(STEP1_ROWS).map(() => [randInt(rng, -6, 6), randInt(rng, -6, 6)]);
      if (step1Problems(A).length) continue;
      const s = S.solveMx2(A);
      if (s.x < 0.2 || s.x > 0.8) continue;
      const [i, j] = s.optimal;
      const denom = Math.abs((A[i][1] - A[i][0]) - (A[j][1] - A[j][0]));
      if (!NICE_DENOMINATORS.includes(denom)) continue;
      // Неактивные прямые заметно ниже минимума огибающей — график читается.
      const clear = A.every((r, k) => s.optimal.includes(k) || r[0] + (r[1] - r[0]) * s.x <= s.value - 0.5);
      if (!clear) continue;
      return A;
    }
    throw new Error('Не удалось сгенерировать матрицу шага 1');
  }

  /* ---------- Шаги 2–3: матрица 10×6, сокращаемая до 3×3 ---------- */

  function step3Problems(C) {
    const p = [];
    if (S.saddlePoint(C).hasSaddle) p.push('у 3×3 есть седловая точка');
    const d = S.solveByDeterminants(C);
    if (!d.valid) p.push('метод определителей неприменим (нулевой det/сумма или неположительные вероятности)');
    else {
      const eq = S.verifyEquilibrium(C, d.X.strategy, d.Y.strategy, d.value);
      if (!eq.ok) p.push('решение методом определителей не прошло проверку: ' + eq.problems.join('; '));
    }
    return p;
  }

  function step2Problems(M) {
    const p = [];
    const out = S.dominanceOutcomes(M);
    if (out.terminals.length !== 1) p.push(`результат сокращения зависит от порядка (${out.terminals.length} тупиков)`);
    const t = out.terminals[0];
    if (t.rows.length !== CORE || t.cols.length !== CORE) p.push(`сокращается до ${t.rows.length}×${t.cols.length}, а не до 3×3`);
    return { problems: p, terminal: t };
  }

  function genCore(rng) {
    for (;;) {
      const C = S.range(CORE).map(() => S.range(CORE).map(() => randInt(rng, -3, 5)));
      if (step3Problems(C).length) continue;
      const all = S.range(CORE);
      const rem = S.removableLines(C, all, all);
      if (rem.rows.length || rem.cols.length) continue;
      return C;
    }
  }

  function genStep2(rng) {
    for (let attempt = 0; attempt < 20000; attempt++) {
      const C = genCore(rng);
      const coreRows = sample(rng, STEP2_ROWS, CORE);
      const coreCols = sample(rng, STEP2_COLS, CORE);
      const extraRows = S.range(STEP2_ROWS).filter(r => !coreRows.includes(r));
      const extraCols = S.range(STEP2_COLS).filter(c => !coreCols.includes(c));
      const M = S.range(STEP2_ROWS).map(() => new Array(STEP2_COLS).fill(0));
      coreRows.forEach((r, i) => coreCols.forEach((c, j) => { M[r][c] = C[i][j]; }));

      // Лишний столбец >= одного из столбцов ядра (по всем строкам).
      const colSource = {};
      extraCols.forEach(k => {
        const c = pick(rng, coreCols);
        colSource[k] = c;
        const offs = coreRows.map(() => randInt(rng, 0, 3));
        if (offs.every(o => o === 0)) offs[0] = 1;
        coreRows.forEach((r, i) => { M[r][k] = M[r][c] + offs[i]; });
      });
      // Лишняя строка <= одной из строк ядра на столбцах ядра; одна строка — с дробными числами.
      const decimalRow = rng() < 0.7 ? pick(rng, extraRows) : -1;
      extraRows.forEach(r => {
        const d = pick(rng, coreRows);
        const offs = coreCols.map(() => (r === decimalRow ? pick(rng, [0, 0.4, 1, 1.1, 2.5]) : randInt(rng, 0, 3)));
        if (offs.every(o => o === 0)) offs[0] = 1;
        coreCols.forEach((c, j) => { M[r][c] = Math.round((M[d][c] - offs[j]) * 10) / 10; });
        extraCols.forEach(k => { M[r][k] = Math.round((M[r][colSource[k]] + randInt(rng, 0, 2)) * 10) / 10; });
      });

      if (M.some(row => row.some(t => t < -9 || t > 9))) continue;
      const { problems, terminal } = step2Problems(M);
      if (problems.length) continue;
      if (terminal.rows.join() !== coreRows.join() || terminal.cols.join() !== coreCols.join()) continue;
      return M;
    }
    throw new Error('Не удалось сгенерировать матрицу шага 2');
  }

  /* ---------- Варианты ---------- */

  const cache = {};

  function getVariant(n) {
    if (cache[n]) return cache[n];
    let v;
    if (FIXED[n]) v = { n, step1: FIXED[n].step1, step2: FIXED[n].step2 };
    else {
      const rng = mulberry32(20261012 + n * 7919);
      v = { n, step1: genStep1(rng), step2: genStep2(rng) };
    }
    cache[n] = v;
    return v;
  }

  // Полное решение варианта решателями + список найденных проблем.
  function analyzeVariant(n) {
    const v = getVariant(n);
    const problems = [];
    step1Problems(v.step1).forEach(p => problems.push('Шаг 1: ' + p));
    const s1 = S.solveMx2(v.step1);

    const s2 = step2Problems(v.step2);
    s2.problems.forEach(p => problems.push('Шаг 2: ' + p));
    const C = S.submatrix(v.step2, s2.terminal.rows, s2.terminal.cols);

    step3Problems(C).forEach(p => problems.push('Шаг 3: ' + p));
    const s3 = S.solveByDeterminants(C);

    return { variant: v, step1: s1, step2: s2.terminal, step3Matrix: C, step3: s3, problems };
  }

  const api = { VARIANTS, FIXED, getVariant, analyzeVariant, step1Problems, step2Problems, step3Problems };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GTVariants = api;
})(typeof window !== 'undefined' ? window : globalThis);
