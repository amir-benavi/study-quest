'use strict';

const $ = s => document.querySelector(s);
const STORE = 'studyquest-v1';
const HOUR = 36e5, DAY = 24 * HOUR;
const EARLY_BONUS = 1.5; // XP multiplier for finishing more than a day before the deadline

// ---------- game rules ----------
const DIFF = {
  easy:   { xp: 10, label: 'קל' },
  medium: { xp: 25, label: 'בינוני' },
  hard:   { xp: 50, label: 'קשה' },
};

const STAGES = [
  { lvl: 1, e: '🥚', n: 'ביצה' },
  { lvl: 2, e: '🐣', n: 'אפרוח בוקע' },
  { lvl: 3, e: '🐥', n: 'אפרוח' },
  { lvl: 5, e: '🐔', n: 'תרנגול' },
  { lvl: 7, e: '🦅', n: 'נשר' },
  { lvl: 9, e: '🦖', n: 'דינוזאור' },
  { lvl: 12, e: '🐉', n: 'דרקון' },
  { lvl: 15, e: '🐉', n: 'דרקון אגדי', legend: true },
];

const xpNeeded = lvl => 50 + 25 * (lvl - 1);

function levelInfo(xp) {
  let level = 1;
  while (xp >= xpNeeded(level)) { xp -= xpNeeded(level); level++; }
  return { level, into: xp, need: xpNeeded(level) };
}
const stageFor = lvl => STAGES.filter(s => lvl >= s.lvl).pop();
const nextStage = lvl => STAGES.find(s => s.lvl > lvl);

const ACH = [
  { id: 'first',   ic: '🌱', nm: 'צעד ראשון',  ds: 'השלמת משימה ראשונה',          test: s => s.stats.done >= 1 },
  { id: 'five',    ic: '🖐️', nm: 'חמישייה',    ds: '5 משימות הושלמו',              test: s => s.stats.done >= 5 },
  { id: 'ten',     ic: '🏅', nm: 'מכונה',      ds: '10 משימות הושלמו',             test: s => s.stats.done >= 10 },
  { id: 'hard',    ic: '💪', nm: 'אומץ',       ds: 'השלמת משימה קשה',              test: s => s.stats.hard >= 1 },
  { id: 'early',   ic: '⏱️', nm: 'מקדימים',    ds: 'סיום יותר מיום לפני הדדליין',  test: s => s.stats.early >= 1 },
  { id: 'moodle',  ic: '🔗', nm: 'מחוברים',    ds: 'ייבוא מטלות מ-Moodle',         test: s => s.stats.imported >= 1 },
  { id: 'combo',   ic: '⚡', nm: 'קומבו',      ds: '3 משימות תוך 5 דקות',          test: s => s.stats.combo >= 3 },
  { id: 'streak3', ic: '🔥', nm: 'על הגל',     ds: 'רצף של 3 ימים',                test: s => currentStreak() >= 3 },
  { id: 'courses', ic: '📚', nm: 'רב-תחומי',   ds: 'משימות ב-3 קורסים שונים',      test: s => s.stats.courses.length >= 3 },
  { id: 'owl',     ic: '🦉', nm: 'ינשוף לילה', ds: 'משימה בין חצות ל-5 בבוקר',     test: s => s.stats.owl >= 1 },
  { id: 'lvl5',    ic: '🐔', nm: 'רמה 5',      ds: 'הגעת לרמה 5',                  test: s => levelInfo(s.xp).level >= 5 },
  { id: 'dragon',  ic: '🐉', nm: 'דרקון!',     ds: 'הגעת לרמה 12',                 test: s => levelInfo(s.xp).level >= 12 },
  { id: 'legend',  ic: '✨', nm: 'אגדה',       ds: 'הגעת לרמה 15',                 test: s => levelInfo(s.xp).level >= 15 },
];

