/*
 * Шаг 3. Метод определителей для матрицы 3×3, полученной на шаге 2.
 */
(function (root) {
  'use strict';

  const UI = root.GTUI;
  const S = root.GTSolvers;
  const { el } = UI;

  const MATRIX_OPTIONS = [['', '— выберите —'], ['orig', 'Первоначальная'], ['trans', 'Транспонированная']];

  function matrixCells(M, attrs) {
    const n = M.length;
    const cells = [];
    const grid = el('div', { class: 's3-matrix', style: `grid-template-columns: repeat(${n}, auto)` });
    for (let i = 0; i < n; i++) {
      cells.push([]);
      for (let j = 0; j < n; j++) {
        const c = el('input', Object.assign({ class: 'inp s3-cell', 'aria-label': `[${i + 1},${j + 1}]` }, attrs));
        c.value = M[i][j] == null ? '' : UI.fmtNum(M[i][j]);
        cells[i].push(c);
        grid.append(c);
      }
    }
    return { grid, cells };
  }

  function open(ctx) {
    const d2 = ctx.stepData(2);
    const C = d2 ? S.submatrix(ctx.analysis.variant.step2, d2.rows, d2.cols) : ctx.analysis.step3Matrix;
    const n = C.length;
    const CT = S.transpose(C);
    const sol = S.solveByDeterminants(C);
    const passed = { Y: false, X: false };

    const win = UI.createWindow({ title: 'Метод определителей', onClose: ctx.close, className: 'win-step3' });
    const msg = el('div', { class: 'msg s3-msg', role: 'status' });
    const inpPrice = el('input', { class: 'inp w60', 'aria-label': 'Цена игры' });

    function setMsg(text, kind) {
      msg.textContent = text;
      msg.className = 'msg s3-msg' + (kind ? ' ' + kind : '');
    }

    // Половина окна: «Нахождение Y» (первоначальная) или «Нахождение X» (транспонированная).
    function buildHalf(cfg) {
      let base = null;
      let selectedCol = null;

      const repl = el('input', { class: 'inp w30', value: '1', 'aria-label': 'Заменить столбец на' });
      const select = el('select', { class: 'inp s3-select', 'aria-label': 'Матрица для ' + cfg.key },
        MATRIX_OPTIONS.map(([v, t]) => el('option', { value: v }, t)));
      const radios = S.range(n).map(j => el('input', {
        type: 'radio', name: 's3-col-' + cfg.key, class: 's3-radio', disabled: true, 'aria-label': `Столбец ${j + 1}`,
        onclick: () => {
          selectedCol = selectedCol === j ? null : j; // повторный щелчок снимает выбор
          radios[j].checked = selectedCol === j;
          refreshWork();
        },
      }));
      const work = matrixCells(S.range(n).map(() => new Array(n).fill(null)), {});
      const detOut = el('div', { class: 's3-detout', 'aria-live': 'polite' });

      function refreshWork() {
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            work.cells[i][j].value = !base ? '' : (selectedCol === j ? repl.value : UI.fmtNum(base[i][j]));
            work.cells[i][j].classList.remove('wrong');
          }
        }
        detOut.textContent = '';
      }

      select.addEventListener('change', () => {
        const v = select.value;
        if (!v) { base = null; radios.forEach(r => { r.disabled = true; r.checked = false; }); selectedCol = null; refreshWork(); return; }
        base = v === 'orig' ? C : CT;
        selectedCol = null;
        radios.forEach(r => { r.disabled = false; r.checked = false; });
        refreshWork();
        if (v !== cfg.correct) {
          ctx.addError();
          UI.msgBox('Неверный выбор матрицы.', { kind: 'error', title: 'Ошибка' });
        }
      });
      repl.addEventListener('input', () => { if (selectedCol !== null) refreshWork(); });

      function calcDet() {
        const vals = work.cells.map(r => r.map(c => UI.parseNum(c.value)));
        if (!base || vals.some(r => r.some(v => Number.isNaN(v)))) {
          detOut.textContent = 'ошибка ввода';
          return;
        }
        detOut.textContent = UI.fmtNum(S.det(vals));
      }

      const detInputs = cfg.detLabels.map(l => el('input', { class: 'inp w60', 'aria-label': l }));
      const stratInputs = S.range(n).map(j => el('input', { class: 'inp w60', 'aria-label': `${cfg.key}${j + 1}` }));
      const btnCheck = el('button', { class: 'btn btn-bold s3-check', type: 'button', onclick: () => check() }, 'Проверка');

      function check() {
        const ref = cfg.ref;
        const wrong = [];
        if (select.value !== cfg.correct) wrong.push(select);
        [ref.det, ...ref.dets].forEach((v, k) => { if (!UI.near(UI.parseNum(detInputs[k].value), v)) wrong.push(detInputs[k]); });
        if (cfg.withPrice && !UI.near(UI.parseNum(inpPrice.value), ref.value)) wrong.push(inpPrice);
        ref.strategy.forEach((v, j) => { if (!UI.near(UI.parseNum(stratInputs[j].value), v)) wrong.push(stratInputs[j]); });

        if (wrong.length) {
          wrong.forEach(i => i.classList.add('wrong'));
          ctx.addError();
          setMsg(`${cfg.title.replace(':', '')}: есть ошибки, неверные поля выделены.`, 'err');
          return;
        }
        passed[cfg.key] = true;
        btnCheck.disabled = true;
        select.disabled = true;
        [...detInputs, ...stratInputs, ...(cfg.withPrice ? [inpPrice] : [])].forEach(i => { i.readOnly = true; });
        if (passed.Y && passed.X) setMsg('Задание выполнено верно!', 'ok');
        else setMsg(`${cfg.title.replace(':', '')} — верно.`, 'ok');
      }

      const half = el('div', { class: 's3-half s3-half-' + cfg.key },
        el('div', { class: 's3-h-title' }, cfg.title),
        el('div', { class: 's3-grid' },
          el('div', { class: 's3-work' },
            el('label', { class: 's3-repl' }, 'Заменить столбец на ', repl),
            el('div', { class: 's3-radios' }, radios),
            el('div', { class: 's3-work-row' }, work.grid,
              el('div', { class: 's3-calc' },
                el('button', { class: 'btn', type: 'button', onclick: calcDet }, 'Считать'),
                detOut))),
          el('div', { class: 's3-dets' },
            select,
            cfg.detLabels.map((l, k) => el('div', { class: 's3-field' }, el('label', null, l), detInputs[k])),
            cfg.withCalc && el('button', { class: 'btn btn-bold s3-calcbtn', type: 'button', onclick: UI.openCalculator }, 'Калькулятор'))),
        el('div', { class: 's3-answers' },
          cfg.withPrice && el('div', { class: 's3-field' }, el('label', null, 'Цена игры='), inpPrice),
          stratInputs.map((inp, j) => el('div', { class: 's3-field' }, el('label', null, `${cfg.key}${j + 1}=`), inp))),
        el('div', { class: 's3-checkrow' }, btnCheck));
      return half;
    }

    const halfY = buildHalf({
      key: 'Y', title: 'Нахождение Y:', correct: 'orig', ref: sol.Y, withPrice: true, withCalc: true,
      detLabels: ['Det C=', ...S.range(n).map(j => `Det C${j + 1}=`)],
    });
    const halfX = buildHalf({
      key: 'X', title: 'Нахождение X:', correct: 'trans', ref: sol.X, withPrice: false, withCalc: false,
      detLabels: ['Det C~=', ...S.range(n).map(j => `Det C${j + 1}~=`)],
    });

    async function finish() {
      if (!(passed.Y && passed.X)) {
        await UI.msgBox('Сначала выполните проверку обеих частей («Нахождение Y» и «Нахождение X»).');
        return;
      }
      ctx.complete();
    }

    win.body.append(
      el('div', { class: 's3-top' }, matrixCells(C, { readonly: true, tabindex: -1 }).grid),
      el('div', { class: 's3-halves' }, halfY, el('div', { class: 's3-divider' }), halfX),
      el('div', { class: 's3-bottom' }, msg,
        el('button', { class: 'btn btn-bold', type: 'button', onclick: finish }, 'Завершить задание')));
    return win;
  }

  root.GTSteps = root.GTSteps || {};
  root.GTSteps[3] = { open };
})(window);
