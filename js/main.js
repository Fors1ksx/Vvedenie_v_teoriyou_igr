/*
 * Главный экран: регистрация, плитки шагов (проходятся в любом порядке), учёт ошибок.
 */
(function (root) {
  'use strict';

  const UI = root.GTUI;
  const V = root.GTVariants;
  const { el, svg } = UI;

  const ACTIVE_STEPS = [1, 2, 3, 4, 5];

  /* ---------- Миниатюры плиток (SVG) ---------- */

  function thumbFrame(...children) {
    return svg('svg', { viewBox: '0 0 180 120', width: 180, height: 120, 'aria-hidden': 'true' }, ...children);
  }

  function miniWindow(fill) {
    return [
      svg('rect', { x: 4, y: 6, width: 172, height: 108, fill: fill, stroke: '#7d93b2' }),
      svg('rect', { x: 4, y: 6, width: 172, height: 12, fill: '#c9dbf0' }),
      svg('rect', { x: 160, y: 8, width: 13, height: 8, fill: '#d0604c' }),
    ];
  }

  const THUMBS = {
    1: () => {
      const g = [svg('rect', { x: 0, y: 0, width: 180, height: 120, fill: '#fff' })];
      for (let k = 1; k < 6; k++) g.push(svg('line', { x1: k * 30, x2: k * 30, y1: 0, y2: 120, stroke: '#999' }));
      for (let k = 1; k < 5; k++) g.push(svg('line', { x1: 0, x2: 180, y1: k * 24, y2: k * 24, stroke: '#999' }));
      g.push(
        svg('line', { x1: 0, x2: 180, y1: 62, y2: 62, stroke: '#000', 'stroke-width': 2 }),
        svg('path', { d: 'M0 40L180 22M0 50L180 100M0 66L180 50M0 88L180 64', stroke: '#000', 'stroke-dasharray': '5 4', fill: 'none' }),
        svg('line', { x1: 86, x2: 86, y1: 34, y2: 62, stroke: '#e0262b', 'stroke-width': 2 }),
        svg('text', { x: 64, y: 76, 'font-size': 11, 'font-family': 'Arial' }, '0,5'));
      return thumbFrame(...g);
    },
    2: () => {
      const g = miniWindow('#cfe3f7');
      g.push(svg('rect', { x: 12, y: 24, width: 120, height: 82, fill: '#fff', stroke: '#aab' }));
      for (let r = 0; r < 8; r++) for (let c = 0; c < 6; c++) {
        g.push(svg('rect', { x: 18 + c * 19, y: 29 + r * 9.5, width: 9, height: 3.5, fill: '#8a8f99' }));
      }
      g.push(svg('rect', { x: 140, y: 40, width: 30, height: 9, fill: '#e8e8e8', stroke: '#888' }),
        svg('rect', { x: 140, y: 70, width: 30, height: 9, fill: '#e8e8e8', stroke: '#888' }));
      return thumbFrame(...g);
    },
    3: () => {
      const g = miniWindow('#eef0f2');
      const mini = (x, y) => {
        for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
          g.push(svg('rect', { x: x + c * 11, y: y + r * 10, width: 9, height: 8, fill: '#fff', stroke: '#555', 'stroke-width': 0.8 }));
        }
      };
      mini(70, 22); mini(20, 54); mini(20, 86);
      g.push(svg('rect', { x: 100, y: 58, width: 60, height: 8, fill: '#fff', stroke: '#777' }),
        svg('rect', { x: 100, y: 74, width: 60, height: 8, fill: '#fff', stroke: '#777' }),
        svg('rect', { x: 110, y: 94, width: 40, height: 9, fill: '#e2e2e2', stroke: '#888' }));
      return thumbFrame(...g);
    },
    4: () => {
      const g = miniWindow('#b9bcc2');
      for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) {
        g.push(svg('rect', { x: 14 + c * 22, y: 26 + r * 13, width: 18, height: 9, fill: '#d3d5d9', stroke: '#8d9097', 'stroke-width': 0.6 }));
      }
      return thumbFrame(...g);
    },
    5: () => thumbFrame(
      svg('rect', { x: 10, y: 8, width: 160, height: 104, fill: '#0e1238' }),
      svg('text', { x: 90, y: 66, 'text-anchor': 'middle', 'font-size': 30, 'font-weight': 'bold', 'font-family': 'Arial Narrow, Arial, sans-serif', fill: '#fff', 'letter-spacing': 1 }, 'БРАУН'),
      svg('text', { x: 90, y: 90, 'text-anchor': 'middle', 'font-size': 12, 'font-family': 'Arial, sans-serif', fill: '#b9c1ea' }, 'Робинсон · Нейман')),
  };

  const TILES = [
    { n: 1, title: 'Графический метод' },
    { n: 2, title: 'Сокращение матрицы' },
    { n: 3, title: 'Метод определителей' },
    { n: 4, title: 'Симплекс-метод' },
    { n: 5, title: 'Метод Брауна и метод Неймана' },
  ];

  /* ---------- Состояние ---------- */

  const app = {
    store: UI.loadStore(),
    session: null, // { key, surname, variant, analysis }
    stepWin: null,
    storageOk: true,
  };

  function record() { return app.store.users[app.session.key]; }
  function stepState(n) {
    const rec = record();
    rec.steps[n] = rec.steps[n] || { done: false, errors: 0 };
    return rec.steps[n];
  }
  function persist() { app.storageOk = UI.saveStore(app.store) && app.storageOk; }
  // Шаги проходятся в любом порядке. Шагам 3–5 нужна матрица 3×3 из шага 2: пока шаг 2 не пройден,
  // берётся итог решателя — сокращение у всех вариантов однозначно (проверяет самопроверка).
  const isAvailable = n => !!app.session && ACTIVE_STEPS.includes(n) && !stepState(n).done;

  const rootEl = document.getElementById('app');

  /* ---------- Главный экран ---------- */

  function renderMain() {
    const last = app.session || app.store.last || {};
    const inpSurname = el('input', { class: 'inp inp-reg', type: 'text', maxlength: 40, 'aria-label': 'Фамилия', autocomplete: 'off' });
    inpSurname.value = last.surname || '';
    const inpPw = el('input', { class: 'inp inp-reg', type: 'password', 'aria-label': 'Пароль' });
    const selVar = el('select', { class: 'inp sel-var', 'aria-label': 'Вариант' },
      V.VARIANTS.map(n => el('option', { value: n, selected: n === (last.variant || 4) }, `${n} вар`)));

    async function start() {
      const surname = inpSurname.value.trim();
      const variant = Number(selVar.value);
      if (!surname) { await UI.msgBox('Введите фамилию.'); inpSurname.focus(); return; }
      if (!inpPw.value) { await UI.msgBox('Введите пароль.'); inpPw.focus(); return; }
      const key = surname.toLowerCase() + '|' + variant;
      const pw = UI.hash(inpPw.value);
      const rec = app.store.users[key];
      if (rec && rec.pw !== pw) {
        await UI.msgBox('Неверный пароль для этого пользователя и варианта.', { kind: 'error', title: 'Ошибка' });
        return;
      }
      if (!rec) app.store.users[key] = { surname, variant, pw, steps: {} };
      app.store.last = { surname, variant };
      app.session = { key, surname, variant, analysis: V.analyzeVariant(variant) };
      persist();
      render();
    }

    async function reset() {
      if (!(await UI.confirmBox(`Сбросить прогресс и ошибки пользователя «${app.session.surname}» (${app.session.variant} вар)?`))) return;
      record().steps = {};
      persist();
      render();
    }

    const reg = el('fieldset', { class: 'frame reg' },
      el('legend', null, 'Регистрация пользователя'),
      el('form', { class: 'reg-row', onsubmit: e => { e.preventDefault(); start(); } },
        el('label', { class: 'reg-label' }, 'Фамилия:', inpSurname),
        el('label', { class: 'reg-label' }, 'Пароль:', inpPw),
        selVar,
        el('button', { class: 'btn btn-bold btn-start', type: 'submit' }, 'Начать')),
      el('div', { class: 'reg-info' },
        app.session
          ? [`Пользователь: ${app.session.surname}, ${app.session.variant} вар. `,
            el('button', { class: 'linkbtn', type: 'button', onclick: reset }, 'Сбросить прогресс')]
          : 'Введите фамилию, пароль, выберите вариант и нажмите «Начать».',
        !app.storageOk && el('span', { class: 'warn' }, ' Прогресс не сохраняется: localStorage недоступен.')));

    const tiles = el('div', { class: 'tiles' }, TILES.map(t => {
      const available = !t.wip && isAvailable(t.n);
      const st = app.session && !t.wip ? stepState(t.n) : null;
      let status = '';
      if (t.wip) status = el('span', { class: 'st-wip' }, 'в разработке');
      else if (!app.session) status = '';
      else if (st.done) status = el('span', { class: 'st-done' }, 'Выполнено', el('br'), `Ошибок: ${st.errors}`);
      else status = el('span', { class: 'st-open' }, 'Доступно');

      return el('fieldset', { class: 'frame tile' + (t.wip ? ' tile-wip' : '') + (st && st.done ? ' tile-done' : '') },
        el('legend', null, t.title),
        el('button', {
          class: 'tile-thumb', type: 'button', disabled: !available,
          'aria-label': `Шаг ${t.n}: ${t.title}`, onclick: () => openStep(t.n),
        }, THUMBS[t.n]()),
        el('div', { class: 'tile-step' }, `Шаг ${t.n}`),
        el('div', { class: 'tile-status' }, status));
    }));

    let summary = null;
    if (app.session) {
      const done = ACTIVE_STEPS.filter(n => stepState(n).done);
      if (done.length === ACTIVE_STEPS.length) {
        const total = ACTIVE_STEPS.reduce((s, n) => s + stepState(n).errors, 0);
        summary = el('div', { class: 'summary' },
          `Шаги 1–${ACTIVE_STEPS.length} выполнены. Ошибок: ${ACTIVE_STEPS.map(n => `шаг ${n} — ${stepState(n).errors}`).join(', ')}. Всего: ${total}.`);
      }
    }

    return el('div', { class: 'main-panel' }, reg, tiles, summary);
  }

  /* ---------- Шаги ---------- */

  function openStep(n) {
    if (!isAvailable(n)) return;
    let win = null;
    const refreshStatus = () => {
      win.status.textContent = `${app.session.surname}, ${app.session.variant} вар · Шаг ${n} · ошибок на этом шаге: ${stepState(n).errors}`;
    };
    const ctx = {
      analysis: app.session.analysis,
      stepData: k => stepState(k).data,
      addError() {
        stepState(n).errors++;
        persist();
        refreshStatus();
        return stepState(n).errors;
      },
      async complete(data, opts = {}) {
        const st = stepState(n);
        st.done = true;
        if (data) st.data = data;
        persist();
        if (opts.keepOpen) refreshStatus(); else closeStep();
        await UI.msgBox(`Шаг ${n} выполнен. Ошибок: ${st.errors}.`, { kind: 'ok', title: 'Задание выполнено' });
      },
      close: () => closeStep(),
    };
    win = root.GTSteps[n].open(ctx);
    refreshStatus();
    app.stepWin = win.root;
    render();
    window.scrollTo(0, 0);
  }

  function closeStep() {
    app.stepWin = null;
    UI.closeCalculator();
    render();
  }

  function render() {
    rootEl.replaceChildren(app.stepWin || renderMain());
  }

  render();
})(window);