// what the pet says when a task is done: difficulty-specific lines mixed with general ones
const QUOTES = {
  easy: [
    'קטן אבל סופר ✔️',
    'צעד קטן לסטודנט, צעד ענק לממוצע',
    'ככה בונים מומנטום 🚀',
    'וי קטן, דופמין גדול',
    'עוד אחת ירדה מהרשימה 👋',
    'קל? אולי. נספר? בהחלט.',
    'גם משימות קטנות בונות דרקונים 🐉',
    'יפה! עכשיו הבאה בתור',
  ],
  medium: [
    'יציב! ככה עוברים סמסטר 📈',
    'חצי דרך לגאונות 🧠',
    'ה-XP הזה הרגיש טוב, נכון?',
    'המרצה היה גאה (כנראה) 🎓',
    'עבודה רצינית, תוצאות רציניות',
    'עוד משימה פחות, עוד קפה יותר ☕',
    'הממוצע מחייך עכשיו 😊',
    'קצב מעולה, לא לעצור!',
  ],
  hard: [
    'זה היה בוס! 💪',
    'וואו. פשוט וואו. 🔥',
    'המשימה הזאת לא ידעה עם מי היא מתעסקת',
    'אגדה. אין מילה אחרת. 🏆',
    'זה שווה הפסקת קפה מוצדקת ☕',
    'הדרקון הפנימי מתעורר 🐉',
    'מבחן? איזה מבחן? 😎',
    'את זה אפשר לשים בקורות חיים',
  ],
  any: [
    'המוח עושה כפיפות בטן 🧠',
    'אתם-של-העתיד שולחים תודה 🙏',
    'דדליין? מה זה? 😌',
    'ככה בונים ממוצע 90+',
    'פרוקרסטינציה: 0, אתם: 1',
    'הספרייה גאה בכם 📚',
    'עוד אחת והמלגה בדרך (אולי) 💸',
    'אני מתפתח בזכותכם! 🥹',
  ],
  early: [
    'הגשה מוקדמת?! מי אתם?! 😱',
    'בונוס ×1.5! המתרגל בהלם ⚡',
    'הדדליין עוד ישן, ואתם כבר סיימתם 😴',
    'ככה נראית תוכנית עבודה 📅',
    'מוקדם זה הזמן החדש 🏎️',
  ],
  late: [
    'עדיף מאוחר מאשר אף פעם 🙂',
    'הוגש! זה מה שחשוב',
    'בפעם הבאה ננצח את הדדליין ⏰',
    'סוף טוב, הכול טוב 🫡',
  ],
};

// [title, course, difficulty, hours until deadline (null = no deadline)]
const DEMO = [
  ['להגיש תרגיל 3', 'אלגוריתמים', 'hard', 72],
  ['לקרוא פרק 4', 'מבוא לפסיכולוגיה', 'medium', 30],
  ['לצפות בהרצאה 6', 'אינפי 1', 'medium', null],
  ['לשלוח מייל למתרגל', 'אלגוריתמים', 'easy', 5],
  ['לחזור על הוכחות למבחן', 'אינפי 1', 'hard', 9 * 24],
  ['להירשם לקורסי בחירה', 'מנהלה', 'easy', 20],
  ['פרויקט גמר – שלב א׳', 'מעבדה בתכנות', 'hard', 14 * 24],
  ['לסכם את הרצאה 2', 'מבוא לפסיכולוגיה', 'easy', null],
];

// ---------- deadlines ----------
function dueInfo(due) {
  const ms = due - Date.now();
  if (ms < 0) return { cls: 'late', text: '⚠️ באיחור' };
  const h = ms / HOUR, d = Math.round(h / 24), hr = Math.round(h);
  const text = h < 1 ? `⏰ עוד ${Math.max(1, Math.round(ms / 60000))} דק׳`
    : h < 48 ? (hr === 1 ? '⏰ עוד שעה' : `⏰ עוד ${hr} שעות`)
    : `⏰ עוד ${d} ימים`;
  return { cls: h < 24 ? 'urgent' : h < 72 ? 'soon' : '', text };
}
const fmtDue = due => new Date(due).toLocaleString('he-IL', {
  weekday: 'short', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit',
});

