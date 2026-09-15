/* D01T01 — тренажёр: логика приложения (vanilla JS, без зависимостей)
   Возможности: локальное сохранение (localStorage + файл), две темы,
   перелистывание вопросов, подсказки, отметка «Повторить»,
   повторение отмеченного/ошибочного в конце сессии и режим «Повторение». */
(function () {
  'use strict';

  var D = window.STUDY_DATA;
  var app = document.getElementById('app');
  var modalHost = document.getElementById('modal');
  var toastEl = document.getElementById('toast');

  var STORE_KEY = 'd01t01.progress.v2';
  var LEGACY_KEY = 'd01t01.progress.v1';
  var EXPORT_TAG = 'd01t01-trainer';
  var SCHEMA = 2;

  /* ============================== утилиты ============================== */

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function num(x, d) { return typeof x === 'number' && isFinite(x) ? x : d; }

  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }

  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function fmtClock(ts) {
    var d = new Date(ts || Date.now());
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function fmtStamp(ts) {
    var d = new Date(ts || Date.now());
    return pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) + ' · ' + fmtClock(d);
  }

  function fmtBytes(n) {
    if (n < 1024) return n + ' Б';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1).replace('.', ',') + ' КБ';
    return (n / 1024 / 1024).toFixed(2).replace('.', ',') + ' МБ';
  }

  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2200);
  }

  function copy(text, doneMsg) {
    var done = function () { toast(doneMsg || 'Скопировано'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text, done); });
    } else { fallbackCopy(text, done); }
  }

  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.top = '-1000px';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('Не удалось скопировать'); }
    document.body.removeChild(ta);
  }

  /* ============================== локальное сохранение ============================== */

  var DB = (function () {
    var cache = null;
    var lastSaved = 0;
    var warnOnce = false;

    function defaults() {
      return {
        v: SCHEMA, theme: '', day: 'all',
        read: {}, best: {}, marks: {}, hard: {},
        stats: { answered: 0, correct: 0, hints: 0, sessions: 0 },
        session: null, updatedAt: 0
      };
    }

    function normalize(raw) {
      var d = defaults();
      if (!isObj(raw)) return d;
      d.theme = raw.theme === 'light' || raw.theme === 'dark' ? raw.theme : '';
      d.day = typeof raw.day === 'string' ? raw.day : 'all';
      d.read = isObj(raw.read) ? raw.read : {};
      d.best = isObj(raw.best) ? raw.best : {};
      d.marks = cleanMarks(raw.marks);
      d.hard = cleanHard(raw.hard);
      var st = isObj(raw.stats) ? raw.stats : {};
      d.stats = {
        answered: num(st.answered, 0), correct: num(st.correct, 0),
        hints: num(st.hints, 0), sessions: num(st.sessions, 0)
      };
      d.session = isObj(raw.session) ? raw.session : null;
      d.updatedAt = num(raw.updatedAt, 0);
      return d;
    }

    function cleanMarks(x) {
      var out = {};
      if (!isObj(x)) return out;
      Object.keys(x).forEach(function (id) {
        if (!ITEM_BY_ID[id]) return;
        var v = x[id];
        out[id] = { kind: (isObj(v) && v.kind === 'what') ? 'what' : (isObj(v) && v.kind ? v.kind : 'pick'), at: isObj(v) ? num(v.at, 0) : 0 };
      });
      return out;
    }

    function cleanHard(x) {
      var out = {};
      if (!isObj(x)) return out;
      Object.keys(x).forEach(function (id) {
        if (!ITEM_BY_ID[id]) return;
        var v = x[id];
        var n = isObj(v) ? num(v.n, 1) : num(v, 1);
        if (n < 1) return;
        out[id] = { n: n, kind: (isObj(v) && v.kind === 'what') ? 'what' : 'pick', at: isObj(v) ? num(v.at, 0) : 0 };
      });
      return out;
    }

    function read() {
      if (cache) return cache;
      var raw = null;
      try { raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { raw = null; }
      cache = normalize(raw);
      if (!raw) migrateLegacy();
      return cache;
    }

    /* переносим данные старой версии (v1) в новую схему — один раз */
    function migrateLegacy() {
      var old = null;
      try { old = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null'); } catch (e) { old = null; }
      if (!isObj(old)) return;
      if (typeof old.day === 'string') cache.day = old.day;
      if (isObj(old.read)) { Object.keys(old.read).forEach(function (k) { cache.read[k] = true; }); }
      if (isObj(old.best)) { Object.keys(old.best).forEach(function (k) { cache.best[k] = old.best[k]; }); }
      write();
    }

    function write() {
      var d = read();
      d.v = SCHEMA;
      d.updatedAt = Date.now();
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(d));
        lastSaved = d.updatedAt;
        return true;
      } catch (e) {
        if (!warnOnce) {
          warnOnce = true;
          toast('Локальное сохранение недоступно — браузер блокирует хранилище');
        }
        return false;
      }
    }

    function get() { return read(); }

    function set(patch) {
      var d = read();
      Object.keys(patch).forEach(function (k) { d[k] = patch[k]; });
      write();
      return d;
    }

    function reset() {
      cache = defaults();
      try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
      write();
    }

    function last() { read(); return lastSaved || cache.updatedAt; }

    function size() {
      try { return (localStorage.getItem(STORE_KEY) || '').length; } catch (e) { return 0; }
    }

    function dump() {
      return JSON.stringify({
        app: EXPORT_TAG, schema: SCHEMA, exportedAt: new Date().toISOString(), data: read()
      }, null, 2);
    }

    function restore(text, mode) {
      var parsed;
      try { parsed = JSON.parse(text); } catch (e) { return 'bad-json'; }
      var data = isObj(parsed) && isObj(parsed.data) ? parsed.data : parsed;
      if (!isObj(data)) return 'bad-shape';
      if (!isObj(data.marks) && !isObj(data.read) && !isObj(data.best) && !isObj(data.stats)) return 'bad-shape';
      var incoming = normalize(data);
      if (mode === 'merge') {
        var cur = read();
        Object.keys(incoming.read).forEach(function (k) { cur.read[k] = true; });
        Object.keys(incoming.marks).forEach(function (k) { cur.marks[k] = incoming.marks[k]; });
        Object.keys(incoming.hard).forEach(function (k) {
          var prev = cur.hard[k] || { n: 0, kind: incoming.hard[k].kind, at: 0 };
          cur.hard[k] = { n: Math.max(prev.n, incoming.hard[k].n), kind: incoming.hard[k].kind, at: Math.max(prev.at || 0, incoming.hard[k].at || 0) };
        });
        Object.keys(incoming.best).forEach(function (k) {
          cur.best[k] = Math.max(num(cur.best[k], 0), num(incoming.best[k], 0));
        });
        cur.stats.answered += incoming.stats.answered;
        cur.stats.correct += incoming.stats.correct;
        cur.stats.hints += incoming.stats.hints;
        cur.stats.sessions += incoming.stats.sessions;
        if (!cur.session && incoming.session) cur.session = incoming.session;
        write();
      } else {
        cache = incoming;
        write();
      }
      return 'ok';
    }

    return { get: get, set: set, write: write, reset: reset, last: last, size: size, dump: dump, restore: restore };
  })();

  var ITEM_BY_ID = {};
  D.items.forEach(function (i) { ITEM_BY_ID[i.id] = i; });

  function marks() { return DB.get().marks; }
  function hard() { return DB.get().hard; }
  function isMarked(id) { return !!marks()[id]; }

  function toggleMark(id, kind) {
    var m = marks();
    if (m[id]) {
      delete m[id];
      DB.write();
      return false;
    }
    m[id] = { kind: kind === 'what' ? 'what' : 'pick', at: Date.now() };
    DB.write();
    return true;
  }

  function registerWrong(q) {
    var h = hard();
    var prev = h[q.id] || { n: 0 };
    h[q.id] = { n: num(prev.n, 0) + 1, kind: q.kind, at: Date.now() };
    DB.write();
  }

  function registerRight(q) {
    var h = hard();
    var prev = h[q.id];
    if (!prev) return;
    if (num(prev.n, 1) <= 1) delete h[q.id];
    else { prev.n = prev.n - 1; prev.at = Date.now(); }
    DB.write();
  }

  function bumpStats(ok, hints) {
    var st = DB.get().stats;
    st.answered += 1;
    if (ok) st.correct += 1;
    st.hints += hints || 0;
    DB.write();
  }

  function markCount() { return Object.keys(marks()).length; }
  function hardCount() { return Object.keys(hard()).length; }

  /* ============================== тема ============================== */

  function systemTheme() {
    try {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    } catch (e) { return 'dark'; }
  }

  function currentTheme() { return DB.get().theme || systemTheme(); }

  var swapTimer = null;

  /* Смена темы — это смена значений CSS-переменных. Если свойство одновременно
     объявлено с transition и берёт значение из var(), браузер может оставить
     старый цвет в отрисованном слое (баг Blink/WebKit). Поэтому на время смены
     темы переходы отключаются, а перерисовка форсируется. */
  function forceRepaint() {
    var root = document.documentElement;
    void root.offsetHeight;
    if (document.body) void document.body.offsetHeight;
    var host = document.getElementById('app');
    if (host) void host.offsetHeight;
    var end = function () { root.classList.remove('theme-swap'); };
    clearTimeout(swapTimer);
    swapTimer = setTimeout(end, 260);
    if (window.requestAnimationFrame) window.requestAnimationFrame(end);
  }

  function applyTheme() {
    var t = currentTheme();
    state.theme = t;
    var root = document.documentElement;
    var body = document.body;

    root.classList.add('theme-swap');
    root.setAttribute('data-theme', t);

    /* Атрибут ставится и на <body>. Причина: браузер (Blink) не всегда
       инвалидирует наследование CSS-переменных от :root — на html значения
       обновляются, а внутри body остаются старые, и страница выглядит
       «непереключившейся». С атрибутом на body переменные пересчитываются
       для самого body, а от него наследуются всеми элементами. */
    if (body) body.setAttribute('data-theme', t);

    /* Фон-канва тоже кэшируется браузером: подставляем вычисленный цвет явно. */
    var bg = '';
    try { bg = getComputedStyle(root).getPropertyValue('--bg').trim(); } catch (e) { bg = ''; }
    root.style.backgroundColor = bg || '';
    if (body) body.style.backgroundColor = bg || '';

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', bg || (t === 'light' ? '#f6f7f4' : '#08090b'));
    syncThemeButtons();
    forceRepaint();
  }

  function themeActionLabel() {
    return state.theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему';
  }

  /* кнопка показывает, на какую тему переключит; текущая — в подписи панели */
  function syncThemeButtons() {
    var dark = state.theme === 'dark';
    var label = dark ? 'Светлая тема' : 'Тёмная тема';
    var title = (dark ? 'Включить светлую тему' : 'Включить тёмную тему') + ' (t) · сейчас ' +
      (dark ? 'тёмная' : 'светлая');
    Array.prototype.forEach.call(document.querySelectorAll('[data-act="theme"]'), function (el) {
      el.setAttribute('title', title);
      el.setAttribute('aria-label', title);
      var icon = el.querySelector('.themebtn__icon');
      if (icon) icon.textContent = dark ? '☀' : '☾';
      var text = el.querySelector('.themebtn__label');
      if (text) text.textContent = label;
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-act="theme-set"]'), function (el) {
      var on = el.getAttribute('data-theme') === state.theme;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-pressed', String(on));
    });
    var now = document.getElementById('theme-now');
    if (now) now.textContent = state.theme === 'dark' ? 'тёмная' : 'светлая';
  }

  function setTheme(t) {
    if (t !== 'light' && t !== 'dark') return;
    if (t === state.theme) return;
    DB.set({ theme: t });
    applyTheme();
    toast(t === 'light' ? 'Включена светлая тема' : 'Включена тёмная тема');
  }

  function toggleTheme() {
    setTheme(state.theme === 'dark' ? 'light' : 'dark');
  }

  /* ============================== состояние ============================== */

  var state = {
    mode: 'home',            // home | read | readDone | pick | what | repeat | done
    day: 'all',
    theme: 'dark',
    readIndex: 0,
    session: null,           // {kind, day, phase, list[], repeat[], i}
    summary: null,
    panel: null,             // null | 'save'
    confirmReset: false
  };

  var MODE_META = {
    read: { n: '01', title: 'Читать', desc: 'Материал по квестам: цель, шаги, команды и проверка результата.' },
    pick: { n: '02', title: 'Команды', desc: 'Дана задача — выбери правильную команду или часть кода.' },
    what: { n: '03', title: 'Разбор кода', desc: 'Дана команда — выбери, что она делает.' },
    repeat: { n: '04', title: 'Повторение', desc: 'Сложные и отмеченные вопросы: смешанные задания по всем дням.' }
  };

  var QUIZ_KINDS = { pick: 1, what: 1, repeat: 1 };

  function dayMeta(id) {
    for (var i = 0; i < D.days.length; i++) if (D.days[i].id === id) return D.days[i];
    return D.days[0];
  }

  function dayOk(id) { return D.days.some(function (d) { return d.id === id; }); }

  /* ============================== выборка контента ============================== */

  function readCards(day) {
    var cards = [];
    if (day === 'all' || day === 'd1') cards.push({ kind: 'intro', id: 'intro' });
    D.quests.forEach(function (q) {
      if (day === 'all' || q.day === day) cards.push({ kind: 'quest', id: q.id, quest: q });
    });
    if (day === 'all' || day === 'd2') {
      cards.push({ kind: 'final', id: 'final' });
      cards.push({ kind: 'flow', id: 'flow' });
    }
    cards.push({ kind: 'cheatsheet', id: 'cheatsheet' });
    return cards;
  }

  function itemModeOk(item, kind) {
    var m = item.modes || ['pick', 'what'];
    return m.indexOf(kind) !== -1;
  }

  function itemDayOk(item, day) {
    return day === 'all' || item.day === day;
  }

  function distractors(item, pool, kind, need, strict) {
    if (strict === undefined) strict = 2;
    var seen = {};
    [item.cmd, item.what].forEach(function (t) { seen[t] = 1; });
    var tiers = [
      function (x) { return x.fam !== item.fam && x.dom !== item.dom; },
      function (x) { return x.dom !== item.dom; },
      function () { return true; }
    ];
    var out = [];
    for (var t = 0; t < tiers.length && out.length < need; t++) {
      var cands = shuffle(pool.filter(function (x) {
        if (x.id === item.id) return false;
        if (!itemModeOk(x, kind)) return false;
        if (out.indexOf(x) !== -1) return false;
        if (seen[kind === 'pick' ? x.cmd : x.what]) return false;
        return tiers[t](x);
      }));
      for (var i = 0; i < cands.length && out.length < need; i++) {
        var key = kind === 'pick' ? cands[i].cmd : cands[i].what;
        if (seen[key]) continue;
        seen[key] = 1;
        out.push(cands[i]);
      }
      if (t >= strict && out.length >= need) break;
    }
    return out;
  }

  function fallbackHint(item, kind) {
    if (kind === 'pick') {
      var w = String(item.cmd).split(/\s+/)[0];
      return 'Ответ начинается с «' + w + '».';
    }
    var what = String(item.what).split(/\s+/).slice(0, 2).join(' ');
    return 'Описание начинается со слов «' + what + '…».';
  }

  function makeQuestion(item, kind, pool) {
    var use = pool || D.items;
    var wrong = distractors(item, use, kind, 3);
    if (wrong.length < 3) return null;
    var all = shuffle([item].concat(wrong));
    var q = {
      id: item.id, kind: kind, quest: item.quest, day: item.day,
      prompt: kind === 'pick' ? item.task : item.cmd,
      promptIsCode: kind === 'what',
      options: all.map(function (x) { return kind === 'pick' ? x.cmd : x.what; }),
      codes: all.map(function (x) { return x.cmd; }),
      correctIndex: all.indexOf(item),
      why: item.why || '',
      hint: item.hint || fallbackHint(item, kind),
      pick: null, ok: null,
      marked: isMarked(item.id),
      hintShown: false, fifty: null
    };
    return q;
  }

  function buildQuestions(kind, day) {
    var pool = D.items.filter(function (i) { return itemDayOk(i, day); });
    var usable = pool.filter(function (i) { return itemModeOk(i, kind); });
    var list = [];
    shuffle(usable).forEach(function (item) {
      var q = makeQuestion(item, kind, pool);
      if (q) list.push(q);
    });
    return list;
  }

  /* источник для режима «Повторение»: отмеченные вручную + сложные (ошибки) */
  function repeatSourceIds() {
    var out = [], seen = {}, m = marks(), h = hard();
    Object.keys(m).forEach(function (id) { if (!seen[id]) { seen[id] = 1; out.push(id); } });
    Object.keys(h).forEach(function (id) { if (!seen[id]) { seen[id] = 1; out.push(id); } });
    return out;
  }

  function kindForItem(item) {
    var m = marks()[item.id], h = hard()[item.id];
    if (h && h.kind) return h.kind;
    if (m && m.kind) return m.kind;
    var modes = item.modes || ['pick', 'what'];
    return modes.length === 1 ? modes[0] : 'pick';
  }

  function buildRepeatQuestions() {
    var list = [];
    repeatSourceIds().forEach(function (id) {
      var item = ITEM_BY_ID[id];
      if (!item) return;
      var kind = kindForItem(item);
      if (!itemModeOk(item, kind)) kind = itemModeOk(item, 'pick') ? 'pick' : 'what';
      var q = makeQuestion(item, kind, D.items);
      if (q) list.push(q);
    });
    return list;
  }

  function repeatSourceCount() { return buildRepeatQuestions().length; }

  /* ============================== анимации ============================== */

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function burst(node) {
    if (!node || reducedMotion()) return;
    var host = document.createElement('span');
    host.className = 'burst';
    for (var i = 0; i < 12; i++) {
      var p = document.createElement('i');
      var a = (i / 12) * Math.PI * 2 + Math.random() * 0.5;
      var d = 26 + Math.random() * 34;
      p.style.setProperty('--tx', Math.cos(a).toFixed(2) * d + 'px');
      p.style.setProperty('--ty', Math.sin(a).toFixed(2) * d + 'px');
      p.style.setProperty('--dl', (Math.random() * 60).toFixed(0) + 'ms');
      host.appendChild(p);
    }
    node.appendChild(host);
    setTimeout(function () { if (host.parentNode) host.parentNode.removeChild(host); }, 900);
  }

  function ringChart(pct) {
    var r = 54, c = 2 * Math.PI * r;
    var off = c * (1 - pct / 100);
    return '<svg class="ring" viewBox="0 0 130 130" aria-hidden="true">' +
      '<circle cx="65" cy="65" r="' + r + '" class="ring__bg"/>' +
      '<circle cx="65" cy="65" r="' + r + '" class="ring__fg" style="stroke-dasharray:' + c.toFixed(1) + ';stroke-dashoffset:' + c.toFixed(1) + '" data-off="' + off.toFixed(1) + '"/>' +
      '</svg>' +
      '<span class="ring__num" data-target="' + pct + '">0</span>';
  }

  function animateRing() {
    var fg = app.querySelector('.ring__fg');
    var numEl = app.querySelector('.ring__num');
    if (!fg || !numEl) return;
    if (reducedMotion()) {
      fg.style.strokeDashoffset = fg.getAttribute('data-off');
      numEl.textContent = (numEl.getAttribute('data-target') || 0) + '%';
      return;
    }
    requestAnimationFrame(function () { fg.style.strokeDashoffset = fg.getAttribute('data-off'); });
    var target = parseInt(numEl.getAttribute('data-target'), 10) || 0;
    var t0 = performance.now(), dur = 700;
    (function tick(now) {
      var k = clamp((now - t0) / dur, 0, 1);
      var e = 1 - Math.pow(1 - k, 3);
      numEl.textContent = Math.round(target * e) + '%';
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  }

  function scrollTop(smooth) {
    window.scrollTo({ top: 0, behavior: smooth === false || reducedMotion() ? 'auto' : 'smooth' });
  }

  /* ============================== компоненты ============================== */

  function dayChips(compact) {
    return '<div class="chips' + (compact ? ' chips--compact' : '') + '" role="tablist" aria-label="Фильтр по дням">' +
      D.days.map(function (d) {
        return '<button class="chip' + (state.day === d.id ? ' is-active' : '') + '" role="tab" aria-selected="' + (state.day === d.id) + '"' +
          ' data-act="day" data-day="' + d.id + '">' +
          '<span class="chip__label">' + esc(d.label) + '</span>' +
          '<span class="chip__short">' + esc(d.short || d.label) + '</span>' +
          '<span class="chip__hint">' + esc(d.hint) + '</span>' +
        '</button>';
      }).join('') + '</div>';
  }

  function themeButton(wide) {
    var dark = state.theme === 'dark';
    return '<button class="themebtn' + (wide ? ' themebtn--wide' : '') + '" data-act="theme" type="button"' +
      ' title="' + esc(themeActionLabel()) + ' (t)">' +
      '<span class="themebtn__icon" aria-hidden="true">' + (dark ? '☀' : '☾') + '</span>' +
      '<span class="themebtn__label">' + (dark ? 'Светлая тема' : 'Тёмная тема') + '</span>' +
    '</button>';
  }

  function saveButton(wide) {
    return '<button class="themebtn' + (wide ? ' themebtn--wide' : '') + '" data-act="panel" data-panel="save" type="button"' +
      ' title="Локальное сохранение прогресса" aria-label="Локальное сохранение прогресса">' +
      '<span class="themebtn__icon" aria-hidden="true">⤓</span>' +
      '<span class="themebtn__label">Сохранение</span>' +
    '</button>';
  }

  function modeBar(kind, counter, note) {
    var m = MODE_META[kind] || MODE_META.pick;
    return '<div class="modebar">' +
      '<button class="ghost" data-act="home" aria-label="К режимам">←</button>' +
      '<div class="modebar__title"><span class="modebar__num">' + m.n + '</span>' + esc(m.title) +
        (note ? '<span class="modebar__note">' + esc(note) + '</span>' : '') + '</div>' +
      '<div class="modebar__right">' +
        saveButton(false) + themeButton(false) +
        '<span class="modebar__count">' + esc(counter) + '</span>' +
        '<button class="ghost" data-act="home" aria-label="Закрыть">✕</button>' +
      '</div>' +
    '</div>';
  }

  function pipsQuiz(list, cur) {
    return '<div class="pips" id="pips" role="tablist" aria-label="Перелистывание вопросов">' +
      list.map(function (q, i) {
        var c = 'pip';
        if (q.pick !== null) c += q.ok ? ' is-ok' : ' is-bad';
        if (q.marked) c += ' is-marked';
        if (i === cur) c += ' is-current';
        var t = 'Вопрос ' + (i + 1) + ' из ' + list.length +
          (q.pick !== null ? (q.ok ? ' · верно' : ' · ошибка') : ' · без ответа') +
          (q.marked ? ' · отмечен для повтора' : '');
        return '<button class="' + c + '" role="tab" aria-selected="' + (i === cur) + '" data-act="jump" data-to="' + i + '"' +
          ' title="' + esc(t) + '" aria-label="' + esc(t) + '">' + (i + 1) + '</button>';
      }).join('') +
    '</div>';
  }

  function pipsRead(cards, cur, readMap) {
    return '<div class="pips pips--read" id="pips" role="tablist" aria-label="Содержание">' +
      cards.map(function (c, i) {
        var c2 = 'pip' + (readMap[c.id] ? ' is-read' : '') + (i === cur ? ' is-current' : '');
        var label = cardLabel(c);
        return '<button class="' + c2 + '" role="tab" aria-selected="' + (i === cur) + '" data-act="jump" data-to="' + i + '"' +
          ' title="' + esc(label) + '" aria-label="' + esc(label) + '">' + (i + 1) + '</button>';
      }).join('') +
    '</div>';
  }

  function cardLabel(c) {
    if (c.kind === 'quest') return 'Quest ' + c.quest.num + ' — ' + c.quest.title;
    if (c.kind === 'intro') return D.intro.title;
    if (c.kind === 'final') return D.final.title;
    if (c.kind === 'flow') return D.flow.title;
    if (c.kind === 'cheatsheet') return D.cheatsheet.title;
    return c.id;
  }

  function bestLabel(kind) {
    var best = (DB.get().best || {})[kind];
    return best ? ' · лучший ' + best + '%' : '';
  }

  /* ------------------------------ главный экран ------------------------------ */

  function readProgress(day) {
    var cards = readCards(day);
    var prog = DB.get().read || {};
    var done = cards.filter(function (c) { return prog[c.id]; }).length;
    return { done: done, total: cards.length };
  }

  function draftInfo() {
    var raw = DB.get().session;
    if (!isObj(raw) || !QUIZ_KINDS[raw.kind]) return null;
    var list = raw.list || [];
    if (!list.length) return null;
    var answered = list.filter(function (q) { return q && q.pick !== null && q.pick !== undefined; }).length;
    /* черновик без единого ответа на первом вопросе не считаем прогрессом */
    if (!answered && num(raw.i, 0) === 0) return null;
    var meta = MODE_META[raw.kind];
    return {
      kind: raw.kind,
      title: meta ? meta.title : 'Сессия',
      i: clamp(num(raw.i, 0), 0, list.length - 1),
      total: list.length,
      answered: answered,
      phase: raw.phase === 'repeat' ? 'repeat' : (raw.phase === 'prep' ? 'prep' : 'main'),
      at: num(raw.at, 0)
    };
  }

  function renderHome() {
    var day = state.day;
    var dm = dayMeta(day);
    var rp = readProgress(day);
    var repeatN = repeatSourceCount();
    var st = DB.get().stats;
    var acc = st.answered ? Math.round((st.correct / st.answered) * 100) + '%' : '—';
    var draft = draftInfo();

    var cards = [
      { mode: 'read', meta: MODE_META.read, extra: rp.done + ' / ' + rp.total + ' карточек' + (rp.total && rp.done === rp.total ? ' · прочитано' : '') },
      { mode: 'pick', meta: MODE_META.pick, extra: buildQuestions('pick', day).length + ' вопросов' + bestLabel('pick') },
      { mode: 'what', meta: MODE_META.what, extra: buildQuestions('what', day).length + ' вопросов' + bestLabel('what') },
      {
        mode: 'repeat', meta: MODE_META.repeat,
        extra: repeatN ? repeatN + ' ' + plural(repeatN, 'вопрос', 'вопроса', 'вопросов') + ' · по всем дням' : 'пока пусто — отметьте вопросы кнопкой «Повторить»'
      }
    ];

    app.innerHTML =
      '<div class="screen screen--home">' +
        '<section class="hero">' +
          '<div class="hero__top">' +
            '<span class="kicker">' + esc(D.meta.code) + '</span>' +
            '<h1 class="hero__title">' + esc(D.meta.title) + '</h1>' +
            '<p class="hero__sub">' + esc(D.meta.subtitle) + ' · <code>' + esc(D.meta.repo) + '/src</code></p>' +
          '</div>' +

          '<div class="hero__tools">' + themeButton(true) + saveButton(true) + '</div>' +

          (draft
            ? '<div class="resume">' +
                '<div class="resume__body">' +
                  '<span class="resume__tag">Прогресс сессии сохранён локально</span>' +
                  '<b class="resume__title">Продолжить: ' + esc(draft.title) + ' — ' +
                    (draft.phase === 'repeat' ? 'повторение, вопрос ' : 'вопрос ') + (draft.i + 1) + ' из ' + draft.total + '</b>' +
                  '<span class="resume__sub">Отвечено ' + draft.answered + ' из ' + draft.total + ' · сохранено ' + esc(fmtStamp(draft.at)) + '</span>' +
                '</div>' +
                '<div class="resume__actions">' +
                  '<button class="btn btn--sm btn--primary" data-act="resume">Продолжить →</button>' +
                  '<button class="btn btn--sm btn--ghost" data-act="drop-draft">Удалить</button>' +
                '</div>' +
              '</div>'
            : '') +

          '<div class="daypick">' +
            '<div class="daypick__label">Фильтр по дням' +
              '<span class="daypick__now">' + esc(dm.label) + ' · ' + esc(dm.hint) + '</span>' +
            '</div>' +
            dayChips(false) +
          '</div>' +
        '</section>' +

        '<section class="modes" aria-label="Режимы">' +
          cards.map(function (c, i) {
            return '<button class="mode-card" data-act="mode" data-mode="' + c.mode + '" style="--d:' + i * 70 + 'ms">' +
              '<span class="mode-card__num">' + c.meta.n + '</span>' +
              '<span class="mode-card__body">' +
                '<span class="mode-card__title">' + esc(c.meta.title) + '</span>' +
                '<span class="mode-card__desc">' + esc(c.meta.desc) + '</span>' +
                '<span class="mode-card__meta">' + esc(c.extra) + '</span>' +
              '</span>' +
              '<span class="mode-card__arrow" aria-hidden="true">→</span>' +
            '</button>';
          }).join('') +
        '</section>' +

        '<section class="statsline" aria-label="Статистика">' +
          '<span class="statsline__item"><b>' + st.answered + '</b> ' + plural(st.answered, 'ответ', 'ответа', 'ответов') + '</span>' +
          '<span class="statsline__item"><b>' + acc + '</b> точность</span>' +
          '<span class="statsline__item"><b>' + markCount() + '</b> отмечено</span>' +
          '<span class="statsline__item"><b>' + hardCount() + '</b> сложных</span>' +
          '<span class="statsline__item"><b>' + st.sessions + '</b> ' + plural(st.sessions, 'сессия', 'сессии', 'сессий') + '</span>' +
          '<span class="statsline__item">сохранено ' + esc(fmtClock(DB.last())) + '</span>' +
        '</section>' +

        '<footer class="home-foot">' +
          '<span>Обязательная часть — Quest 1–7. Бонус Quest 8–10 — по желанию.</span>' +
          '<span class="home-foot__keys"><kbd>←</kbd><kbd>→</kbd> листать · <kbd>1</kbd>–<kbd>4</kbd> ответ · <kbd>h</kbd> подсказка · <kbd>m</kbd> отметить · <kbd>t</kbd> тема · <kbd>esc</kbd> выход</span>' +
          '<button class="linkbtn" data-act="panel" data-panel="save">Данные и сохранение</button>' +
        '</footer>' +
      '</div>';

    syncThemeButtons();
  }

  /* ------------------------------ чтение ------------------------------ */

  function renderRead() {
    var cards = readCards(state.day);
    state.readIndex = clamp(state.readIndex, 0, cards.length - 1);
    var card = cards[state.readIndex];
    var readMap = DB.get().read || {};
    var pct = ((state.readIndex) / cards.length) * 100;

    app.innerHTML =
      '<div class="screen screen--mode">' +
        modeBar('read', (state.readIndex + 1) + ' / ' + cards.length) +
        '<div class="progress"><span style="width:' + pct.toFixed(1) + '%"></span></div>' +
        '<article class="card card--read" data-kind="' + card.kind + '">' + readCardHTML(card) + '</article>' +
        pipsRead(cards, state.readIndex, readMap) +
        '<nav class="navbar">' +
          '<button class="btn btn--ghost" data-act="prev"' + (state.readIndex === 0 ? ' disabled' : '') + '>← Назад</button>' +
          '<div class="navbar__hint">' + esc(dayMeta(state.day).label) + ' · ' + esc(cardLabel(card)) + '</div>' +
          (state.readIndex === cards.length - 1
            ? '<button class="btn btn--primary" data-act="finish-read">Завершить</button>'
            : '<button class="btn btn--primary" data-act="next">Дальше →</button>') +
        '</nav>' +
      '</div>';
    syncThemeButtons();
  }

  function cmdBlock(c) {
    return '<div class="cmd">' +
      '<button class="cmd__copy" data-act="copy" data-cmd="' + esc(c.c) + '" title="Скопировать" aria-label="Скопировать команду">copy</button>' +
      '<code class="cmd__code"><span class="cmd__ps">❯</span> ' + esc(c.c) + '</code>' +
      (c.n ? '<span class="cmd__note">' + esc(c.n) + '</span>' : '') +
    '</div>';
  }

  function outBlock(text, label) {
    return '<div class="out">' +
      '<span class="out__label">' + esc(label || 'ожидаемый вывод') + '</span>' +
      '<pre class="out__pre">' + esc(text) + '</pre>' +
    '</div>';
  }

  function treeBlock(lines) {
    return '<pre class="tree">' + lines.map(function (l) { return esc(l); }).join('\n') + '</pre>';
  }

  function stepHTML(s, n) {
    return '<div class="step">' +
      '<div class="step__num">' + n + '</div>' +
      '<div class="step__body">' +
        '<div class="step__title">' + esc(s.t) + '</div>' +
        (s.d ? '<p class="step__desc">' + esc(s.d) + '</p>' : '') +
        (s.diff ? '<div class="diff"><code class="diff__from">- ' + esc(s.diff.from) + '</code><code class="diff__to">+ ' + esc(s.diff.to) + '</code></div>' : '') +
        (s.cmds && s.cmds.length ? s.cmds.map(cmdBlock).join('') : '') +
        (s.out ? outBlock(s.out) : '') +
        (s.note ? '<p class="step__note">' + esc(s.note) + '</p>' : '') +
      '</div>' +
    '</div>';
  }

  function readCardHTML(card) {
    if (card.kind === 'intro') {
      var i = D.intro;
      return '' +
        '<header class="card__head">' +
          '<span class="tag">' + esc(i.kicker) + '</span>' +
          '<h2 class="card__title">' + esc(i.title) + '</h2>' +
        '</header>' +
        i.body.map(function (t) { return '<p class="card__text">' + esc(t) + '</p>'; }).join('') +
        treeBlock(i.tree) +
        i.steps.map(function (s, n) { return stepHTML(s, n + 1); }).join('');
    }

    if (card.kind === 'quest') {
      var q = card.quest;
      return '' +
        '<header class="card__head">' +
          '<span class="tag tag--accent">Quest ' + q.num + '</span>' +
          '<h2 class="card__title">' + esc(q.title) + '</h2>' +
          '<p class="card__goal"><b>Цель:</b> ' + esc(q.goal) + '</p>' +
        '</header>' +
        (q.branch ? '<p class="card__note">Ветка: <code>' + esc(q.branch) + '</code></p>' : '') +
        (q.file ? '<p class="card__note">Файл: <code>' + esc(q.file) + '</code></p>' : '') +
        (q.tree ? treeBlock(q.tree) : '') +
        (q.pre ? '<p class="card__text card__text--muted">' + esc(q.pre) + '</p>' : '') +
        q.steps.map(function (s, n) { return stepHTML(s, n + 1); }).join('') +
        (q.note ? '<div class="callout"><b>Важно.</b> ' + esc(q.note) + '</div>' : '') +
        '<div class="result"><span class="result__mark">✓</span><span><b>Итог:</b> ' + esc(q.result) + '</span></div>';
    }

    if (card.kind === 'final') {
      var f = D.final;
      return '<header class="card__head">' +
          '<span class="tag tag--accent">' + esc(f.kicker) + '</span>' +
          '<h2 class="card__title">' + esc(f.title) + '</h2>' +
        '</header>' +
        f.steps.map(function (s, n) { return stepHTML(s, n + 1); }).join('') +
        '<div class="callout callout--warn">' +
          '<b>' + esc(f.warn.t) + '</b>' +
          '<p>' + esc(f.warn.d) + '</p>' +
          '<p class="callout__bad">Так делать нельзя: ' + f.warn.bad.map(function (b) { return '<code>' + esc(b) + '</code>'; }).join(' · ') + '</p>' +
          '<p>' + esc(f.warn.good) + '</p>' +
        '</div>';
    }

    if (card.kind === 'flow') {
      var fl = D.flow;
      return '<header class="card__head">' +
          '<span class="tag">' + esc(fl.kicker) + '</span>' +
          '<h2 class="card__title">' + esc(fl.title) + '</h2>' +
        '</header>' +
        '<ol class="flow">' + fl.chain.map(function (s, n) {
          var isQuest = /^Quest/.test(s);
          return '<li class="flow__item' + (isQuest ? ' flow__item--quest' : '') + '" style="--d:' + (n * 45) + 'ms">' + esc(s) + '</li>';
        }).join('') + '</ol>' +
        '<div class="callout">' + fl.bonus.map(function (b) { return esc(b); }).join('<br>') + '</div>';
    }

    if (card.kind === 'cheatsheet') {
      var cs = D.cheatsheet;
      return '<header class="card__head">' +
          '<span class="tag">' + esc(cs.kicker) + '</span>' +
          '<h2 class="card__title">' + esc(cs.title) + '</h2>' +
        '</header>' +
        cs.groups.map(function (g, gi) {
          return '<div class="sheet" style="--d:' + gi * 60 + 'ms">' +
            '<div class="sheet__title">' + esc(g.g) + '</div>' +
            g.rows.map(function (r) {
              return '<div class="sheet__row"><code class="sheet__cmd">' + esc(r[0]) + '</code><span class="sheet__what">' + esc(r[1]) + '</span></div>';
            }).join('') +
          '</div>';
        }).join('');
    }
    return '';
  }

  /* ------------------------------ квиз ------------------------------ */

  function curList(s) { return s.phase === 'repeat' ? s.repeat : s.list; }

  function statOf(list) {
    var st = { total: list.length, correct: 0, wrong: 0, answered: 0, hints: 0, marked: 0 };
    list.forEach(function (q) {
      if (q.pick !== null) { st.answered++; if (q.ok) st.correct++; else st.wrong++; }
      if (q.hintShown) st.hints++;
      if (q.marked) st.marked++;
    });
    return st;
  }

  function findQuestion(id) {
    var s = state.session;
    if (!s) return null;
    var all = s.list.concat(s.repeat);
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }

  /* отмеченные вручную и ошибочные вопросы основной части — в повтор */
  function repeatCandidates(s) {
    var seen = {}, out = [];
    s.list.forEach(function (q) {
      if (!(q.marked || q.ok === false)) return;
      if (seen[q.id]) return;
      seen[q.id] = 1;
      out.push(q);
    });
    return out;
  }

  function requeue(q) {
    var pairs = q.options.map(function (o, i) {
      return { text: o, code: q.codes[i] || '', ok: i === q.correctIndex };
    });
    var mixed = shuffle(pairs);
    var correct = 0;
    for (var i = 0; i < mixed.length; i++) if (mixed[i].ok) correct = i;
    return {
      id: q.id, kind: q.kind, quest: q.quest, day: q.day,
      prompt: q.prompt, promptIsCode: q.promptIsCode,
      options: mixed.map(function (p) { return p.text; }),
      codes: mixed.map(function (p) { return p.code; }),
      correctIndex: correct,
      why: q.why, hint: q.hint || '',
      pick: null, ok: null,
      marked: isMarked(q.id),
      hintShown: false, fifty: null
    };
  }

  function startSession(kind, day, list) {
    var sessionList = list || (kind === 'repeat' ? buildRepeatQuestions() : buildQuestions(kind, day));
    if (!sessionList.length) {
      toast(kind === 'repeat'
        ? 'Пока нечего повторять: отметьте вопросы кнопкой «Повторить»'
        : 'Нет вопросов для этого фильтра');
      return false;
    }
    state.session = {
      kind: kind, day: day, phase: 'main',
      list: sessionList, repeat: [], i: 0,
      startedAt: Date.now()
    };
    state.summary = null;
    state.mode = kind;
    saveDraft();
    render();
    scrollTop();
    return true;
  }

  function optClass(q, i) {
    var c = 'opt' + (q.kind === 'pick' ? ' opt--code' : '');
    if (q.pick === null && q.fifty && q.fifty.indexOf(i) !== -1) c += ' is-off';
    if (q.pick !== null) {
      c += ' is-locked';
      if (i === q.correctIndex) c += (i === q.pick ? ' is-ok' : ' is-ok-hint');
      else if (i === q.pick) c += ' is-bad';
      else if (q.fifty && q.fifty.indexOf(i) !== -1) c += ' is-off';
      else c += ' is-dim';
    }
    return c;
  }

  function optMark(q, i) {
    if (q.pick === null) return '';
    if (i === q.correctIndex) return '✓';
    if (i === q.pick) return '✕';
    return '';
  }

  function markButtonHTML(q, small) {
    return '<button class="markbtn' + (small ? ' markbtn--sm' : '') + (q.marked ? ' is-on' : '') + '"' +
      ' data-act="mark" data-id="' + q.id + '" aria-pressed="' + (q.marked ? 'true' : 'false') + '"' +
      ' title="Отметить вопрос для повтора (m)">' +
      '<span class="markbtn__icon" aria-hidden="true">' + (q.marked ? '★' : '☆') + '</span>' +
      '<span class="markbtn__label">' + (q.marked ? 'Отмечено' : 'Повторить') + '</span>' +
    '</button>';
  }

  function hintZoneHTML(q) {
    if (!q.hintShown) {
      return '<div class="hintzone">' +
        '<button class="hintbtn" data-act="hint" title="Показать подсказку (h)">' +
          '<span class="hintbtn__icon" aria-hidden="true">✦</span> Подсказка' +
        '</button>' +
      '</div>';
    }
    return '<div class="hintzone hintzone--open">' +
      '<div class="hint" id="hintbox">' +
        '<span class="hint__icon" aria-hidden="true">✦</span>' +
        '<div class="hint__text">' + esc(q.hint) + '</div>' +
      '</div>' +
      (q.pick === null && !q.fifty
        ? '<button class="hintbtn hintbtn--ghost" data-act="fifty">Убрать два неверных</button>'
        : (q.fifty ? '<span class="hint__used">оставлено два варианта</span>' : '')) +
    '</div>';
  }

  function feedbackHTML(q) {
    if (q.pick === null) return '';
    var ok = q.ok;
    var correctText = q.kind === 'pick'
      ? '<code>' + esc(q.options[q.correctIndex]) + '</code>'
      : esc(q.options[q.correctIndex]);
    return '<div class="feedback__head feedback__head--' + (ok ? 'ok' : 'bad') + '">' +
        '<span class="feedback__icon">' + (ok ? '✓' : '✕') + '</span>' +
        '<b>' + (ok ? 'Верно' : 'Неверно') + '</b>' +
        '<span class="feedback__sub">' + (ok ? 'так и есть' : 'правильный ответ: ' + correctText) + '</span>' +
      '</div>' +
      (q.why ? '<p class="feedback__why">' + esc(q.why) + '</p>' : '') +
      '<div class="feedback__row">' +
        '<span>' + (q.marked ? 'Вопрос отмечен для повтора ★' : 'Можно отметить кнопкой «Повторить» — вопрос вернётся в конце') + '</span>' +
      '</div>';
  }

  function renderQuiz() {
    var s = state.session;
    var list = curList(s);
    var q = list[s.i];
    var isR = s.phase === 'repeat';
    var st = statOf(list);
    var pct = list.length ? (st.answered / list.length) * 100 : 0;
    var locked = q.pick !== null;

    var askHTML = q.kind === 'pick'
      ? '<h2 class="q__ask">' + esc(q.prompt) + '</h2>' +
        '<p class="q__hint">Выберите команду или часть кода</p>'
      : '<h2 class="q__ask">Что делает этот код?</h2>' +
        '<div class="q__code"><code>' + esc(q.prompt) + '</code>' +
        '<button class="cmd__copy" data-act="copy" data-cmd="' + esc(q.prompt) + '">copy</button></div>' +
        '<p class="q__hint">Выберите верное описание</p>';

    app.innerHTML =
      '<div class="screen screen--mode">' +
        modeBar(s.kind, (s.i + 1) + ' / ' + list.length, isR ? 'повторение' : '') +
        '<div class="progress"><span style="width:' + pct.toFixed(1) + '%"></span></div>' +
        (isR
          ? '<div class="roundbar"><span class="tag tag--repeat">Повторение</span>' +
            '<span class="roundbar__text">Отмеченные вопросы и места, где были ошибки. Варианты перемешаны.</span></div>'
          : '') +
        '<article class="card card--quiz" data-kind="' + q.kind + '">' +
          '<div class="q__top">' +
            '<span class="tag tag--quest">Quest ' + q.quest + '</span>' +
            (q.kind === 'what' ? '<span class="tag">разбор кода</span>' : '<span class="tag">команды</span>') +
            markButtonHTML(q, false) +
            '<span class="q__score" aria-live="polite">верно <b>' + st.correct + '</b> · ошибок <b>' + st.wrong + '</b> · ответов <b>' + st.answered + '</b></span>' +
          '</div>' +
          askHTML +
          '<div class="opts" role="list">' +
            q.options.map(function (o, i) {
              var isCode = q.kind === 'pick';
              var dead = locked || (q.pick === null && q.fifty && q.fifty.indexOf(i) !== -1);
              return '<button class="' + optClass(q, i) + '" role="listitem" data-act="opt" data-i="' + i + '"' + (dead ? ' disabled' : '') + '>' +
                '<span class="opt__key">' + (i + 1) + '</span>' +
                '<span class="opt__text">' + (isCode ? '<code>' + esc(o) + '</code>' : esc(o)) + '</span>' +
                '<span class="opt__mark" aria-hidden="true">' + optMark(q, i) + '</span>' +
              '</button>';
            }).join('') +
          '</div>' +
          hintZoneHTML(q) +
          '<div class="feedback' + (locked ? ' is-in ' + (q.ok ? 'is-ok' : 'is-bad') : '') + '" id="feedback" role="status" aria-live="polite">' + feedbackHTML(q) + '</div>' +
        '</article>' +
        pipsQuiz(list, s.i) +
        '<nav class="navbar">' +
          '<button class="btn btn--ghost" data-act="prev"' + (s.i === 0 ? ' disabled' : '') + '>← Назад</button>' +
          '<div class="navbar__hint">' + esc(dayMeta(s.day).label) + ' · ' + esc(isR ? 'повторение' : (MODE_META[s.kind] ? MODE_META[s.kind].title : '')) + ' · вопрос ' + (s.i + 1) + ' из ' + list.length + '</div>' +
          '<button class="btn btn--primary" data-act="next"' + (locked ? '' : ' disabled') + '>' + esc(nextLabel(s)) + '</button>' +
        '</nav>' +
      '</div>';
    syncThemeButtons();
  }

  function nextLabel(s) {
    var list = curList(s);
    if (s.i < list.length - 1) return 'Дальше →';
    if (s.phase === 'main' && repeatCandidates(s).length) return 'К повторению →';
    return 'Итоги →';
  }

  function paintAnswer(q, animate) {
    var opts = app.querySelectorAll('.opt');
    Array.prototype.forEach.call(opts, function (btn, i) {
      btn.className = optClass(q, i);
      btn.disabled = true;
      var mark = btn.querySelector('.opt__mark');
      if (mark) mark.textContent = optMark(q, i);
    });

    var panel = app.querySelector('#feedback');
    if (panel) {
      panel.innerHTML = feedbackHTML(q);
      panel.classList.add('is-in', q.ok ? 'is-ok' : 'is-bad');
    }

    var nextBtn = app.querySelector('.navbar .btn--primary');
    if (nextBtn) {
      nextBtn.disabled = false;
      nextBtn.textContent = nextLabel(state.session);
    }

    if (animate && opts[q.correctIndex]) {
      if (q.ok) burst(opts[q.correctIndex]);
      else {
        var el = opts[q.pick];
        if (el) {
          el.classList.add('shake');
          setTimeout(function () { el.classList.remove('shake'); }, 500);
        }
      }
    }
  }

  function refreshPips() {
    var host = document.getElementById('pips');
    var s = state.session;
    if (!host || !s) return;
    var list = curList(s);
    host.outerHTML = pipsQuiz(list, s.i);

    var score = app.querySelector('.q__score');
    if (score) {
      var st = statOf(list);
      score.innerHTML = 'верно <b>' + st.correct + '</b> · ошибок <b>' + st.wrong + '</b> · ответов <b>' + st.answered + '</b>';
    }
    var bar = app.querySelector('.progress span');
    if (bar) {
      var st2 = statOf(list);
      bar.style.width = (list.length ? (st2.answered / list.length) * 100 : 0).toFixed(1) + '%';
    }
  }

  function answer(pick) {
    var s = state.session;
    if (!s) return;
    var list = curList(s);
    var q = list[s.i];
    if (q.pick !== null) return;
    if (q.fifty && q.fifty.indexOf(pick) !== -1) return;

    q.pick = pick;
    q.ok = pick === q.correctIndex;
    if (q.ok) registerRight(q); else registerWrong(q);
    bumpStats(q.ok, 0);
    paintAnswer(q, true);
    refreshPips();
    saveDraft();

    setTimeout(function () {
      var panel = app.querySelector('#feedback');
      if (!panel) return;
      var r = panel.getBoundingClientRect();
      var nav = app.querySelector('.navbar');
      var navH = nav ? nav.offsetHeight : 0;
      if (r.top > window.innerHeight - navH - 24 || r.top < 12) {
        var y = r.top + window.pageYOffset - 24;
        window.scrollTo({ top: Math.max(0, y), behavior: reducedMotion() ? 'auto' : 'smooth' });
      }
    }, 430);
  }

  function nudge() {
    var card = app.querySelector('.card--quiz');
    if (!card) return;
    card.classList.add('nudge');
    setTimeout(function () { card.classList.remove('nudge'); }, 420);
    toast('Сначала выберите вариант — или полистайте кнопкой «Назад»');
  }

  function gotoQuestion(i) {
    var s = state.session;
    if (!s) return;
    var list = curList(s);
    s.i = clamp(i, 0, list.length - 1);
    saveDraft();
    renderQuiz();
    scrollTop();
  }

  function advance() {
    var s = state.session;
    if (!s) return;
    var list = curList(s);
    var q = list[s.i];
    if (q.pick === null) { nudge(); return; }

    if (s.i < list.length - 1) {
      s.i += 1;
      saveDraft();
      renderQuiz();
      scrollTop();
      return;
    }

    if (s.phase === 'main') {
      var cands = repeatCandidates(s);
      if (cands.length) {
        s.repeat = cands.map(requeue);
        s.phase = 'prep';
        s.i = 0;
        saveDraft();
        render();
        scrollTop();
        return;
      }
    }
    finishSession();
  }

  function showHint(action) {
    var s = state.session;
    if (!s) return;
    var q = curList(s)[s.i];
    if (action === 'fifty') {
      if (q.pick !== null || q.fifty) return;
      var wrongIdx = [];
      for (var i = 0; i < q.options.length; i++) if (i !== q.correctIndex) wrongIdx.push(i);
      q.fifty = shuffle(wrongIdx).slice(0, Math.max(0, q.options.length - 2));
      saveDraft();
      renderQuiz();
      toast('Оставлено два варианта');
      return;
    }
    if (q.hintShown) return;
    q.hintShown = true;
    DB.get().stats.hints += 1;
    DB.write();
    saveDraft();
    var zone = app.querySelector('.hintzone');
    if (zone) zone.outerHTML = hintZoneHTML(q);
    else renderQuiz();
  }

  function toggleQuestionMark(q) {
    if (!q) return;
    q.marked = toggleMark(q.id, q.kind);
    var btn = app.querySelector('.markbtn[data-id="' + q.id + '"]');
    if (btn) {
      btn.classList.toggle('is-on', q.marked);
      btn.setAttribute('aria-pressed', q.marked ? 'true' : 'false');
      var icon = btn.querySelector('.markbtn__icon');
      var label = btn.querySelector('.markbtn__label');
      if (icon) icon.textContent = q.marked ? '★' : '☆';
      if (label) label.textContent = q.marked ? 'Отмечено' : 'Повторить';
    }
    var nextBtn = app.querySelector('.navbar .btn--primary');
    if (nextBtn && state.session) nextBtn.textContent = nextLabel(state.session);
    refreshPips();
    if (state.mode === 'done') render();
    return q.marked;
  }

  function markCurrentQuestion() {
    var s = state.session;
    if (!s) return;
    var q = curList(s)[s.i];
    var on = toggleQuestionMark(q);
    toast(on ? 'Отмечено ★ — вопрос попадёт в повторение' : 'Отметка снята');
    saveDraft();
  }

  /* ------------------------------ повторение в конце ------------------------------ */

  function renderRepeatIntro() {
    var s = state.session;
    var total = s.repeat.length;
    var markedN = s.list.filter(function (q) { return q.marked; }).length;
    var wrongN = s.list.filter(function (q) { return q.ok === false; }).length;

    app.innerHTML =
      '<div class="screen screen--mode">' +
        modeBar(s.kind, total + ' ' + plural(total, 'вопрос', 'вопроса', 'вопросов'), 'этап 2') +
        '<div class="progress"><span style="width:100%"></span></div>' +
        '<article class="card card--done card--repeat">' +
          '<div class="repeat-intro">' +
            '<span class="tag tag--repeat">Этап 2 · повторение</span>' +
            '<h2 class="done__title">Повторим ' + total + ' ' + plural(total, 'вопрос', 'вопроса', 'вопросов') + '</h2>' +
            '<p class="done__sub">Вы отметили кнопкой «Повторить»: <b>' + markedN + '</b>. Ошибок в основной части: <b>' + wrongN + '</b>.' +
              ' Эти вопросы будут заданы ещё раз — варианты перемешаны, ответы сброшены.</p>' +
            '<div class="repeat-intro__list">' +
              s.repeat.slice(0, 12).map(function (q, i) {
                return '<span class="chip chip--mini" style="--d:' + (i * 30) + 'ms">' +
                  '<span class="chip__label">Quest ' + q.quest + '</span>' +
                  (q.marked ? '<span class="chip__hint">★</span>' : '') +
                '</span>';
              }).join('') +
              (total > 12 ? '<span class="chip chip--mini chip--more">и ещё ' + (total - 12) + '</span>' : '') +
            '</div>' +
          '</div>' +
        '</article>' +
        '<nav class="navbar navbar--wrap navbar--static">' +
          '<button class="btn btn--ghost" data-act="home">К режимам</button>' +
          '<button class="btn btn--ghost" data-act="skip-repeat">К итогам</button>' +
          '<button class="btn btn--primary" data-act="start-repeat">Начать повторение →</button>' +
        '</nav>' +
      '</div>';
    syncThemeButtons();
  }

  /* ------------------------------ итоги ------------------------------ */

  function startRepeatRound() {
    var s = state.session;
    if (!s || !s.repeat.length) return;
    s.phase = 'repeat';
    s.i = 0;
    saveDraft();
    render();
    scrollTop();
  }

  function finishSession() {
    var s = state.session;
    if (!s) return;
    var st = DB.get().stats;
    st.sessions += 1;
    DB.write();
    state.summary = buildSummary(s);
    state.session = null;
    saveDraft();
    state.mode = 'done';
    render();
    scrollTop();
  }

  function buildSummary(s) {
    var main = statOf(s.list);
    var rep = s.repeat.length ? statOf(s.repeat) : null;
    var pct = main.total ? Math.round((main.correct / main.total) * 100) : 0;
    var bestPrev = num((DB.get().best || {})[s.kind], 0);
    var isRecord = pct > bestPrev;
    var bestMap = DB.get().best || {};
    bestMap[s.kind] = Math.max(bestPrev, pct);
    DB.set({ best: bestMap });

    var wrongs = [], seen = {};
    s.list.concat(s.repeat).forEach(function (q) {
      if (q.ok !== false || seen[q.id]) return;
      seen[q.id] = 1;
      wrongs.push(q);
    });

    return {
      kind: s.kind, day: s.day, main: main, repeat: rep, pct: pct,
      best: bestMap[s.kind], isRecord: isRecord, wrongs: wrongs,
      hints: main.hints + (rep ? rep.hints : 0)
    };
  }

  function verdictText(pct) {
    if (pct >= 90) return 'Отлично — можно сдавать';
    if (pct >= 70) return 'Хорошо, но есть что подтянуть';
    if (pct >= 40) return 'Нужно повторить материал';
    return 'Вернитесь в режим «Читать»';
  }

  function statLine(st) {
    return 'верно <b>' + st.correct + '</b> из ' + st.total + ' · ошибок <b>' + st.wrong + '</b>' +
      (st.hints ? ' · подсказок <b>' + st.hints + '</b>' : '');
  }

  function itemRowHTML(id, note) {
    var item = ITEM_BY_ID[id];
    if (!item) return '';
    var kind = kindForItem(item);
    var text = kind === 'pick' ? item.task : item.cmd;
    var isCode = kind === 'what';
    return '<div class="review__item">' +
      '<div class="review__ask">' + (isCode ? '<code>' + esc(text) + '</code>' : esc(text)) +
        '<span class="review__lbl">' + (kind === 'pick' ? 'команды' : 'разбор') + '</span></div>' +
      (note ? '<div class="review__why">' + esc(note) + '</div>' : '') +
      '<div class="review__act">' +
        '<button class="chipbtn' + (isMarked(id) ? ' is-on' : '') + '" data-act="toggle-mark" data-id="' + id + '">' +
          (isMarked(id) ? '★ Отмечено' : '☆ Повторить') +
        '</button>' +
      '</div>' +
    '</div>';
  }

  function renderSummary() {
    var s = state.summary;
    var kindTitle = MODE_META[s.kind] ? MODE_META[s.kind].title : 'Итог';
    var markedIds = repeatSourceIds();
    var hardMap = hard();

    var marksBlock = markedIds.length
      ? '<div class="review"><div class="review__title">Отмечено для повтора · ' + Object.keys(marks()).length + '</div>' +
          Object.keys(marks()).map(function (id) { return itemRowHTML(id, ''); }).join('') +
        '</div>'
      : '';

    var hardBlock = hardCount()
      ? '<div class="review"><div class="review__title">Сложные вопросы · ' + hardCount() + '</div>' +
          Object.keys(hardMap).map(function (id) {
            return itemRowHTML(id, 'Ошибок при последних попытках: ' + hardMap[id].n);
          }).join('') +
        '</div>'
      : '';

    app.innerHTML =
      '<div class="screen screen--mode">' +
        modeBar(s.kind, s.main.correct + ' / ' + s.main.total) +
        '<div class="progress"><span style="width:100%"></span></div>' +
        '<article class="card card--done">' +
          '<div class="done">' +
            '<div class="done__ring">' + ringChart(s.pct) + '</div>' +
            '<div class="done__body">' +
              '<span class="tag tag--accent">' + esc(kindTitle) + ' · итог</span>' +
              '<h2 class="done__title">' + esc(verdictText(s.pct)) + '</h2>' +
              '<p class="done__sub">' + statLine(s.main) +
                ' · лучший результат: <b>' + s.best + '%</b>' + (s.isRecord ? ' <span class="badge">новый рекорд</span>' : '') + '</p>' +
              (s.repeat
                ? '<p class="done__sub done__sub--repeat">Повторение: ' + statLine(s.repeat) + '</p>'
                : '') +
            '</div>' +
          '</div>' +

          (s.wrongs.length
            ? '<div class="review"><div class="review__title">Разобрать ошибки · ' + s.wrongs.length + '</div>' +
                s.wrongs.slice(0, 20).map(function (q) {
                  var correctText = q.kind === 'pick'
                    ? '<code>' + esc(q.options[q.correctIndex]) + '</code>'
                    : esc(q.options[q.correctIndex]);
                  var ask = q.kind === 'pick' ? esc(q.prompt) : '<code>' + esc(q.prompt) + '</code>';
                  return '<div class="review__item">' +
                    '<div class="review__ask">' + ask + '</div>' +
                    '<div class="review__ans"><span class="review__lbl">верно:</span> ' + correctText + '</div>' +
                    (q.why ? '<div class="review__why">' + esc(q.why) + '</div>' : '') +
                    '<div class="review__act">' +
                      '<button class="chipbtn' + (isMarked(q.id) ? ' is-on' : '') + '" data-act="toggle-mark" data-id="' + q.id + '">' +
                        (isMarked(q.id) ? '★ Отмечено' : '☆ Повторить') +
                      '</button>' +
                      (q.hintShown ? '<span class="review__note">использована подсказка</span>' : '') +
                    '</div>' +
                  '</div>';
                }).join('') +
                (s.wrongs.length > 20
                  ? '<p class="review__more">Ещё ' + (s.wrongs.length - 20) + ' ' +
                    plural(s.wrongs.length - 20, 'вопрос', 'вопроса', 'вопросов') +
                    ' — кнопка «Повторить сложное» ниже соберёт их в отдельную сессию.</p>'
                  : '') +
              '</div>'
            : '<div class="result"><span class="result__mark">✓</span><span>Ни одной ошибки в этой сессии.</span></div>') +

          marksBlock + hardBlock +

          '<div class="callout callout--save">' +
            '<b>Локальное сохранение.</b> Результат, отметки и сложные вопросы записаны в этом браузере — ' +
            'их можно скачать файлом и перенести на другое устройство.' +
            '<div class="callout__act"><button class="btn btn--sm" data-act="export">⤓ Скачать файл прогресса</button></div>' +
          '</div>' +
        '</article>' +

        '<nav class="navbar navbar--wrap navbar--static">' +
          '<button class="btn btn--ghost" data-act="home">К режимам</button>' +
          '<button class="btn btn--ghost" data-act="panel" data-panel="save">Сохранение</button>' +
          (repeatSourceCount() ? '<button class="btn btn--ghost" data-act="mode" data-mode="repeat">Повторить сложное · ' + repeatSourceCount() + '</button>' : '') +
          '<button class="btn btn--primary" data-act="restart">Повторить сессию</button>' +
        '</nav>' +
      '</div>';
    animateRing();
    syncThemeButtons();
  }

  /* ------------------------------ финал чтения ------------------------------ */

  function renderReadDone() {
    var cards = readCards(state.day);
    var readMap = DB.get().read || {};
    cards.forEach(function (c) { readMap[c.id] = true; });
    DB.set({ read: readMap });
    app.innerHTML =
      '<div class="screen screen--mode">' +
        modeBar('read', cards.length + ' / ' + cards.length) +
        '<div class="progress"><span style="width:100%"></span></div>' +
        '<article class="card card--done">' +
          '<div class="done">' +
            '<div class="done__ring">' + ringChart(100) + '</div>' +
            '<div class="done__body">' +
              '<span class="tag tag--accent">Материал пройден</span>' +
              '<h2 class="done__title">' + esc(dayMeta(state.day).label) + ' — прочитано</h2>' +
              '<p class="done__sub">' + cards.length + ' ' + plural(cards.length, 'карточка', 'карточки', 'карточек') +
                ' ' + plural(cards.length, 'отмечена', 'отмечены', 'отмечено') +
                ' как прочитанные. Прогресс чтения хранится локально.</p>' +
            '</div>' +
          '</div>' +
          '<div class="result"><span class="result__mark">✓</span><span>Теперь закрепите материал в режиме «Команды» или «Разбор кода».</span></div>' +
        '</article>' +
        '<nav class="navbar navbar--wrap navbar--static">' +
          '<button class="btn btn--ghost" data-act="home">К режимам</button>' +
          '<button class="btn btn--ghost" data-act="restart-read">Сначала</button>' +
          '<button class="btn btn--primary" data-act="mode" data-mode="pick">К вопросам →</button>' +
        '</nav>' +
      '</div>';
    animateRing();
    syncThemeButtons();
  }

  /* ============================== панель сохранения ============================== */

  function draftLabel(draft) {
    if (draft) return draft.answered + ' / ' + draft.total;
    var raw = DB.get().session;
    if (isObj(raw) && Array.isArray(raw.list) && raw.list.length) {
      var answered = raw.list.filter(function (q) { return q && q.pick !== null && q.pick !== undefined; }).length;
      return answered + ' / ' + raw.list.length;
    }
    return 'нет';
  }

  function renderModal() {
    if (!modalHost) return;
    if (state.panel !== 'save') {
      modalHost.innerHTML = '';
      modalHost.classList.remove('is-open');
      document.body.classList.remove('is-locked');
      return;
    }
    var st = DB.get().stats;
    var draft = draftInfo();
    modalHost.classList.add('is-open');
    document.body.classList.add('is-locked');

    modalHost.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">' +
        '<div class="modal__backdrop" data-act="panel-close"></div>' +
        '<div class="modal__card">' +
          '<div class="modal__head">' +
            '<h2 class="modal__title" id="modal-title">Локальное сохранение</h2>' +
            '<button class="ghost" data-act="panel-close" aria-label="Закрыть">✕</button>' +
          '</div>' +
          '<div class="theme-pick">' +
            '<span class="theme-pick__lbl">Тема оформления · сейчас <b id="theme-now">' +
              (state.theme === 'dark' ? 'тёмная' : 'светлая') + '</b></span>' +
            '<div class="seg">' +
              '<button class="seg__btn' + (state.theme === 'dark' ? ' is-active' : '') + '" data-act="theme-set" data-theme="dark" aria-pressed="' + (state.theme === 'dark') + '">' +
                '<span aria-hidden="true">☾</span> Тёмная</button>' +
              '<button class="seg__btn' + (state.theme === 'light' ? ' is-active' : '') + '" data-act="theme-set" data-theme="light" aria-pressed="' + (state.theme === 'light') + '">' +
                '<span aria-hidden="true">☀</span> Светлая</button>' +
            '</div>' +
          '</div>' +
          '<p class="modal__text">Прогресс хранится в localStorage этого браузера: тема, выбранный день, прочитанные карточки, ' +
            'лучшие результаты, отметки «повторить», сложные вопросы, незавершённая сессия и статистика.</p>' +
          '<div class="save-grid">' +
            '<div class="save-cell"><span class="save-cell__lbl">Последнее сохранение</span><b class="save-cell__val">' + esc(fmtStamp(DB.last())) + '</b></div>' +
            '<div class="save-cell"><span class="save-cell__lbl">Размер данных</span><b class="save-cell__val">' + esc(fmtBytes(DB.size())) + '</b></div>' +
            '<div class="save-cell"><span class="save-cell__lbl">Отмечено к повтору</span><b class="save-cell__val">' + markCount() + '</b></div>' +
            '<div class="save-cell"><span class="save-cell__lbl">Сложных вопросов</span><b class="save-cell__val">' + hardCount() + '</b></div>' +
            '<div class="save-cell"><span class="save-cell__lbl">Ответов всего</span><b class="save-cell__val">' + st.answered + '</b></div>' +
            '<div class="save-cell"><span class="save-cell__lbl">Сессия-черновик</span><b class="save-cell__val">' + draftLabel(draft) + '</b></div>' +
          '</div>' +
          '<div class="save-actions">' +
            '<button class="btn btn--primary" data-act="export">⤓ Скачать файл прогресса</button>' +
            '<button class="btn" data-act="import">⤒ Загрузить из файла</button>' +
            '<button class="btn btn--ghost" data-act="copy-json">Скопировать JSON</button>' +
            '<button class="btn btn--danger" data-act="reset">' + (state.confirmReset ? 'Точно удалить всё?' : 'Сбросить прогресс') + '</button>' +
            '<input type="file" accept=".json,application/json" class="save-file" data-role="import-file" aria-label="Файл прогресса">' +
          '</div>' +
          '<p class="modal__note">Файл прогресса — обычный JSON: его можно сохранить как резервную копию, перенести в другой браузер ' +
            'или отдать проверяющему. Загрузка из файла заменяет текущие локальные данные, сброс удаляет их полностью.</p>' +
        '</div>' +
      '</div>';
    syncThemeButtons();
  }

  function exportProgress() {
    var text = DB.dump();
    try {
      var blob = new Blob([text], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'd01t01-progress-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
      toast('Файл прогресса сохранён');
    } catch (e) {
      copy(text, 'Прогресс скопирован в буфер (скачивание недоступно)');
    }
  }

  function importProgress(file) {
    if (!file) return;
    var fr = new FileReader();
    fr.onload = function () {
      var res = DB.restore(String(fr.result), 'replace');
      if (res === 'ok') {
        state.session = null;
        state.summary = null;
        state.mode = 'home';
        state.panel = null;
        state.day = dayOk(DB.get().day) ? DB.get().day : 'all';
        applyTheme();
        render();
        toast('Прогресс загружен из файла');
      } else if (res === 'bad-json') {
        toast('Файл не является JSON');
      } else {
        toast('Файл не похож на сохранение тренажёра');
      }
    };
    fr.onerror = function () { toast('Не удалось прочитать файл'); };
    fr.readAsText(file);
  }

  function resetProgress() {
    if (!state.confirmReset) {
      state.confirmReset = true;
      renderModal();
      toast('Нажмите ещё раз, чтобы удалить локальные данные');
      return;
    }
    DB.reset();
    state.session = null;
    state.summary = null;
    state.confirmReset = false;
    state.panel = null;
    state.day = 'all';
    state.readIndex = 0;
    applyTheme();
    render();
    toast('Локальный прогресс удалён');
  }

  /* ============================== черновик сессии ============================== */

  function serQ(q) {
    return {
      id: q.id, kind: q.kind, quest: q.quest, day: q.day,
      prompt: q.prompt, promptIsCode: q.promptIsCode,
      options: q.options, codes: q.codes, correctIndex: q.correctIndex,
      why: q.why, hint: q.hint,
      pick: q.pick, ok: q.ok, marked: !!q.marked,
      hintShown: !!q.hintShown, fifty: q.fifty || null
    };
  }

  function serSession(s) {
    return {
      kind: s.kind, day: s.day, phase: s.phase,
      list: s.list.map(serQ), repeat: s.repeat.map(serQ),
      i: s.i, startedAt: s.startedAt || Date.now(), at: Date.now()
    };
  }

  function deserQ(raw) {
    if (!isObj(raw) || !ITEM_BY_ID[raw.id]) return null;
    if (!Array.isArray(raw.options) || typeof raw.correctIndex !== 'number') return null;
    if (raw.correctIndex < 0 || raw.correctIndex >= raw.options.length) return null;
    return {
      id: raw.id, kind: raw.kind === 'what' ? 'what' : 'pick',
      quest: num(raw.quest, 0), day: raw.day,
      prompt: String(raw.prompt == null ? '' : raw.prompt),
      promptIsCode: !!raw.promptIsCode,
      options: raw.options.slice(), codes: Array.isArray(raw.codes) ? raw.codes.slice() : [],
      correctIndex: raw.correctIndex,
      why: raw.why || '', hint: raw.hint || '',
      pick: typeof raw.pick === 'number' ? raw.pick : null,
      ok: typeof raw.ok === 'boolean' ? raw.ok : null,
      marked: !!raw.marked, hintShown: !!raw.hintShown,
      fifty: Array.isArray(raw.fifty) ? raw.fifty : null
    };
  }

  function deserSession(raw) {
    if (!isObj(raw) || !QUIZ_KINDS[raw.kind]) return null;
    var list = (Array.isArray(raw.list) ? raw.list : []).map(deserQ);
    if (!list.length || list.indexOf(null) !== -1) return null;
    var repeat = (Array.isArray(raw.repeat) ? raw.repeat : []).map(deserQ);
    if (repeat.indexOf(null) !== -1) repeat = [];
    var phase = raw.phase === 'repeat' && repeat.length ? 'repeat' : (raw.phase === 'prep' && repeat.length ? 'prep' : 'main');
    return {
      kind: raw.kind, day: dayOk(raw.day) ? raw.day : 'all', phase: phase,
      list: list, repeat: repeat,
      i: clamp(num(raw.i, 0), 0, (phase === 'repeat' ? repeat : list).length - 1),
      startedAt: num(raw.startedAt, Date.now())
    };
  }

  function saveDraft() {
    DB.set({ session: state.session ? serSession(state.session) : null });
  }

  function resumeDraft() {
    var s = deserSession(DB.get().session);
    if (!s) { toast('Черновик сессии не удалось восстановить'); return; }
    state.session = s;
    state.summary = null;
    state.mode = s.kind;
    render();
    scrollTop();
    toast('Сессия восстановлена — продолжаем с вопроса ' + (s.i + 1));
  }

  function dropDraft() {
    DB.set({ session: null });
    render();
    toast('Черновик сессии удалён');
  }

  /* ============================== роутер ============================== */

  function render() {
    document.body.dataset.mode = state.mode;
    var tb = document.querySelector('.topbar');
    if (tb) tb.hidden = state.mode === 'home';

    if (state.mode === 'home') renderHome();
    else if (state.mode === 'read') renderRead();
    else if (state.mode === 'readDone') renderReadDone();
    else if (state.mode === 'pick' || state.mode === 'what' || state.mode === 'repeat') {
      if (state.session && state.session.phase === 'prep') renderRepeatIntro();
      else if (state.session) renderQuiz();
      else { state.mode = 'home'; renderHome(); }
    } else if (state.mode === 'done') {
      if (state.summary) renderSummary(); else { state.mode = 'home'; renderHome(); }
    } else {
      state.mode = 'home';
      renderHome();
    }

    var chipsHost = document.getElementById('topchips');
    if (chipsHost) chipsHost.innerHTML = dayChips(true);

    syncThemeButtons();
    renderModal();
    syncHash();
  }

  function syncHash() {
    var h = '#/' + state.mode + '?day=' + state.day;
    if (location.hash !== h) { history.replaceState(null, '', h); }
    var meta = MODE_META[state.mode];
    document.title = (meta ? meta.title + ' · ' : '') + D.meta.code + ' — Linux & Git';
  }

  function readHash() {
    var m = /^#\/([a-z-]+)(?:\?day=([a-z0-9]+))?/i.exec(location.hash || '');
    if (!m) return null;
    if (dayOk(m[2])) state.day = m[2];
    var mode = m[1] === 'readdone' ? 'readDone' : m[1];
    return ['home', 'read', 'pick', 'what', 'repeat', 'done', 'readDone'].indexOf(mode) !== -1 ? mode : null;
  }

  function goHome() {
    state.mode = 'home';
    state.summary = null;
    state.panel = null;
    state.confirmReset = false;
    render();
    scrollTop();
  }

  function startMode(mode) {
    if (state.panel) { state.panel = null; renderModal(); }
    if (mode === 'read') {
      state.readIndex = 0;
      state.mode = 'read';
      render();
      scrollTop();
      return;
    }
    if (mode === 'repeat' && !repeatSourceCount()) {
      toast('Пока нечего повторять: отметьте вопрос кнопкой «Повторить» или ответьте с ошибкой');
      return;
    }
    state.session = null;
    startSession(mode, state.day);
  }

  /* ============================== события ============================== */

  function advanceRead() {
    var cards = readCards(state.day);
    var card = cards[state.readIndex];
    var readMap = DB.get().read || {};
    readMap[card.id] = true;
    DB.set({ read: readMap });
    if (state.readIndex < cards.length - 1) {
      state.readIndex += 1;
      render();
      scrollTop();
    }
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]');
    if (!t) return;
    var act = t.getAttribute('data-act');

    if (act === 'theme') { toggleTheme(); return; }
    if (act === 'theme-set') { setTheme(t.getAttribute('data-theme')); return; }

    if (act === 'panel') {
      var want = t.getAttribute('data-panel');
      state.panel = state.panel === want ? null : want;
      state.confirmReset = false;
      renderModal();
      return;
    }
    if (act === 'panel-close') { state.panel = null; state.confirmReset = false; renderModal(); return; }

    if (act === 'export') { exportProgress(); return; }
    if (act === 'import') {
      var input = modalHost ? modalHost.querySelector('[data-role="import-file"]') : null;
      if (input) input.click();
      return;
    }
    if (act === 'copy-json') { copy(DB.dump(), 'JSON прогресса скопирован'); return; }
    if (act === 'reset') { resetProgress(); return; }

    if (act === 'day') {
      var d = t.getAttribute('data-day');
      if (d === state.day) return;
      state.day = d;
      DB.set({ day: d });
      if (state.mode === 'read') { state.readIndex = 0; render(); return; }
      if (state.mode === 'pick' || state.mode === 'what') {
        var keepKind = state.mode;
        state.session = null;
        if (startSession(keepKind, state.day)) toast('Фильтр изменён — сессия начата заново');
        else goHome();
        return;
      }
      if (state.mode === 'done') { state.mode = 'home'; render(); return; }
      render();
      return;
    }

    if (act === 'mode') { startMode(t.getAttribute('data-mode')); return; }
    if (act === 'home' || act === 'exit') { goHome(); return; }
    if (act === 'next') { state.mode === 'read' ? advanceRead() : advance(); return; }
    if (act === 'opt') { answer(parseInt(t.getAttribute('data-i'), 10)); return; }
    if (act === 'hint' || act === 'fifty') { showHint(act); return; }
    if (act === 'mark') { markCurrentQuestion(); return; }

    if (act === 'toggle-mark') {
      var id = t.getAttribute('data-id');
      var item = ITEM_BY_ID[id];
      var on = toggleMark(id, item ? kindForItem(item) : 'pick');
      var q = findQuestion(id);
      if (q) { q.marked = on; refreshPips(); }
      if (state.mode === 'done') render(); else {
        var btn = app.querySelector('.markbtn[data-id="' + id + '"]');
        if (btn) {
          btn.classList.toggle('is-on', on);
          var ic = btn.querySelector('.markbtn__icon');
          if (ic) ic.textContent = on ? '★' : '☆';
        }
      }
      toast(on ? 'Отмечено ★' : 'Отметка снята');
      return;
    }

    if (act === 'jump') {
      var to = parseInt(t.getAttribute('data-to'), 10);
      if (state.mode === 'read') {
        state.readIndex = clamp(to, 0, readCards(state.day).length - 1);
        render();
        scrollTop();
      } else {
        gotoQuestion(to);
      }
      return;
    }

    if (act === 'prev') {
      if (state.mode === 'read') {
        state.readIndex = Math.max(0, state.readIndex - 1);
        render();
        scrollTop();
      } else {
        gotoQuestion(state.session ? state.session.i - 1 : 0);
      }
      return;
    }

    if (act === 'finish-read') { state.mode = 'readDone'; render(); scrollTop(); return; }
    if (act === 'restart-read') { state.mode = 'read'; state.readIndex = 0; render(); return; }

    if (act === 'restart') {
      var kind = state.summary ? state.summary.kind : 'pick';
      state.session = null;
      startSession(kind, state.day);
      return;
    }

    if (act === 'start-repeat') { startRepeatRound(); return; }
    if (act === 'skip-repeat') { finishSession(); return; }

    if (act === 'resume') { resumeDraft(); return; }
    if (act === 'drop-draft') { dropDraft(); return; }

    if (act === 'copy') {
      var cmd = t.getAttribute('data-cmd');
      copy(cmd, 'Скопировано: ' + cmd);
      t.classList.add('is-copied');
      t.textContent = 'ok';
      setTimeout(function () { t.classList.remove('is-copied'); t.textContent = 'copy'; }, 1100);
      return;
    }
  });

  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el && el.getAttribute && el.getAttribute('data-role') === 'import-file') {
      var f = el.files && el.files[0];
      if (f) importProgress(f);
      el.value = '';
    }
  });

  /* свайпы влево/вправо (мобильные) */
  (function () {
    var x0 = null, y0 = null;
    app.addEventListener('touchstart', function (e) {
      if ((state.mode !== 'read' && !QUIZ_KINDS[state.mode]) || e.touches.length !== 1) { x0 = null; return; }
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
    }, { passive: true });

    app.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var t = e.changedTouches && e.changedTouches[0];
      if (!t) { x0 = null; return; }
      var dx = t.clientX - x0, dy = t.clientY - y0;
      x0 = null;
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.6) return;

      if (state.mode === 'read') {
        var cards = readCards(state.day);
        if (dx < 0) {
          if (state.readIndex < cards.length - 1) advanceRead();
          else { state.mode = 'readDone'; render(); }
        } else {
          state.readIndex = Math.max(0, state.readIndex - 1);
          render();
        }
        scrollTop(false);
        return;
      }

      if (QUIZ_KINDS[state.mode] && state.session) {
        if (dx < 0) advance();
        else gotoQuestion(state.session.i - 1);
      }
    }, { passive: true });
  })();

  document.addEventListener('keydown', function (e) {
    if (e.target && e.target.matches && e.target.matches('input, textarea')) return;
    var k = e.key;

    /* при открытой панели сохранения работают только Esc */
    if (state.panel && k !== 'Escape') return;

    /* Enter/Space на кнопке уже обрабатываются браузером как click */
    var onButton = !!(e.target && e.target.closest && e.target.closest('button'));
    if (onButton && (k === ' ' || k === 'Enter')) return;

    if (k === 'Escape') {
      if (state.panel) { state.panel = null; state.confirmReset = false; renderModal(); return; }
      if (state.mode !== 'home') goHome();
      return;
    }

    if (k === 't' || k === 'T' || k === 'е' || k === 'Е') { toggleTheme(); return; }

    if (state.mode === 'read' || state.mode === 'readDone') {
      if (k === 'ArrowRight' || k === 'Enter' || k === ' ') {
        e.preventDefault();
        var cards = readCards(state.day);
        if (state.readIndex < cards.length - 1) advanceRead();
        else { state.mode = 'readDone'; render(); }
      }
      if (k === 'ArrowLeft') {
        e.preventDefault();
        state.readIndex = Math.max(0, state.readIndex - 1);
        render();
      }
      return;
    }

    if (QUIZ_KINDS[state.mode] && state.session) {
      if (state.session.phase === 'prep') {
        if (k === 'Enter') { startRepeatRound(); }
        return;
      }
      var list = curList(state.session);
      var q = list[state.session.i];

      if (/^[1-4]$/.test(k)) {
        var i = parseInt(k, 10) - 1;
        if (i < q.options.length && !(q.fifty && q.fifty.indexOf(i) !== -1)) answer(i);
        return;
      }
      if (k === 'h' || k === 'H' || k === 'р' || k === 'Р') {
        e.preventDefault();
        showHint(q.hintShown ? 'fifty' : 'hint');
        return;
      }
      if (k === 'm' || k === 'M' || k === 'ь' || k === 'Ь') { e.preventDefault(); markCurrentQuestion(); return; }
      if (k === 'ArrowRight' || k === 'Enter' || k === ' ') {
        e.preventDefault();
        advance();
        return;
      }
      if (k === 'ArrowLeft' || k === 'Backspace') {
        e.preventDefault();
        if (state.session.i > 0) gotoQuestion(state.session.i - 1);
        return;
      }
    }

    if (state.mode === 'done') {
      if (k === 'Enter') { state.session = null; startSession(state.summary.kind, state.day); }
      return;
    }

    if (state.mode === 'home') {
      if (/^[1-4]$/.test(k)) {
        var modes = ['read', 'pick', 'what', 'repeat'];
        startMode(modes[parseInt(k, 10) - 1]);
        return;
      }
      if ((k === 'c' || k === 'C' || k === 'с' || k === 'С') && draftInfo()) resumeDraft();
    }
  });

  try {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function () {
      if (!DB.get().theme) { applyTheme(); }
    });
  } catch (e) { /* старые браузеры */ }

  /* ============================== старт ============================== */

  (function init() {
    var st = DB.get();
    if (dayOk(st.day)) state.day = st.day;
    applyTheme();

    var hashMode = readHash();
    var autoStart = null;
    if (hashMode) state.mode = hashMode;
    if (hashMode === 'pick' || hashMode === 'what' || hashMode === 'repeat') {
      var draft = deserSession(st.session);
      if (draft && draft.kind === hashMode) state.session = draft;
      else { state.mode = 'home'; autoStart = hashMode; }
    }
    if (state.mode === 'done') state.mode = 'home';
    if (state.mode === 'readDone') state.mode = 'read';

    if (autoStart && startSession(autoStart, state.day)) { /* сессия уже отрисована */ }
    else render();
    if (st.session && !state.session) {
      var d = draftInfo();
      if (d) toast('Есть сохранённая сессия — можно продолжить с главного экрана');
    }
  })();
})();
