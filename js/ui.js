/*
 * Общие элементы интерфейса: создание DOM/SVG, окна в стиле Windows 7,
 * диалоги (сообщение, ввод, подтверждение), калькулятор, разбор чисел, localStorage.
 */
(function (root) {
  'use strict';

  /* ---------- DOM ---------- */

  function setAttrs(e, attrs) {
    if (!attrs) return;
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') e.setAttribute('class', v);
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, '');
      else e.setAttribute(k, v);
    }
  }

  function append(e, children) {
    for (const c of children.flat(Infinity)) {
      if (c == null || c === false) continue;
      e.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
  }

  function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    setAttrs(e, attrs);
    append(e, children);
    return e;
  }

  const SVGNS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs, ...children) {
    const e = document.createElementNS(SVGNS, tag);
    setAttrs(e, attrs);
    append(e, children);
    return e;
  }

  /* ---------- Числа ---------- */

  // Принимает и запятую, и точку. Пустая строка/мусор → NaN.
  function parseNum(s) {
    const t = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/[−–]/g, '-').replace(',', '.');
    if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t)) return NaN;
    return Number(t);
  }

  function fmtNum(x, digits = 4) {
    if (!Number.isFinite(x)) return '—';
    const r = Number(x.toFixed(digits));
    return String(Object.is(r, -0) ? 0 : r).replace('.', ',');
  }

  const TOL = 0.01;
  const near = (a, b, tol = TOL) => Number.isFinite(a) && Math.abs(a - b) <= tol + 1e-9;

  /* ---------- Хранилище ---------- */

  const STORE_KEY = 'gt-trainer-v1';

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const d = raw ? JSON.parse(raw) : null;
      if (d && typeof d === 'object' && d.users && typeof d.users === 'object') return d;
    } catch (e) { /* недоступно или испорчено — начинаем с чистого */ }
    return { users: {}, last: null };
  }

  function saveStore(d) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(d));
      return true;
    } catch (e) {
      return false;
    }
  }

  // FNV-1a: чтобы не хранить пароль открытым текстом. Это не защита, а формальность.
  function hash(s) {
    let h = 0x811c9dc5;
    for (const ch of String(s)) {
      h ^= ch.codePointAt(0);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16);
  }

  /* ---------- Окна ---------- */

  function appIcon() {
    return svg('svg', { class: 'win-icon', viewBox: '0 0 16 16', width: 16, height: 16, 'aria-hidden': 'true' },
      svg('rect', { x: 1, y: 2, width: 14, height: 12, rx: 1.5, fill: '#fdfdfd', stroke: '#4a6b94' }),
      svg('rect', { x: 1, y: 2, width: 14, height: 3.5, rx: 1.5, fill: '#4f86c6' }),
      svg('circle', { cx: 5, cy: 9.5, r: 2, fill: '#e8a33a' }),
      svg('path', { d: 'M8.5 8h4.5M8.5 11h3.5', stroke: '#4a6b94', 'stroke-width': 1.2 }));
  }

  function ctrlGlyph(kind) {
    const s = svg('svg', { viewBox: '0 0 12 10', width: 12, height: 10, 'aria-hidden': 'true' });
    if (kind === 'min') s.append(svg('rect', { x: 2, y: 6.5, width: 8, height: 2, fill: '#1d2d44' }));
    if (kind === 'max') s.append(svg('rect', { x: 2, y: 1, width: 8, height: 7, fill: 'none', stroke: '#1d2d44', 'stroke-width': 1.6 }));
    if (kind === 'close') s.append(svg('path', { d: 'M2.5 1.5l7 7M9.5 1.5l-7 7', stroke: '#fff', 'stroke-width': 2.2, 'stroke-linecap': 'round' }));
    return s;
  }

  // Окно с заголовком, кнопками управления, клиентской областью и строкой состояния.
  function createWindow({ title, onClose, className = '', minMax = true }) {
    const body = el('div', { class: 'win-body' });
    const status = el('div', { class: 'win-status' });
    const titleBar = el('div', { class: 'win-title' },
      appIcon(),
      el('span', { class: 'win-title-text', text: title }),
      el('div', { class: 'win-ctrls' },
        minMax && el('span', { class: 'wc wc-min', 'aria-hidden': 'true' }, ctrlGlyph('min')),
        minMax && el('span', { class: 'wc wc-max', 'aria-hidden': 'true' }, ctrlGlyph('max')),
        el('button', { class: 'wc wc-close', type: 'button', title: 'Закрыть', 'aria-label': 'Закрыть', onclick: () => onClose && onClose() },
          ctrlGlyph('close'))));
    const rootEl = el('div', { class: 'win ' + className, role: 'dialog', 'aria-label': title }, titleBar, body, status);
    // Исправленное поле больше не подсвечивается как ошибочное.
    body.addEventListener('input', e => e.target.classList && e.target.classList.remove('wrong'));
    body.addEventListener('change', e => e.target.classList && e.target.classList.remove('wrong'));
    return { root: rootEl, body, status, titleBar };
  }

  /* ---------- Диалоги ---------- */

  function dlgIcon(kind) {
    const s = svg('svg', { viewBox: '0 0 32 32', width: 32, height: 32, class: 'dlg-icon', 'aria-hidden': 'true' });
    if (kind === 'error') {
      s.append(svg('circle', { cx: 16, cy: 16, r: 14, fill: '#d9362b', stroke: '#9e1d14' }),
        svg('path', { d: 'M10.5 10.5l11 11M21.5 10.5l-11 11', stroke: '#fff', 'stroke-width': 3.2, 'stroke-linecap': 'round' }));
    } else if (kind === 'question') {
      s.append(svg('circle', { cx: 16, cy: 16, r: 14, fill: '#2f6fc0', stroke: '#1d4a85' }),
        svg('text', { x: 16, y: 22.5, 'text-anchor': 'middle', 'font-size': 19, 'font-weight': 'bold', fill: '#fff', 'font-family': 'Arial' }, '?'));
    } else if (kind === 'ok') {
      s.append(svg('circle', { cx: 16, cy: 16, r: 14, fill: '#2e9b46', stroke: '#1d6a2f' }),
        svg('path', { d: 'M9 16.5l5 5 9-10', stroke: '#fff', 'stroke-width': 3.2, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    } else {
      s.append(svg('circle', { cx: 16, cy: 16, r: 14, fill: '#2f6fc0', stroke: '#1d4a85' }),
        svg('text', { x: 16, y: 23, 'text-anchor': 'middle', 'font-size': 19, 'font-weight': 'bold', fill: '#fff', 'font-family': 'Georgia, serif' }, 'i'));
    }
    return s;
  }

  // Модальное окно. buttons: [{label, value, primary}]; Escape → cancelValue.
  function dialog({ title, kind, text, input, buttons, cancelValue }) {
    return new Promise(resolve => {
      const prevFocus = document.activeElement;
      const overlay = el('div', { class: 'overlay' });
      let inp = null;
      const finish = value => {
        overlay.remove();
        document.removeEventListener('keydown', onKey, true);
        if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus();
        resolve(value);
      };
      const w = createWindow({ title, onClose: () => finish(cancelValue), className: 'dlg', minMax: false });
      const btnEls = buttons.map(b => el('button', {
        class: 'btn dlg-btn', type: 'button',
        onclick: () => finish(b.value === '__input__' ? inp.value : b.value),
      }, b.label));
      const content = el('div', { class: 'dlg-text' }, text);
      if (input) {
        inp = el('input', { class: 'inp dlg-input', type: 'text', value: input.value || '', 'aria-label': text });
        content.append(inp);
      }
      w.body.append(el('div', { class: 'dlg-msg' }, dlgIcon(kind), content), el('div', { class: 'dlg-foot' }, btnEls));
      overlay.append(w.root);
      document.body.append(overlay);

      const primary = buttons.findIndex(b => b.primary);
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); finish(cancelValue); }
        else if (e.key === 'Enter') { e.preventDefault(); btnEls[primary >= 0 ? primary : 0].click(); }
        else if (e.key === 'Tab') {
          // Фокус не уходит из модального окна.
          const f = [...overlay.querySelectorAll('input, button')];
          const i = f.indexOf(document.activeElement);
          e.preventDefault();
          f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
        }
      }
      document.addEventListener('keydown', onKey, true);
      (inp || btnEls[primary >= 0 ? primary : 0]).focus();
    });
  }

  const msgBox = (text, { title = 'Сообщение', kind = 'info' } = {}) =>
    dialog({ title, kind, text, buttons: [{ label: 'OK', value: true, primary: true }], cancelValue: true });

  const promptBox = (text, { title = 'Ввод', value = '' } = {}) =>
    dialog({
      title, kind: 'question', text, input: { value },
      buttons: [{ label: 'OK', value: '__input__', primary: true }, { label: 'Отмена', value: null }],
      cancelValue: null,
    });

  const confirmBox = (text, { title = 'Подтверждение' } = {}) =>
    dialog({
      title, kind: 'question', text,
      buttons: [{ label: 'Да', value: true }, { label: 'Нет', value: false, primary: true }],
      cancelValue: false,
    });

  /* ---------- Калькулятор ---------- */

  // Разбор выражения: + − × ÷, скобки, унарный минус, запятая или точка.
  function evaluate(src) {
    const s = String(src).replace(/\s+/g, '').replace(/,/g, '.')
      .replace(/[×xх]/gi, '*').replace(/[÷:]/g, '/').replace(/[−–]/g, '-');
    let i = 0;
    const fail = () => { throw new Error('syntax'); };
    function expr() {
      let v = term();
      while (s[i] === '+' || s[i] === '-') { const op = s[i++]; const r = term(); v = op === '+' ? v + r : v - r; }
      return v;
    }
    function term() {
      let v = factor();
      while (s[i] === '*' || s[i] === '/') { const op = s[i++]; const r = factor(); v = op === '*' ? v * r : v / r; }
      return v;
    }
    function factor() {
      if (s[i] === '-') { i++; return -factor(); }
      if (s[i] === '+') { i++; return factor(); }
      if (s[i] === '(') { i++; const v = expr(); if (s[i++] !== ')') fail(); return v; }
      const m = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i));
      if (!m) fail();
      i += m[0].length;
      return parseFloat(m[0]);
    }
    if (!s) fail();
    const v = expr();
    if (i !== s.length || !Number.isFinite(v)) fail();
    return v;
  }

  let calc = null;

  function openCalculator() {
    if (calc) { calc.root.classList.add('calc-flash'); setTimeout(() => calc && calc.root.classList.remove('calc-flash'), 300); calc.display.focus(); return; }
    const w = createWindow({ title: 'Калькулятор', className: 'calc', minMax: false, onClose: () => { w.root.remove(); calc = null; } });
    const display = el('input', { class: 'inp calc-display', type: 'text', 'aria-label': 'Выражение', autocomplete: 'off' });
    let justEvaluated = false;

    const compute = () => {
      try {
        const v = evaluate(display.value);
        display.value = String(Number(v.toPrecision(12))).replace('.', ',');
      } catch (e) {
        display.value = 'Ошибка';
      }
      justEvaluated = true;
    };
    const press = key => {
      if (display.value === 'Ошибка') display.value = '';
      if (key === 'C') { display.value = ''; justEvaluated = false; }
      else if (key === '←') { display.value = display.value.slice(0, -1); justEvaluated = false; }
      else if (key === '=') compute();
      else {
        if (justEvaluated && /[\d,(]/.test(key)) display.value = '';
        display.value += key;
        justEvaluated = false;
      }
      display.focus();
    };
    const keys = ['C', '←', '(', ')', '7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', ',', '=', '+'];
    const labels = { '/': '÷', '*': '×', '-': '−' };
    const pad = el('div', { class: 'calc-pad' },
      keys.map(k => el('button', { class: 'btn calc-key' + (k === '=' ? ' calc-eq' : ''), type: 'button', onclick: () => press(k) }, labels[k] || k)));
    display.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); compute(); }
      else if (e.key === 'Escape') { e.preventDefault(); display.value = ''; }
      else if (justEvaluated && e.key.length === 1) {
        if (/[\d,.(]/.test(e.key)) display.value = '';
        justEvaluated = false;
      }
    });
    w.body.append(display, pad, el('div', { class: 'calc-hint' }, 'Можно вводить выражение с клавиатуры, Enter — вычислить.'));
    w.status.remove();

    // Перетаскивание за заголовок.
    w.titleBar.addEventListener('pointerdown', e => {
      if (e.target.closest('.wc')) return;
      const r = w.root.getBoundingClientRect();
      const dx = e.clientX - r.left, dy = e.clientY - r.top;
      w.titleBar.setPointerCapture(e.pointerId);
      const move = ev => {
        const x = Math.min(Math.max(0, ev.clientX - dx), window.innerWidth - 60);
        const y = Math.min(Math.max(0, ev.clientY - dy), window.innerHeight - 30);
        Object.assign(w.root.style, { left: x + 'px', top: y + 'px', right: 'auto' });
      };
      const up = () => { w.titleBar.removeEventListener('pointermove', move); w.titleBar.removeEventListener('pointerup', up); };
      w.titleBar.addEventListener('pointermove', move);
      w.titleBar.addEventListener('pointerup', up);
    });

    document.body.append(w.root);
    calc = { root: w.root, display };
    display.focus();
  }

  function closeCalculator() {
    if (calc) { calc.root.remove(); calc = null; }
  }

  root.GTUI = {
    el, svg, parseNum, fmtNum, near, TOL, loadStore, saveStore, hash,
    createWindow, msgBox, promptBox, confirmBox, evaluate, openCalculator, closeCalculator,
  };
})(window);