// ---------- state ----------
const fresh = () => ({
  tasks: [], xp: 0, streak: 0, lastDay: null, unlocked: [],
  stats: { done: 0, hard: 0, owl: 0, combo: 0, early: 0, imported: 0, courses: [] },
  muted: false, theme: null,
});

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE));
    if (s && Array.isArray(s.tasks)) return { ...fresh(), ...s, stats: { ...fresh().stats, ...s.stats } };
  } catch {}
  return fresh();
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch {}
}

let state = load();
let recent = []; // completion timestamps this session, for the combo achievement

// ---------- streak ----------
const dayKey = d => d.toLocaleDateString('en-CA');
const yesterdayKey = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); };

function currentStreak() {
  return state.lastDay === dayKey(new Date()) || state.lastDay === yesterdayKey() ? state.streak : 0;
}
function bumpStreak() {
  const today = dayKey(new Date());
  if (state.lastDay === today) return;
  state.streak = state.lastDay === yesterdayKey() ? state.streak + 1 : 1;
  state.lastDay = today;
}

// ---------- sound (generated with Web Audio, no files) ----------
let actx;
function tone(freq, at, dur, type = 'sine', vol = .15) {
  if (state.muted) return;
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    const t = actx.currentTime + at;
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + .01);
    g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g).connect(actx.destination);
    o.start(t); o.stop(t + dur + .05);
  } catch {}
}
const sfx = {
  add()     { tone(440, 0, .08, 'sine', .08); tone(660, .05, .1, 'sine', .08); },
  ding()    { tone(880, 0, .15, 'triangle'); tone(1320, .08, .3, 'triangle'); },
  del()     { tone(260, 0, .12, 'sawtooth', .04); tone(180, .06, .15, 'sawtooth', .04); },
  ach()     { tone(784, 0, .12); tone(1175, .1, .35); },
  levelUp() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * .1, .3, 'square', .07));
    tone(1568, .45, .7, 'triangle', .14);
  },
};

// ---------- rendering ----------
function hueOf(str) {
  let h = 0;
  for (const c of str) h = (h * 31 + c.codePointAt(0)) >>> 0;
  return h % 360;
}

function taskEl(t, isNew) {
  const li = document.createElement('li');
  li.className = `task ${t.diff}${isNew ? ' new' : ''}`;
  li.style.setProperty('--hue', hueOf(t.course || ''));
  li.innerHTML = `
    <button class="check" aria-label="סמן כבוצע">${t.done ? '✓' : ''}</button>
    <div class="body">
      <div class="t-title"></div>
      <div class="meta">${t.course ? '<span class="course"></span>' : ''}${t.due && !t.done ? '<span class="due"></span>' : ''}<span class="badge">${DIFF[t.diff].label} · ${DIFF[t.diff].xp} XP</span></div>
    </div>
    <button class="del" aria-label="מחק">✕</button>`;
  li.querySelector('.t-title').textContent = t.title;
  if (t.course) li.querySelector('.course').textContent = t.course;
  if (t.due && !t.done) {
    const el = li.querySelector('.due');
    el.dataset.due = t.due;
    el.title = fmtDue(t.due);
    paintDue(el);
  }
  const check = li.querySelector('.check');
  if (t.done) check.disabled = true;
  else check.onclick = () => complete(t.id, li);
  li.querySelector('.del').onclick = () => removeTask(t.id, li);
  return li;
}

function paintDue(el) {
  const { cls, text } = dueInfo(+el.dataset.due);
  el.className = `due ${cls}`;
  el.textContent = text;
}

function renderLists(newId) {
  // closest deadline first; tasks without a deadline after them, newest first
  const open = state.tasks.filter(t => !t.done)
    .sort((a, b) => (a.due ?? Infinity) - (b.due ?? Infinity) || b.createdAt - a.createdAt);
  const done = state.tasks.filter(t => t.done).sort((a, b) => b.doneAt - a.doneAt);
  $('#openList').replaceChildren(...open.map(t => taskEl(t, t.id === newId)));
  $('#doneList').replaceChildren(...done.map(t => taskEl(t)));
  $('#emptyOpen').hidden = open.length > 0;
  $('#openCount').textContent = open.length || '';
  $('#doneListCount').textContent = done.length;

  const courses = [...new Set(state.tasks.map(t => t.course).filter(Boolean))];
  $('#courses').replaceChildren(...courses.map(c => Object.assign(document.createElement('option'), { value: c })));
}

