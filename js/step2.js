/*
 * Шаг 2. Сокращение матрицы вычёркиванием доминируемых строк и столбцов.
 */
(function (root) {
  'use strict';

  const UI = root.GTUI;
  const S = root.GTSolvers;
  const { el } = UI;
  const TARGET = 3;

  function open(ctx) {
    const M = ctx.analysis.variant.step2;
    let rows = S.range(M.length);
    let cols = S.range(M[0].length);
    let sel = null; // { type: 'row' | 'col', idx }

    const win = UI.createWindow({ title: 'Сокращение матрицы', onClose: ctx.close, className: 'win-step2' });
    const table = el('table', { class: 's2-table' });
    const msg = el('div', { class: 'msg', role: 'status' });

    function radio(type, idx, label) {
      const r = el('input', {
        type: 'radio', name: 's2-pick', class: 's2-radio', 'aria-label': label,
        onchange: () => { sel = { type, idx }; highlight(); },
      });
      if (sel && sel.type === type && sel.idx === idx) r.checked = true;
      return r;
    }

    function render() {
      table.replaceChildren(
        el('tr', null, el('th', { class: 's2-corner' }),
          cols.map((c, j) => el('th', { class: 's2-colpick' }, radio('col', c, `Столбец ${j + 1}`)))),
        ...rows.map((r, i) => el('tr', { 'data-row': r },
          el('th', { class: 's2-rowpick' }, radio('row', r, `Строка ${i + 1}`)),
          cols.map(c => el('td', { 'data-col': c }, UI.fmtNum(M[r][c]))))));
      highlight();
    }

    function highlight() {
      table.querySelectorAll('.picked').forEach(e => e.classList.remove('picked'));
      if (!sel) return;
      if (sel.type === 'row') table.querySelectorAll(`tr[data-row="${sel.idx}"] td`).forEach(e => e.classList.add('picked'));
      else table.querySelectorAll(`td[data-col="${sel.idx}"]`).forEach(e => e.classList.add('picked'));
    }

    function setMsg(text, kind) {
      msg.textContent = text;
      msg.className = 'msg' + (kind ? ' ' + kind : '');
    }

    async function reduce() {
      if (!sel) {
        await UI.msgBox('Выберите строку или столбец радиокнопкой.');
        return;
      }
      if (sel.type === 'row') {
        if (S.rowDominated(M, rows, cols, sel.idx)) {
          rows = rows.filter(r => r !== sel.idx);
          setMsg('Строка вычеркнута.', '');
        } else {
          ctx.addError();
          setMsg('', '');
          await UI.msgBox('Эту строку нельзя вычеркнуть: нет другой строки, все элементы которой не меньше соответствующих элементов выбранной.',
            { kind: 'error', title: 'Ошибка' });
          return;
        }
      } else if (S.colDominated(M, rows, cols, sel.idx)) {
        cols = cols.filter(c => c !== sel.idx);
        setMsg('Столбец вычеркнут.', '');
      } else {
        ctx.addError();
        setMsg('', '');
        await UI.msgBox('Этот столбец нельзя вычеркнуть: нет другого столбца, все элементы которого не больше соответствующих элементов выбранного.',
          { kind: 'error', title: 'Ошибка' });
        return;
      }
      sel = null;
      render();
    }

    async function finish() {
      const rem = S.removableLines(M, rows, cols);
      const canReduce = rem.rows.length > 0 || rem.cols.length > 0;
      if (rows.length === TARGET && cols.length === TARGET && !canReduce) {
        ctx.complete({ rows, cols });
        return;
      }
      ctx.addError();
      await UI.msgBox(canReduce ? 'Матрицу ещё можно сократить.' : `Матрица должна быть сокращена до размера ${TARGET}×${TARGET}.`,
        { kind: 'error', title: 'Ошибка' });
    }

    win.body.append(el('div', { class: 's2-layout' },
      el('div', { class: 's2-left' }, table, msg),
      el('div', { class: 's2-right' },
        el('button', { class: 'btn s2-reduce', type: 'button', onclick: reduce }, 'Сократить матрицу'),
        el('button', { class: 'btn btn-bold s2-finish', type: 'button', onclick: finish }, 'Завершить задание'))));
    render();
    return win;
  }

  root.GTSteps = root.GTSteps || {};
  root.GTSteps[2] = { open };
})(window);
