'use strict';
/* Journal des migraines — PWA 100 % locale (localStorage). Météo : Open-Meteo (sans clé). */

const STORE_KEY = 'migraine.entries.v1';
const SETTINGS_KEY = 'migraine.settings.v1';
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const OPTIONS = {
  location: ['Gauche', 'Droite', 'Bilatérale', 'Front', 'Tempes', 'Derrière l’œil', 'Nuque'],
  painType: ['Pulsatile', 'Pression / étau', 'Lancinante', 'Brûlure'],
  aura: ['Non', 'Oui'],
  symptoms: ['Nausées', 'Vomissements', 'Sensibilité lumière', 'Sensibilité bruit', 'Sensibilité odeurs',
             'Vertiges', 'Troubles visuels', 'Fatigue', 'Raideur nuque', 'Difficultés concentration'],
  stress: ['1', '2', '3', '4', '5'],
  workDay: ['Travail (site)', 'Télétravail', 'Repos / congé'],
  sleepQuality: ['1', '2', '3', '4', '5'],
  exercise: ['Aucune', 'Légère', 'Modérée', 'Intense'],
  hydration: ['Faible', 'Normale', 'Bonne'],
  screens: ['Faible', 'Normal', 'Élevé'],
  alcohol: ['Non', 'Oui'],
  skippedMeal: ['Non', 'Oui'],
  cycle: ['Non concerné', 'Règles', 'Pré-menstruel', 'Ovulation', 'Autre phase'],
  triggers: ['Stress', 'Manque de sommeil', 'Excès de sommeil', 'Repas sauté', 'Alcool', 'Chocolat', 'Fromage',
             'Odeur forte', 'Lumière vive', 'Bruit', 'Écrans', 'Effort physique', 'Changement de météo',
             'Chaleur', 'Voyage', 'Déshydratation', 'Relâchement après stress'],
  medEfficacy: ['Aucune', 'Partielle', 'Bonne', 'Totale']
};
const WEATHER_CONDS = ['Ensoleillé', 'Peu nuageux', 'Nuageux / couvert', 'Brouillard', 'Bruine',
                       'Pluie', 'Averses', 'Neige', 'Orage'];

let entries = load(STORE_KEY, []);
let settings = load(SETTINGS_KEY, { cycle: false });
let editingId = null;
let workDayTouched = false;
let weatherMeta = null;           // {lat, lon, auto}
let calMonth = firstOfMonth(new Date());
let calSelected = null;

/* ---------- Utilitaires ---------- */
function load(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
function saveEntries() { localStorage.setItem(STORE_KEY, JSON.stringify(entries)); }
function saveSettings() { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function pad(n) { return String(n).padStart(2, '0'); }
function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function localDT(d) { return ymd(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
function firstOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function parseDT(s) { if (!s) return null; const d = new Date(s); return isNaN(d) ? null : d; }
function num(sel) { const v = $(sel).value.trim().replace(',', '.'); if (v === '') return null; const n = Number(v); return isFinite(n) ? n : null; }
function round1(n) { return n == null || !isFinite(n) ? null : Math.round(n * 10) / 10; }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function lvl(i) { return i >= 7 ? 'lvl3' : i >= 4 ? 'lvl2' : 'lvl1'; }
function durationH(e) { const s = parseDT(e.start), en = parseDT(e.end); return s && en && en >= s ? (en - s) / 36e5 : null; }
function fmtDur(h) { if (h == null) return 'en cours / non renseignée'; const m = Math.round(h * 60); return Math.floor(m / 60) + ' h ' + pad(m % 60); }
function fmtDate(s, withTime = true) {
  const d = parseDT(s); if (!d) return '';
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) +
    (withTime ? ' ' + pad(d.getHours()) + 'h' + pad(d.getMinutes()) : '');
}
function setMsg(sel, text, err) { const el = $(sel); el.textContent = text; el.classList.toggle('err', !!err); if (text) setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, 4000); }

/* ---------- Chips ---------- */
function buildChips() {
  $$('.chips').forEach(box => {
    const key = box.dataset.key;
    box.innerHTML = OPTIONS[key].map(o => `<button type="button" data-v="${esc(o)}" aria-pressed="false">${esc(o)}</button>`).join('');
    box.addEventListener('click', ev => {
      const b = ev.target.closest('button'); if (!b) return;
      if (box.hasAttribute('data-multi')) {
        b.classList.toggle('on');
      } else {
        const was = b.classList.contains('on');
        box.querySelectorAll('button').forEach(x => x.classList.remove('on'));
        if (!was) b.classList.add('on');
      }
      box.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x.classList.contains('on')));
      if (key === 'workDay') workDayTouched = true;
    });
  });
}
function getChips(key) {
  const box = $(`.chips[data-key="${key}"]`);
  const on = Array.from(box.querySelectorAll('button.on')).map(b => b.dataset.v);
  return box.hasAttribute('data-multi') ? on : (on[0] || null);
}
function setChips(key, val) {
  const box = $(`.chips[data-key="${key}"]`);
  const vals = Array.isArray(val) ? val : (val == null ? [] : [val]);
  box.querySelectorAll('button').forEach(b => {
    const on = vals.includes(b.dataset.v);
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
  });
}