function renderStats() {
  const { level, into, need } = levelInfo(state.xp);
  $('#level').textContent = level;
  $('#xpText').textContent = `${into} / ${need} XP`;
  $('#xpfill').style.width = `${(into / need) * 100}%`;

  const st = stageFor(level);
  $('#pet').textContent = st.e;
  $('#pet').classList.toggle('legend', !!st.legend);
  $('#petName').textContent = st.n;

  const nx = nextStage(level);
  const left = nx ? nx.lvl - level : 0;
  $('#nextEvo').textContent = !nx ? 'הגעת לשלב הסופי! 🏆'
    : left === 1 ? `עוד רמה אחת להתפתחות הבאה: ${nx.n} ${nx.e}`
    : `עוד ${left} רמות להתפתחות הבאה: ${nx.n} ${nx.e}`;

  $('#streak').textContent = currentStreak();
  $('#doneCount').textContent = state.stats.done;
  $('#totalXp').textContent = state.xp;
}

function renderAch(freshIds = []) {
  $('#achGrid').replaceChildren(...ACH.map(a => {
    const el = document.createElement('div');
    const on = state.unlocked.includes(a.id);
    el.className = `ach${on ? ' on' : ''}${freshIds.includes(a.id) ? ' fresh' : ''}`;
    el.innerHTML = `<div class="ic">${a.ic}</div><div class="nm">${a.nm}</div><div class="ds">${a.ds}</div>`;
    return el;
  }));
  $('#achCount').textContent = `${state.unlocked.length}/${ACH.length}`;
}

function renderControls() {
  $('#soundBtn').textContent = state.muted ? '🔇' : '🔊';
  if (state.theme) document.documentElement.dataset.theme = state.theme;
  else delete document.documentElement.dataset.theme;
  $('#themeBtn').textContent = effectiveTheme() === 'dark' ? '☀️' : '🌙';
}

function render() {
  renderLists();
  renderStats();
  renderAch();
  renderControls();
}

// ---------- effects ----------
function toast(ic, title, sub) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="ic">${ic}</span><div><b></b><small></small></div>`;
  el.querySelector('b').textContent = title;
  el.querySelector('small').textContent = sub || '';
  $('#toasts').append(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 3200);
}

let lastQuotes = [], bubbleTimer;
function pickQuote(kind) {
  const all = DIFF[kind] ? [...QUOTES[kind], ...QUOTES.any] : QUOTES[kind];
  const fresh = all.filter(q => !lastQuotes.includes(q));
  const pool = fresh.length ? fresh : all;
  const q = pool[Math.floor(Math.random() * pool.length)];
  lastQuotes = [q, ...lastQuotes].slice(0, 8);
  return q;
}
function say(text) {
  const b = $('#bubble');
  b.textContent = text;
  // speak to the right of the pet when the page margin has room, otherwise below it
  const room = innerWidth - $('.pet-wrap').getBoundingClientRect().right;
  b.classList.toggle('below', room < 290);
  b.classList.remove('show');
  void b.offsetWidth;
  b.classList.add('show');
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => b.classList.remove('show'), 3500);
}

function bumpPet() {
  const p = $('#pet');
  p.classList.remove('bump');
  void p.offsetWidth;
  p.classList.add('bump');
  setTimeout(() => p.classList.remove('bump'), 500);
}

function flyXP(fromEl, gain, bonus, done) {
  const from = fromEl.getBoundingClientRect();
  const bar = $('#xpbar').getBoundingClientRect();
  const f = document.createElement('div');
  f.className = 'fly';
  f.textContent = `+${gain} XP${bonus ? ' ⚡' : ''}`;
  const x0 = from.left + from.width / 2, y0 = from.top + from.height / 2;
  f.style.left = `${x0}px`;
  f.style.top = `${y0}px`;
  document.body.append(f);
  const dx = bar.left + bar.width / 2 - x0, dy = bar.top + bar.height / 2 - y0;
  const anim = f.animate([
    { transform: 'translate(-50%, -50%) scale(.6)', opacity: 0 },
    { transform: 'translate(-50%, -140%) scale(1.3)', opacity: 1, offset: .25 },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.7)`, opacity: .3 },
  ], { duration: 850, easing: 'cubic-bezier(.5, 0, .6, 1)' });
  anim.onfinish = () => {
    f.remove();
    const b = $('#xpbar');
    b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse');
    done();
  };
}

