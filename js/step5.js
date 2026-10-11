/*
 * Шаг 5. Итерационный метод Брауна–Робинсон.
 */
(function (root) {
  'use strict';

  const UI = root.GTUI;
  const S = root.GTSolvers;
  const { el } = UI;

  const STUDENT_ROWS = 3;

  function open(ctx) {
    const d2 = ctx.stepData(2);
    const C = d2 ? S.submatrix(ctx.analysis.variant.step2, d2.rows, d2.cols) : ctx.analysis.step3Matrix;
    const n = C.length;
    let start = null; // выбранная первая строка (с 0)
    let passed = false;

    const win = UI.createWindow({ title: 'Метод Брауна-Робинсон', onClose: ctx.close, className: 'win-step5' });
    const fieldKeys = ['i', ...S.range(n).map(t => 'B' + t), 'j', ...S.range(n).map(t => 'A' + t), 'low', 'high', 'v'];
    const headers = ['k', 'i', ...S.range(n).map(t => 'B' + (t + 1)), 'j', ...S.range(n).map(t => 'A' + (t + 1)), 'LowV', 'HighV', 'V'];

    /* ---------- Таблица ---------- */

    const inputs = S.range(STUDENT_ROWS).map(k => {
      const row = {};
      fieldKeys.forEach(f => {
        row[f] = el('input', { class: 'inp s5-cell', 'aria-label': `k=${k + 1}, ${f}` });
      });
      return row;
    });
    inputs[0].i.readOnly = true;
    inputs[0].i.placeholder = '←';
    inputs[0].i.title = 'Выберите строку щелчком по исходной матрице';

    const tbody = el('tbody', null, inputs.map((row, k) =>
      el('tr', null, el('td', { class: 's5-k' }, String(k + 1)), fieldKeys.map(f => el('td', null, row[f])))));
    const table = el('table', { class: 's5-table' }, el('thead', null, el('tr', null, headers.map(h => el('th', null, h)))), tbody);

    /* ---------- Исходная матрица ---------- */

    const mCells = C.map((row, i) => row.map((x, j) => el('button', {
      class: 's5-mcell', type: 'button', 'aria-label': `Строка ${i + 1}, столбец ${j + 1}: ${UI.fmtNum(x)}`,
      onclick: () => selectRow(i),
    }, UI.fmtNum(x))));

    function selectRow(i) {
      if (passed) return;
      start = i;
      mCells.forEach((row, r) => row.forEach(c => c.classList.toggle('sel', r === i)));
      inputs[0].i.value = String(i + 1);
      inputs[0].i.classList.remove('wrong');
    }

    /* ---------- Проверка и автоматическое завершение ---------- */

    const msg = el('div', { class: 'msg s5-msg', role: 'status' });
    const result = el('div', { class: 's5-result' });
    const btnCheck = el('button', { class: 'btn btn-bold', type: 'button', onclick: () => check() }, 'Проверка');
    const btnAuto = el('button', { class: 'btn btn-bold s5-auto', type: 'button', disabled: true, onclick: () => auto() }, 'Закончить автоматически');
    const btnHome = el('button', { class: 'btn', type: 'button', hidden: true, onclick: ctx.close }, 'На главный экран');

    function setMsg(text, kind) {
      msg.textContent = text;
      msg.className = 'msg s5-msg' + (kind ? ' ' + kind : '');
    }

    const readRows = () => inputs.map(row => {
      const idx = f => { const v = UI.parseNum(row[f].value); return Number.isInteger(v) ? v - 1 : NaN; };
      return {
        i: idx('i'),
        B: S.range(n).map(t => UI.parseNum(row['B' + t].value)),
        j: idx('j'),
        A: S.range(n).map(t => UI.parseNum(row['A' + t].value)),
        low: UI.parseNum(row.low.value),
        high: UI.parseNum(row.high.value),
        v: UI.parseNum(row.v.value),
      };
    });

    async function check() {
      if (start === null) {
        await UI.msgBox('Выберите первую строку i щелчком по исходной матрице.');
        return;
      }
      inputs.forEach(row => fieldKeys.forEach(f => row[f].classList.remove('wrong')));
      const bad = S.checkBrownRows(C, start, readRows());
      if (bad) {
        const cell = inputs[bad.row][bad.field];
        cell.classList.add('wrong');
        cell.focus();
        ctx.addError();
        setMsg(`Ошибка в итерации k=${bad.row + 1}: неверная выделенная ячейка.`, 'err');
        return;
      }
      passed = true;
      inputs.forEach(row => fieldKeys.forEach(f => { row[f].readOnly = true; }));
      btnCheck.disabled = true;
      btnAuto.disabled = false;
      setMsg('Таблица заполнена верно! Нажмите «Закончить автоматически».', 'ok');
    }

    function auto() {
      if (!passed) return;
      const prefix = readRows().map(r => ({ i: r.i, j: r.j }));
      const res = S.brownRobinson(C, start, { prefix });
      const num = x => UI.fmtNum(x, 3);
      res.rows.slice(STUDENT_ROWS).forEach(r => tbody.append(el('tr', { class: 's5-auto-row' },
        el('td', { class: 's5-k' }, String(r.k)), el('td', null, String(r.i + 1)),
        r.B.map(x => el('td', null, num(x))), el('td', null, String(r.j + 1)),
        r.A.map(x => el('td', null, num(x))), el('td', null, num(r.low)), el('td', null, num(r.high)), el('td', null, num(r.v)))));
      const K = res.rows.length;
      const vec = p => '(' + p.map(x => UI.fmtNum(x, 3)).join('; ') + ')';
      const exact = S.solveByDeterminants(C);
      result.replaceChildren(
        el('div', null, `Итераций: ${K}${res.high - res.low < 0.01 ? ' (HighV − LowV < 0,01)' : ' (достигнут предел 200 итераций)'}.`),
        el('div', null, el('b', null, `Цена игры ≈ ${num(res.value)}`), `  (LowV = ${num(res.low)}, HighV = ${num(res.high)})`),
        el('div', null, `Частоты стратегий игрока A: ${vec(res.freqA)}`),
        el('div', null, `Частоты стратегий игрока B: ${vec(res.freqB)}`),
        exact.valid && el('div', { class: 's5-exact' }, `Для сравнения, точное решение (шаг 3): v = ${num(exact.value)}, X = ${vec(exact.X.strategy)}, Y = ${vec(exact.Y.strategy)}`));
      btnAuto.disabled = true;
      btnHome.hidden = false;
      setMsg('Задание выполнено верно!', 'ok');
      ctx.complete({ value: res.value, iterations: K }, { keepOpen: true });
    }

    win.body.append(
      el('div', { class: 's5-layout' },
        el('div', { class: 's5-tablewrap' }, table),
        el('div', { class: 's5-side' },
          el('div', null, 'Исходная матрица:'),
          el('div', { class: 's5-matrix', style: `grid-template-columns: repeat(${n}, auto)` }, mCells),
          el('div', { class: 's5-note' }, 'Заполните таблицу для трех итераций, и нажмите кнопку Проверка'),
          el('div', { class: 's5-note s5-hint' }, 'Первую строку i выберите щелчком по исходной матрице.'),
          el('button', { class: 'btn', type: 'button', onclick: UI.openCalculator }, 'Калькулятор'))),
      el('div', { class: 's5-bar' }, btnCheck, btnAuto, btnHome),
      msg, result);
    return win;
  }

  root.GTSteps = root.GTSteps || {};
  root.GTSteps[5] = { open };
})(window);
