// Leonida Trophy Guide — tracker + guide renderer.
// Loads app/data/trophies.json (local file only, no network), renders the
// checklist, roadmap, notes and sources, and keeps progress in localStorage.
const STORAGE_KEY = 'leonida-trophy-progress-v1';
const listEl = document.getElementById('trophyList');
const searchEl = document.getElementById('search');
const gradeEl = document.getElementById('gradeFilter');
const spoilerEl = document.getElementById('spoilerToggle');
const metaEl = document.getElementById('listMeta');
const onlineNoteEl = document.getElementById('onlineNote');
const params = new URLSearchParams(location.search);

const data = await (await fetch('data/trophies.json')).json();
const trophies = data.trophies;

let earned = new Set(loadProgress());
let kind = params.get('filter') ?? 'all';
let openId = params.get('open') ? Number(params.get('open')) : null;

if (params.get('seed')) {
  for (const n of params.get('seed').split(',')) earned.add(Number(n));
  saveProgress();
}
if (params.get('grade')) gradeEl.value = params.get('grade');
if (params.get('spoiler') === 'on') spoilerEl.checked = true;
if (params.get('q')) searchEl.value = params.get('q');

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); }
  catch { return []; }
}
function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...earned].sort((a, b) => a - b)));
}

function kindLabel(k) {
  return { story: 'Story', missable: 'Missable', collectibles: 'Collectibles', activities: 'Activities', hidden: 'Hidden', online: 'Online' }[k] ?? k;
}
function matches(t) {
  if (gradeEl.value !== 'all' && t.grade !== gradeEl.value) return false;
  if (kind === 'online') return false;
  if (kind === 'missable' && !t.missable) return false;
  if (kind === 'hidden' && !t.hidden) return false;
  if (kind !== 'all' && kind !== 'missable' && kind !== 'hidden' && !t.kinds.includes(kind)) return false;
  const q = searchEl.value.trim().toLowerCase();
  if (q && !(t.name + ' ' + t.description + ' ' + t.guide + ' ' + (t.target ?? '')).toLowerCase().includes(q)) return false;
  return true;
}

function sourceLinks(t) {
  return t.sources.map((s) => s.url
    ? `<a href="${s.url}" target="_blank" rel="noopener">${s.name}</a>`
    : s.name).join(' · ');
}

function renderList() {
  listEl.replaceChildren();
  const shown = trophies.filter(matches);
  onlineNoteEl.hidden = kind !== 'online';
  metaEl.textContent = kind === 'online'
    ? 'Online filter: 0 trophies — GTA VI has no online trophies.'
    : `Showing ${shown.length} of 55 trophies · ${earned.size} earned · ${trophies.filter((t) => t.missable).length} possibly missable`;
  for (const t of shown) {
    const li = document.createElement('li');
    li.className = 'trophy-card' + (earned.has(t.id) ? ' earned' : '');
    li.id = 'trophy-' + t.id;

    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = earned.has(t.id);
    box.setAttribute('aria-label', 'Mark ' + t.name + ' earned');
    box.addEventListener('change', () => {
      if (box.checked) earned.add(t.id); else earned.delete(t.id);
      saveProgress();
      renderProgress();
      renderList();
    });
    li.append(box);

    const body = document.createElement('div');
    const spoilerHidden = spoilerEl.checked && t.hidden && !earned.has(t.id);
    if (spoilerHidden) {
      body.innerHTML = `<p class="trophy-name">Hidden trophy</p>
        <p class="trophy-desc">Spoiler-free mode: the name and description stay hidden until you earn it.</p>
        <div class="trophy-meta"><span class="badge ${t.grade}">${t.grade}</span>
        <span class="tag hidden-tag">Hidden</span></div>`;
    } else {
      const name = document.createElement('p');
      name.className = 'trophy-name';
      name.textContent = t.name;
      body.append(name);
      const desc = document.createElement('p');
      desc.className = 'trophy-desc';
      desc.textContent = '“' + t.description + '”';
      body.append(desc);
      const meta = document.createElement('div');
      meta.className = 'trophy-meta';
      meta.innerHTML = `<span class="badge ${t.grade}">${t.grade}</span>` +
        t.kinds.map((k) => `<span class="tag">${kindLabel(k)}</span>`).join('') +
        (t.hidden ? '<span class="tag hidden-tag">Hidden</span>' : '') +
        (t.missable ? '<span class="tag missable-tag">⚠ Possibly missable</span>' : '');
      body.append(meta);
      if (t.target) {
        const target = document.createElement('p');
        target.className = 'target';
        target.textContent = 'Target: ' + t.target;
        body.append(target);
      }
    }
    li.append(body);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'guide-btn' + (openId === t.id ? ' open' : '');
    btn.textContent = openId === t.id ? 'Hide guide ▲' : 'Guide ▼';
    btn.addEventListener('click', () => {
      openId = openId === t.id ? null : t.id;
      renderList();
    });
    li.append(btn);

    if (!spoilerHidden && openId === t.id) {
      const guide = document.createElement('div');
      guide.className = 'guide';
      const unconfirmed = t.guide.includes('TRIGGER UNCONFIRMED');
      const text = unconfirmed ? t.guide.replace('TRIGGER UNCONFIRMED — ', '') : t.guide;
      guide.innerHTML = (unconfirmed
        ? '<p class="unconfirmed">⚠ Trigger unconfirmed — the guides at launch do not pin this one down. What follows is the best reported reading, not a confirmed step.</p>'
        : '') +
        `<p></p><p class="guide-sources"><strong>Sources:</strong> ${sourceLinks(t)}</p>`;
      guide.querySelector('p:not(.unconfirmed):not(.guide-sources)').textContent = text;
      li.append(guide);
    }
    if (spoilerHidden) {
      const mask = document.createElement('div');
      mask.className = 'spoiler-mask';
      mask.textContent = 'Tick the box once you have earned it to reveal the name, description and guide.';
      li.append(mask);
    }
    listEl.append(li);
  }
  if (openId) {
    const el = document.getElementById('trophy-' + openId);
    if (el) el.classList.add('open-card');
  }
}

