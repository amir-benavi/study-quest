'use strict';

const $ = s => document.querySelector(s);
const STORE = 'studyquest-v1';

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
  { lvl: 8, e: '🐉', n: 'דרקון' },
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
  { id: 'combo',   ic: '⚡', nm: 'קומבו',      ds: '3 משימות תוך 5 דקות',          test: s => s.stats.combo >= 3 },
  { id: 'streak3', ic: '🔥', nm: 'על הגל',     ds: 'רצף של 3 ימים',                test: s => currentStreak() >= 3 },
  { id: 'courses', ic: '📚', nm: 'רב-תחומי',   ds: 'משימות ב-3 קורסים שונים',      test: s => s.stats.courses.length >= 3 },
  { id: 'owl',     ic: '🦉', nm: 'ינשוף לילה', ds: 'משימה בין חצות ל-5 בבוקר',     test: s => s.stats.owl >= 1 },
  { id: 'lvl5',    ic: '🐔', nm: 'רמה 5',      ds: 'הגעת לרמה 5',                  test: s => levelInfo(s.xp).level >= 5 },
  { id: 'dragon',  ic: '🐉', nm: 'דרקון!',     ds: 'הגעת לרמה 8',                  test: s => levelInfo(s.xp).level >= 8 },
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
};

const DEMO = [
  ['להגיש תרגיל 3', 'אלגוריתמים', 'hard'],
  ['לקרוא פרק 4', 'מבוא לפסיכולוגיה', 'medium'],
  ['לצפות בהרצאה 6', 'אינפי 1', 'medium'],
  ['לשלוח מייל למתרגל', 'אלגוריתמים', 'easy'],
  ['לחזור על הוכחות למבחן', 'אינפי 1', 'hard'],
  ['להירשם לקורסי בחירה', 'מנהלה', 'easy'],
  ['פרויקט גמר – שלב א׳', 'מעבדה בתכנות', 'hard'],
  ['לסכם את הרצאה 2', 'מבוא לפסיכולוגיה', 'easy'],
];

// ---------- state ----------
const fresh = () => ({
  tasks: [], xp: 0, streak: 0, lastDay: null, unlocked: [],
  stats: { done: 0, hard: 0, owl: 0, combo: 0, courses: [] },
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
      <div class="meta">${t.course ? '<span class="course"></span>' : ''}<span class="badge">${DIFF[t.diff].label} · ${DIFF[t.diff].xp} XP</span></div>
    </div>
    <button class="del" aria-label="מחק">✕</button>`;
  li.querySelector('.t-title').textContent = t.title;
  if (t.course) li.querySelector('.course').textContent = t.course;
  const check = li.querySelector('.check');
  if (t.done) check.disabled = true;
  else check.onclick = () => complete(t.id, li);
  li.querySelector('.del').onclick = () => removeTask(t.id, li);
  return li;
}

function renderLists(newId) {
  const open = state.tasks.filter(t => !t.done);
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
  $('#petName').textContent = st.n;

  const nx = nextStage(level);
  const left = nx ? nx.lvl - level : 0;
  $('#nextEvo').textContent = !nx ? 'הגעת לשלב הסופי! 🏆'
    : left === 1 ? `עוד רמה אחת להתפתחות הבאה ${nx.e}`
    : `עוד ${left} רמות להתפתחות הבאה ${nx.e}`;

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
function pickQuote(diff) {
  const pool = [...QUOTES[diff], ...QUOTES.any].filter(q => !lastQuotes.includes(q));
  const q = pool[Math.floor(Math.random() * pool.length)];
  lastQuotes = [q, ...lastQuotes].slice(0, 8);
  return q;
}
function say(text) {
  const b = $('#bubble');
  b.textContent = text;
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

function flyXP(fromEl, gain, done) {
  const from = fromEl.getBoundingClientRect();
  const bar = $('#xpbar').getBoundingClientRect();
  const f = document.createElement('div');
  f.className = 'fly';
  f.textContent = `+${gain} XP`;
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

function addTask(title, course, diff) {
  const t = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title, course, diff, done: false, createdAt: Date.now() };
  state.tasks.unshift(t);
  save();
  return t;
}

function complete(id, li) {
  const t = state.tasks.find(x => x.id === id);
  if (!t || t.done) return;
  const before = levelInfo(state.xp).level;
  const gain = DIFF[t.diff].xp;
  const now = Date.now();

  t.done = true;
  t.doneAt = now;
  state.xp += gain;
  const s = state.stats;
  s.done++;
  if (t.diff === 'hard') s.hard++;
  if (new Date().getHours() < 5) s.owl++;
  recent = recent.filter(x => now - x < 5 * 60 * 1000).concat(now);
  s.combo = Math.max(s.combo, recent.length);
  if (t.course && !s.courses.includes(t.course)) s.courses.push(t.course);
  bumpStreak();
  save();

  const after = levelInfo(state.xp).level;
  sfx.ding();
  say(pickQuote(t.diff));
  li.classList.add('completing');
  li.querySelector('.check').textContent = '✓';
  flyXP(li.querySelector('.check'), gain, () => {
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
  [...DEMO].reverse().forEach(([title, course, diff]) => { if (!have.has(title)) addTask(title, course, diff); });
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

// ---------- wiring ----------
$('#addForm').addEventListener('submit', e => {
  e.preventDefault();
  const title = $('#title').value.trim();
  if (!title) return;
  const diff = document.querySelector('input[name="diff"]:checked').value;
  const t = addTask(title, $('#course').value.trim(), diff);
  renderLists(t.id);
  sfx.add();
  $('#title').value = '';
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
document.addEventListener('keydown', e => { if (e.key === 'Escape') hideLevelUp(); });

render();