function fillBarThenLevelUp(then) {
  const fill = $('#xpfill');
  fill.style.width = '100%';
  setTimeout(() => {
    fill.style.transition = 'none';
    fill.style.width = '0%';
    void fill.offsetWidth;
    fill.style.transition = '';
    renderStats();
    then();
  }, 450);
}

function showLevelUp(before, after) {
  const oldSt = stageFor(before), newSt = stageFor(after);
  $('#luPet').textContent = newSt.e;
  $('#luPet').classList.toggle('legend', !!newSt.legend);
  $('#luLevel').textContent = after;
  const nx = nextStage(after);
  $('#luMsg').innerHTML = oldSt !== newSt
    ? `<div dir="ltr">${oldSt.e} ➜ ${newSt.e}</div>התפתחות! עכשיו את/ה ${newSt.n}`
    : nx ? `עוד קצת ותהפכו ל${nx.n} ${nx.e}` : 'אגדה 🏆';
  $('#levelUp').hidden = false;
  confetti();
  sfx.levelUp();
  bumpPet();
}
const hideLevelUp = () => { $('#levelUp').hidden = true; };

// confetti on a full-screen canvas
const cv = $('#confetti'), cx = cv.getContext('2d');
let parts = [], raf = 0;
function confetti() {
  const dpr = window.devicePixelRatio || 1;
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const colors = ['#7c5cff', '#ff5ca8', '#f5b301', '#22c55e', '#38bdf8'];
  for (let i = 0; i < 200; i++) {
    parts.push({
      x: innerWidth / 2, y: innerHeight * .4,
      vx: (Math.random() - .5) * 18, vy: -Math.random() * 15 - 4,
      s: Math.random() * 6 + 5, r: Math.random() * 6, vr: (Math.random() - .5) * .35,
      c: colors[i % colors.length], life: 0,
    });
  }
  if (!raf) raf = requestAnimationFrame(tick);
}
function tick() {
  cx.clearRect(0, 0, innerWidth, innerHeight);
  for (const p of parts) {
    p.vy += .35; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life++;
    cx.save();
    cx.translate(p.x, p.y); cx.rotate(p.r);
    cx.globalAlpha = Math.max(0, 1 - p.life / 170);
    cx.fillStyle = p.c;
    cx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
    cx.restore();
  }
  parts = parts.filter(p => p.y < innerHeight + 40 && p.life < 170);
  if (parts.length) raf = requestAnimationFrame(tick);
  else { cx.clearRect(0, 0, innerWidth, innerHeight); raf = 0; }
}

// ---------- actions ----------
function checkAchievements() {
  const fresh = ACH.filter(a => !state.unlocked.includes(a.id) && a.test(state));
  if (!fresh.length) return;
  fresh.forEach((a, i) => {
    state.unlocked.push(a.id);
    setTimeout(() => { toast(a.ic, `הישג חדש: ${a.nm}`, a.ds); sfx.ach(); }, 600 + i * 450);
  });
  save();
  renderAch(fresh.map(a => a.id));
}

function addTask(title, course, diff, due = null, uid = null) {
  const t = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title, course, diff, due, uid, done: false, createdAt: Date.now(),
  };
  state.tasks.unshift(t);
  save();
  return t;
}

