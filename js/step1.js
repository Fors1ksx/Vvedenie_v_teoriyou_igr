/*
 * Шаг 1. Графический метод для игры m×2: построение прямых и выбор оптимальных стратегий.
 */
(function (root) {
  'use strict';

  const UI = root.GTUI;
  const { el, svg } = UI;

  // Геометрия графика (единицы viewBox).
  const G = { X0: 80, X1: 480, Y0: 300, K: 33, AX: 40, STRIP_X: 532, STRIP_W: 26, W: 572, H: 600, VMAX: 8 };
  const yOf = v => G.Y0 - v * G.K;
  const xOf = t => G.X0 + t * (G.X1 - G.X0);
  const snap = y => Math.max(-G.VMAX, Math.min(G.VMAX, Math.round((G.Y0 - y) / G.K)));
  const label = v => String(v).replace('-', '−');

  function buildGraphBase(s) {
    const top = yOf(G.VMAX) - 20, bottom = yOf(-G.VMAX) + 20;
    s.append(svg('rect', { x: G.X0 - G.AX, y: top, width: G.X1 - G.X0 + 2 * G.AX, height: bottom - top, fill: '#fff' }));

    const grid = svg('g', { stroke: '#8a8a8a', 'stroke-width': 1 });
    for (let k = 1; k < 10; k++) grid.append(svg('line', { x1: xOf(k / 10), x2: xOf(k / 10), y1: top, y2: bottom }));
    for (let v = -G.VMAX; v <= G.VMAX; v++) if (v) grid.append(svg('line', { x1: G.X0, x2: G.X1, y1: yOf(v), y2: yOf(v) }));
    s.append(grid);

    const axes = svg('g', { stroke: '#000', 'stroke-width': 3 });
    [G.X0 - G.AX, G.X0, G.X1, G.X1 + G.AX].forEach(x => axes.append(svg('line', { x1: x, x2: x, y1: top, y2: bottom })));
    axes.append(svg('line', { x1: G.X0 - G.AX, x2: G.X1 + G.AX, y1: G.Y0, y2: G.Y0 }));
    s.append(axes);

    const labels = svg('g', { 'font-size': 17, 'font-family': 'Arial, sans-serif', 'text-anchor': 'middle', fill: '#000' });
    for (let v = -G.VMAX; v <= G.VMAX; v++) {
      labels.append(svg('text', { x: G.X0 - G.AX / 2, y: yOf(v) + 6 }, label(v)));
      labels.append(svg('text', { x: G.X1 + G.AX / 2, y: yOf(v) + 6 }, label(v)));
    }
    labels.append(svg('text', { x: G.X0 + 9, y: G.Y0 + 21 }, '0'));
    labels.append(svg('text', { x: xOf(0.5), y: G.Y0 + 21 }, '0,5'));
    labels.append(svg('text', { x: G.X1 - 9, y: G.Y0 + 21 }, '1'));
    s.append(labels);
  }

  function open(ctx) {
    const A = ctx.analysis.variant.step1;
    const sol = ctx.analysis.step1;
    const m = A.length;
    const drawn = new Set();
    let passed = false;
    let busy = false;

    const win = UI.createWindow({ title: 'Построение графика и выбор оптимальных стратегий', onClose: ctx.close, className: 'win-step1' });

    /* --- Левая часть: матрица и поля ответа --- */
    const numCells = [];
    const stratRows = A.map((row, i) => {
      const num = el('span', { class: 's1-rownum', title: 'Прямая не построена' }, String(i + 1));
      numCells.push(num);
      return el('div', { class: 's1-row' }, num,
        el('input', { class: 'inp w36', value: UI.fmtNum(row[0]), readonly: true, tabindex: -1, 'aria-label': `a${i + 1}1` }),
        el('input', { class: 'inp w36', value: UI.fmtNum(row[1]), readonly: true, tabindex: -1, 'aria-label': `a${i + 1}2` }));
    });

    const inpCount = el('input', { class: 'inp w36', 'aria-label': 'Число оптимальных стратегий' });
    const numsBox = el('div', { class: 's1-nums' });
    let numInputs = [];
    inpCount.addEventListener('input', () => {
      const n = Number(String(inpCount.value).trim());
      const want = Number.isInteger(n) && n >= 1 && n <= m ? n : 0;
      while (numInputs.length < want) {
        const i = el('input', { class: 'inp w36', 'aria-label': 'Номер оптимальной стратегии ' + (numInputs.length + 1) });
        numInputs.push(i);
        numsBox.append(i);
      }
      while (numInputs.length > want) numInputs.pop().remove();
    });

    const inpPrice = el('input', { class: 'inp w52', 'aria-label': 'Цена игры' });
    const inpSb = [0, 1].map(j => el('input', { class: 'inp w60', 'aria-label': `Sb* ${j + 1}` }));
    const inpSa = A.map((_, i) => el('input', { class: 'inp w60', 'aria-label': `Sa* ${i + 1}` }));
    const msg = el('div', { class: 'msg', role: 'status' });
    const btnCheck = el('button', { class: 'btn', type: 'button', onclick: () => check() }, 'Проверка');
    const btnFinish = el('button', { class: 'btn', type: 'button', onclick: () => finish() }, 'Завершить задание');

    const left = el('div', { class: 's1-left' },
      el('div', { class: 's1-strats' },
        el('div', { class: 's1-strats-label' }, 'Номера стратегий'),
        el('div', { class: 's1-strats-rows' }, stratRows)),
      el('div', { class: 's1-field' }, el('label', null, 'Число оптимальных стратегий'), inpCount),
      el('div', { class: 's1-field s1-field-top' }, el('label', null, 'Номера оптимальных стратегий:'), numsBox),
      el('div', { class: 's1-spacer' }),
      el('div', { class: 's1-field s1-price' }, el('label', null, 'Цена игры ='), inpPrice),
      el('div', { class: 's1-field s1-sb' }, el('label', { class: 's1-big' }, 'Sb*='), inpSb,
        el('button', { class: 'btn', type: 'button', onclick: UI.openCalculator }, 'Калькулятор')),
      el('div', { class: 's1-field s1-sa' }, el('label', { class: 's1-big' }, 'Sa*='), inpSa),
      el('div', { class: 's1-actions' }, btnCheck, btnFinish),
      msg);

    /* --- Правая часть: график --- */
    const s = svg('svg', { class: 's1-graph', viewBox: `0 0 ${G.W} ${G.H}`, width: G.W, height: G.H, role: 'img', 'aria-label': 'График' });
    buildGraphBase(s);
    const gLines = svg('g');
    const gResult = svg('g');
    const gPreview = svg('g', { 'pointer-events': 'none' });
    const gHover = svg('g', { 'pointer-events': 'none' });
    const strip = svg('rect', {
      class: 's1-strip', x: G.STRIP_X, y: yOf(G.VMAX) - 12, width: G.STRIP_W, height: 2 * G.VMAX * G.K + 24,
      fill: '#a6dcf7', stroke: '#5aa7d4',
    }, svg('title', null, 'Нажмите на уровне a_i1 и протяните до a_i2'));
    s.append(gLines, gResult, strip, gPreview, gHover);

    const right = el('div', { class: 's1-right' }, s,
      el('div', { class: 's1-hint' }, 'Нажмите на голубой полосе на уровне a', el('sub', null, 'i1'),
        ' и протяните до a', el('sub', null, 'i2'), ' — построится отрезок от (0; a', el('sub', null, 'i1'), ') до (1; a', el('sub', null, 'i2'), ').'));

    win.body.append(el('div', { class: 's1-layout' }, left, right));

    function svgY(evt) {
      const pt = s.createSVGPoint();
      pt.x = evt.clientX;
      pt.y = evt.clientY;
      return pt.matrixTransform(s.getScreenCTM().inverse()).y;
    }

    function drawPreview(a1, a2) {
      gPreview.replaceChildren(
        svg('line', { x1: G.X0, y1: yOf(a1), x2: G.X1, y2: yOf(a2), stroke: '#1a4f9c', 'stroke-width': 2, 'stroke-dasharray': '7 5' }),
        svg('circle', { cx: G.X0, cy: yOf(a1), r: 4.5, fill: '#1a4f9c' }),
        svg('circle', { cx: G.X1, cy: yOf(a2), r: 4.5, fill: '#1a4f9c' }),
        svg('rect', { x: G.X0 + 4, y: yOf(G.VMAX) - 17, width: 150, height: 22, fill: '#fffbe0', stroke: '#b9a94a' }),
        svg('text', { x: G.X0 + 10, y: yOf(G.VMAX) - 1, 'font-size': 15, 'font-family': 'Arial, sans-serif' },
          `(0; ${label(a1)}) → (1; ${label(a2)})`));
    }

    function showHover(v) {
      gHover.replaceChildren(
        svg('line', { x1: G.STRIP_X - 4, x2: G.STRIP_X + G.STRIP_W + 4, y1: yOf(v), y2: yOf(v), stroke: '#0b3d7a', 'stroke-width': 2 }));
    }

    let drag = null;
    strip.addEventListener('pointerdown', e => {
      if (busy || passed || drawn.size === m) return;
      e.preventDefault();
      strip.setPointerCapture(e.pointerId);
      const v = snap(svgY(e));
      drag = { a1: v, a2: v };
      drawPreview(v, v);
    });
    strip.addEventListener('pointermove', e => {
      const v = snap(svgY(e));
      showHover(v);
      if (drag && v !== drag.a2) { drag.a2 = v; drawPreview(drag.a1, v); }
    });
    strip.addEventListener('pointerleave', () => { if (!drag) gHover.replaceChildren(); });
    strip.addEventListener('pointercancel', () => { drag = null; gPreview.replaceChildren(); });
    strip.addEventListener('pointerup', async () => {
      if (!drag) return;
      const seg = drag;
      drag = null;
      busy = true;
      try {
        await onSegment(seg.a1, seg.a2);
      } finally {
        busy = false;
        gPreview.replaceChildren();
        gHover.replaceChildren();
      }
    });

    async function onSegment(a1, a2) {
      const ans = await UI.promptBox(`Отрезок от (0; ${UI.fmtNum(a1)}) до (1; ${UI.fmtNum(a2)}).\nВведите номер стратегии:`,
        { title: 'Номер стратегии' });
      if (ans === null) return;
      const t = ans.trim();
      if (!/^\d+$/.test(t)) {
        await UI.msgBox('Введите номер стратегии целым числом.');
        return;
      }
      const k = Number(t);
      if (k < 1 || k > m) {
        ctx.addError();
        await UI.msgBox(`Стратегии с номером ${k} нет.`, { kind: 'error', title: 'Ошибка' });
        return;
      }
      const row = A[k - 1];
      if (row[0] !== a1 || row[1] !== a2) {
        ctx.addError();
        const any = A.some(r => r[0] === a1 && r[1] === a2);
        await UI.msgBox(any ? `Отрезок не соответствует стратегии ${k}.` : 'Отрезок не соответствует ни одной строке матрицы.',
          { kind: 'error', title: 'Ошибка' });
        return;
      }
      if (drawn.has(k)) {
        await UI.msgBox(`Прямая для стратегии ${k} уже построена.`);
        return;
      }
      drawn.add(k);
      drawLine(k);
      if (drawn.size === m) showEnvelope();
    }

    function drawLine(k) {
      const [a1, a2] = A[k - 1];
      const t = m > 1 ? 0.1 + 0.75 * (k - 1) / (m - 1) : 0.5;
      gLines.append(
        svg('line', { x1: G.X0, y1: yOf(a1), x2: G.X1, y2: yOf(a2), stroke: '#000', 'stroke-width': 1.8 }),
        svg('text', {
          x: xOf(t), y: yOf(a1 + (a2 - a1) * t) - 5, 'font-size': 13, 'font-family': 'Arial, sans-serif',
          'text-anchor': 'middle', fill: '#1a4f9c', stroke: '#fff', 'stroke-width': 3, 'paint-order': 'stroke',
        }, String(k)));
      numCells[k - 1].classList.add('drawn');
      numCells[k - 1].title = 'Прямая построена';
    }

    function showEnvelope() {
      const pts = sol.envelope.map(p => `${xOf(p.x)},${yOf(p.y)}`).join(' ');
      const xm = xOf(sol.x), ym = yOf(sol.value);
      gResult.append(
        svg('line', { x1: G.X0, x2: G.X1, y1: ym, y2: ym, stroke: '#e0262b', 'stroke-width': 1.4 }),
        svg('polyline', { points: pts, fill: 'none', stroke: '#e0262b', 'stroke-width': 3.2, 'stroke-linejoin': 'round' }),
        svg('line', { x1: xm, x2: xm, y1: ym, y2: G.Y0, stroke: '#e0262b', 'stroke-width': 2 }),
        svg('circle', { cx: xm, cy: ym, r: 5, fill: '#e0262b' }));
      setMsg('Все прямые построены. Верхняя огибающая и её минимум выделены красным.', '');
    }

    function setMsg(text, kind) {
      msg.textContent = text;
      msg.className = 'msg' + (kind ? ' ' + kind : '');
    }

    async function check() {
      if (drawn.size < m) {
        await UI.msgBox('Сначала постройте прямые для всех стратегий.');
        return;
      }
      const wrong = [];
      const optimal = sol.optimal.map(i => i + 1);

      const cnt = UI.parseNum(inpCount.value);
      if (cnt !== optimal.length) wrong.push(inpCount);

      const nums = numInputs.map(i => UI.parseNum(i.value));
      const numsOk = nums.length === optimal.length &&
        [...nums].sort((a, b) => a - b).every((v, i) => v === optimal[i]);
      if (!numsOk) wrong.push(...(numInputs.length ? numInputs : [inpCount]));

      if (!UI.near(UI.parseNum(inpPrice.value), sol.value)) wrong.push(inpPrice);
      inpSb.forEach((inp, j) => { if (!UI.near(UI.parseNum(inp.value), sol.sb[j])) wrong.push(inp); });
      inpSa.forEach((inp, i) => { if (!UI.near(UI.parseNum(inp.value), sol.sa[i])) wrong.push(inp); });

      if (wrong.length) {
        wrong.forEach(i => i.classList.add('wrong'));
        ctx.addError();
        setMsg('Ответ неверный. Ошибочные поля выделены.', 'err');
        return;
      }
      passed = true;
      [inpCount, ...numInputs, inpPrice, ...inpSb, ...inpSa].forEach(i => { i.readOnly = true; });
      btnCheck.disabled = true;
      setMsg('Задание выполнено верно!', 'ok');
    }

    async function finish() {
      if (!passed) {
        await UI.msgBox('Сначала нажмите «Проверка» и получите верный результат.');
        return;
      }
      ctx.complete();
    }

    return win;
  }

  root.GTSteps = root.GTSteps || {};
  root.GTSteps[1] = { open };
})(window);
