/*
 * Шаг 4. Симплекс-метод: Y через прямой симплекс (w), X через двойственный (Z).
 */
(function (root) {
  'use strict';

  const UI = root.GTUI;
  const S = root.GTSolvers;
  const { el } = UI;

  const TOL = 0.02;
  const MATRIX_OPTIONS = [['', '— выберите —'], ['orig', 'Первоначальная'], ['trans', 'Транспонированная']];

  function open(ctx) {
    const d2 = ctx.stepData(2);
    const C = d2 ? S.submatrix(ctx.analysis.variant.step2, d2.rows, d2.cols) : ctx.analysis.step3Matrix;
    const n = C.length;
    const cols = 2 * n + 1; // переменные 1..2n и свободный член
    let shift = null; // принятый сдвиг k
    let A = null; // сдвинутая матрица
    const passed = { Y: false, X: false, price: false };
    const tbl = { side: null, phase: 'empty', T: null, expected: null, pick: null }; // phase: empty | entered | verified

    const win = UI.createWindow({ title: 'Симплекс-метод', onClose: ctx.close, className: 'win-step4' });
    const kindOf = side => (side === 'Y' ? 'primal' : 'dual');
    const varName = side => (side === 'Y' ? 'w' : 'Z');

    /* ---------- Верх: матрица и сдвиг ---------- */

    const topCells = C.map((row, i) => row.map((x, j) =>
      el('input', { class: 'inp s4-mcell', value: UI.fmtNum(x), readonly: true, tabindex: -1, 'aria-label': `[${i + 1},${j + 1}]` })));
    const inpShift = el('input', { class: 'inp w36', 'aria-label': 'Увеличить на' });
    const btnShift = el('button', { class: 'btn', type: 'button', onclick: () => doShift() }, 'Увеличить на...');

    async function doShift() {
      const k = UI.parseNum(inpShift.value);
      if (Number.isNaN(k)) {
        await UI.msgBox('Введите число, на которое нужно увеличить все элементы матрицы.');
        return;
      }
      const why = S.shiftProblem(C, k);
      if (why) {
        ctx.addError();
        inpShift.classList.add('wrong');
        await UI.msgBox(`Сдвиг ${UI.fmtNum(k)} не подходит: ${why}.`, { kind: 'error', title: 'Ошибка' });
        return;
      }
      shift = k;
      A = S.shiftMatrix(C, k);
      A.forEach((row, i) => row.forEach((x, j) => { topCells[i][j].value = UI.fmtNum(x); }));
      btnShift.disabled = true;
      inpShift.readOnly = true;
      halves.forEach(h => { h.select.disabled = false; });
    }

    /* ---------- Половины ---------- */

    const coefInput = label => el('input', { class: 'inp w36', readonly: true, tabindex: -1, 'aria-label': label });

    function buildHalf(cfg) {
      const select = el('select', { class: 'inp s4-select', disabled: true, 'aria-label': 'Матрица для ' + cfg.key },
        MATRIX_OPTIONS.map(([v, t]) => el('option', { value: v }, t)));
      const v = varName(cfg.key);

      // Строки неравенств и уравнений: groups[g][i][j] — поле коэффициента.
      const groups = cfg.groups.map(g => S.range(n).map(i => S.range(n).map(j => coefInput(`${g.prefix}${j + 1}, строка ${i + 1}`))));
      const groupEls = cfg.groups.map((g, gi) => el('div', { class: 's4-group' },
        S.range(n).map(i => el('div', { class: 's4-eq' },
          S.range(n).map(j => [j ? ` +${g.prefix}${j + 1}*` : `${g.prefix}${j + 1}*`, groups[gi][i][j]]),
          ' ' + g.tail(i)))));

      const obj = S.range(n).map(j => el('input', { class: 'inp w36', 'aria-label': `Коэффициент целевой функции ${cfg.key} ${j + 1}` }));
      const objRow = el('div', { class: 's4-eq s4-obj' }, cfg.objLabel + ' (',
        S.range(n).map(j => [obj[j], `*${v.toLowerCase()}${j + 1}`, j < n - 1 ? ' + ' : '']), ')');
      const btnTransfer = el('button', { class: 'btn', type: 'button', onclick: () => transfer() }, 'Перенести значения в симплекс-таблицу');

      select.addEventListener('change', async () => {
        if (!select.value) return;
        if (select.value !== cfg.correct) {
          select.value = '';
          ctx.addError();
          await UI.msgBox('Неверный выбор матрицы.', { kind: 'error', title: 'Ошибка' });
          return;
        }
        const M = cfg.correct === 'orig' ? A : S.transpose(A);
        cfg.groups.forEach((g, gi) => M.forEach((row, i) => row.forEach((x, j) => { groups[gi][i][j].value = UI.fmtNum(g.sign * x); })));
        select.disabled = true;
      });

      async function transfer() {
        if (shift === null) { await UI.msgBox('Сначала увеличьте элементы матрицы («Увеличить на...»).'); return; }
        if (select.value !== cfg.correct) { await UI.msgBox('Сначала выберите матрицу.'); return; }
        if (passed[cfg.key]) { await UI.msgBox('Эта часть уже выполнена.'); return; }
        if (tbl.side && tbl.side !== cfg.key && tbl.phase !== 'empty' && !passed[tbl.side]) {
          await UI.msgBox('В симплекс-таблице идёт решение другой части. Закончите его или нажмите «Очистить таблицу».');
          return;
        }
        const wrong = obj.filter(inp => !UI.near(UI.parseNum(inp.value), cfg.objCoef, 1e-9));
        if (wrong.length) {
          wrong.forEach(i => i.classList.add('wrong'));
          ctx.addError();
          await UI.msgBox('Неверные коэффициенты целевой функции.', { kind: 'error', title: 'Ошибка' });
          return;
        }
        obj.forEach(i => { i.readOnly = true; });
        loadTable(cfg.key);
      }

      const node = el('div', { class: 's4-half s4-half-' + cfg.key }, groupEls, objRow, el('div', { class: 's4-transfer' }, btnTransfer));
      return { key: cfg.key, select, node };
    }

    const halfY = buildHalf({
      key: 'Y', correct: 'orig', objCoef: -1, objLabel: 'max(L)=0 -',
      groups: [
        { prefix: 'Y', sign: 1, tail: () => '<=цена игры' },
        { prefix: 'w', sign: 1, tail: i => `+ w${n + i + 1}=1` },
      ],
    });
    const halfX = buildHalf({
      key: 'X', correct: 'trans', objCoef: 1, objLabel: 'max(-L)=0-',
      groups: [
        { prefix: 'X', sign: 1, tail: () => '>=цена игры' },
        { prefix: 'Z', sign: 1, tail: i => `−Z${n + i + 1}=1` },
        { prefix: 'Z', sign: -1, tail: i => `+Z${n + i + 1}=−1` },
      ],
    });
    const halves = [halfY, halfX];

    /* ---------- Симплекс-таблица ---------- */

    const headCells = S.range(cols).map(j => el('th', null, j < 2 * n ? `Z${j + 1}` : 'Св. член'));
    const cells = S.range(n + 1).map(i => S.range(cols).map(j =>
      el('input', { class: 'inp s4-tcell', 'aria-label': `Таблица, ${i < n ? 'строка ' + (i + 1) : '-f(x)'}, ${j < 2 * n ? 'столбец ' + (j + 1) : 'св. член'}` })));
    const tableEl = el('table', { class: 's4-table' },
      el('tr', null, el('th'), headCells),
      cells.map((row, i) => el('tr', null, el('th', { class: 's4-rowlabel' }, i < n ? '' : '-f(x)'), row.map(c => el('td', null, c)))));

    const isTransferred = (i, j) => i < n && (j < n || j === 2 * n);

    function loadTable(side) {
      tbl.side = side;
      tbl.phase = 'entered';
      tbl.pick = null;
      tbl.T = null;
      tbl.expected = side === 'Y' ? S.simplexStartW(A) : S.simplexStartZ(A);
      headCells.forEach((h, j) => { if (j < 2 * n) h.textContent = varName(side) + (j + 1); });
      cells.forEach((row, i) => row.forEach((c, j) => {
        c.classList.remove('wrong', 'pivot');
        c.readOnly = isTransferred(i, j);
        c.value = isTransferred(i, j) ? UI.fmtNum(tbl.expected[i][j]) : '';
      }));
      resetPick();
      setTableMsg('', '');
      refreshButtons();
    }

    function showT() {
      cells.forEach((row, i) => row.forEach((c, j) => {
        c.readOnly = true;
        c.classList.remove('wrong', 'pivot');
        c.value = UI.fmtNum(tbl.T[i][j], 4);
      }));
    }

    function clearTable() {
      tbl.side = null;
      tbl.phase = 'empty';
      tbl.T = null;
      tbl.expected = null;
      tbl.pick = null;
      headCells.forEach((h, j) => { if (j < 2 * n) h.textContent = `Z${j + 1}`; });
      cells.forEach(row => row.forEach(c => { c.value = ''; c.readOnly = false; c.classList.remove('wrong', 'pivot'); }));
      resetPick();
      setTableMsg('', '');
      refreshButtons();
    }

    const tableMsg = { Y: el('div', { class: 'msg s4-tmsg' }), X: el('div', { class: 'msg s4-tmsg' }) };
    function setTableMsg(text, kind) {
      ['Y', 'X'].forEach(s => { tableMsg[s].textContent = ''; tableMsg[s].className = 'msg s4-tmsg'; });
      if (tbl.side && text) {
        tableMsg[tbl.side].textContent = text;
        tableMsg[tbl.side].className = 'msg s4-tmsg' + (kind ? ' ' + kind : '');
      }
    }

    const btnCheckTable = {
      Y: el('button', { class: 'btn', type: 'button', disabled: true, onclick: () => checkTable('Y') }, 'Проверить симплекс-таблицу'),
      X: el('button', { class: 'btn', type: 'button', disabled: true, onclick: () => checkTable('X') }, 'Проверить симплекс-таблицу'),
    };

    function checkTable(side) {
      if (tbl.side !== side || tbl.phase !== 'entered') return;
      const wrong = [];
      cells.forEach((row, i) => row.forEach((c, j) => {
        if (!UI.near(UI.parseNum(c.value), tbl.expected[i][j], 1e-6)) wrong.push(c);
      }));
      if (wrong.length) {
        wrong.forEach(c => c.classList.add('wrong'));
        ctx.addError();
        setTableMsg('Матрица неверна', 'err');
        return;
      }
      tbl.phase = 'verified';
      tbl.T = tbl.expected.map(r => r.slice());
      showT();
      setTableMsg('Матрица верна', 'ok');
      refreshButtons();
    }

    /* ---------- Разрешающий элемент ---------- */

    const inpCol = el('input', { class: 'inp w36', 'aria-label': 'Столбец' });
    const inpRow = el('input', { class: 'inp w36', 'aria-label': 'Строка' });
    const btnPick = el('button', { class: 'btn', type: 'button', onclick: () => pick() }, 'Выбрать');
    const btnPivot = el('button', { class: 'btn btn-bold', type: 'button', disabled: true, onclick: () => pivot() }, 'Рассчитать новую таблицу');

    function resetPick() {
      tbl.pick = null;
      btnPivot.disabled = true;
      cells.forEach(row => row.forEach(c => c.classList.remove('pivot')));
    }

    async function pick() {
      if (tbl.phase !== 'verified') {
        await UI.msgBox('Сначала перенесите значения, заполните симплекс-таблицу и проверьте её.');
        return;
      }
      if (passed[tbl.side]) { await UI.msgBox('Эта часть уже выполнена.'); return; }
      const c = UI.parseNum(inpCol.value), r = UI.parseNum(inpRow.value);
      if (!Number.isInteger(c) || c < 1 || c > 2 * n || !Number.isInteger(r) || r < 1 || r > n) {
        await UI.msgBox(`Введите номер столбца (1–${2 * n}) и строки (1–${n}).`);
        return;
      }
      resetPick();
      const ch = S.pivotOptions(tbl.T, kindOf(tbl.side));
      if (ch.done) {
        ctx.addError();
        await UI.msgBox('Таблица уже оптимальна — разрешающий элемент не нужен.', { kind: 'error', title: 'Ошибка' });
        return;
      }
      if (!ch.options.some(o => o.c === c - 1 && o.r === r - 1)) {
        inpCol.classList.add('wrong');
        inpRow.classList.add('wrong');
        ctx.addError();
        await UI.msgBox('Неверный разрешающий элемент.', { kind: 'error', title: 'Ошибка' });
        return;
      }
      tbl.pick = { c: c - 1, r: r - 1 };
      cells[r - 1][c - 1].classList.add('pivot');
      btnPivot.disabled = false;
    }

    function pivot() {
      if (!tbl.pick) return;
      tbl.T = S.pivotTable(tbl.T, tbl.pick.r, tbl.pick.c);
      showT();
      resetPick();
      inpCol.value = '';
      inpRow.value = '';
    }

    /* ---------- Ответы ---------- */

    const ansMsg = el('div', { class: 'msg s4-partmsg' });
    const finalMsg = el('div', { class: 'msg ok s4-finalmsg' });
    const inpPrice = el('input', { class: 'inp w60', 'aria-label': 'Цена игры' });
    const btnPrice = el('button', { class: 'btn btn-bold', type: 'button', onclick: () => checkPrice() }, 'Проверка цены игры');

    function buildAnswers(side) {
      const v = varName(side);
      const vars = S.range(n).map(j => el('input', { class: 'inp w60', 'aria-label': `${v.toUpperCase()}${j + 1}` }));
      const strat = S.range(n).map(j => el('input', { class: 'inp w60', 'aria-label': `${side}${j + 1}` }));
      const btn = el('button', { class: 'btn btn-bold s4-check', type: 'button', onclick: () => checkAnswers(side, vars, strat, btn) }, 'Проверка');
      const node = el('div', { class: 's4-ans' }, btn,
        el('div', { class: 's4-ansgrid' }, S.range(n).map(j => [
          el('label', null, `${v.toUpperCase()}${j + 1}=`), vars[j], el('label', null, `${side}${j + 1}=`), strat[j]])));
      return node;
    }

    async function checkAnswers(side, vars, strat, btn) {
      const done = tbl.side === side && tbl.phase === 'verified' && S.pivotOptions(tbl.T, kindOf(side)).done;
      if (!done) {
        await UI.msgBox('Сначала доведите симплекс-таблицу этой части до конца.');
        return;
      }
      const ref = S.simplexBasic(tbl.T, n);
      const total = S.sum(ref);
      const wrong = [];
      ref.forEach((x, j) => {
        if (!UI.near(UI.parseNum(vars[j].value), x, TOL)) wrong.push(vars[j]);
        if (!UI.near(UI.parseNum(strat[j].value), x / total, TOL)) wrong.push(strat[j]);
      });
      if (wrong.length) {
        wrong.forEach(i => i.classList.add('wrong'));
        ctx.addError();
        ansMsg.textContent = 'Есть ошибки, неверные поля выделены.';
        ansMsg.className = 'msg err s4-partmsg';
        return;
      }
      passed[side] = true;
      btn.disabled = true;
      [...vars, ...strat].forEach(i => { i.readOnly = true; });
      updateMessages();
    }

    async function checkPrice() {
      if (shift === null) { await UI.msgBox('Сначала увеличьте элементы матрицы («Увеличить на...»).'); return; }
      const value = S.solveSimplex(C, shift).value;
      if (!UI.near(UI.parseNum(inpPrice.value), value, TOL)) {
        inpPrice.classList.add('wrong');
        ctx.addError();
        finalMsg.textContent = '';
        await UI.msgBox('Цена игры найдена неверно.', { kind: 'error', title: 'Ошибка' });
        return;
      }
      passed.price = true;
      inpPrice.readOnly = true;
      btnPrice.disabled = true;
      updateMessages();
    }

    function updateMessages() {
      const parts = (passed.Y ? 1 : 0) + (passed.X ? 1 : 0);
      ansMsg.className = 'msg ok s4-partmsg';
      ansMsg.textContent = parts === 1 ? '1 часть выполнена верно!\nWell Done!!!' : parts === 2 ? 'Обе части выполнены верно!\nWell Done!!!' : '';
      finalMsg.textContent = parts === 2 && passed.price ? 'Задание выполнено верно!' : passed.price ? 'Цена игры найдена верно.' : '';
      refreshButtons();
    }

    function refreshButtons() {
      ['Y', 'X'].forEach(s => { btnCheckTable[s].disabled = !(tbl.side === s && tbl.phase === 'entered'); });
    }

    async function finish() {
      if (!(passed.Y && passed.X && passed.price)) {
        await UI.msgBox('Сначала выполните обе части и проверку цены игры.');
        return;
      }
      ctx.complete({ shift });
    }

    /* ---------- Разметка ---------- */

    win.body.append(
      el('div', { class: 's4-top' },
        el('div', { class: 's4-ttl' }, el('b', null, 'Нахождение Y:'), halfY.select),
        el('div', { class: 's4-center' },
          el('div', { class: 's4-matrix' }, topCells),
          el('div', { class: 's4-shift' }, btnShift, inpShift)),
        el('div', { class: 's4-ttl' }, el('b', null, 'Нахождение X:'), halfX.select)),
      el('div', { class: 's4-halves' }, halfY.node, el('div', { class: 's4-divider' }), halfX.node),
      el('div', { class: 's4-tablezone' },
        el('div', { class: 's4-tleft' },
          el('b', null, 'Полученная симплекс-таблица'), btnCheckTable.Y, tableMsg.Y,
          el('button', { class: 'btn btn-bold s4-calc', type: 'button', onclick: UI.openCalculator }, 'Калькулятор')),
        el('div', { class: 's4-tcenter' }, tableEl,
          el('button', { class: 'btn', type: 'button', onclick: clearTable }, 'Очистить таблицу')),
        el('div', { class: 's4-tright' }, btnCheckTable.X, tableMsg.X,
          el('fieldset', { class: 'frame s4-pivot' }, el('legend', null, 'Разрешающий элемент'),
            el('div', { class: 's4-pf' }, el('label', null, 'Столбец'), inpCol, btnPick),
            el('div', { class: 's4-pf' }, el('label', null, 'Строка'), inpRow),
            btnPivot))),
      el('div', { class: 's4-answers' }, buildAnswers('Y'), el('div', { class: 's4-divider' }), buildAnswers('X')),
      el('div', { class: 's4-bottom' }, ansMsg,
        el('div', { class: 's4-price' }, el('label', null, 'Цена игры='), inpPrice, btnPrice, finalMsg),
        el('button', { class: 'btn btn-bold', type: 'button', onclick: finish }, 'Завершить задание')));
    return win;
  }

  root.GTSteps = root.GTSteps || {};
  root.GTSteps[4] = { open };
})(window);
