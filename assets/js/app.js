/* D01T01 — тренажёр: логика приложения (vanilla JS, без зависимостей) */
(function () {
  'use strict';

  var D = window.STUDY_DATA;
  var app = document.getElementById('app');
  var toastEl = document.getElementById('toast');
  var STORE_KEY = 'd01t01.progress.v1';

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

  function store() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; }
  }
  function save(patch) {
    var s = store();
    Object.keys(patch).forEach(function (k) { s[k] = patch[k]; });
    try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) { /* приватный режим */ }
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toastEl.classList.remove('is-on'); }, 1600);
  }

  function copy(text) {
    var done = function () { toast('Скопировано: ' + text); };
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

  /* ============================== состояние ============================== */

  var state = {
    mode: 'home',            // home | read | pick | what | done
    day: 'all',
    readIndex: 0,
    session: null,           // {kind, list, i, correct, wrong, locked, day, retryOf}
    summary: null,           // {kind, total, correct, wrong, pct, best, isRecord}
    locked: false
  };

  var MODE_META = {
    read: { n: '01', title: 'Читать', desc: 'Материал по квестам: цель, шаги, команды и проверка результата.' },
    pick: { n: '02', title: 'Команды', desc: 'Дана задача — выбери правильную команду или часть кода.' },
    what: { n: '03', title: 'Разбор кода', desc: 'Дана команда — выбери, что она делает.' }
  };

  function dayMeta(id) {
    for (var i = 0; i < D.days.length; i++) if (D.days[i].id === id) return D.days[i];
    return D.days[0];
  }

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

  function buildQuestions(kind, day) {
    var pool = D.items.filter(function (i) { return itemDayOk(i, day); });
    var usable = pool.filter(function (i) { return itemModeOk(i, kind); });
    var list = [];
    shuffle(usable).forEach(function (item) {
      var wrong = distractors(item, pool, kind, 3);
      if (wrong.length < 3) return;
      var all = shuffle([item].concat(wrong));
      list.push({
        id: item.id,
        day: item.day,
        quest: item.quest,
        kind: kind,
        prompt: kind === 'pick' ? item.task : item.cmd,
        promptIsCode: kind === 'what',
        options: all.map(function (x) { return kind === 'pick' ? x.cmd : x.what; }),
        codes: all.map(function (x) { return x.cmd; }),
        correctIndex: all.indexOf(item),
        item: item,
        why: item.why || ''
      });
    });
    return list;
  }

  function questionCount(kind, day) {
    return buildQuestions(kind, day).length;
  }

  /* ============================== анимации ============================== */

  function burst(node) {
    if (!node || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
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
    var num = app.querySelector('.ring__num');
    if (fg) requestAnimationFrame(function () { fg.style.strokeDashoffset = fg.getAttribute('data-off'); });
    if (num) {
      var target = parseInt(num.getAttribute('data-target'), 10) || 0;
      var t0 = performance.now(), dur = 700;
      (function tick(now) {
        var k = clamp((now - t0) / dur, 0, 1);
        var e = 1 - Math.pow(1 - k, 3);
        num.textContent = Math.round(target * e) + '%';
        if (k < 1) requestAnimationFrame(tick);
      })(t0);
    }
  }

  /* ============================== рендер: компоненты ============================== */

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

  function progressLine(kind, day) {
    var cards = readCards(day);
    var prog = store().read || {};
    var done = cards.filter(function (c) { return prog[c.id]; }).length;
    return { kind: kind, done: done, total: cards.length };
  }

  function renderHome() {
    var day = state.day;
    var dm = dayMeta(day);
    var p = progressLine('read', day);
    var readDone = store().read || {};
    var s = store();

    var cards = [
      { mode: 'read', meta: MODE_META.read, extra: p.done + ' / ' + p.total + ' карточек' },
      { mode: 'pick', meta: MODE_META.pick, extra: questionCount('pick', day) + ' вопросов' + bestLabel(s, 'pick') },
      { mode: 'what', meta: MODE_META.what, extra: questionCount('what', day) + ' вопросов' + bestLabel(s, 'what') }
    ];

    app.innerHTML =
      '<div class="screen screen--home">' +
        '<section class="hero">' +
          '<div class="hero__top">' +
            '<span class="kicker">' + esc(D.meta.code) + '</span>' +
            '<h1 class="hero__title">' + esc(D.meta.title) + '</h1>' +
            '<p class="hero__sub">' + esc(D.meta.subtitle) + ' · <code>' + esc(D.meta.repo) + '/src</code></p>' +
          '</div>' +
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

        '<footer class="home-foot">' +
          '<span>Обязательная часть — Quest 1–7. Бонус Quest 8–10 — по желанию.</span>' +
          '<span class="home-foot__keys"><kbd>←</kbd><kbd>→</kbd> листать · <kbd>1</kbd>–<kbd>4</kbd> ответ · <kbd>esc</kbd> выход</span>' +
        '</footer>' +
      '</div>';
    app.querySelectorAll('.mode-card').forEach(function (el, i) { el.style.animationDelay = i * 70 + 'ms'; });
  }

  function bestLabel(s, kind) {
    var best = (s.best || {})[kind];
    return best ? ' · лучший ' + best + '%' : '';
  }

  /* ------------------------------ терминальный блок ------------------------------ */

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

  /* ------------------------------ режим чтения ------------------------------ */

  function renderRead() {
    var cards = readCards(state.day);
    state.readIndex = clamp(state.readIndex, 0, cards.length - 1);
    var card = cards[state.readIndex];
    var pct = ((state.readIndex) / cards.length) * 100;
    var seen = store().read || {};

    app.innerHTML =
      '<div class="screen screen--mode">' +
        modeBar('read', (state.readIndex + 1) + ' / ' + cards.length) +
        '<div class="progress"><span style="width:' + pct.toFixed(1) + '%"></span></div>' +
        '<article class="card card--read" data-kind="' + card.kind + '">' + readCardHTML(card, seen) + '</article>' +
        '<nav class="navbar">' +
          '<button class="btn btn--ghost" data-act="prev"' + (state.readIndex === 0 ? ' disabled' : '') + '>← Назад</button>' +
          '<div class="navbar__hint">' + esc(dayMeta(state.day).label) + ' · ' + esc(card.id) + '</div>' +
          (state.readIndex === cards.length - 1
            ? '<button class="btn btn--primary" data-act="finish-read">Завершить</button>'
            : '<button class="btn btn--primary" data-act="next">Дальше →</button>') +
        '</nav>' +
      '</div>';
  }

  function readCardHTML(card, seen) {
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

  /* ------------------------------ квизы ------------------------------ */

  function modeBar(kind, counter) {
    var m = MODE_META[kind];
    return '<div class="modebar">' +
      '<button class="ghost" data-act="home" aria-label="К режимам">←</button>' +
      '<div class="modebar__title"><span class="modebar__num">' + m.n + '</span>' + esc(m.title) + '</div>' +
      '<div class="modebar__right"><span class="modebar__count">' + esc(counter) + '</span>' +
        '<button class="ghost" data-act="home" aria-label="Закрыть">✕</button></div>' +
    '</div>';
  }

  function startSession(kind, day, list) {
    state.session = {
      kind: kind,
      day: day,
      list: list || buildQuestions(kind, day),
      i: 0,
      correct: 0,
      wrong: [],
      locked: false
    };
    if (!state.session.list.length) { toast('Нет вопросов для этого фильтра'); state.mode = 'home'; render(); return; }
    state.mode = kind;
    state.locked = false;
    render();
  }

  function renderQuiz() {
    var s = state.session;
    var q = s.list[s.i];
    var kind = s.kind;
    var pct = (s.i / s.list.length) * 100;
    s.locked = false;              // новый вопрос — снова можно отвечать
    state.locked = false;

    var askHTML = kind === 'pick'
      ? '<h2 class="q__ask">' + esc(q.prompt) + '</h2>' +
        '<p class="q__hint">Выберите команду или часть кода</p>'
      : '<h2 class="q__ask">Что делает этот код?</h2>' +
        '<div class="q__code"><code>' + esc(q.prompt) + '</code>' +
        '<button class="cmd__copy" data-act="copy" data-cmd="' + esc(q.prompt) + '">copy</button></div>' +
        '<p class="q__hint">Выберите верное описание</p>';

    app.innerHTML =
      '<div class="screen screen--mode">' +
        modeBar(kind, (s.i + 1) + ' / ' + s.list.length) +
        '<div class="progress"><span style="width:' + pct.toFixed(1) + '%"></span></div>' +
        '<article class="card card--quiz" data-kind="' + kind + '">' +
          '<div class="q__top">' +
            '<span class="tag tag--quest">Quest ' + q.quest + '</span>' +
            '<span class="q__score" aria-live="polite"><b>' + s.correct + '</b> верно · <b>' + s.wrong.length + '</b> ошибок</span>' +
          '</div>' +
          askHTML +
          '<div class="opts" role="list">' +
            q.options.map(function (o, i) {
              var isCode = kind === 'pick';
              return '<button class="opt' + (isCode ? ' opt--code' : '') + '" role="listitem" data-act="opt" data-i="' + i + '">' +
                '<span class="opt__key">' + (i + 1) + '</span>' +
                '<span class="opt__text">' + (isCode ? '<code>' + esc(o) + '</code>' : esc(o)) + '</span>' +
                '<span class="opt__mark" aria-hidden="true"></span>' +
              '</button>';
            }).join('') +
          '</div>' +
          '<div class="feedback" id="feedback" role="status" aria-live="polite"></div>' +
        '</article>' +
        '<nav class="navbar">' +
          '<button class="btn btn--ghost" data-act="home">Выйти</button>' +
          '<div class="navbar__hint">' + esc(dayMeta(s.day).label) + ' · вопрос ' + (s.i + 1) + ' из ' + s.list.length + '</div>' +
          '<button class="btn btn--primary" data-act="next" disabled>Дальше →</button>' +
        '</nav>' +
      '</div>';
  }

  function answer(pick) {
    var s = state.session;
    if (!s || s.locked) return;
    var q = s.list[s.i];
    s.locked = true;
    state.locked = true;
    var ok = pick === q.correctIndex;
    if (ok) s.correct++; else s.wrong.push(q);

    var opts = app.querySelectorAll('.opt');
    opts.forEach(function (btn, i) {
      btn.disabled = true;
      btn.classList.add('is-locked');
      if (i === q.correctIndex) btn.classList.add(i === pick ? 'is-ok' : 'is-ok-hint');
      else if (i === pick) btn.classList.add('is-bad');
      else btn.classList.add('is-dim');
      var mark = btn.querySelector('.opt__mark');
      if (i === q.correctIndex) mark.textContent = '✓';
      else if (i === pick) mark.textContent = '✕';
    });

    if (ok) burst(opts[q.correctIndex]);
    else {
      var el = opts[pick];
      el.classList.add('shake');
      setTimeout(function () { el.classList.remove('shake'); }, 500);
    }

    var panel = app.querySelector('#feedback');
    var correctText = q.kind === 'pick' ? '<code>' + esc(q.options[q.correctIndex]) + '</code>' : esc(q.options[q.correctIndex]);
    panel.innerHTML =
      '<div class="feedback__head feedback__head--' + (ok ? 'ok' : 'bad') + '">' +
        '<span class="feedback__icon">' + (ok ? '✓' : '✕') + '</span>' +
        '<b>' + (ok ? 'Верно' : 'Неверно') + '</b>' +
        '<span class="feedback__sub">' + (ok ? 'так и есть' : 'правильный ответ: ' + correctText) + '</span>' +
      '</div>' +
      (q.why ? '<p class="feedback__why">' + esc(q.why) + '</p>' : '');
    panel.classList.add('is-in', ok ? 'is-ok' : 'is-bad');

    var nextBtn = app.querySelector('.navbar .btn--primary');
    nextBtn.disabled = false;
    nextBtn.textContent = s.i === s.list.length - 1 ? 'Результат →' : 'Дальше →';
    setTimeout(function () { nextBtn.focus({ preventScroll: true }); }, 60);

    // подтягиваем отклик в видимую область, если он не поместился
    setTimeout(function () {
      var r = panel.getBoundingClientRect();
      var nav = app.querySelector('.navbar');
      var navH = nav ? nav.offsetHeight : 0;
      if (r.top > window.innerHeight - navH - 24 || r.top < 12) {
        var y = r.top + window.pageYOffset - 24;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      }
    }, 430);
  }

  function nextQuestion() {
    var s = state.session;
    if (!s) return;
    if (!s.locked) {
      // подсветим, что сначала нужен ответ
      var card = app.querySelector('.card--quiz');
      card.classList.add('nudge');
      setTimeout(function () { card.classList.remove('nudge'); }, 420);
      toast('Сначала выберите вариант');
      return;
    }
    if (s.i === s.list.length - 1) { finishSession(); return; }
    s.i++;
    renderQuiz();
  }

  function finishSession() {
    var s = state.session;
    var total = s.list.length;
    var correct = s.correct;
    var pct = Math.round((correct / total) * 100);
    var st = store();
    var bestPrev = (st.best || {})[s.kind] || 0;
    var isRecord = pct > bestPrev;
    var best = Math.max(bestPrev, pct);
    var bestMap = st.best || {};
    bestMap[s.kind] = best;
    save({ best: bestMap });
    state.summary = { kind: s.kind, day: s.day, total: total, correct: correct, wrong: s.wrong, pct: pct, best: best, isRecord: isRecord };
    state.mode = 'done';
    render();
  }

  function renderSummary() {
    var s = state.summary;
    var verdict = s.pct >= 90 ? 'Отлично — можно сдавать' : s.pct >= 70 ? 'Хорошо, но есть что подтянуть' : s.pct >= 40 ? 'Нужно повторить материал' : 'Вернитесь в режим «Читать»';
    app.innerHTML =
      '<div class="screen screen--mode">' +
        modeBar(s.kind, s.correct + ' / ' + s.total) +
        '<div class="progress"><span style="width:100%"></span></div>' +
        '<article class="card card--done">' +
          '<div class="done">' +
            '<div class="done__ring">' + ringChart(s.pct) + '</div>' +
            '<div class="done__body">' +
              '<span class="tag tag--accent">' + (MODE_META[s.kind] ? esc(MODE_META[s.kind].title) : 'Итог') + '</span>' +
              '<h2 class="done__title">' + esc(verdict) + '</h2>' +
              '<p class="done__sub">Верно: <b>' + s.correct + '</b> из ' + s.total + ' · ошибок: <b>' + s.wrong.length + '</b>' +
                ' · лучший результат: <b>' + s.best + '%</b>' + (s.isRecord ? ' <span class="badge">новый рекорд</span>' : '') + '</p>' +
            '</div>' +
          '</div>' +
          (s.wrong.length
            ? '<div class="review"><div class="review__title">Разобрать ошибки</div>' +
                s.wrong.map(function (q) {
                  var correctText = q.kind === 'pick' ? '<code>' + esc(q.options[q.correctIndex]) + '</code>' : esc(q.options[q.correctIndex]);
                  var ask = q.kind === 'pick' ? esc(q.prompt) : '<code>' + esc(q.prompt) + '</code>';
                  return '<div class="review__item">' +
                    '<div class="review__ask">' + ask + '</div>' +
                    '<div class="review__ans"><span class="review__lbl">верно:</span> ' + correctText + '</div>' +
                    (q.why ? '<div class="review__why">' + esc(q.why) + '</div>' : '') +
                  '</div>';
                }).join('') +
              '</div>'
            : '<div class="result"><span class="result__mark">✓</span><span>Ни одной ошибки в этой сессии.</span></div>') +
        '</article>' +
        '<nav class="navbar navbar--wrap navbar--static">' +
          '<button class="btn btn--ghost" data-act="home">К режимам</button>' +
          (s.wrong.length ? '<button class="btn btn--ghost" data-act="retry-wrong">Повторить ошибки</button>' : '') +
          '<button class="btn btn--primary" data-act="restart">Повторить</button>' +
        '</nav>' +
      '</div>';
    animateRing();
  }

  /* ------------------------------ финал режима чтения ------------------------------ */

  function renderReadDone() {
    var cards = readCards(state.day);
    var st = store();
    var readMap = st.read || {};
    cards.forEach(function (c) { readMap[c.id] = true; });
    save({ read: readMap });
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
              '<p class="done__sub">' + cards.length + ' карточек отмечены как прочитанные. Теперь закрепите материал в режиме «Команды» или «Разбор кода».</p>' +
            '</div>' +
          '</div>' +
          '<div class="result"><span class="result__mark">✓</span><span>Повторять чтение можно в любой момент — прогресс сохраняется локально.</span></div>' +
        '</article>' +
        '<nav class="navbar navbar--wrap navbar--static">' +
          '<button class="btn btn--ghost" data-act="home">К режимам</button>' +
          '<button class="btn btn--ghost" data-act="restart-read">Сначала</button>' +
          '<button class="btn btn--primary" data-act="mode" data-mode="pick">К вопросам →</button>' +
        '</nav>' +
      '</div>';
    animateRing();
  }

  /* ============================== роутер ============================== */

  function render() {
    document.body.dataset.mode = state.mode;
    var tb = document.querySelector('.topbar');
    if (tb) tb.hidden = state.mode === 'home';

    if (state.mode === 'home') renderHome();
    else if (state.mode === 'read') renderRead();
    else if (state.mode === 'readDone') renderReadDone();
    else if (state.mode === 'pick' || state.mode === 'what') renderQuiz();
    else if (state.mode === 'done') renderSummary();

    var chipsHost = document.getElementById('topchips');
    if (chipsHost) chipsHost.innerHTML = dayChips(true);
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
    if (!m) return;
    state.day = D.days.some(function (d) { return d.id === m[2]; }) ? m[2] : state.day;
    var mode = m[1] === 'readdone' ? 'readDone' : m[1];
    if (['home', 'read', 'pick', 'what', 'done', 'readDone'].indexOf(mode) !== -1) state.mode = mode;
  }

  function goHome() {
    state.mode = 'home';
    state.session = null;
    state.summary = null;
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function startMode(mode) {
    if (mode === 'read') {
      state.readIndex = 0;
      state.mode = 'read';
      render();
    } else {
      startSession(mode, state.day);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ============================== события ============================== */

  function advanceRead() {
    var cards = readCards(state.day);
    var card = cards[state.readIndex];
    var readMap = store().read || {};
    readMap[card.id] = true;
    save({ read: readMap });
    if (state.readIndex < cards.length - 1) {
      state.readIndex++;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]');
    if (!t) return;
    var act = t.getAttribute('data-act');

    if (act === 'day') {
      var d = t.getAttribute('data-day');
      if (d === state.day) return;
      state.day = d;
      save({ day: d });
      if (state.mode === 'read') { state.readIndex = 0; render(); return; }
      if (state.mode === 'pick' || state.mode === 'what') { startSession(state.mode, state.day); return; }
      if (state.mode === 'done') { state.mode = 'home'; render(); return; }
      render();
      return;
    }

    if (act === 'mode') { startMode(t.getAttribute('data-mode')); return; }
    if (act === 'home' || act === 'exit') { goHome(); return; }
    if (act === 'next') { state.mode === 'read' ? advanceRead() : nextQuestion(); return; }

    if (act === 'opt') { answer(parseInt(t.getAttribute('data-i'), 10)); return; }

    if (act === 'prev') {
      state.readIndex = Math.max(0, state.readIndex - 1);
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (act === 'finish-read') { state.mode = 'readDone'; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (act === 'restart-read') { state.mode = 'read'; state.readIndex = 0; render(); return; }

    if (act === 'restart') {
      var kind = state.summary ? state.summary.kind : 'pick';
      startSession(kind, state.day);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (act === 'retry-wrong') {
      var s = state.summary;
      startSession(s.kind, s.day, s.wrong.slice());
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (act === 'copy') {
      var cmd = t.getAttribute('data-cmd');
      copy(cmd);
      t.classList.add('is-copied');
      t.textContent = 'ok';
      setTimeout(function () { t.classList.remove('is-copied'); t.textContent = 'copy'; }, 1100);
      return;
    }
  });

  /* свайпы влево/вправо в режиме чтения (мобильные) */
  (function () {
    var x0 = null, y0 = null;
    app.addEventListener('touchstart', function (e) {
      if (state.mode !== 'read' || e.touches.length !== 1) { x0 = null; return; }
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
    }, { passive: true });

    app.addEventListener('touchend', function (e) {
      if (x0 === null || state.mode !== 'read') return;
      var t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      var dx = t.clientX - x0, dy = t.clientY - y0;
      x0 = null;
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
      if (dx < 0) {                       // влево — дальше
        var cards = readCards(state.day);
        if (state.readIndex < cards.length - 1) advanceRead();
        else { state.mode = 'readDone'; render(); }
      } else {                            // вправо — назад
        state.readIndex = Math.max(0, state.readIndex - 1);
        render();
      }
      window.scrollTo({ top: 0 });
    }, { passive: true });
  })();

  document.addEventListener('keydown', function (e) {
    if (e.target.matches('input, textarea')) return;
    var k = e.key;

    if (k === 'Escape') { if (state.mode !== 'home') goHome(); return; }

    if (state.mode === 'read') {
      if (k === 'ArrowRight' || k === 'Enter' || k === ' ') {
        e.preventDefault();
        var cards = readCards(state.day);
        if (state.readIndex < cards.length - 1) advanceRead();
        else { state.mode = 'readDone'; render(); }
      }
      if (k === 'ArrowLeft') { e.preventDefault(); state.readIndex = Math.max(0, state.readIndex - 1); render(); }
      return;
    }

    if ((state.mode === 'pick' || state.mode === 'what') && state.session) {
      if (/^[1-4]$/.test(k)) {
        var i = parseInt(k, 10) - 1;
        var q = state.session.list[state.session.i];
        if (i < q.options.length) answer(i);
        return;
      }
      if (k === 'ArrowRight' || k === 'Enter' || k === ' ') {
        if (state.session && state.session.locked) { e.preventDefault(); nextQuestion(); }
        return;
      }
      if (k === 'ArrowLeft') { e.preventDefault(); goHome(); return; }
    }

    if (state.mode === 'done') {
      if (k === 'Enter') { startSession(state.summary.kind, state.day); }
    }
  });

  /* ============================== старт ============================== */

  var st = store();
  if (st.day && D.days.some(function (d) { return d.id === st.day; })) state.day = st.day;
  readHash();
  render();
})();