function complete(id, li) {
  const t = state.tasks.find(x => x.id === id);
  if (!t || t.done) return;
  const before = levelInfo(state.xp).level;
  const now = Date.now();
  const early = t.due && t.due - now > DAY;
  const late = t.due && now > t.due;
  const gain = Math.round(DIFF[t.diff].xp * (early ? EARLY_BONUS : 1));

  t.done = true;
  t.doneAt = now;
  state.xp += gain;
  const s = state.stats;
  s.done++;
  if (t.diff === 'hard') s.hard++;
  if (early) s.early++;
  if (new Date().getHours() < 5) s.owl++;
  recent = recent.filter(x => now - x < 5 * 60 * 1000).concat(now);
  s.combo = Math.max(s.combo, recent.length);
  if (t.course && !s.courses.includes(t.course)) s.courses.push(t.course);
  bumpStreak();
  save();

  const after = levelInfo(state.xp).level;
  sfx.ding();
  say(pickQuote(early ? 'early' : late ? 'late' : t.diff));
  li.classList.add('completing');
  li.querySelector('.check').textContent = '✓';
  flyXP(li.querySelector('.check'), gain, early, () => {
    bumpPet();
    if (after > before) fillBarThenLevelUp(() => showLevelUp(before, after));
    else renderStats();
    checkAchievements();
  });
  setTimeout(renderLists, 400);
}

function removeTask(id, li) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  save();
  sfx.del();
  li.classList.add('removing');
  setTimeout(renderLists, 300);
}

function loadDemo() {
  const have = new Set(state.tasks.map(t => t.title));
  [...DEMO].reverse().forEach(([title, course, diff, hours]) => {
    if (!have.has(title)) addTask(title, course, diff, hours ? Date.now() + hours * HOUR : null);
  });
  // pretend we studied yesterday too, so the streak achievement can pop during the demo
  if (currentStreak() === 0) { state.streak = 2; state.lastDay = yesterdayKey(); }
  save();
  render();
  sfx.add();
  toast('✨', 'נוספו משימות לדוגמה', 'סמנו משימה קשה כדי לראות level-up');
  $('#openList').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

const effectiveTheme = () =>
  state.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

// ---------- Moodle import (.ics calendar export, parsed entirely in the browser) ----------
function parseIcsDate(v) {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s = 0, z] = m;
  if (h === undefined) return new Date(+y, mo - 1, +d, 23, 59).getTime(); // all-day: end of that day
  return z ? Date.UTC(+y, mo - 1, +d, +h, +mi, +s) : new Date(+y, mo - 1, +d, +h, +mi, +s).getTime();
}
// Moodle double-encodes: ICS escapes (\, \;) around HTML entities (&amp;)
const decodeEntities = v => v
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" })[e]);
const unescapeIcs = v => decodeEntities(v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1')).trim();

function parseICS(text) {
  // RFC 5545: long lines are folded onto continuation lines that start with a space or tab
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const events = [];
  let cur = null;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const i = line.indexOf(':');
    if (i < 0) continue;
    const name = line.slice(0, i).split(';')[0].toUpperCase();
    const val = line.slice(i + 1);
    if (name === 'DTSTART') cur.due = parseIcsDate(val);
    else if (name === 'UID' || name === 'SUMMARY' || name === 'CATEGORIES') cur[name.toLowerCase()] = unescapeIcs(val);
  }
  return events.filter(e => e.summary && e.due).map(e => {
    const rawCourse = (e.categories || '').split(',')[0].trim();
    return {
      uid: e.uid || `${e.summary}@${e.due}`,
      title: cleanTitle(e.summary),
      course: cleanCourse(rawCourse),
      due: e.due,
      diff: guessDiff(e.summary),
      kind: eventKind(e.summary, rawCourse),
    };
  });
}

// Moodle appends the event type to the activity name: "Lab 1 is due", "Quiz 2 closes"
const cleanTitle = s => s.replace(/\s+(is due|is due to be graded|closes|should be completed)\.?\s*$/i, '').trim();
// HUJI course categories look like "67723-תכנות עם סוכני AI": drop the course number
const cleanCourse = c => (/^site events$/i.test(c) ? '' : c.replace(/^\d+\s*-\s*/, '').trim());