/* ---------- Formulaire ---------- */
function defaultWorkDay(startStr) {
  const d = parseDT(startStr); if (!d) return null;
  const wd = d.getDay(); return (wd === 0 || wd === 6) ? 'Repos / congé' : 'Travail (site)';
}
function resetForm() {
  editingId = null; workDayTouched = false; weatherMeta = null;
  $('#form').reset();
  Object.keys(OPTIONS).forEach(k => setChips(k, null));
  const now = new Date();
  $('#f-start').value = localDT(now);
  $('#f-intensity').value = 5; $('#f-int-val').textContent = '5';
  setChips('workDay', defaultWorkDay($('#f-start').value));
  ['#w-place', '#w-temp', '#w-hum', '#w-press', '#w-delta', '#w-wind'].forEach(s => { $(s).value = ''; });
  $('#w-cond').value = '';
  $('#btn-delete').hidden = true; $('#btn-cancel').hidden = true;
  $('#btn-save').textContent = 'Enregistrer la crise';
  $('#w-status').textContent = 'La météo est récupérée automatiquement. Tu peux ajuster chaque valeur.';
}
function fillForm(e) {
  resetForm();
  editingId = e.id; workDayTouched = true;
  $('#f-start').value = e.start || ''; $('#f-end').value = e.end || '';
  $('#f-intensity').value = e.intensity || 5; $('#f-int-val').textContent = e.intensity || 5;
  ['location', 'painType', 'aura', 'symptoms', 'stress', 'workDay', 'sleepQuality', 'exercise', 'hydration',
   'screens', 'alcohol', 'skippedMeal', 'cycle', 'triggers', 'medEfficacy'].forEach(k => setChips(k, e[k]));
  $('#f-sleep').value = e.sleepHours ?? ''; $('#f-caffeine').value = e.caffeine ?? '';
  $('#f-exercise-h').value = e.exerciseHoursBefore ?? '';
  const w = e.weather || {};
  $('#w-place').value = w.place || ''; $('#w-cond').value = w.cond || '';
  $('#w-temp').value = w.temp ?? ''; $('#w-hum').value = w.humidity ?? ''; $('#w-press').value = w.pressure ?? '';
  $('#w-delta').value = w.pressureDelta ?? ''; $('#w-wind').value = w.wind ?? '';
  weatherMeta = (w.lat != null) ? { lat: w.lat, lon: w.lon, auto: w.auto } : null;
  $('#w-status').textContent = w.auto ? 'Météo récupérée automatiquement lors de la saisie.' : 'Météo saisie manuellement.';
  $('#f-med').value = e.med || ''; $('#f-med-delay').value = e.medDelayMin ?? ''; $('#f-notes').value = e.notes || '';
  $('#btn-delete').hidden = false; $('#btn-cancel').hidden = false;
  $('#btn-save').textContent = 'Enregistrer les modifications';
}
function collect() {
  return {
    id: editingId || uid(),
    start: $('#f-start').value, end: $('#f-end').value || null,
    intensity: Number($('#f-intensity').value),
    location: getChips('location'), painType: getChips('painType'), aura: getChips('aura'), symptoms: getChips('symptoms'),
    stress: getChips('stress'), workDay: getChips('workDay'),
    sleepHours: num('#f-sleep'), sleepQuality: getChips('sleepQuality'),
    exercise: getChips('exercise'), exerciseHoursBefore: num('#f-exercise-h'),
    caffeine: num('#f-caffeine'), hydration: getChips('hydration'), screens: getChips('screens'),
    alcohol: getChips('alcohol'), skippedMeal: getChips('skippedMeal'),
    cycle: settings.cycle ? getChips('cycle') : null,
    triggers: getChips('triggers'),
    weather: {
      place: $('#w-place').value.trim() || null, cond: $('#w-cond').value || null,
      temp: num('#w-temp'), humidity: num('#w-hum'), pressure: num('#w-press'),
      pressureDelta: num('#w-delta'), wind: num('#w-wind'),
      lat: weatherMeta ? weatherMeta.lat : null, lon: weatherMeta ? weatherMeta.lon : null,
      auto: weatherMeta ? !!weatherMeta.auto : false
    },
    med: $('#f-med').value.trim() || null, medDelayMin: num('#f-med-delay'), medEfficacy: getChips('medEfficacy'),
    notes: $('#f-notes').value.trim() || null,
    updatedAt: new Date().toISOString()
  };
}
function onSubmit(ev) {
  ev.preventDefault();
  const e = collect();
  const s = parseDT(e.start);
  if (!s) return setMsg('#form-msg', 'Indique la date et l’heure de début.', true);
  if (e.end) { const en = parseDT(e.end); if (!en || en < s) return setMsg('#form-msg', 'La fin doit être après le début.', true); }
  const idx = entries.findIndex(x => x.id === e.id);
  if (idx >= 0) entries[idx] = e; else entries.push(e);
  entries.sort((a, b) => (a.start < b.start ? 1 : -1));
  saveEntries();
  const wasEdit = idx >= 0;
  resetForm();
  setMsg('#form-msg', wasEdit ? 'Crise mise à jour ✔' : 'Crise enregistrée ✔');
  if (!wasEdit) autoWeather();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function onDelete() {
  if (!editingId) return;
  if (!confirm('Supprimer définitivement cette crise ?')) return;
  entries = entries.filter(x => x.id !== editingId); saveEntries();
  resetForm(); setMsg('#form-msg', 'Crise supprimée.'); showView('history');
}

/* ---------- Météo (Open-Meteo) ---------- */
function codeToCond(c) {
  if (c == null) return '';
  if (c === 0) return 'Ensoleillé';
  if (c <= 2) return 'Peu nuageux';
  if (c === 3) return 'Nuageux / couvert';
  if (c === 45 || c === 48) return 'Brouillard';
  if (c >= 51 && c <= 57) return 'Bruine';
  if ((c >= 61 && c <= 67)) return 'Pluie';
  if (c >= 71 && c <= 77) return 'Neige';
  if (c >= 80 && c <= 82) return 'Averses';
  if (c === 85 || c === 86) return 'Neige';
  if (c >= 95) return 'Orage';
  return '';
}
function getPosition() {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error('géolocalisation non disponible'));
    navigator.geolocation.getCurrentPosition(res, err => rej(new Error(err.code === 1 ? 'autorisation refusée' : 'position introuvable')),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
  });
}
async function weatherAt(lat, lon, startStr) {
  const d = parseDT(startStr);
  const daysAgo = (Date.now() - d.getTime()) / 864e5;
  const hourly = 'temperature_2m,relative_humidity_2m,pressure_msl,weather_code,wind_speed_10m';
  const base = `latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&hourly=${hourly}&timezone=auto`;
  let url;
  if (daysAgo > 85) {
    const prev = ymd(new Date(d.getTime() - 864e5));
    url = `https://archive-api.open-meteo.com/v1/archive?${base}&start_date=${prev}&end_date=${ymd(d)}`;
  } else if (daysAgo >= 0) {
    url = `https://api.open-meteo.com/v1/forecast?${base}&past_days=${Math.min(92, Math.ceil(daysAgo) + 2)}&forecast_days=1`;
  } else {
    url = `https://api.open-meteo.com/v1/forecast?${base}&past_days=2&forecast_days=${Math.min(16, Math.ceil(-daysAgo) + 1)}`;
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error('service météo indisponible (' + r.status + ')');
  const j = await r.json();
  const h = j.hourly; if (!h || !h.time) throw new Error('réponse météo vide');
  const key = startStr.slice(0, 13) + ':00';
  const i = h.time.indexOf(key);
  if (i < 0 || h.temperature_2m[i] == null) throw new Error('pas de donnée pour cette heure');
  const p = h.pressure_msl;
  const delta = (i >= 24 && p[i] != null && p[i - 24] != null) ? round1(p[i] - p[i - 24]) : null;
  return {
    temp: round1(h.temperature_2m[i]), humidity: h.relative_humidity_2m[i], pressure: round1(p[i]),
    pressureDelta: delta, cond: codeToCond(h.weather_code[i]), wind: round1(h.wind_speed_10m[i])
  };
}
async function placeName(lat, lon) {
  try {
    const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=fr`);
    if (!r.ok) return '';
    const j = await r.json(); return j.city || j.locality || '';
  } catch (e) { return ''; }
}
async function fetchWeather() {
  const startStr = $('#f-start').value;
  const st = $('#w-status');
  if (!parseDT(startStr)) { st.textContent = 'Renseigne d’abord la date de début.'; return; }
  st.textContent = 'Localisation en cours…';
  let pos;
  try { pos = await getPosition(); }
  catch (e) { st.textContent = 'Position indisponible (' + e.message + '). Saisis la météo manuellement.'; return; }
  const lat = pos.coords.latitude, lon = pos.coords.longitude;
  st.textContent = 'Récupération de la météo…';
  try {
    const w = await weatherAt(lat, lon, startStr);
    $('#w-temp').value = w.temp ?? ''; $('#w-hum').value = w.humidity ?? ''; $('#w-press').value = w.pressure ?? '';
    $('#w-delta').value = w.pressureDelta ?? ''; $('#w-wind').value = w.wind ?? ''; $('#w-cond').value = w.cond || '';
    weatherMeta = { lat: round1(lat * 10) / 10, lon: round1(lon * 10) / 10, auto: true };
    const name = await placeName(lat, lon);
    if (name) $('#w-place').value = name;
    st.textContent = 'Météo récupérée pour ' + fmtDate(startStr) + ' — tu peux ajuster les valeurs.';
  } catch (e) {
    st.textContent = 'Météo non récupérée (' + e.message + '). Saisis-la manuellement.';
  }
}
function autoWeather() { if (!editingId && !$('#w-temp').value) fetchWeather(); }

/* ---------- Navigation ---------- */
const TITLES = { form: 'Nouvelle crise', calendar: 'Calendrier', report: 'Rapport', history: 'Historique' };
function showView(v) {
  $$('.view').forEach(x => x.classList.toggle('active', x.id === 'view-' + v));
  $$('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  $('#title').textContent = (v === 'form' && editingId) ? 'Modifier la crise' : TITLES[v];
  if (v === 'calendar') renderCalendar();
  if (v === 'report') renderReport();
  if (v === 'history') renderHistory();
  window.scrollTo(0, 0);
}
function editEntry(id) {
  const e = entries.find(x => x.id === id); if (!e) return;
  fillForm(e); showView('form');
}

/* ---------- Calendrier ---------- */
function dayMap() {
  const map = {};
  entries.forEach(e => {
    const s = parseDT(e.start); if (!s) return;
    const en = parseDT(e.end) || s;
    const d = new Date(s.getFullYear(), s.getMonth(), s.getDate());
    for (let k = 0; k < 14 && d <= en; k++) {
      const key = ymd(d);
      (map[key] = map[key] || []).push(e);
      d.setDate(d.getDate() + 1);
    }
  });
  return map;
}
function entryCard(e) {
  const tags = [e.workDay, e.stress ? 'stress ' + e.stress + '/5' : null, e.weather && e.weather.cond, e.med].filter(Boolean);
  return `<button type="button" class="entry" data-id="${esc(e.id)}">
    <div class="top"><span>${esc(fmtDate(e.start))}</span><span class="badge ${lvl(e.intensity)}">${e.intensity}/10</span></div>
    <div class="sub">Durée : ${esc(fmtDur(durationH(e)))}${tags.length ? ' · ' + esc(tags.join(' · ')) : ''}</div></button>`;
}
function renderCalendar() {
  const map = dayMap();
  const y = calMonth.getFullYear(), m = calMonth.getMonth();
  $('#cal-title').textContent = calMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const offset = (new Date(y, m, 1).getDay() + 6) % 7;
  const days = new Date(y, m + 1, 0).getDate();
  const today = ymd(new Date());
  let html = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => `<div class="dow">${d}</div>`).join('');
  for (let i = 0; i < offset; i++) html += '<button type="button" class="empty" tabindex="-1" aria-hidden="true"></button>';
  let count = 0;
  for (let d = 1; d <= days; d++) {
    const key = y + '-' + pad(m + 1) + '-' + pad(d);
    const list = map[key];
    let cls = '';
    if (list) { count++; cls = lvl(Math.max(...list.map(e => e.intensity))); }
    if (key === today) cls += ' today';
    if (key === calSelected) cls += ' sel';
    html += `<button type="button" class="${cls.trim()}" data-day="${key}" aria-label="${d}${list ? ', migraine' : ''}">${d}</button>`;
  }
  $('#cal-grid').innerHTML = html;
  $('#cal-summary').textContent = count ? `${count} jour${count > 1 ? 's' : ''} de migraine ce mois-ci.` : 'Aucune migraine enregistrée ce mois-ci.';
  renderCalDay(map);
}
function renderCalDay(map) {
  const box = $('#cal-day');
  if (!calSelected) { box.innerHTML = ''; return; }
  const list = (map || dayMap())[calSelected] || [];
  const title = parseDT(calSelected + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  box.innerHTML = `<div class="card"><h2>${esc(title)}</h2>${list.length ? list.map(entryCard).join('') :
    '<p class="hint">Aucune crise ce jour-là.</p>'}
    <button type="button" class="btn secondary" id="cal-add">➕ Déclarer une crise ce jour-là</button></div>`;
}

/* ---------- Rapport ---------- */
function countBy(list, fn, order) {
  const c = {};
  list.forEach(e => { let v = fn(e); if (v == null || v === '' || (Array.isArray(v) && !v.length)) v = ['Non renseigné'];
    (Array.isArray(v) ? v : [v]).forEach(x => { c[x] = (c[x] || 0) + 1; }); });
  let keys = Object.keys(c);
  if (order) keys = order.filter(k => c[k]).concat(keys.filter(k => !order.includes(k)));
  else keys.sort((a, b) => c[b] - c[a]);
  return keys.map(k => [k, c[k]]);
}
function bars(title, data, order) {
  if (!data.length) return '';
  if (order) data = order.filter(k => data.some(d => d[0] === k)).map(k => data.find(d => d[0] === k))
    .concat(data.filter(d => !order.includes(d[0])));
  const max = Math.max(1, ...data.map(d => d[1]));
  return `<div class="card"><h3>${esc(title)}</h3>${data.map(([l, v]) =>
    `<div class="bar-row"><span class="bar-lbl" title="${esc(l)}">${esc(l)}</span><span class="bar"><span style="width:${(v / max * 100).toFixed(1)}%"></span></span><span class="bar-val">${v}</span></div>`).join('')}</div>`;
}
function bucket(v, defs) { if (v == null) return null; for (const [lab, test] of defs) if (test(v)) return lab; return null; }
function renderReport() {
  const p = $('#r-period').value;
  const now = new Date();
  const cutoff = p === 'all' ? null : new Date(now.getTime() - Number(p) * 864e5);
  const list = entries.filter(e => { const s = parseDT(e.start); return s && (!cutoff || s >= cutoff); });
  const box = $('#report');
  if (!list.length) { box.innerHTML = '<div class="card empty-state">Aucune crise sur cette période.</div>'; return; }

  const map = {}; list.forEach(e => { map[e.start.slice(0, 10)] = 1; });
  const dm = dayMap(); let migraineDays = 0;
  Object.keys(dm).forEach(k => { const d = parseDT(k + 'T12:00'); if (!cutoff || d >= cutoff) migraineDays++; });
  const durs = list.map(durationH).filter(x => x != null);
  const avgInt = list.reduce((a, e) => a + e.intensity, 0) / list.length;
  const first = parseDT(list[list.length - 1].start);
  const spanDays = cutoff ? Number(p) : Math.max(1, (now - first) / 864e5);
  const perMonth = list.length / (spanDays / 30.44);
  const withMed = list.filter(e => e.med).length;
  const label = $('#r-period').selectedOptions[0].textContent;

  let html = `<div class="card"><h2>Synthèse — ${esc(label)}</h2><div class="kpis">
    <div class="kpi"><b>${list.length}</b><span>crises</span></div>
    <div class="kpi"><b>${migraineDays}</b><span>jours de migraine</span></div>
    <div class="kpi"><b>${perMonth.toFixed(1)}</b><span>crises / mois</span></div>
    <div class="kpi"><b>${avgInt.toFixed(1)}/10</b><span>intensité moyenne</span></div>
    <div class="kpi"><b>${durs.length ? fmtDur(durs.reduce((a, b) => a + b, 0) / durs.length) : '–'}</b><span>durée moyenne</span></div>
    <div class="kpi"><b>${Math.round(withMed / list.length * 100)} %</b><span>crises traitées</span></div>
  </div><p class="hint">Généré le ${esc(now.toLocaleDateString('fr-FR'))}. Les fréquences indiquent des associations, pas des causes.</p></div>`;

  // Crises par mois
  const months = {}; list.forEach(e => { const k = e.start.slice(0, 7); months[k] = (months[k] || 0) + 1; });
  const mKeys = Object.keys(months).sort().slice(-12);
  html += bars('Crises par mois', mKeys.map(k => [parseDT(k + '-01T12:00').toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }), months[k]]));
  html += bars('Intensité', countBy(list, e => e.intensity >= 7 ? 'Sévère (7-10)' : e.intensity >= 4 ? 'Modérée (4-6)' : 'Légère (1-3)'),
    ['Légère (1-3)', 'Modérée (4-6)', 'Sévère (7-10)']);
  const DOW = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  html += bars('Jour de la semaine', countBy(list, e => DOW[(parseDT(e.start).getDay() + 6) % 7]), DOW);
  html += bars('Moment de début', countBy(list, e => { const h = parseDT(e.start).getHours();
    return h < 6 ? 'Nuit (0-6 h)' : h < 12 ? 'Matin (6-12 h)' : h < 18 ? 'Après-midi (12-18 h)' : 'Soir (18-24 h)'; }),
    ['Nuit (0-6 h)', 'Matin (6-12 h)', 'Après-midi (12-18 h)', 'Soir (18-24 h)']);
  html += bars('Type de journée', countBy(list, e => e.workDay), OPTIONS.workDay);
  html += bars('Niveau de stress', countBy(list, e => e.stress ? e.stress + '/5' : null), ['1/5', '2/5', '3/5', '4/5', '5/5']);
  html += bars('Sommeil la nuit précédente', countBy(list, e => bucket(e.sleepHours, [
    ['< 6 h', v => v < 6], ['6-7 h', v => v < 7], ['7-8 h', v => v < 8], ['≥ 8 h', () => true]])), ['< 6 h', '6-7 h', '7-8 h', '≥ 8 h']);
  html += bars('Activité physique récente', countBy(list, e => e.exercise), OPTIONS.exercise);
  html += bars('Conditions météo', countBy(list, e => e.weather && e.weather.cond), WEATHER_CONDS);
  const PB = ['Forte baisse (< -5)', 'Baisse (-5 à -2)', 'Stable (-2 à +2)', 'Hausse (+2 à +5)', 'Forte hausse (> +5)'];
  html += bars('Variation de pression sur 24 h (hPa)', countBy(list, e => bucket(e.weather && e.weather.pressureDelta, [
    [PB[0], v => v < -5], [PB[1], v => v < -2], [PB[2], v => v <= 2], [PB[3], v => v <= 5], [PB[4], () => true]])), PB);
  html += bars('Température', countBy(list, e => bucket(e.weather && e.weather.temp, [
    ['< 5 °C', v => v < 5], ['5-15 °C', v => v < 15], ['15-25 °C', v => v < 25], ['≥ 25 °C', () => true]])), ['< 5 °C', '5-15 °C', '15-25 °C', '≥ 25 °C']);
  html += bars('Déclencheurs suspectés', countBy(list, e => e.triggers));
  html += bars('Symptômes associés', countBy(list, e => e.symptoms));
  html += bars('Aura', countBy(list, e => e.aura), OPTIONS.aura);
  if (settings.cycle) html += bars('Cycle menstruel', countBy(list, e => e.cycle), OPTIONS.cycle);

  // Traitements
  const meds = {};
  list.filter(e => e.med).forEach(e => { const k = e.med; meds[k] = meds[k] || { n: 0, eff: {} };
    meds[k].n++; const ef = e.medEfficacy || 'Non renseignée'; meds[k].eff[ef] = (meds[k].eff[ef] || 0) + 1; });
  const medKeys = Object.keys(meds).sort((a, b) => meds[b].n - meds[a].n);
  if (medKeys.length) {
    html += `<div class="card"><h3>Traitements et efficacité</h3><div class="tbl-wrap"><table><tr><th>Médicament</th><th>Prises</th><th>Efficacité</th></tr>${
      medKeys.map(k => `<tr><td>${esc(k)}</td><td>${meds[k].n}</td><td>${esc(Object.entries(meds[k].eff).map(([a, b]) => a + ' : ' + b).join(', '))}</td></tr>`).join('')
    }</table></div></div>`;
  }

  // Détail
  html += `<div class="card"><h3>Détail des crises</h3><div class="tbl-wrap"><table>
    <tr><th>Début</th><th>Durée</th><th>Int.</th><th>Stress</th><th>Journée</th><th>Météo</th><th>Traitement</th></tr>${
    list.map(e => { const w = e.weather || {};
      const met = [w.cond, w.temp != null ? w.temp + ' °C' : null, w.pressureDelta != null ? 'Δp ' + w.pressureDelta : null].filter(Boolean).join(', ');
      return `<tr><td>${esc(fmtDate(e.start))}</td><td>${esc(durationH(e) != null ? fmtDur(durationH(e)) : '–')}</td><td>${e.intensity}</td>
        <td>${esc(e.stress || '–')}</td><td>${esc(e.workDay || '–')}</td><td>${esc(met || '–')}</td>
        <td>${esc([e.med, e.medEfficacy].filter(Boolean).join(' – ') || '–')}</td></tr>`; }).join('')
  }</table></div></div>`;
  box.innerHTML = html;
}

/* ---------- Historique ---------- */
function renderHistory() {
  const box = $('#history');
  if (!entries.length) { box.innerHTML = '<div class="card empty-state">Aucune crise enregistrée pour l’instant.</div>'; return; }
  box.innerHTML = `<div class="card"><h2>${entries.length} crise${entries.length > 1 ? 's' : ''} enregistrée${entries.length > 1 ? 's' : ''}</h2>
    <p class="hint">Touche une crise pour la modifier ou la supprimer.</p>${entries.map(entryCard).join('')}</div>`;
}

/* ---------- Export / import ---------- */
async function shareOrDownload(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  try {
    const file = new File([blob], filename, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: filename }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
function exportJSON() {
  shareOrDownload(JSON.stringify({ app: 'journal-migraines', version: 1, exportedAt: new Date().toISOString(), settings, entries }, null, 2),
    'migraines-' + ymd(new Date()) + '.json', 'application/json');
}
function exportCSV() {
  const cols = [['Début', e => e.start], ['Fin', e => e.end], ['Durée (h)', e => { const d = durationH(e); return d == null ? '' : d.toFixed(2); }],
    ['Intensité', e => e.intensity], ['Localisation', e => (e.location || []).join(' / ')], ['Type douleur', e => (e.painType || []).join(' / ')],
    ['Aura', e => e.aura], ['Symptômes', e => (e.symptoms || []).join(' / ')], ['Stress', e => e.stress], ['Journée', e => e.workDay],
    ['Sommeil (h)', e => e.sleepHours], ['Qualité sommeil', e => e.sleepQuality], ['Activité', e => e.exercise],
    ['Activité il y a (h)', e => e.exerciseHoursBefore], ['Caféine', e => e.caffeine], ['Hydratation', e => e.hydration],
    ['Écrans', e => e.screens], ['Alcool', e => e.alcohol], ['Repas sauté', e => e.skippedMeal], ['Cycle', e => e.cycle],
    ['Déclencheurs', e => (e.triggers || []).join(' / ')], ['Lieu', e => e.weather && e.weather.place],
    ['Météo', e => e.weather && e.weather.cond], ['Temp (°C)', e => e.weather && e.weather.temp],
    ['Humidité (%)', e => e.weather && e.weather.humidity], ['Pression (hPa)', e => e.weather && e.weather.pressure],
    ['Δ pression 24h', e => e.weather && e.weather.pressureDelta], ['Vent (km/h)', e => e.weather && e.weather.wind],
    ['Médicament', e => e.med], ['Délai prise (min)', e => e.medDelayMin], ['Efficacité', e => e.medEfficacy], ['Notes', e => e.notes]];
  const cell = v => { if (v == null) return ''; let s = String(v); if (typeof v === 'number') s = s.replace('.', ',');
    return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const lines = [cols.map(c => c[0]).join(';')].concat(entries.map(e => cols.map(c => cell(c[1](e))).join(';')));
  shareOrDownload('\ufeff' + lines.join('\r\n'), 'migraines-' + ymd(new Date()) + '.csv', 'text/csv');
}
function importJSON(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const j = JSON.parse(r.result);
      const list = Array.isArray(j) ? j : j.entries;
      if (!Array.isArray(list)) throw new Error('format');
      const valid = list.filter(e => e && e.id && e.start && e.intensity);
      const ids = new Set(entries.map(e => e.id));
      let added = 0;
      valid.forEach(e => { if (!ids.has(e.id)) { entries.push(e); added++; } });
      entries.sort((a, b) => (a.start < b.start ? 1 : -1));
      saveEntries(); renderHistory();
      setMsg('#data-msg', `${added} crise(s) importée(s), ${valid.length - added} déjà présente(s).`);
    } catch (e) { setMsg('#data-msg', 'Fichier non reconnu.', true); }
  };
  r.readAsText(file);
}

/* ---------- Initialisation ---------- */
function applySettings() {
  $('#s-cycle').checked = !!settings.cycle;
  $('#cycle-field').hidden = !settings.cycle;
}
function init() {
  buildChips();
  $('#w-cond').innerHTML = '<option value="">—</option>' + WEATHER_CONDS.map(c => `<option>${esc(c)}</option>`).join('');
  applySettings();
  resetForm();

  $('#form').addEventListener('submit', onSubmit);
  $('#f-intensity').addEventListener('input', e => { $('#f-int-val').textContent = e.target.value; });
  $('#f-start').addEventListener('change', () => { if (!workDayTouched) setChips('workDay', defaultWorkDay($('#f-start').value)); });
  $('#btn-weather').addEventListener('click', fetchWeather);
  $('#btn-delete').addEventListener('click', onDelete);
  $('#btn-cancel').addEventListener('click', () => { resetForm(); showView('history'); });
  $$('.tabbar button').forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));

  $('#cal-prev').addEventListener('click', () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); renderCalendar(); });
  $('#cal-next').addEventListener('click', () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); renderCalendar(); });
  $('#cal-grid').addEventListener('click', ev => { const b = ev.target.closest('button[data-day]'); if (!b) return;
    calSelected = b.dataset.day; renderCalendar(); $('#cal-day').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  $('#cal-day').addEventListener('click', ev => {
    const card = ev.target.closest('.entry'); if (card) return editEntry(card.dataset.id);
    if (ev.target.id === 'cal-add') { resetForm(); $('#f-start').value = calSelected + 'T09:00';
      setChips('workDay', defaultWorkDay($('#f-start').value)); showView('form'); }
  });
  $('#history').addEventListener('click', ev => { const card = ev.target.closest('.entry'); if (card) editEntry(card.dataset.id); });

  $('#r-period').addEventListener('change', renderReport);
  $('#btn-print').addEventListener('click', () => window.print());

  $('#s-cycle').addEventListener('change', e => { settings.cycle = e.target.checked; saveSettings(); applySettings(); });
  $('#btn-export-json').addEventListener('click', exportJSON);
  $('#btn-export-csv').addEventListener('click', exportCSV);
  $('#f-import').addEventListener('change', e => { if (e.target.files[0]) importJSON(e.target.files[0]); e.target.value = ''; });
  $('#btn-wipe').addEventListener('click', () => {
    if (!entries.length) return;
    if (confirm('Effacer TOUTES les crises ? Pense à exporter une sauvegarde avant.') && confirm('Confirmer la suppression définitive ?')) {
      entries = []; saveEntries(); renderHistory(); setMsg('#data-msg', 'Toutes les données ont été effacées.');
    }
  });

  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  autoWeather();
}
document.addEventListener('DOMContentLoaded', init);