function renderProgress() {
  const total = trophies.length;
  const others = trophies.filter((t) => t.id !== 1).length;
  const othersEarned = trophies.filter((t) => t.id !== 1 && earned.has(t.id)).length;
  document.getElementById('earnedCount').textContent = earned.size;
  document.getElementById('progressFill').style.width = (earned.size / total * 100).toFixed(1) + '%';
  document.getElementById('progressSub').textContent =
    `Platinum: Vice Got a Price! — ${othersEarned} of ${others} others done`;
  const byGrade = {};
  for (const t of trophies) {
    byGrade[t.grade] = byGrade[t.grade] ?? [0, 0];
    byGrade[t.grade][1] += 1;
    if (earned.has(t.id)) byGrade[t.grade][0] += 1;
  }
  document.getElementById('progressGrades').textContent =
    ['platinum', 'gold', 'silver', 'bronze'].map((g) => `${g} ${byGrade[g][0]}/${byGrade[g][1]}`).join(' · ');
}

function renderRoadmap() {
  const ol = document.getElementById('roadmapList');
  ol.replaceChildren();
  for (const s of data.roadmap) {
    const li = document.createElement('li');
    const h = document.createElement('h3');
    h.innerHTML = `Stage ${s.stage}: ${s.title} <span class="stage-time">· ${s.time}</span>`;
    const p = document.createElement('p');
    p.textContent = s.text;
    li.append(h, p);
    ol.append(li);
  }
  const ul = document.getElementById('checklist100');
  ul.replaceChildren();
  const items = [
    'Story complete (all 5 chapters)',
    '300 stunts (of 397 total)',
    '70 of 80 challenges',
    '200 of 277 vehicles discovered',
    '100 of 255 animals studied',
    '50 of 66 weapons',
    'All 8 bank vaults robbed',
    '39 illegal operations robbed',
    'All 42 Top Fun drone races won',
    '15 of 18 meditation spots',
    '3 collectible card sets',
    '8 Strangers & Freaks strands',
  ];
  for (const text of items) {
    const li = document.createElement('li');
    li.textContent = text;
    ul.append(li);
  }
  const notes = document.getElementById('notesList');
  notes.replaceChildren();
  for (const text of data.notes) {
    const li = document.createElement('li');
    li.textContent = text;
    notes.append(li);
  }
  const sources = document.getElementById('sourcesList');
  sources.replaceChildren();
  for (const s of data.sources) {
    const li = document.createElement('li');
    if (s.url) {
      const a = document.createElement('a');
      a.href = s.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = s.name;
      li.append(a);
    } else {
      li.textContent = s.name;
    }
    sources.append(li);
  }
}

function showView(name) {
  document.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== 'view-' + name; });
  document.querySelectorAll('.view-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
}
document.querySelectorAll('.view-btn').forEach((b) => b.addEventListener('click', () => showView(b.dataset.view)));
document.querySelectorAll('.kind-btn').forEach((b) => b.addEventListener('click', () => {
  kind = b.dataset.kind;
  document.querySelectorAll('.kind-btn').forEach((x) => x.classList.toggle('active', x === b));
  renderList();
}));
searchEl.addEventListener('input', renderList);
gradeEl.addEventListener('change', renderList);
spoilerEl.addEventListener('change', renderList);

document.getElementById('exportBtn').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify([...earned].sort((x, y) => x - y))], { type: 'application/json' }));
  a.download = 'leonida-trophy-progress.json';
  a.click();
});
document.getElementById('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const ids = JSON.parse(await file.text());
    earned = new Set(ids.filter((n) => trophies.some((t) => t.id === n)));
    saveProgress();
    renderProgress();
    renderList();
  } catch { alert('That file is not a valid progress export.'); }
});

// URL-driven views (also how the maker's screenshots are framed):
// ?view=roadmap|notes|sources, ?filter=story|missable|collectibles|activities|hidden|online,
// ?grade=platinum|gold|silver|bronze, ?spoiler=on, ?open=<trophy id>, ?seed=<ids> to pre-tick,
// ?scroll=<px> to frame a view lower on the page.
if (params.get('view')) showView(params.get('view'));
if (kind !== 'all') {
  document.querySelectorAll('.kind-btn').forEach((x) => x.classList.toggle('active', x.dataset.kind === kind));
}
renderRoadmap();
renderProgress();
renderList();
if (params.get('scroll')) window.scrollTo(0, Number(params.get('scroll')));