// Only real deadlines get pre-selected: "is due" (assignments) and "closes" (quizzes).
// Openings, attendance sessions and site-wide events are calendar noise, not tasks.
function eventKind(summary, course) {
  if (/\b(opens|starts)\s*$/i.test(summary) || /נפתח/.test(summary)) return 'opening';
  if (/attendance|נוכחות/i.test(summary)) return 'attendance';
  if (/^site events$/i.test(course)) return 'site';
  return 'deadline';
}
const KIND_LABEL = { opening: 'פתיחה', attendance: 'נוכחות', site: 'אירוע כללי' };

function guessDiff(title) {
  if (/מבחן|בחינה|אמצע|exam|midterm|final|פרויקט|project|סמינר|seminar/i.test(title)) return 'hard';
  if (/quiz|בוחן/i.test(title)) return 'easy'; // weekly Moodle quizzes are short
  if (/תרגיל|מטלה|הגשה|עבודה|exercise|assignment|homework|submission|report|\bhw\b|\bex\b|lab/i.test(title)) return 'medium';
  return 'easy';
}

let importRows = [];

function openImport() {
  $('#importPick').hidden = false;
  $('#importPreview').hidden = true;
  $('#ipAdd').hidden = true;
  $('#importModal').hidden = false;
}
const closeImport = () => { $('#importModal').hidden = true; };

async function importFile(file) {
  let events = [];
  try { events = parseICS(await file.text()); } catch {}
  if (!events.length) {
    toast('⚠️', 'לא נמצאו מטלות בקובץ', 'ודאו שזה קובץ יומן (.ics) שיוצא מ-Moodle');
    return;
  }
  showPreview(events);
}

function showPreview(events) {
  const known = new Set(state.tasks.map(t => t.uid).filter(Boolean));
  const now = Date.now();
  // upcoming deadlines on top (pre-selected); openings, attendance, site events and past ones below
  importRows = events
    .map(e => ({ ...e, exists: known.has(e.uid), main: e.kind === 'deadline' && e.due >= now }))
    .map(e => ({ ...e, checked: e.main && !e.exists }))
    .sort((a, b) => b.main - a.main || a.due - b.due);

  const items = importRows.map((r, i) => {
    const li = document.createElement('li');
    li.className = 'ip-row';
    li.style.setProperty('--hue', hueOf(r.course));
    li.innerHTML = `
      <label>
        <input type="checkbox">
        <div class="body">
          <div class="t-title"></div>
          <div class="meta">${r.course ? '<span class="course"></span>' : ''}<span class="badge"></span></div>
        </div>
      </label>
      <select aria-label="רמת קושי">${Object.entries(DIFF).map(([k, d]) => `<option value="${k}">${d.label}</option>`).join('')}</select>`;
    li.querySelector('.t-title').textContent = r.title;
    if (r.course) li.querySelector('.course').textContent = r.course;
    const note = r.exists ? 'כבר קיים' : KIND_LABEL[r.kind] || (r.due < now ? 'עבר' : '');
    li.querySelector('.badge').textContent = `📅 ${fmtDue(r.due)}${note ? ` · ${note}` : ''}`;
    const cb = li.querySelector('input');
    cb.checked = r.checked;
    cb.disabled = r.exists;
    cb.onchange = () => { r.checked = cb.checked; updateImportSummary(); };
    const sel = li.querySelector('select');
    sel.value = r.diff;
    sel.onchange = () => { r.diff = sel.value; };
    li.dataset.i = i;
    return li;
  });

  const firstOther = importRows.findIndex(r => !r.main);
  if (firstOther >= 0) {
    const divider = document.createElement('li');
    divider.className = 'ip-divider';
    divider.textContent = `לא דדליינים או שכבר עברו (${importRows.length - firstOther})`;
    items.splice(firstOther, 0, divider);
  }
  $('#ipList').replaceChildren(...items);

  $('#importPick').hidden = true;
  $('#importPreview').hidden = false;
  $('#ipAdd').hidden = false;
  $('#importModal').hidden = false;
  updateImportSummary();
}

