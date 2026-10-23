/* מנוע חדר הבריחה. התוכן נמצא ב־content.js (window.GAME). */
(function () {
  'use strict';

  const G = window.GAME;
  const KEY = 'endoEscape.v1';
  const HEB = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז'];
  const REG = { face: 'פנים', neck: 'צוואר', chest: 'חזה', abdomen: 'בטן', hands: 'ידיים', legs: 'רגליים' };

  /* ---------------- utils ---------------- */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (sec) => { sec = Math.max(0, Math.round(sec)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); };
  const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
  const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const norm = (s) => String(s).toLowerCase().replace(/[֑-ׇ]/g, '').replace(/[\s"'`׳״.,;:!?()\-–_/\\]/g, '');
  const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
  const stById = (id) => G.stations.find((s) => s.id === id);

  function matchText(input, accept, reject) {
    const v = norm(input);
    if (!v) return false;
    if ((reject || []).some((r) => v.includes(norm(r)))) return false;
    return accept.some((a) => { const t = norm(a); return v === t || (t.length >= 4 && v.includes(t)); });
  }

  /* ---------------- state ---------------- */
  const fresh = () => ({
    screen: 'intro', names: '', startTs: null, endTs: null, penalty: 0,
    mistakes: {}, hints: {}, hintTotal: {}, progress: {}, done: [], cur: null,
    doorTries: 0, refl: {}, rating: 0
  });
  function load() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }
  let S = Object.assign(fresh(), load() || {});
  if (S.endTs && S.screen === 'door') S.screen = 'finale';

  // מצב זמני של השלב הפעיל
  let U = { animate: true, introIdx: 0 };

  const elapsed = () => S.startTs ? ((S.endTs || Date.now()) - S.startTs) / 1000 : 0;
  const total = () => elapsed() + S.penalty;

  /* ---------------- toast / confetti / lightbox ---------------- */
  function toast(msg, good) {
    const t = document.createElement('div');
    t.className = 'toast' + (good ? ' good' : '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 1900);
  }
  function confetti() {
    const em = ['🎉', '✨', '💊', '🩺', '⭐', '🧬'];
    for (let i = 0; i < 46; i++) {
      const s = document.createElement('span');
      s.className = 'conf';
      s.textContent = em[i % em.length];
      s.style.left = Math.random() * 100 + 'vw';
      s.style.animationDuration = 2.2 + Math.random() * 2.5 + 's';
      s.style.animationDelay = Math.random() * .8 + 's';
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 6000);
    }
  }
  function penalize(sec, sid, wrong) {
    S.penalty += sec;
    if (wrong && sid) S.mistakes[sid] = (S.mistakes[sid] || 0) + 1;
    save(); Sound.bad(); toast('−' + sec + ' שניות', false); tick();
  }

  /* ---------------- clock ---------------- */
  function tick() {
    const c = $('#clock');
    const bar = $('#top');
    if (!c) return;
    const show = S.startTs && S.screen !== 'intro' && S.screen !== 'report' && S.screen !== 'reflect';
    c.style.visibility = show ? 'visible' : 'hidden';
    if (show) c.innerHTML = fmt(total()) + (S.penalty ? ` <span class="pen">+${S.penalty}s</span>` : '');
    bar.dataset.screen = S.screen;
  }
  setInterval(tick, 500);

  /* ---------------- ECG ---------------- */
  let ecgHR = 70;
  function wave(p) {
    const g = (c, w, a) => a * Math.exp(-Math.pow((p - c) / w, 2));
    return g(.12, .03, .12) + g(.2, .008, -.12) + g(.23, .011, 1) + g(.26, .01, -.28) + g(.46, .05, .25);
  }
  function ecgLoop() {
    const cv = $('#ecg');
    if (cv) {
      const dpr = window.devicePixelRatio || 1;
      const w = cv.clientWidth * dpr, h = cv.clientHeight * dpr;
      if (cv.width !== w) { cv.width = w; cv.height = h; }
      const x = cv.getContext('2d');
      x.clearRect(0, 0, w, h);
      x.lineWidth = 2 * dpr; x.strokeStyle = '#4ade80'; x.shadowColor = '#4ade80'; x.shadowBlur = 6 * dpr;
      x.beginPath();
      const now = performance.now() / 1000, period = 60 / ecgHR, pps = 70;
      for (let px = 0; px < w; px++) {
        const t = now - (w - px) / dpr / pps;
        const p = ((t % period) + period) % period / period;
        const y = h * .78 - wave(p) * h * .62;
        px ? x.lineTo(px, y) : x.moveTo(px, y);
      }
      x.stroke();
    }
    requestAnimationFrame(ecgLoop);
  }
  requestAnimationFrame(ecgLoop);

  const bannerStyle = (key) => {
    const u = G.backgrounds && G.backgrounds[key];
    return u ? ` style="background-image:linear-gradient(rgba(10,17,32,.45),rgba(10,17,32,.92)),url('${esc(u)}')" ` : '';
  };

  /* ---------------- screens ---------------- */
  const app = $('#app');
  function render() {
    const fn = { intro: rIntro, hub: rHub, station: rStation, door: rDoor, finale: rFinale, reflect: rReflect, report: rReport }[S.screen] || rIntro;
    app.innerHTML = fn();
    U.animate = false;
    tick();
    const toggle = $('#mute'); if (toggle) toggle.textContent = Sound.isMuted() ? '🔇' : '🔊';
  }
  const rise = () => U.animate ? ' rise' : '';
  function go(screen) { S.screen = screen; U.animate = true; save(); render(); window.scrollTo(0, 0); }

  /* ----- intro ----- */
  function rIntro() {
    const i = U.introIdx || 0, msgs = G.intro;
    let h = `<div class="pager"><div class="logo">📟</div><h1>${esc(G.meta.title)}</h1><p class="muted">${esc(G.meta.subtitle)}</p></div>`;
    h += msgs.slice(0, i + 1).map((m, k) => `<div class="msg${k === i ? ' rise' : ''}">${esc(m.text)}</div>`).join('');
    if (i < msgs.length - 1) {
      h += `<button class="btn block" data-act="introNext">הבא ▸</button>`;
    } else {
      h += `<div class="card" style="margin-top:14px"><h3>מי התורנים הלילה?</h3>
        <input class="field" id="names" placeholder="שם או שני שמות" value="${esc(S.names)}" maxlength="60" autocomplete="off">
        <button class="btn block" data-act="start">🏥 מתחילים משמרת (השעון מתחיל לרוץ)</button>
        <p class="muted small" style="margin:10px 0 0">המשחק משתמש בסאונד. אפשר להשתיק בכל רגע מהכפתור למעלה.</p></div>`;
    }
    h += `<p class="credit">פותח על ידי אורי עליון</p>`;
    return h;
  }

  /* ----- hub ----- */
  function rHub() {
    const n = G.stations.length, d = S.done.length;
    let h = `<div class="card banner has-img"${bannerStyle('hub')}><div class="row between"><div><h2>קומה 3 · המחלקה הפנימית</h2>
      <div class="muted small">${d} מתוך ${n} תחנות הושלמו</div></div><div class="cards" style="margin:0">${G.stations.map((s) => `<span class="keyslot ${S.done.includes(s.id) ? 'have' : ''}">${S.done.includes(s.id) ? s.letter : '?'}</span>`).join('')}</div></div>
      <div class="progress"><i style="width:${d / n * 100}%"></i></div></div><div class="path">`;
    G.stations.forEach((s, k) => {
      const done = S.done.includes(s.id), open = !done && (k === 0 || S.done.includes(G.stations[k - 1].id));
      const cls = done ? 'done' : open ? 'open' : 'locked';
      h += `<div class="node ${cls}"><div class="rail"><div class="dot">${done ? '✅' : open ? s.icon : '🔒'}</div><div class="stem"></div></div>
        <button class="body" ${open || done ? `data-act="open" data-id="${s.id}"` : 'disabled'}>
          <div class="t">${esc(s.title)}</div><div class="s">${esc(s.room)} · ${esc(s.patient.tag)} · ${esc(s.patient.line)}</div></button></div>`;
    });
    const all = d === n;
    h += `<div class="node ${all ? 'open' : 'locked'}"><div class="rail"><div class="dot">${all ? '🚪' : '🔒'}</div></div>
      <button class="body" ${all ? 'data-act="toDoor"' : 'disabled'}><div class="t">הדלת החוצה</div><div class="s">${all ? 'כל האותות אצלכם. אפשר לפתוח.' : 'דורשת את כל כרטיסי הגישה'}</div></button></div></div>
      <p class="center muted small" style="text-align:center"><a href="#" data-act="reset" style="color:inherit">התחלה מחדש (מוחק את ההתקדמות)</a></p>`;
    return h;
  }

  /* ----- station ----- */
  function openStation(id) {
    S.cur = id; U = { animate: true }; prepStep(); go('station');
  }
  function prepStep() {
    const st = stById(S.cur), i = S.progress[st.id] || 0, step = st.steps[i];
    U.justIdx = U.justIdx ?? null;
    U.sel = []; U.wrong = []; U.tval = []; U.tok = []; U.mval = {}; U.mok = {}; U.seq = []; U.msg = '';
    if (!step) return;
    if (step.type === 'match') U.mopts = shuffle(step.choices);
    // סדר התשובות מעורבב בכל פתיחה, כדי שמיקום התשובה הנכונה לא ילמד כלום (data-i נשאר האינדקס המקורי)
    if (step.type === 'choice' || step.type === 'multi') U.perm = shuffle(step.options.map((_, k) => k));
    if (step.type === 'sequence') {
      let o; do { o = shuffle(step.items.map((_, k) => k)); } while (o.every((v, k) => v === k) && o.length > 1);
      U.order = o;
    }
  }

  const bubbleHTML = (m) => {
    if (!m.who) return `<div class="sys${rise()}">${esc(m.text)}</div>`;
    const c = G.chars[m.who];
    return `<div class="bubble-row${rise()}"><div class="avatar" style="background:${c.color}">${esc(c.initial)}</div>
      <div class="bubble"><div class="who">${esc(c.name)} · ${esc(c.role)}</div>${esc(m.text)}</div></div>`;
  };
  const imgHTML = (im) => `<figure class="img"><img src="${esc(im.src)}" alt="${esc(im.caption)}" data-cap="${esc(im.caption)}" loading="lazy"><figcaption>${esc(im.caption)}</figcaption></figure>`;

  function monitorHTML(v) {
    ecgHR = v.hr;
    const f = (k) => v.flags.includes(k) ? ' class="flag"' : '';
    return `<div class="monitor"><canvas id="ecg"></canvas><div class="vitals">
      <div${f('hr')}><b>${v.hr}</b><span>HR</span></div><div${f('bp')}><b>${esc(v.bp)}</b><span>BP</span></div>
      <div${f('spo2')}><b>${v.spo2}%</b><span>SpO₂</span></div><div${f('temp')}><b>${v.temp}°</b><span>TEMP</span></div></div>
      <button class="listen" data-act="listen">🔊 להאזין לדופק</button></div>`;
  }

  function rStation() {
    const st = stById(S.cur), n = st.steps.length, p = S.progress[st.id] || 0;
    let h = `<div class="banner has-img"${bannerStyle(st.bg)}><button class="btn ghost back" data-act="back" style="align-self:flex-start">▸ חזרה למפה</button>
      <div class="shead" style="margin:0"><div class="big">${st.icon}</div><div><h2 style="margin:0">${esc(st.title)}</h2>
      <div class="muted small">${esc(st.room)}</div></div></div></div>
      <div class="patient-chip">🪪 ${esc(st.patient.tag)} · ${esc(st.patient.line)}</div><div style="height:12px"></div>`;
    h += monitorHTML(st.vitals);
    h += st.story.map(bubbleHTML).join('');
    if (st.images) h += st.images.map(imgHTML).join('');
    for (let i = 0; i < Math.min(p + 1, n); i++) {
      const step = st.steps[i];
      if (step.before) {
        h += (step.before.story || []).map(bubbleHTML).join('');
        h += (step.before.images || []).map(imgHTML).join('');
      }
      if (i < p) h += doneCard(st, i, step);
      else h += activeCard(st, i, step);
    }
    if (p >= n && U.justIdx == null) {
      h += `<div class="card keycard${rise()}"><div>🔑 כרטיס גישה התקבל</div><div class="letter">${esc(st.letter)}</div>
        <p class="muted small">שמרו על האות. היא חלק מקוד היציאה.</p>
        <p><b>אבחנה:</b> ${esc(st.diagnosis)}</p><button class="btn" data-act="back">חזרה למפה ▸</button></div>`;
    }
    return h;
  }

  function answerText(step) {
    switch (step.type) {
      case 'choice': return esc(step.options[step.answer]);
      case 'multi': return step.answer.map((i) => '• ' + esc(step.options[i])).join('<br>');
      case 'body': return step.answer.map((r) => REG[r]).join(', ');
      case 'text': return step.fields.map((f) => esc(f.show || f.accept[0])).join(' • ');
      case 'match': return step.pairs.map((p) => `• ${esc(p.left)}: <b>${esc(p.right)}</b>`).join('<br>');
      case 'sequence': return '<ol style="margin:4px 0;padding-inline-start:20px">' + step.items.map((t) => `<li>${esc(t)}</li>`).join('') + '</ol>';
    }
    return '';
  }

  function doneCard(st, i, step) {
    const fresh_ = U.justIdx === i, n = st.steps.length;
    const explain = `<div class="explain"><b>מה למדנו:</b> ${esc(step.explain)}</div>`;
    let h = `<div class="card step done${fresh_ ? ' rise' : ''}"><div class="num">✔ שלב ${i + 1} מתוך ${n}</div><div class="q">${esc(step.q)}</div>
      <div class="small"><b>התשובה:</b><br>${answerText(step)}</div>`;
    if (fresh_) {
      h += explain + `<div style="height:12px"></div><button class="btn block" data-act="next">${i + 1 >= n ? '🔑 קבלו את כרטיס הגישה' : 'המשיכו ▸'}</button>`;
    } else {
      h += `<details style="margin-top:8px"><summary class="muted small" style="cursor:pointer">הסבר</summary>${explain}</details>`;
    }
    return h + '</div>';
  }

  function activeCard(st, i, step) {
    const n = st.steps.length;
    let h = `<div class="card step${rise()}" id="active"><div class="num">שלב ${i + 1} מתוך ${n}</div><div class="q">${esc(step.q)}</div>`;
    h += ({ choice: bChoice, multi: bMulti, text: bText, match: bMatch, sequence: bSeq, body: bBody }[step.type])(step);
    if (U.msg) h += `<div class="msg-bad">${esc(U.msg)}</div>`;
    h += hintArea(st, i, step) + '</div>';
    return h;
  }

  const bChoice = (s) => U.perm.map((k, pos) => {
    const bad = U.wrong.includes(k);
    return `<button class="opt ${bad ? 'bad' : ''}" ${bad ? 'disabled' : ''} data-act="opt" data-i="${k}"><span class="mk">${HEB[pos]}</span><span>${esc(s.options[k])}</span></button>`;
  }).join('');

  const bMulti = (s) => U.perm.map((k) =>
    `<button class="opt ${U.sel.includes(k) ? 'sel' : ''}" data-act="mtoggle" data-i="${k}"><span class="mk">${U.sel.includes(k) ? '✓' : ''}</span><span>${esc(s.options[k])}</span></button>`
  ).join('') + `<button class="btn block" data-act="mcheck" ${U.sel.length ? '' : 'disabled'}>בדקו תשובה</button>`;

  const bText = (s) => s.fields.map((f, k) =>
    `<div class="tfield"><label>${esc(f.label)}</label><input class="field ${U.tok[k] === true ? 'ok' : U.tok[k] === false ? 'bad' : ''}" data-ti="${k}" value="${esc(U.tval[k] || '')}" ${U.tok[k] === true ? 'readonly' : ''} autocomplete="off" autocapitalize="off" spellcheck="false"></div>`
  ).join('') + `<button class="btn block" data-act="tcheck">אישור</button>`;

  const bMatch = (s) => s.pairs.map((p, k) =>
    `<div class="mrow ${U.mok[k] === true ? 'ok' : U.mok[k] === false ? 'bad' : ''}"><div>${esc(p.left)}</div>
      <select class="field" data-mi="${k}" ${U.mok[k] === true ? 'disabled' : ''}><option value="">בחרו…</option>${U.mopts.map((o) => `<option ${U.mval[k] === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div>`
  ).join('') + `<button class="btn block" data-act="mmatch">בדקו תשובות</button>`;

  function bSeq(s) {
    let h = `<div class="slots">`;
    s.items.forEach((_, k) => {
      const v = U.seq[k];
      h += `<div class="slot ${v != null ? 'filled' : ''}" ${v != null ? `data-act="slotundo" data-i="${k}"` : ''}><span class="n">${k + 1}</span><span>${v != null ? esc(s.items[v]) : ''}</span></div>`;
    });
    h += `</div>`;
    h += U.order.filter((v) => !U.seq.includes(v)).map((v) => `<button class="opt" data-act="seqpick" data-i="${v}"><span class="mk">+</span><span>${esc(s.items[v])}</span></button>`).join('');
    return h + (U.seq.length ? `<button class="btn ghost" data-act="seqreset" style="margin-top:6px">איפוס</button>` : '');
  }

  function bBody(s) {
    const c = (r) => U.sel.includes(r) ? 'on' : '';
    const w = (r) => U.wrong.includes(r) ? 'style="opacity:.4"' : '';
    const rg = (r, inner) => `<g class="${c(r)}" data-act="reg" data-r="${r}" ${w(r)}>${inner}</g>`;
    const svg = `<svg class="bodymap" viewBox="0 0 220 450" role="img" aria-label="מפת גוף">
      <rect x="44" y="108" width="18" height="140" rx="9" fill="rgba(148,163,184,.1)" stroke="rgba(148,163,184,.4)"/>
      <rect x="158" y="108" width="18" height="140" rx="9" fill="rgba(148,163,184,.1)" stroke="rgba(148,163,184,.4)"/>
      ${rg('face', '<circle class="rg" cx="110" cy="48" r="34"/><text x="110" y="52" text-anchor="middle">פנים</text>')}
      ${rg('neck', '<rect class="rg" x="98" y="82" width="24" height="22" rx="6"/><text x="132" y="97">צוואר</text>')}
      ${rg('chest', '<rect class="rg" x="68" y="106" width="84" height="68" rx="14"/><text x="110" y="145" text-anchor="middle">חזה</text>')}
      ${rg('abdomen', '<rect class="rg" x="72" y="176" width="76" height="66" rx="12"/><text x="110" y="213" text-anchor="middle">בטן</text>')}
      ${rg('hands', '<circle class="rg" cx="53" cy="262" r="18"/><circle class="rg" cx="167" cy="262" r="18"/><text x="53" y="292" text-anchor="middle">ידיים</text><text x="167" y="292" text-anchor="middle">ידיים</text>')}
      ${rg('legs', '<rect class="rg" x="76" y="246" width="30" height="170" rx="13"/><rect class="rg" x="114" y="246" width="30" height="170" rx="13"/><text x="110" y="440" text-anchor="middle">רגליים וכפות רגליים</text>')}
    </svg>`;
    return svg + (s.multi ? `<div class="muted small" style="text-align:center">נבחרו: ${U.sel.map((r) => REG[r]).join(', ') || 'עדיין כלום'}</div>
      <button class="btn block" style="margin-top:8px" data-act="bcheck" ${U.sel.length ? '' : 'disabled'}>בדקו תשובה</button>` : `<div class="muted small" style="text-align:center">לחצו על אזור בגוף</div>`);
  }

  function hintArea(st, i, step) {
    const key = st.id + ':' + i, used = S.hints[key] || 0, hs = step.hints || [];
    if (!hs.length) return '';
    let h = hs.slice(0, used).map((t, k) => `<div class="hintbox">📞 <b>פרופ׳ עלמה (רמז ${k + 1}):</b> ${esc(t)}</div>`).join('');
    if (used < hs.length) {
      const pen = G.penalties.hint[Math.min(used, G.penalties.hint.length - 1)];
      h += `<button class="btn ghost warn-b" style="margin-top:10px" data-act="hint">📞 התקשרו לפרופ׳ עלמה: רמז ${used + 1}/${hs.length} (+${pen} שניות)</button>`;
    }
    return h;
  }

  /* ----- solving ----- */
  function solved() {
    const st = stById(S.cur), i = S.progress[st.id] || 0;
    S.progress[st.id] = i + 1;
    if (i + 1 >= st.steps.length && !S.done.includes(st.id)) S.done.push(st.id);
    Sound.ok();
    const prevJust = i;
    U = { animate: true, justIdx: prevJust };
    prepStep(); U.justIdx = prevJust;
    save(); render();
    const card = $('.step.done.rise'); if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function wrong(msg) {
    penalize(G.penalties.wrong, S.cur, true);
    U.msg = msg || '';
    render();
  }
  const curStep = () => { const st = stById(S.cur); return st.steps[S.progress[st.id] || 0]; };

  /* ----- door ----- */
  function rDoor() {
    const letters = S.done.map((id) => stById(id).letter);
    const used = S.hints.door || 0, hs = G.exit.hints;
    let h = `<button class="btn ghost" data-act="back" style="margin-bottom:12px">▸ חזרה למפה</button>
      <div class="card"><h2>🚪 הדלת החוצה</h2><p>${esc(G.exit.prompt)}</p>
      <div class="door ${U.doorOpen ? 'open' : ''}"><div class="glow"></div><div class="leaf">🔒</div><div class="leaf">🔒</div></div>
      <div class="cards">${letters.map((l) => `<span class="keyslot have">${esc(l)}</span>`).join('')}</div>
      <input class="field code-input" id="code" maxlength="${G.exit.word.length + 4}" placeholder="${'_ '.repeat(G.exit.word.length).trim()}" autocomplete="off" autocapitalize="characters" spellcheck="false" ${U.doorOpen ? 'disabled' : ''}>
      ${U.msg ? `<div class="msg-bad">${esc(U.msg)}</div>` : ''}
      <button class="btn block" data-act="code" ${U.doorOpen ? 'disabled' : ''}>🔓 נסו לפתוח</button>`;
    h += hs.slice(0, used).map((t, k) => `<div class="hintbox">📞 <b>רמז ${k + 1}:</b> ${esc(t)}</div>`).join('');
    if (used < hs.length && !U.doorOpen) {
      const pen = G.penalties.hint[Math.min(used, 2)];
      h += `<button class="btn ghost" style="margin-top:10px" data-act="hint">📞 התקשרו לפרופ׳ עלמה: רמז ${used + 1}/${hs.length} (+${pen} שניות)</button>`;
    }
    return h + '</div>';
  }

  /* ----- finale ----- */
  function rFinale() {
    const mist = sum(S.mistakes), hnt = sum(S.hintTotal);
    return `<div class="card" style="text-align:center"><div style="font-size:3.4rem">🎉</div><h1>יצאתם מבית החולים!</h1>
      <p class="muted">כל שמונת החולים טופלו, והמשמרת נגמרה.</p>
      <div class="stats"><div><span class="muted small">זמן סופי</span><b>${fmt(total())}</b></div>
      <div><span class="muted small">זמן משחק</span><b>${fmt(elapsed())}</b></div>
      <div><span class="muted small">קנסות</span><b>${S.penalty}s</b></div>
      <div><span class="muted small">טעויות / רמזים</span><b>${mist} / ${hnt}</b></div></div>
      <p>הראו למורה את הזמן הסופי. עכשיו נשארה משימה אחרונה: סיכום ורפלקציה, שיוצאים ממנו כדוח.</p>
      <button class="btn block" data-act="toReflect">📝 לסיכום והרפלקציה</button></div>`;
  }

  /* ----- reflection ----- */
  function rReflect() {
    let h = `<div class="card"><h2>📝 סיכום ורפלקציה</h2><p class="muted">כתבו בעצמכם, במילים שלכם. הכתיבה הזאת היא חלק מהלמידה, והיא תהפוך לדוח שתגישו למורה.</p>
      <label class="muted small">שמות</label><input class="field" id="names" value="${esc(S.names)}" maxlength="60" autocomplete="off"></div>`;
    G.reflection.forEach((r) => {
      const v = S.refl[r.key] || '';
      h += `<div class="card" id="card-${r.key}"><h3>${esc(r.label)}</h3><p>${esc(r.prompt)}</p>
        <textarea class="field" data-r="${r.key}" placeholder="כתבו כאן…">${esc(v)}</textarea>
        <div class="counter ${v.trim().length >= r.min ? 'good' : ''}" data-c="${r.key}">${counterText(r, v.trim().length)}</div></div>`;
    });
    h += `<div class="card" id="card-rating"><h3>איך הייתה החוויה? <span class="muted small">(לא חובה)</span></h3><div class="rate">${[1, 2, 3, 4, 5].map((n) => `<button data-act="rate" data-n="${n}" class="${S.rating === n ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="muted small" style="margin-top:6px">1 = לא עזר ללמוד · 5 = עזר מאוד</div></div>
      <div class="missing" id="missing">${missingHTML()}</div>
      <button class="btn block${reflOk() ? '' : ' dim'}" id="mkreport" data-act="toReport">📄 צרו את הדוח</button>`;
    return h;
  }
  const counterText = (r, n) => r.min > 0 ? n + ' / ' + r.min : n + ' תווים';
  const missingList = () => {
    const m = G.reflection
      .map((r) => ({ id: 'card-' + r.key, text: `${r.label}: עוד ${r.min - (S.refl[r.key] || '').trim().length} תווים`, short: (S.refl[r.key] || '').trim().length < r.min }))
      .filter((x) => x.short);
    return m;
  };
  const reflOk = () => missingList().length === 0;
  const missingHTML = () => {
    const m = missingList();
    return m.length ? '<b>כדי ליצור את הדוח עוד חסר:</b><ul>' + m.map((x) => '<li>' + esc(x.text) + '</li>').join('') + '</ul>' : 'אפשר ליצור את הדוח בכל רגע. מה שכתבתם כאן יופיע בו, וזה מה שהמורה יבדוק.';
  };

  /* ----- report ----- */
  function resultCode() {
    const o = { n: S.names, t: Math.round(total()), e: Math.round(elapsed()), p: S.penalty, w: sum(S.mistakes), h: sum(S.hintTotal), s: S.done.length, d: new Date().toISOString().slice(0, 10) };
    return 'ENDO-' + btoa(unescape(encodeURIComponent(JSON.stringify(o))));
  }
  function rReport() {
    const date = new Date().toLocaleDateString('he-IL');
    let h = `<div class="noprint card"><p>הדוח מוכן. לחצו על "שמירה כ־PDF", ובחלון ההדפסה בחרו <b>"שמירה כ־PDF"</b> כיעד. אפשר גם להוריד טקסט, ולהגיש את הקובץ למורה.</p>
      <div class="row"><button class="btn" data-act="print">🖨️ שמירה כ־PDF / הדפסה</button><button class="btn ghost" data-act="txt">⬇️ הורדת טקסט</button>
      <button class="btn ghost" data-act="copycode">📋 העתקת קוד תוצאה</button><button class="btn ghost" data-act="toReflect">✏️ חזרה לעריכה</button></div></div>
      <div class="report"><h1>${esc(G.meta.title)}: דוח סיכום</h1>
      <div class="meta"><span><b>צוות:</b> ${esc(S.names || 'ללא שם')}</span><span><b>תאריך:</b> ${date}</span>
      <span><b>זמן סופי:</b> ${fmt(total())}</span><span><b>קנסות:</b> ${S.penalty} שניות</span></div>
      <h2>סיכום תחנות</h2><div class="tscroll"><table><tr><th>תחנה</th><th>אבחנה</th><th>הורמון מפתח</th><th>טיפול</th><th>טעויות</th><th>רמזים</th></tr>
      ${G.stations.map((s) => `<tr><td>${esc(s.title)}</td><td>${esc(s.diagnosis)}</td><td>${esc(s.keyHormone)}</td><td>${esc(s.treatment)}</td><td>${S.mistakes[s.id] || 0}</td><td>${S.hintTotal[s.id] || 0}</td></tr>`).join('')}</table></div>`;
    G.reflection.forEach((r) => { h += `<h2>${esc(r.label)}</h2><p class="muted small" style="color:#475569">${esc(r.prompt)}</p><div class="ans">${esc(S.refl[r.key] || '')}</div>`; });
    h += `<h2>דירוג החוויה</h2><p>${S.rating ? S.rating + ' מתוך 5' : 'לא דורג'}</p><h2>קוד תוצאה (למורה)</h2><div class="code">${resultCode()}</div><p class="credit" style="color:#64748b">פותח על ידי אורי עליון</p></div>`;
    return h;
  }
  function reportText() {
    const L = [`${G.meta.title}: דוח סיכום`, `צוות: ${S.names}`, `תאריך: ${new Date().toLocaleDateString('he-IL')}`, `זמן סופי: ${fmt(total())} (קנסות: ${S.penalty} שניות)`, '', 'תחנות:'];
    G.stations.forEach((s) => L.push(`- ${s.title}: ${s.diagnosis} | ${s.keyHormone} | ${s.treatment} | טעויות ${S.mistakes[s.id] || 0}, רמזים ${S.hintTotal[s.id] || 0}`));
    G.reflection.forEach((r) => { L.push('', r.label, r.prompt, S.refl[r.key] || ''); });
    L.push('', `דירוג: ${S.rating ? S.rating + '/5' : 'לא דורג'}`, '', 'קוד תוצאה: ' + resultCode(), '', 'פותח על ידי אורי עליון');
    return L.join('\n');
  }

  /* ---------------- events ---------------- */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) { if (e.target.tagName === 'IMG' && e.target.closest('figure.img')) lightbox(e.target.src); return; }
    const act = t.dataset.act, i = +t.dataset.i;
    const step = S.cur && S.screen === 'station' ? curStep() : null;
    switch (act) {
      case 'mute': Sound.toggle(); $('#mute').textContent = Sound.isMuted() ? '🔇' : '🔊'; break;
      case 'introNext': U.introIdx = (U.introIdx || 0) + 1; U.animate = true; Sound.unlock(); Sound.pager(); render(); break;
      case 'start': {
        const nm = ($('#names') || {}).value || '';
        S.names = nm.trim(); S.startTs = Date.now(); Sound.unlock(); Sound.ok(); go('hub'); break;
      }
      case 'open': Sound.unlock(); openStation(t.dataset.id); break;
      case 'back': U.justIdx = null; go('hub'); break;
      case 'toDoor': U = { animate: true }; go('door'); break;
      case 'reset': e.preventDefault(); if (confirm('למחוק את כל ההתקדמות ולהתחיל מחדש?')) { S = fresh(); U = { animate: true, introIdx: 0 }; save(); render(); } break;
      case 'listen': Sound.unlock(); Sound.heart(stById(S.cur).vitals.hr, 4); break;
      case 'hint': {
        if (S.screen === 'door') {
          const used = S.hints.door || 0;
          if (used >= G.exit.hints.length) break;
          penalize(G.penalties.hint[Math.min(used, 2)], null, false); S.hints.door = used + 1; S.hintTotal.door = (S.hintTotal.door || 0) + 1;
        } else {
          const st = stById(S.cur), idx = S.progress[st.id] || 0, key = st.id + ':' + idx, used = S.hints[key] || 0;
          if (used >= (step.hints || []).length) break;
          penalize(G.penalties.hint[Math.min(used, G.penalties.hint.length - 1)], null, false);
          S.hints[key] = used + 1; S.hintTotal[st.id] = (S.hintTotal[st.id] || 0) + 1;
        }
        Sound.ring(); save(); render(); break;
      }
      case 'opt':
        if (i === step.answer) solved(); else { U.wrong.push(i); wrong(); }
        break;
      case 'mtoggle': { const k = U.sel.indexOf(i); k < 0 ? U.sel.push(i) : U.sel.splice(k, 1); render(); break; }
      case 'mcheck':
        if (sameSet(U.sel, step.answer)) solved(); else wrong('לא מדויק. יש בחירה מיותרת או שחסרה בחירה.');
        break;
      case 'tcheck': checkText(step); break;
      case 'mmatch': checkMatch(step); break;
      case 'seqpick':
        U.seq.push(i);
        if (U.seq.length === step.items.length) {
          if (U.seq.every((v, k) => v === k)) { solved(); }
          else { U.seq = []; wrong('הסדר לא נכון. התחילו מחדש.'); }
        } else render();
        break;
      case 'slotundo': U.seq = U.seq.slice(0, i); render(); break;
      case 'seqreset': U.seq = []; render(); break;
      case 'reg': {
        const r = t.dataset.r;
        if (step.multi) { const k = U.sel.indexOf(r); k < 0 ? U.sel.push(r) : U.sel.splice(k, 1); render(); }
        else if (step.answer.includes(r)) solved(); else { U.wrong.push(r); wrong(); }
        break;
      }
      case 'bcheck':
        if (sameSet(U.sel, step.answer)) solved(); else wrong('לא מדויק. בדקו אילו אזורים חסרים או מיותרים.');
        break;
      case 'next': {
        const st = stById(S.cur);
        U.justIdx = null; U.animate = true; prepStep(); render();
        if ((S.progress[st.id] || 0) >= st.steps.length) { Sound.key(); confetti(); }
        const a = $('#active') || $('.keycard'); if (a) a.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      }
      case 'code': checkCode(); break;
      case 'toReflect': go('reflect'); break;
      case 'rate': S.rating = +t.dataset.n; save(); render(); break;
      case 'toReport': {
        const m = missingList();
        if (!m.length) { go('report'); break; }
        const card = document.getElementById(m[0].id);
        if (card) { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); card.classList.add('flash'); setTimeout(() => card.classList.remove('flash'), 1600); }
        toast('עוד לא הכול מולא: ' + m[0].text, false);
        break;
      }
      case 'print': window.print(); break;
      case 'txt': download('endocrine-report.txt', reportText()); break;
      case 'copycode': copy(resultCode()); break;
    }
  });

  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.ti !== undefined) U.tval[+t.dataset.ti] = t.value;
    else if (t.dataset.r) {
      S.refl[t.dataset.r] = t.value; save();
      const r = G.reflection.find((x) => x.key === t.dataset.r), n = t.value.trim().length, c = $(`[data-c="${r.key}"]`);
      c.textContent = counterText(r, n); c.classList.toggle('good', n >= r.min);
      $('#missing').innerHTML = missingHTML(); $('#mkreport').classList.toggle('dim', !reflOk());
    } else if (t.id === 'names') { S.names = t.value; save(); }
  });
  document.addEventListener('change', (e) => { if (e.target.dataset.mi !== undefined) U.mval[+e.target.dataset.mi] = e.target.value; });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (e.target.dataset && e.target.dataset.ti !== undefined) { e.preventDefault(); checkText(curStep()); }
    if (e.target.id === 'code') { e.preventDefault(); checkCode(); }
  });
  // החלפת תמונה חסרה בכרטיס מקום־שמור
  document.addEventListener('error', (e) => {
    const im = e.target;
    if (im.tagName !== 'IMG') return;
    const d = document.createElement('div');
    d.className = 'ph';
    d.innerHTML = `<div style="font-size:2.2rem">🖼️</div><div>${esc(im.dataset.cap || '')}<br><span class="small">(התמונה עוד לא הועלתה: ${esc(im.getAttribute('src'))})</span></div>`;
    im.replaceWith(d);
  }, true);
  $('#mute').addEventListener('click', () => { Sound.toggle(); $('#mute').textContent = Sound.isMuted() ? '🔇' : '🔊'; });

  function checkText(step) {
    $$('[data-ti]').forEach((inp) => { U.tval[+inp.dataset.ti] = inp.value; });
    let all = true;
    step.fields.forEach((f, k) => {
      if (U.tok[k] === true) return;
      const ok = matchText(U.tval[k] || '', f.accept, f.reject);
      U.tok[k] = ok; if (!ok) all = false;
    });
    if (all) solved(); else wrong('חלק מהתשובות לא נכונות. התשובות הנכונות סומנו בירוק.');
  }
  function checkMatch(step) {
    $$('[data-mi]').forEach((s) => { if (!s.disabled) U.mval[+s.dataset.mi] = s.value; });
    let all = true;
    step.pairs.forEach((p, k) => {
      if (U.mok[k] === true) return;
      const ok = U.mval[k] === p.right; U.mok[k] = ok; if (!ok) { all = false; U.mval[k] = ''; }
    });
    if (all) solved(); else wrong('חלק מההתאמות שגויות. מה שנכון נעול, ואת השאר תבחרו מחדש.');
  }
  function checkCode() {
    const v = (($('#code') || {}).value || '');
    if (matchText(v, G.exit.accept) && norm(v).length >= norm(G.exit.accept[0]).length) {
      S.endTs = Date.now(); save(); U.doorOpen = true; Sound.door(); confetti(); render();
      setTimeout(() => go('finale'), 2600);
    } else { penalize(G.penalties.door, null, false); U.msg = 'הקוד שגוי. הדלת נשארת נעולה.'; render(); }
  }
  function download(name, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/plain;charset=utf-8' }));
    a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function copy(text) {
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast('הקוד הועתק', true), () => prompt('העתיקו את הקוד:', text));
  }
  function lightbox(src) {
    const d = document.createElement('div');
    d.className = 'lightbox'; d.innerHTML = `<img src="${esc(src)}" alt="">`;
    d.addEventListener('click', () => d.remove());
    document.body.appendChild(d);
  }

  if (S.cur && S.screen === 'station') prepStep();
  render();
})();
