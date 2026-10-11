/*
 * Решатели для тренажёра по теории игр.
 *  - графический метод для игр m×2 и 2×n;
 *  - сокращение матрицы доминированием (полный перебор порядков вычёркивания);
 *  - метод определителей (Крамер) для квадратной вполне смешанной игры.
 * Платёжная матрица A — выигрыши игрока A (строки, максимизирует),
 * игрок B выбирает столбцы и минимизирует.
 * Работает и в браузере (window.GTSolvers), и в Node (module.exports).
 */
(function (root) {
  'use strict';

  const EPS = 1e-9;

  // Убирает «шум» плавающей точки у почти целых чисел и -0.
  function clean(x) {
    const r = Math.round(x);
    if (Math.abs(x - r) < 1e-9) return r === 0 ? 0 : r;
    return x;
  }

  const range = n => Array.from({ length: n }, (_, i) => i);
  const sum = a => a.reduce((s, x) => s + x, 0);
  const transpose = M => M[0].map((_, j) => M.map(r => r[j]));
  const submatrix = (M, rows, cols) => rows.map(r => cols.map(c => M[r][c]));

  // Определитель методом Гаусса с выбором главного элемента.
  function det(M) {
    const n = M.length;
    const a = M.map(r => r.slice());
    let d = 1;
    for (let k = 0; k < n; k++) {
      let p = k;
      for (let i = k + 1; i < n; i++) if (Math.abs(a[i][k]) > Math.abs(a[p][k])) p = i;
      if (Math.abs(a[p][k]) < 1e-12) return 0;
      if (p !== k) { const t = a[p]; a[p] = a[k]; a[k] = t; d = -d; }
      d *= a[k][k];
      for (let i = k + 1; i < n; i++) {
        const f = a[i][k] / a[k][k];
        for (let j = k; j < n; j++) a[i][j] -= f * a[k][j];
      }
    }
    return clean(d);
  }

  function replaceColumn(M, j, value) {
    return M.map(r => r.map((x, k) => (k === j ? value : x)));
  }

  // Нижняя и верхняя цены игры в чистых стратегиях.
  function saddlePoint(A) {
    const lower = Math.max(...A.map(r => Math.min(...r)));
    const upper = Math.min(...A[0].map((_, j) => Math.max(...A.map(r => r[j]))));
    return { lower, upper, hasSaddle: Math.abs(lower - upper) < EPS };
  }

  // Независимая проверка: x, y — оптимальные смешанные стратегии, v — цена игры.
  // (A·y)_i <= v для всех строк и (x·A)_j >= v для всех столбцов.
  function verifyEquilibrium(A, x, y, v, tol = 1e-7) {
    const problems = [];
    const isProb = p => p.every(t => t >= -tol) && Math.abs(sum(p) - 1) < tol;
    if (x.length !== A.length || !isProb(x)) problems.push('x не является вероятностным вектором');
    if (y.length !== A[0].length || !isProb(y)) problems.push('y не является вероятностным вектором');
    A.forEach((row, i) => {
      const s = sum(row.map((a, j) => a * y[j]));
      if (s > v + tol) problems.push(`строка ${i + 1}: (A·y)=${s} > v=${v}`);
    });
    A[0].forEach((_, j) => {
      const s = sum(A.map((row, i) => row[j] * x[i]));
      if (s < v - tol) problems.push(`столбец ${j + 1}: (x·A)=${s} < v=${v}`);
    });
    return { ok: problems.length === 0, problems };
  }

  /* ---------- Графический метод ---------- */

  // Игра m×2. Прямая i: y = a_i1·(1−x) + a_i2·x, x — вероятность 2-го столбца у B.
  // B минимизирует верхнюю огибающую, A выбирает из прямых, проходящих через её минимум.
  function solveMx2(A) {
    const m = A.length;
    const slope = A.map(r => r[1] - r[0]);
    const val = (i, x) => A[i][0] + slope[i] * x;
    const envAt = x => Math.max(...range(m).map(i => val(i, x)));

    const xs = [0, 1];
    for (let i = 0; i < m; i++) {
      for (let j = i + 1; j < m; j++) {
        const ds = slope[i] - slope[j];
        if (Math.abs(ds) < EPS) continue;
        const x = (A[j][0] - A[i][0]) / ds;
        if (x > EPS && x < 1 - EPS) xs.push(x);
      }
    }
    xs.sort((a, b) => a - b);
    const bx = xs.filter((x, k) => k === 0 || x - xs[k - 1] > 1e-12);
    const envelope = bx.map(x => ({ x: clean(x), y: clean(envAt(x)) }));

    let best = envelope[0];
    for (const e of envelope) if (e.y < best.y - EPS) best = e;
    const v = best.y;
    const x = best.x;
    const flat = envelope.filter(e => Math.abs(e.y - v) < 1e-7).length > 1;
    const active = range(m).filter(i => Math.abs(val(i, x) - v) < 1e-7);

    const sa = new Array(m).fill(0);
    let degenerate = flat;
    if (x > EPS && x < 1 - EPS) {
      const neg = active.filter(i => slope[i] < -EPS);
      const pos = active.filter(i => slope[i] > EPS);
      const zero = active.filter(i => Math.abs(slope[i]) <= EPS);
      if (zero.length) {
        sa[zero[0]] = 1;
        degenerate = true;
      } else {
        const i = neg[0], j = pos[0];
        const d = slope[j] - slope[i];
        sa[i] = clean(slope[j] / d);
        sa[j] = clean(-slope[i] / d);
      }
      if (active.length > 2) degenerate = true;
    } else {
      // Минимум огибающей на краю — у B чистая стратегия (седловая точка).
      const ok = active.filter(i => (x <= EPS ? slope[i] >= -EPS : slope[i] <= EPS));
      const pick = ok.reduce((b, i) => (x <= EPS ? (slope[i] > slope[b] ? i : b) : (slope[i] < slope[b] ? i : b)), ok[0]);
      sa[pick] = 1;
      if (ok.length > 1) degenerate = true;
    }

    return {
      value: clean(v),
      x: clean(x),
      sb: [clean(1 - x), clean(x)],
      sa,
      optimal: range(m).filter(i => sa[i] > EPS), // индексы с 0
      active,
      envelope,
      degenerate,
      interior: x > EPS && x < 1 - EPS,
    };
  }

  // Игра 2×n сводится к m×2: игра −Aᵀ (игроки меняются ролями).
  function solve2xN(A) {
    const B = transpose(A).map(r => r.map(t => -t));
    const r = solveMx2(B);
    return {
      value: clean(-r.value),
      p: r.x, // вероятность 2-й строки у A
      sa: r.sb,
      sb: r.sa,
      optimal: r.optimal, // активные столбцы
      envelope: r.envelope.map(e => ({ x: e.x, y: clean(-e.y) })), // нижняя огибающая
      degenerate: r.degenerate,
      interior: r.interior,
    };
  }

  /* ---------- Доминирование ---------- */

  // Строка r доминируется, если она <= какой-то другой оставшейся строки поэлементно.
  function rowDominated(M, rows, cols, r) {
    return rows.some(r2 => r2 !== r && cols.every(c => M[r][c] <= M[r2][c] + EPS));
  }

  // Столбец c доминируется, если он >= какого-то другого оставшегося столбца.
  function colDominated(M, rows, cols, c) {
    return cols.some(c2 => c2 !== c && rows.every(r => M[r][c] >= M[r][c2] - EPS));
  }

  function removableLines(M, rows, cols) {
    return {
      rows: rows.filter(r => rowDominated(M, rows, cols, r)),
      cols: cols.filter(c => colDominated(M, rows, cols, c)),
    };
  }

  // Перебирает все возможные порядки вычёркивания и возвращает все
  // тупиковые состояния (где больше ничего вычеркнуть нельзя).
  function dominanceOutcomes(M) {
    const seen = new Set();
    const terminals = new Map();
    const stack = [{ rows: range(M.length), cols: range(M[0].length) }];
    while (stack.length) {
      const s = stack.pop();
      const key = s.rows.join(',') + '|' + s.cols.join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      const rem = removableLines(M, s.rows, s.cols);
      rem.rows.forEach(r => stack.push({ rows: s.rows.filter(t => t !== r), cols: s.cols }));
      rem.cols.forEach(c => stack.push({ rows: s.rows, cols: s.cols.filter(t => t !== c) }));
      if (!rem.rows.length && !rem.cols.length) terminals.set(key, s);
    }
    return { terminals: [...terminals.values()], states: seen.size };
  }

  // Один из возможных порядков вычёркивания (для демонстрации).
  function reduceGreedy(M) {
    let rows = range(M.length), cols = range(M[0].length);
    const steps = [];
    for (;;) {
      const rem = removableLines(M, rows, cols);
      if (rem.rows.length) {
        const r = rem.rows[0];
        const by = rows.find(r2 => r2 !== r && cols.every(c => M[r][c] <= M[r2][c] + EPS));
        steps.push(`строка ${r + 1} <= строки ${by + 1}`);
        rows = rows.filter(t => t !== r);
      } else if (rem.cols.length) {
        const c = rem.cols[0];
        const by = cols.find(c2 => c2 !== c && rows.every(r => M[r][c] >= M[r][c2] - EPS));
        steps.push(`столбец ${c + 1} >= столбца ${by + 1}`);
        cols = cols.filter(t => t !== c);
      } else break;
    }
    return { rows, cols, steps };
  }

  /* ---------- Метод определителей ---------- */

  // Заменяем j-й столбец на единицы: Cj. v = det C / Σ det Cj, y_j = det Cj / Σ det Cj.
  function determinantMethod(C) {
    const d = det(C);
    const dets = C[0].map((_, j) => det(replaceColumn(C, j, 1)));
    const s = clean(sum(dets));
    if (Math.abs(s) < EPS) return { det: d, dets, sum: s, ok: false };
    return { det: d, dets, sum: s, value: clean(d / s), strategy: dets.map(t => clean(t / s)), ok: true };
  }

  // Y — по первоначальной матрице (стратегия B), X — по транспонированной (стратегия A).
  function solveByDeterminants(C) {
    const Y = determinantMethod(C);
    const X = determinantMethod(transpose(C));
    const valid = Y.ok && X.ok &&
      Math.abs(Y.det) > EPS &&
      Y.strategy.every(t => t > EPS) && X.strategy.every(t => t > EPS) &&
      Math.abs(Y.value - X.value) < 1e-9;
    return { Y, X, value: Y.value, valid };
  }

  /* ---------- Симплекс-метод ---------- */

  const TIE = 1e-9;
  const tiny = x => (Math.abs(x) < 1e-12 ? 0 : x);
  const shiftMatrix = (C, k) => C.map(r => r.map(x => clean(x + k)));

  // Причина, по которой сдвиг k не подходит, или null.
  function shiftProblem(C, k) {
    if (!Number.isFinite(k)) return 'сдвиг должен быть числом';
    if (C.some(r => r.some(x => x + k < -EPS))) return 'после сдвига остались отрицательные элементы';
    const d = solveByDeterminants(C);
    if (!d.valid) return 'не удалось найти цену игры';
    if (d.value + k <= EPS) return 'цена сдвинутой игры не положительна';
    return null;
  }

  // Y-сторона: max Σw, A·w <= 1. Строки: [a_i1..a_in | e_i | 1], последняя строка -f(x).
  function simplexStartW(A) {
    const n = A.length;
    const T = A.map((r, i) => [...r, ...range(n).map(j => (j === i ? 1 : 0)), 1]);
    T.push([...range(n).map(() => -1), ...range(n).map(() => 0), 0]);
    return T;
  }

  // X-сторона: min Σz, Aᵀ·z >= 1, ограничения умножены на −1: [−a_1j..−a_nj | e_j | −1].
  function simplexStartZ(A) {
    const n = A.length;
    const T = range(n).map(j => [...range(n).map(i => clean(-A[i][j])), ...range(n).map(t => (t === j ? 1 : 0)), -1]);
    T.push([...range(n).map(() => 1), ...range(n).map(() => 0), 0]);
    return T;
  }

  // Пересчёт Жордана–Гаусса относительно элемента (r, c), индексы с 0.
  function pivotTable(T, r, c) {
    const p = T[r][c];
    const R = T[r].map(x => tiny(x / p));
    return T.map((row, i) => (i === r ? R : row.map((x, j) => tiny(x - row[c] * R[j]))));
  }

  // Прямой симплекс: столбец — самый отрицательный в -f(x), строка — минимум b/a по a > 0.
  function primalPivots(T) {
    const m = T.length - 1, last = T[0].length - 1, f = T[m];
    const minF = Math.min(...f.slice(0, last));
    if (minF > -TIE) return { done: true, options: [] };
    const options = [];
    range(last).filter(j => f[j] <= minF + TIE).forEach(c => {
      const rows = range(m).filter(i => T[i][c] > TIE);
      if (!rows.length) return;
      const ratios = rows.map(i => T[i][last] / T[i][c]);
      const minR = Math.min(...ratios);
      rows.forEach((i, k) => { if (ratios[k] <= minR + TIE) options.push({ c, r: i }); });
    });
    return { done: false, options };
  }

  // Двойственный симплекс: строка — самый отрицательный b, столбец — минимум f/|a| по a < 0.
  function dualPivots(T) {
    const m = T.length - 1, last = T[0].length - 1, f = T[m];
    const b = range(m).map(i => T[i][last]);
    const minB = Math.min(...b);
    if (minB > -TIE) return { done: true, options: [] };
    const options = [];
    range(m).filter(i => b[i] <= minB + TIE).forEach(r => {
      const cols = range(last).filter(j => T[r][j] < -TIE);
      if (!cols.length) return;
      const ratios = cols.map(j => f[j] / -T[r][j]);
      const minR = Math.min(...ratios);
      cols.forEach((j, k) => { if (ratios[k] <= minR + TIE) options.push({ c: j, r }); });
    });
    return { done: false, options };
  }

  const pivotOptions = (T, kind) => (kind === 'primal' ? primalPivots(T) : dualPivots(T));

  // Значения первых n переменных: свободный член строки, где в столбце стоит единица.
  function simplexBasic(T, n) {
    const m = T.length - 1, last = T[0].length - 1;
    return range(n).map(j => {
      const r = range(m).find(i => Math.abs(T[i][j] - 1) < 1e-9 &&
        range(m + 1).every(t => t === i || Math.abs(T[t][j]) < 1e-9));
      return r === undefined ? 0 : clean(T[r][last]);
    });
  }

  function runSimplex(T0, kind, pick = opts => opts[0]) {
    let T = T0;
    const path = [];
    for (let it = 0; it < 50; it++) {
      const ch = pivotOptions(T, kind);
      if (ch.done) return { T, path, ok: true };
      if (!ch.options.length) return { T, path, ok: false };
      const o = pick(ch.options);
      path.push(o);
      T = pivotTable(T, o.r, o.c);
    }
    return { T, path, ok: false };
  }

  // Все исходы при всех вариантах выбора среди равных (для самопроверки).
  function allSimplexOutcomes(T0, kind, n) {
    const out = [];
    (function dfs(T, depth) {
      if (out.length > 5000) return;
      const ch = pivotOptions(T, kind);
      if (ch.done) { out.push(simplexBasic(T, n)); return; }
      if (!ch.options.length || depth > 30) { out.push(null); return; }
      ch.options.forEach(o => dfs(pivotTable(T, o.r, o.c), depth + 1));
    })(T0, 0);
    return out;
  }

  function solveSimplex(C, k) {
    const n = C.length;
    const A = shiftMatrix(C, k);
    const w = runSimplex(simplexStartW(A), 'primal');
    const z = runSimplex(simplexStartZ(A), 'dual');
    const W = simplexBasic(w.T, n), Z = simplexBasic(z.T, n);
    const sumW = clean(sum(W)), sumZ = clean(sum(Z));
    return {
      A, k, w, z, W, Z, sumW, sumZ,
      value: clean(1 / sumW - k),
      Y: W.map(t => clean(t / sumW)),
      X: Z.map(t => clean(t / sumZ)),
      ok: w.ok && z.ok && sumW > EPS && sumZ > EPS,
    };
  }

  /* ---------- Метод Брауна–Робинсон ---------- */

  const argminAll = v => { const m = Math.min(...v); return range(v.length).filter(i => v[i] <= m + 1e-9); };
  const argmaxAll = v => { const m = Math.max(...v); return range(v.length).filter(i => v[i] >= m - 1e-9); };

  // B(k) = B(k−1) + строка i; j = argmin B; A(k) = A(k−1) + столбец j; следующее i = argmax A.
  // prefix — выборы (i, j) для первых итераций (выбор студента); дальше при ничьей берётся меньший индекс.
  function brownRobinson(C, start, { maxIter = 200, eps = 0.01, prefix = [] } = {}) {
    const n = C.length;
    let B = new Array(n).fill(0), A = new Array(n).fill(0), i = start;
    const rows = [];
    for (let k = 1; k <= maxIter; k++) {
      if (prefix[k - 1]) i = prefix[k - 1].i;
      B = B.map((x, t) => x + C[i][t]);
      const j = prefix[k - 1] ? prefix[k - 1].j : argminAll(B)[0];
      A = A.map((x, t) => x + C[t][j]);
      const low = Math.min(...B) / k, high = Math.max(...A) / k;
      rows.push({ k, i, B: B.slice(), j, A: A.slice(), low, high, v: (low + high) / 2 });
      if (high - low < eps) break;
      i = argmaxAll(A)[0];
    }
    const K = rows.length;
    const freqA = range(n).map(t => rows.filter(r => r.i === t).length / K);
    const freqB = range(n).map(t => rows.filter(r => r.j === t).length / K);
    return { rows, freqA, freqB, value: rows[K - 1].v, low: rows[K - 1].low, high: rows[K - 1].high };
  }

  // Проверка строк студента: первая неверная ячейка { row, field } или null.
  // field: 'i', 'B0'.., 'j', 'A0'.., 'low', 'high', 'v'. При ничьей принимается любой из равных индексов.
  function checkBrownRows(C, start, rows, tol = 0.01) {
    const n = C.length;
    const ok = (a, b) => Number.isFinite(a) && Math.abs(a - b) <= tol + 1e-9;
    let B = new Array(n).fill(0), A = new Array(n).fill(0), allowedI = [start];
    for (let row = 0; row < rows.length; row++) {
      const r = rows[row], k = row + 1;
      if (!allowedI.includes(r.i)) return { row, field: 'i' };
      B = B.map((x, t) => x + C[r.i][t]);
      for (let t = 0; t < n; t++) if (!ok(r.B[t], B[t])) return { row, field: 'B' + t };
      if (!argminAll(B).includes(r.j)) return { row, field: 'j' };
      A = A.map((x, t) => x + C[t][r.j]);
      for (let t = 0; t < n; t++) if (!ok(r.A[t], A[t])) return { row, field: 'A' + t };
      const low = Math.min(...B) / k, high = Math.max(...A) / k;
      if (!ok(r.low, low)) return { row, field: 'low' };
      if (!ok(r.high, high)) return { row, field: 'high' };
      if (!ok(r.v, (low + high) / 2)) return { row, field: 'v' };
      allowedI = argmaxAll(A);
    }
    return null;
  }

  const api = {
    EPS, clean, range, sum, transpose, submatrix, det, replaceColumn, saddlePoint,
    verifyEquilibrium, solveMx2, solve2xN, rowDominated, colDominated, removableLines,
    dominanceOutcomes, reduceGreedy, determinantMethod, solveByDeterminants,
    shiftMatrix, shiftProblem, simplexStartW, simplexStartZ, pivotTable, primalPivots, dualPivots,
    pivotOptions, simplexBasic, runSimplex, allSimplexOutcomes, solveSimplex,
    argminAll, argmaxAll, brownRobinson, checkBrownRows,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GTSolvers = api;
})(typeof window !== 'undefined' ? window : globalThis);