function updateImportSummary() {
  const deadlines = importRows.filter(r => r.main && !r.exists);
  const n = importRows.filter(r => r.checked).length;
  $('#ipSummary').textContent = `${importRows.filter(r => r.main).length} דדליינים מתוך ${importRows.length} אירועים · ${n} נבחרו`;
  $('#ipToggle').textContent = deadlines.every(r => r.checked) ? 'נקה בחירה' : 'בחר את כל הדדליינים';
  $('#ipToggle').hidden = !deadlines.length;
  $('#ipAdd').textContent = n ? `הוסף ${n} משימות` : 'בחרו משימות';
  $('#ipAdd').disabled = !n;
  $('#ipList').querySelectorAll('.ip-row').forEach(li => li.classList.toggle('off', !importRows[li.dataset.i].checked));
}

function toggleAllImport() {
  const deadlines = importRows.filter(r => r.main && !r.exists);
  const all = deadlines.every(r => r.checked);
  importRows.forEach(r => { r.checked = !all && r.main && !r.exists; });
  $('#ipList').querySelectorAll('.ip-row').forEach(li => { li.querySelector('input').checked = importRows[li.dataset.i].checked; });
  updateImportSummary();
}

function confirmImport() {
  const chosen = importRows.filter(r => r.checked && !r.exists);
  chosen.forEach(r => addTask(r.title, r.course, r.diff, r.due, r.uid));
  state.stats.imported += chosen.length;
  save();
  closeImport();
  renderLists();
  sfx.add();
  toast('📥', `נוספו ${chosen.length} משימות מ-Moodle`, 'ממוינות לפי הדדליין הקרוב');
  say('וואו, הרבה עבודה! יאללה מתחילים 💪');
  checkAchievements();
  $('#openList').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// drag a calendar file anywhere onto the page
let dragDepth = 0;
const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
window.addEventListener('dragenter', e => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth++;
  $('#dropOverlay').hidden = false;
});
window.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
window.addEventListener('dragleave', e => {
  if (!hasFiles(e)) return;
  if (--dragDepth <= 0) { dragDepth = 0; $('#dropOverlay').hidden = true; }
});
window.addEventListener('drop', e => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth = 0;
  $('#dropOverlay').hidden = true;
  const f = e.dataTransfer.files[0];
  if (f) importFile(f);
});

// ---------- wiring ----------
$('#addForm').addEventListener('submit', e => {
  e.preventDefault();
  const title = $('#title').value.trim();
  if (!title) return;
  const diff = document.querySelector('input[name="diff"]:checked').value;
  const dueVal = $('#due').value;
  const t = addTask(title, $('#course').value.trim(), diff, dueVal ? new Date(dueVal).getTime() : null);
  renderLists(t.id);
  sfx.add();
  $('#title').value = '';
  $('#due').value = '';
  $('#title').focus();
});

$('#demoBtn').onclick = loadDemo;
$('#soundBtn').onclick = () => { state.muted = !state.muted; save(); renderControls(); };
$('#themeBtn').onclick = () => { state.theme = effectiveTheme() === 'dark' ? 'light' : 'dark'; save(); renderControls(); };
$('#resetBtn').onclick = () => {
  if (!confirm('לאפס את כל ההתקדמות והמשימות?')) return;
  state = { ...fresh(), muted: state.muted, theme: state.theme };
  recent = [];
  save();
  render();
};
$('#luClose').onclick = hideLevelUp;
$('#levelUp').onclick = e => { if (e.target.id === 'levelUp') hideLevelUp(); };
document.addEventListener('keydown', e => { if (e.key === 'Escape') { hideLevelUp(); closeImport(); } });

$('#importBtn').onclick = openImport;
$('#icsFile').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) importFile(f); };
$('#sampleIcs').onclick = async () => {
  try {
    const res = await fetch('demo-moodle.ics');
    importFile(new File([await res.text()], 'demo-moodle.ics'));
  } catch { toast('⚠️', 'לא הצלחתי לטעון את קובץ הדוגמה'); }
};
$('#ipToggle').onclick = toggleAllImport;
$('#ipAdd').onclick = confirmImport;
$('#ipCancel').onclick = closeImport;
$('#importModal').onclick = e => { if (e.target.id === 'importModal') closeImport(); };

// keep countdowns fresh without re-rendering the list
setInterval(() => document.querySelectorAll('#openList .due[data-due]').forEach(paintDue), 30000);

render();
