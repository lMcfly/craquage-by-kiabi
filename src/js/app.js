// Craquage by Kiabi : point d'entrée de l'app (swipe, préférences, envies, styles, looks, fiche article, réglages).
import { $, esc, reduced, store, shuffle } from './utils.js';
import { settings, SETTINGS_KEY, t, tl, eur, arts, colourName, STYLE, applyStatic, applyTheme } from './i18n.js';
import { IMG, SW, CATS, catLabel, LOOK, photo, discount, OCCASIONS, occLabel, occFits } from './catalog.js';
import { playSplash } from './splash.js';
import { profile, saveProfile, fits, setSizeData, sizeText, sizeRows } from './profile.js';
import { swipeToClose } from './sheets.js';
import { setupPlatform } from './platform.js';

applyTheme(); applyStatic();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
playSplash();
setupPlatform();

// ---------- Données ----------
let PRODUCTS = [], byId = new Map();

// ---------- État ----------
const KEY = 'craquage-kiabi-v1';
let order = [], history = [], verdicts = {}, chosen = {}, cat = 'all', occ = null, busy = false;
const broken = new Set(), photoIdx = {};
// couleur affichée : celle choisie, sinon la première disponible dans ma taille
const colorIdx = id => { const p = byId.get(id); if (chosen[id] != null) return Math.min(chosen[id], p.c.length - 1); const j = p.c.findIndex(c => fits(p, c)); return j < 0 ? 0 : j; };
const curColor = id => byId.get(id).c[colorIdx(id)];
const matches = id => {
  const p = byId.get(id); if (broken.has(id)) return false;
  if (!p.c.some(c => fits(p, c))) return false;                 // rien dans ma taille
  if (occ && !occFits(p, occ)) return false;                    // pas pour cette occasion
  if (cat === 'all') return true;
  if (cat === 'deal') return p.c.some(c => discount(c) >= 30);
  return p.k === cat;
};
const upcoming = n => { const out = []; for (const id of order) { if (!verdicts[id] && matches(id)) { out.push(id); if (out.length >= n) break; } } return out; };
const currentId = () => upcoming(1)[0];
const goIds = () => order.filter(id => verdicts[id] === 'yes' && !broken.has(id));
let saveTimer = null;
const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => store.set(KEY, { order, history, verdicts, chosen, cat, occ }), 400); };

// ---------- Photos (avec repli si une image Kiabi manque) ----------
function setPhoto(img, id, size, onFail) {
  const c = curColor(id), key = id + ':' + colorIdx(id) + ':' + size;
  let k = photoIdx[key] || 0;
  img.onerror = () => {
    k++; photoIdx[key] = k;
    if (k < c.x.length) img.src = photo(c, size, k);
    else if (size === 'hd') { img.onerror = () => onFail && onFail(); img.src = photo(c, 'fr', 0); }
    else onFail && onFail();
  };
  img.src = photo(c, size, k);
}
const preload = id => { const im = new Image(); im.src = photo(curColor(id), 'hd', photoIdx[id + ':' + colorIdx(id) + ':hd'] || 0); };
function markBroken(id) { if (broken.has(id)) return; broken.add(id); if (!verdicts[id]) render(); }

// ---------- Plusieurs photos par couleur ----------
const badPhoto = new Set(), photoPos = {}, viewed = {};
const photosOf = c => c.x.filter(n => !badPhoto.has(c.i + '_' + n));
function showCardPhoto(el, id) {
  const c = curColor(id), list = photosOf(c), ph = el.querySelector('.photo'), img = ph.querySelector('img');
  if (!list.length) return markBroken(id);
  const pi = Math.min(photoPos[id] || 0, list.length - 1); photoPos[id] = pi;
  ph.classList.add('loading'); img.onload = () => ph.classList.remove('loading');
  img.onerror = () => { badPhoto.add(c.i + '_' + list[pi]); showCardPhoto(el, id); };
  img.src = IMG + c.i + '_hd' + list[pi] + '.jpg';
  const dots = el.querySelector('.dots'); dots.hidden = list.length < 2; dots.innerHTML = list.map((_, j) => `<i class="${j === pi ? 'on' : ''}"></i>`).join('');
  if (list[pi + 1]) { const im = new Image(); im.src = IMG + c.i + '_hd' + list[pi + 1] + '.jpg'; }   // photo suivante prête
}

// ---------- Algorithme de préférences (appris sur cet appareil) ----------
// Chaque geste ajuste le poids des caractéristiques de l'article (catégorie, couleur, style, prix, promo) ;
// les prochaines cartes sont triées par affinité, avec une part de hasard pour continuer à surprendre.
const PREF_KEY = 'craquage-prefs-v1';
const prefs = store.get(PREF_KEY) || { w: {}, n: 0 };
const band = v => v < 15 ? 'p:<15' : v < 30 ? 'p:15-30' : v < 50 ? 'p:30-50' : 'p:50+';
function feats(id, ci) {
  const p = byId.get(id), c = p.c[ci == null ? colorIdx(id) : ci];
  return ['k:' + p.k, 'f:' + c.f, ...p.t.map(t => 't:' + t), band(Math.min(...c.p)), discount(c) >= 30 ? 'd:deal' : 'd:full'];
}
function learn(id, amount) {
  if (!byId.has(id)) return;
  for (const f in prefs.w) prefs.w[f] *= .97;                // les goûts évoluent : les anciens gestes comptent un peu moins
  feats(id).forEach(f => { prefs.w[f] = Math.max(-8, Math.min(8, (prefs.w[f] || 0) + amount)); });
  prefs.n++; store.set(PREF_KEY, prefs);
}
// affinité d'un article ; sur « Tout », la catégorie est gérée à part (quotas) pour garder un peu de tout
function affinity(id, withCat = true) {
  const p = byId.get(id); let best = -Infinity;
  p.c.forEach((_, ci) => { const f = feats(id, ci).filter(x => withCat || x[0] !== 'k');
    const v = f.reduce((s, x) => s + (prefs.w[x] || 0), 0) / Math.sqrt(f.length); if (v > best) best = v; });
  return best;
}
// part d'une catégorie dans la pile : entre 0,5× et 2× la normale selon tes goûts (jamais plus d'environ 1 carte sur 4)
const catShare = k => Math.max(.5, Math.min(2, Math.exp(.18 * (prefs.w['k:' + k] || 0))));
function rerank(pin = 1) {
  if (prefs.n < 4) return;                                   // il faut quelques gestes avant de personnaliser
  // la (ou les) carte(s) déjà affichée(s) derrière, photo chargée, restent en tête : on ne casse pas le rythme
  const pending = order.filter(id => !verdicts[id] && matches(id)), win = pending.slice(pin);
  if (win.length < 3) return;
  const mixed = cat === 'all';
  const score = id => affinity(id, !mixed) + Math.random() * 1.4 + (isNew(id) ? 1 : 0);   // petit coup de pouce aux nouveautés
  let ranked;
  if (!mixed) {
    ranked = win.map(id => ({ id, s: score(id) })).sort((a, b) => b.s - a.s).map(x => x.id);
    for (let i = 3; i < ranked.length; i += 4) {              // 1 carte sur 4 : découverte au hasard
      const j = i + Math.floor(Math.random() * (ranked.length - i)); [ranked[i], ranked[j]] = [ranked[j], ranked[i]];
    }
  } else {
    // une file par catégorie, triée par affinité (couleur, style, prix…), puis on pioche à tour de rôle
    const q = {}; win.forEach(id => { const k = byId.get(id).k; (q[k] = q[k] || []).push({ id, s: score(id) }); });
    Object.values(q).forEach(l => l.sort((a, b) => b.s - a.s));
    const keys = Object.keys(q), credit = {}; keys.forEach(k => credit[k] = Math.random());
    const recent = pending.slice(0, pin).map(id => byId.get(id).k);
    ranked = [];
    while (ranked.length < win.length) {
      const live = keys.filter(k => q[k].length), tot = live.reduce((s, k) => s + catShare(k), 0);
      live.forEach(k => credit[k] += catShare(k) / tot);
      // pas deux fois de suite la même catégorie (ni trois sur les quatre dernières) tant que c'est possible
      const last = recent.slice(-3), ok = live.filter(k => k !== last[last.length - 1] && last.filter(x => x === k).length < 2);
      const pool = ok.length ? ok : live;
      let k;
      if (ranked.length % 4 === 3) k = pool[Math.floor(Math.random() * pool.length)];   // 1 sur 4 : catégorie au hasard
      else k = pool.reduce((m, x) => credit[x] > credit[m] ? x : m, pool[0]);
      credit[k] -= 1;
      const l = q[k], it = ranked.length % 4 === 3 ? l.splice(Math.floor(Math.random() * l.length), 1)[0] : l.shift();
      ranked.push(it.id); recent.push(k);
    }
  }
  const inWin = new Set(win), slots = []; order.forEach((id, i) => { if (inWin.has(id)) slots.push(i); });
  slots.forEach((pos, k) => { order[pos] = ranked[k]; });
}
// ---------- Couleurs ----------
function swatchButtons(id, onPick) {
  const p = byId.get(id), frag = document.createDocumentFragment();
  p.c.forEach((c, k) => {
    if (!fits(p, c)) return;                                    // couleur pas disponible dans ma taille
    const b = document.createElement('button'); b.type = 'button'; b.style.background = SW[c.f] || '#b3b2c2';
    b.setAttribute('aria-label', t('colour') + ' ' + colourName(c)); b.title = colourName(c); b.setAttribute('aria-pressed', String(k === colorIdx(id)));
    b.addEventListener('pointerdown', e => e.stopPropagation());
    b.addEventListener('click', e => { e.stopPropagation(); chosen[id] = k; onPick(); save(); });
    frag.appendChild(b);
  });
  return frag;
}
const priceHtml = c => { const now = Math.min(...c.p), was = Math.max(...c.p); return `<span class="now">${eur(now)}</span>` + (was > now ? `<s>${eur(was)}</s>` : ''); };

// ---------- Partage ----------
async function share(id) {
  learn(id, 1);
  const p = byId.get(id), c = curColor(id), text = t('share_txt', { n: p.n, p: eur(Math.min(...c.p)) });
  try {
    if (navigator.share) { await navigator.share({ title: p.n, text, url: c.u }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text + ' ' + c.u); flash(t('copied')); }
  catch (e) { flash(t('copy_fail', { u: c.u })); }
}
function flash(msg) {
  const t = $('toast'); $('toast-img').hidden = true; $('toast-buy').hidden = true; $('toast-text').textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(hideToast, 2600);
}

// ---------- Carte ----------
let hintShown = !!store.get('craquage-hint');
function fillCard(el, id) {
  const p = byId.get(id), c = curColor(id), k = colorIdx(id), d = discount(c);
  showCardPhoto(el, id); el.querySelector('.photo img').alt = p.n + ', ' + c.c;
  const promo = el.querySelector('.promo'); promo.hidden = !d; promo.textContent = d ? '−' + d + ' %' : '';
  el.querySelector('.newb').hidden = !isNew(id);
  el.querySelector('.tap-hint').hidden = !(photosOf(c).length > 1 && !hintShown && el.classList.contains('top'));
  el.querySelector('.name').textContent = p.n;
  const pr = el.querySelector('.price'); pr.className = 'price' + (d ? ' is-promo' : ''); pr.innerHTML = priceHtml(c);
  el.querySelector('.buy').href = c.u;
  const sw = el.querySelector('.swatches'); sw.innerHTML = ''; sw.appendChild(swatchButtons(id, () => { photoPos[id] = 0; learn(id, .1); fillCard(el, id); }));
  const cn = document.createElement('span'); cn.className = 'cname'; const st = sizeText(p, c); cn.textContent = colourName(c) + (st ? ' · ' + st : ''); sw.appendChild(cn);
  if (el.classList.contains('top')) p.c.forEach((cc, j) => { if (j !== k) { const im = new Image(); im.src = photo(cc, 'hd', 0); } });
}
function makeCard(id, cls) {
  const el = document.createElement('article'); el.className = 'card ' + cls;
  el.innerHTML = `<div class="photo"><img alt="" draggable="false"><span class="promo" hidden></span><span class="newb" hidden>${t('new')}</span><div class="dots" hidden></div>
    <div class="card-tools glass"><button class="share" type="button" aria-label="${t('share')}"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/></svg></button>
    <a class="buy" target="_blank" rel="noopener" aria-label="${t('buy_on')}"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14l-1.2 11.2a1.5 1.5 0 01-1.5 1.3H7.7a1.5 1.5 0 01-1.5-1.3L5 8z"/><path d="M9 8V6.5a3 3 0 016 0V8"/></svg></a></div>
    <span class="tap-hint" hidden>${t('tap_hint')}</span><div class="stamp yes">Go</div><div class="stamp no">No go</div></div>
    <div class="info"><div class="headline"><span class="name-btn"><span class="name"></span></span><div class="price"></div></div>
    <div class="swatches" role="group" aria-label="${t('colours')}"></div></div>`;
  el.querySelectorAll('.buy, .share').forEach(b => b.addEventListener('pointerdown', e => e.stopPropagation()));
  el.querySelector('.share').addEventListener('click', e => { e.stopPropagation(); share(id); });
  el.querySelector('.buy').addEventListener('click', () => learn(id, 1.5));
  fillCard(el, id);
  return el;
}

function render() {
  save();
  const deckEl = $('deck'); deckEl.querySelectorAll('.card').forEach(n => n.remove());
  const next = upcoming(5), done = next.length === 0;
  $('swipe-view').style.display = done ? 'none' : 'contents';
  $('end').hidden = !done;
  $('btn-undo').disabled = history.length === 0;
  const nGo = goIds().length; $('coll-count').textContent = nGo; $('coll-count').hidden = !nGo;
  renderChips();
  if (done) {
    const label = filterLabel(), n = goIds().length;
    $('end-title').textContent = cat === 'all' && !occ ? t('end_all') : t('end_cat', { c: label });
    $('end-text').textContent = t('end_txt', { a: arts(n) });
    $('end-all').hidden = cat === 'all';
    $('end-restart').hidden = !Object.values(verdicts).includes('no');
    return;
  }
  if (next[1]) deckEl.appendChild(makeCard(next[1], 'under'));
  const top = makeCard(next[0], 'top'); deckEl.appendChild(top); attachDrag(top);
  next.slice(1).forEach(preload);
}
// « Robes · Soirée », « Soirée » ou « Tout »
const filterLabel = () => occ ? (cat === 'all' ? occLabel(occ) : catLabel(cat) + ' · ' + occLabel(occ)) : catLabel(cat);
function renderChips() {          // bouton de catégorie en haut
  const label = filterLabel();
  $('catlabel').textContent = label; $('catbtn').classList.toggle('deal', cat === 'deal');
}
function openCats() {
  const box = $('cattiles'); box.innerHTML = '';
  const count = () => order.filter(id => !verdicts[id] && matches(id)).length;
  const left = k => { const save = cat; cat = k; const n = count(); cat = save; return n; };
  CATS.forEach(([k]) => { const label = catLabel(k);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'cattile' + (k === 'deal' ? ' deal' : '');
    b.setAttribute('aria-pressed', String(cat === k)); const n = left(k);
    b.innerHTML = `<b>${label}</b><span>${arts(n)}</span>`;
    b.onclick = () => { cat = k; closeCats(); hideToast(); rerank(0); render(); };
    box.appendChild(b);
  });
  // occasions : se combinent avec la catégorie choisie
  const ob = $('occtiles'); ob.innerHTML = '';
  [null, ...Object.keys(OCCASIONS)].forEach(k => {
    const save = occ; occ = k; const n = count(); occ = save;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'cattile';
    b.setAttribute('aria-pressed', String(occ === k));
    b.innerHTML = `<b>${k ? occLabel(k) : t('occ_all')}</b><span>${arts(n)}</span>`;
    b.onclick = () => { occ = k; closeCats(); hideToast(); rerank(0); render(); };
    ob.appendChild(b);
  });
  $('catsheet').hidden = false;
}
const closeCats = () => { $('catsheet').hidden = true; };
$('catbtn').onclick = openCats;
swipeToClose($('catsheet'), closeCats);

// ---------- Réglages (écrou) ----------
function syncSettings() {
  $('set-theme').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === settings.theme)));
  $('set-lang').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === settings.lang)));
}
function openSettings() { hideToast(); syncSettings(); renderProfile(); syncInstall(); $('install-steps').hidden = true; $('wipe-confirm').hidden = true; $('wipe').hidden = false; $('setsheet').hidden = false; }
const closeSettings = () => { $('setsheet').hidden = true; };
$('gear').onclick = openSettings;

// ---------- Mes infos (tailles) ----------
function profileChanged() { if (!PRODUCTS.length) return; rerank(0); render(); if (!$('coll').hidden) { renderColl(); if (!$('pane-styles').hidden) renderStyles(); } }
function renderProfile() {
  sizeRows($('set-rows'), profileChanged);
  $('set-only').checked = profile.onlyMine;
}
$('set-only').onchange = e => { profile.onlyMine = e.target.checked; saveProfile(); profileChanged(); };
// première visite : on demande la taille (on peut passer)
const closeWelcome = () => { profile.asked = true; saveProfile(); $('welcome').hidden = true; profileChanged(); };
if (!profile.asked) {
  sizeRows($('wel-rows'));
  $('wel-go').onclick = closeWelcome; $('wel-skip').onclick = closeWelcome;
  $('welcome').hidden = false;
}

// ---------- Raccourci sur l'écran d'accueil ----------
// Déjà installée (ouverte depuis l'icône) : l'option disparaît. Android/Chrome : vraie fenêtre d'installation.
// iPhone : Safari ne permet pas d'installer automatiquement, on montre les 3 gestes.
let installEvt = null;
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const inApp = /FBAN|FBAV|Instagram|Line\/|Snapchat|TikTok|musical_ly|GSA\//i.test(navigator.userAgent);
const SHARE_ICO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Partager"><path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/></svg>';
function syncInstall() { $('set-install').hidden = standalone() || !!store.get('craquage-installed'); }
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
window.addEventListener('appinstalled', () => { store.set('craquage-installed', 1); installEvt = null; syncInstall(); flash(t('installed')); });
$('install-btn').onclick = async () => {
  if (installEvt) {
    installEvt.prompt(); const r = await installEvt.userChoice.catch(() => null); installEvt = null;
    if (r && r.outcome === 'accepted') { store.set('craquage-installed', 1); syncInstall(); flash(t('installed')); }
    return;
  }
  const ol = $('install-steps');
  ol.innerHTML = (isIOS && inApp ? [t('inapp')] : []).concat(tl(isIOS ? 'ios_steps' : 'other_steps'))
    .map(x => '<li>' + esc(x).replace('{share}', SHARE_ICO) + '</li>').join('');
  ol.hidden = !ol.hidden;
};
syncInstall();
swipeToClose($('setsheet'), closeSettings);
$('set-theme').addEventListener('click', e => { const v = e.target.closest('button')?.dataset.v; if (!v) return;
  settings.theme = v; store.set(SETTINGS_KEY, settings); applyTheme(); syncSettings(); });
$('set-lang').addEventListener('click', e => { const v = e.target.closest('button')?.dataset.v; if (!v || v === settings.lang) return;
  settings.lang = v; store.set(SETTINGS_KEY, settings); applyStatic(); syncSettings(); renderProfile();
  render(); if (!$('coll').hidden) { renderColl(); renderStyles(); }
  if (!$('sheet').hidden) fillSheet(); });
$('wipe').onclick = () => { $('wipe').hidden = true; $('wipe-confirm').hidden = false; $('wipe-yes').focus(); };
$('wipe-no').onclick = () => { $('wipe-confirm').hidden = true; $('wipe').hidden = false; };
$('wipe-yes').onclick = () => {
  try { Object.keys(localStorage).filter(k => k.startsWith('craquage-')).forEach(k => localStorage.removeItem(k)); } catch (e) {}
  try { sessionStorage.setItem('craquage-wiped', 1); } catch (e) {}
  location.reload();
};

function decide(choice) {
  const id = currentId(); if (busy || !id) return;
  const top = $('deck').querySelector('.card.top');
  const btn = $(choice === 'yes' ? 'btn-yes' : 'btn-no'); btn.classList.add('flash'); setTimeout(() => btn.classList.remove('flash'), 160);
  const commit = () => { verdicts[id] = choice; history.push({ id, choice }); learn(id, choice === 'yes' ? 1 : -.6); rerank(); busy = false; render(); if (choice === 'yes') showToast(id); else hideToast(); };
  if (!top || reduced) return commit();
  busy = true;
  const dir = choice === 'yes' ? 1 : -1;
  top.querySelector('.stamp.' + choice).style.opacity = 1;
  top.classList.add('fly'); top.style.transform = `translate(${dir * 140}%, -4%) rotate(${dir * 24}deg)`; top.style.opacity = 0;
  setTimeout(commit, 300);
}
function undo() {
  if (busy || !history.length) return;
  const last = history.pop(); delete verdicts[last.id];
  order = [last.id].concat(order.filter(x => x !== last.id));
  if (!matches(last.id)) cat = 'all';
  hideToast(); render();
}
function attachDrag(card) {
  let x0 = 0, y0 = 0, dx = 0, dy = 0, active = false, onPhoto = false;
  const yes = card.querySelector('.stamp.yes'), no = card.querySelector('.stamp.no');
  card.addEventListener('pointerdown', e => {
    if (busy) return; active = true; x0 = e.clientX; y0 = e.clientY; dx = dy = 0; onPhoto = !!e.target.closest('.photo');
    card.setPointerCapture(e.pointerId); card.classList.remove('back');
  });
  card.addEventListener('pointermove', e => {
    if (!active) return; dx = e.clientX - x0; dy = e.clientY - y0;
    card.style.transform = `translate(${dx}px, ${dy * .35}px) rotate(${dx / 18}deg)`;
    const t = Math.min(Math.abs(dx) / 110, 1); yes.style.opacity = dx > 0 ? t : 0; no.style.opacity = dx < 0 ? t : 0;
  });
  const end = () => {
    if (!active) return; active = false;
    if (Math.abs(dx) > Math.min(110, card.offsetWidth * .28)) return decide(dx > 0 ? 'yes' : 'no');
    card.classList.add('back'); card.style.transform = ''; yes.style.opacity = 0; no.style.opacity = 0;
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6 && onPhoto) {          // toucher la photo : à droite = photo suivante, à gauche = précédente
      const id = currentId(), n = photosOf(curColor(id)).length;
      if (n > 1) {
        const r = card.getBoundingClientRect(), back = x0 - r.left < r.width / 3;
        photoPos[id] = ((photoPos[id] || 0) + (back ? -1 : 1) + n) % n; showCardPhoto(card, id);
        viewed[id] = (viewed[id] || 0) + 1; if (viewed[id] <= 3) learn(id, .08);   // la curiosité compte un peu
        if (!hintShown) { hintShown = true; store.set('craquage-hint', 1); card.querySelector('.tap-hint').hidden = true; }
      }
    }
  };
  card.addEventListener('pointerup', end); card.addEventListener('pointercancel', end);
}
$('btn-yes').onclick = () => decide('yes');
$('btn-no').onclick = () => decide('no');
$('btn-undo').onclick = undo;
document.addEventListener('keydown', e => {
  if (!$('welcome').hidden) { if (e.key === 'Escape') closeWelcome(); return; }
  if (!$('setsheet').hidden) { if (e.key === 'Escape') closeSettings(); return; }
  if (!$('catsheet').hidden) { if (e.key === 'Escape') closeCats(); return; }
  if (!$('sheet').hidden || !$('coll').hidden) { if (e.key === 'Escape') { if (!$('sheet').hidden) closeSheet(); else navTo('swipe'); } return; }
  if (e.key === 'ArrowRight') { e.preventDefault(); decide('yes'); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); decide('no'); }
  else if (e.key === 'Backspace') { e.preventDefault(); undo(); }
});
$('end-restart').onclick = () => { Object.keys(verdicts).forEach(id => { if (verdicts[id] === 'no') delete verdicts[id]; }); history = history.filter(h => h.choice === 'yes'); render(); };
$('end-all').onclick = () => { cat = 'all'; render(); };
$('end-coll').onclick = () => openColl();

// ---------- Mes envies ----------
function thumbBtn(id, label) {
  const c = curColor(id), b = document.createElement('button'); b.className = 'thumb'; b.type = 'button';
  b.setAttribute('aria-label', byId.get(id).n + ', ' + c.c);
  b.innerHTML = `<img alt="" loading="lazy"><span class="tag">${esc(label || eur(Math.min(...c.p)))}</span>`;
  setPhoto(b.querySelector('img'), id, 'fr'); b.onclick = () => openSheet(id);
  return b;
}
// Vignette d'envie : touche la photo pour la fiche, petit bouton panier pour aller directement sur l'article Kiabi
function wishItem(id) {
  const box = document.createElement('div'); box.className = 'wish-item';
  box.appendChild(thumbBtn(id));
  const a = document.createElement('a'); a.className = 'kbuy'; a.href = curColor(id).u; a.target = '_blank'; a.rel = 'noopener';
  a.setAttribute('aria-label', t('buy_on') + ' : ' + byId.get(id).n); a.title = t('buy_on');
  a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14l-1.2 11.2a1.5 1.5 0 01-1.5 1.3H7.7a1.5 1.5 0 01-1.5-1.3L5 8z"/><path d="M9 8V6.5a3 3 0 016 0V8"/></svg>';
  a.addEventListener('click', () => learn(id, 1.5));
  box.appendChild(a);
  return box;
}
function renderColl() {
  const ids = goIds().slice().reverse(), grid = $('coll-grid');
  $('coll-n').textContent = ids.length ? t('coll_n', { a: arts(ids.length) }) : '';
  grid.innerHTML = ''; ids.forEach(id => grid.appendChild(wishItem(id)));
  if (!ids.length) {
    grid.innerHTML = `<div class="empty-hero" style="grid-column:1/-1"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.7 4.5c2.1 0 3.6 1.2 5.3 3 1.7-1.8 3.2-3 5.3-3 3.7 0 5.8 3.8 4.3 7.2C19.5 16.4 12 21 12 21z"/></svg><h3>${t('title_items')}</h3>
      <p>${t('empty_txt')}</p><div class="stack" style="width:min(100%,320px);margin-top:12px"><button class="btn primary" type="button" id="empty-go">${t('empty_go')}</button></div></div>`;
    $('empty-go').onclick = () => navTo('swipe');
  }
}
const TITLES = { get items() { return t('title_items'); }, get styles() { return t('title_styles'); } };
function navTo(which) {
  hideToast(); if (!$('sheet').hidden) closeSheet();
  ['swipe', 'items', 'styles'].forEach(t => { const b = $('nav-' + t); if (t === which) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  if (which === 'swipe') { $('coll').hidden = true; return; }
  $('coll-title').textContent = TITLES[which]; $('coll-n').textContent = '';
  ['items', 'styles'].forEach(t => { $('pane-' + t).hidden = t !== which; });
  if (which === 'items') renderColl(); if (which === 'styles') renderStyles();
  $('coll').hidden = false;
}
['swipe', 'items', 'styles'].forEach(t => { $('nav-' + t).onclick = () => navTo(t); });
const openColl = () => navTo('items');

// ---------- Mes styles ----------
const NEUTRAL = new Set(['noir', 'blanc', 'écru', 'beige', 'gris', 'marine', 'denim', 'camel', 'taupe', 'marron', 'léopard']);
const CATLABEL = { haut: 'haut', bas: 'bas', veste: 'veste', robe: 'robe', extra: 'touche finale' };
const meta = id => { const p = byId.get(id); return { cat: LOOK[p.k], tags: p.t.length ? p.t : ['casual'], col: curColor(id).f }; };
function pairScore(a, b) {
  const A = meta(a), B = meta(b), shared = A.tags.filter(t => B.tags.includes(t)).length;
  return shared * 2 + ((NEUTRAL.has(A.col) || NEUTRAL.has(B.col) || A.col === B.col) ? 1 : -1) + (A.tags[0] === B.tags[0] ? 1 : 0);
}
function buildLooks(ids) {
  const by = c => ids.filter(i => meta(i).cat === c), usage = new Map();
  const best = (pool, look) => { let top = null, sc = -Infinity;
    for (const p of pool) { if (look.includes(p) || (usage.get(p) || 0) >= 2) continue;
      const v = look.reduce((s, l) => s + pairScore(l, p), 0) / look.length - (usage.get(p) || 0) * 1.5; if (v > sc) { sc = v; top = p; } }
    return sc > 0 ? top : null; };
  const looks = [];
  for (const a of [...by('robe'), ...by('haut')]) {
    const look = [a];
    if (meta(a).cat === 'haut') { const b = best(by('bas'), look); if (b) look.push(b); }
    const v = best(by('veste'), look); if (v) look.push(v);
    const x = best(by('extra'), look); if (x) look.push(x);
    if (look.length < 2) continue;
    looks.push({ look, score: look.slice(1).reduce((s, x) => s + pairScore(a, x), 0) / (look.length - 1) + look.length * .5 });
    look.forEach(x => usage.set(x, (usage.get(x) || 0) + 1));
  }
  return looks.sort((x, y) => y.score - x.score).slice(0, 6).map(({ look }) => {
    const count = {}; look.forEach(x => meta(x).tags.forEach((t, k) => count[t] = (count[t] || 0) + (k ? 1 : 2)));
    return { look, tag: Object.keys(count).sort((p, q) => count[q] - count[p])[0] };
  });
}
function renderStyles() {
  const pane = $('pane-styles'); pane.innerHTML = '';
  const ids = goIds();
  if (ids.length >= 2) {
    const w = {}; let total = 0;
    ids.forEach(id => meta(id).tags.forEach((t, k) => { const v = k ? 1 : 2; w[t] = (w[t] || 0) + v; total += v; }));
    const ranked = Object.keys(w).sort((a, b) => w[b] - w[a]), [t1, t2] = ranked, share1 = w[t1] / total;
    const name = (!t2 || share1 > .55) ? STYLE[t1][0] : `${STYLE[t1][0]} × ${STYLE[t2][0]}`;
    const desc = t2 && share1 <= .55 ? t('desc2', { a: STYLE[t1][1], b: STYLE[t2][0].toLowerCase() }) : t('desc1', { a: STYLE[t1][1] });
    const cols = {}; ids.forEach(id => { const f = meta(id).col; cols[f] = (cols[f] || 0) + 1; });
    const palette = Object.keys(cols).sort((a, b) => cols[b] - cols[a]).slice(0, 5);
    const prof = document.createElement('section'); prof.className = 'profile';
    prof.innerHTML = `<p class="eyebrow">${t('eyebrow', { n: ids.length })}</p><p class="profile-name">${esc(name)}</p><p class="profile-desc">${esc(desc)}</p>
      <div class="palette">${palette.map(c => `<span><b style="background:${SW[c] || '#999'}"></b>${esc(colourName({ c, f: c }))}</span>`).join('')}</div>`;
    pane.appendChild(prof);
  }
  // looks enregistrés, puis looks proposés
  const saved = savedLooks.map(l => ({ ...l, items: l.items.filter(x => byId.has(x.id)) })).filter(l => l.items.length >= 2);
  if (saved.length) {
    const h = document.createElement('h3'); h.className = 'sec-title'; h.textContent = t('my_looks'); pane.appendChild(h);
    saved.forEach((L, n) => {
      L.items.forEach(x => { if (chosen[x.id] == null) chosen[x.id] = x.k; });
      const total = L.items.reduce((s, x) => s + Math.min(...byId.get(x.id).c[Math.min(x.k, byId.get(x.id).c.length - 1)].p), 0);
      pane.appendChild(lookCard(t('look_n', { n: saved.length - n }), L.items.map(x => x.id), total, t('del'), () => {
        savedLooks = savedLooks.filter(l => lookKey(l.items) !== lookKey(L.items)); store.set(LOOKS_KEY, savedLooks); renderStyles();
      }));
    });
  }
  const looks = ids.length >= 2 ? buildLooks(ids) : [];
  const h = document.createElement('h3'); h.className = 'sec-title'; h.textContent = t('looks_for_you'); pane.appendChild(h);
  if (!looks.length) {
    const e = document.createElement('p'); e.className = 'empty'; e.style.textAlign = 'left';
    e.textContent = ids.length < 2 ? t('looks_empty1') : t('looks_empty2');
    pane.appendChild(e);
  }
  looks.forEach((L, k) => {
    const total = L.look.reduce((s, id) => s + Math.min(...curColor(id).p), 0);
    const already = savedLooks.some(l => lookKey(l.items) === lookKey(L.look.map(id => ({ id }))));
    pane.appendChild(lookCard(`${STYLE[L.tag][0]}`, L.look, total, already ? t('saved') : t('save'), already ? null : (btn) => saveLook(L.look, btn), !already));
  });
}
function lookCard(title, ids, total, action, onAction, primary) {
  const el = document.createElement('div'); el.className = 'look';
  el.innerHTML = `<div class="look-head"><strong>${esc(title)}</strong><span>${t('pieces', { n: ids.length })} · ${eur(total)}</span></div>`;
  const row = document.createElement('div'); row.className = 'look-row'; ids.forEach(id => row.appendChild(thumbBtn(id))); el.appendChild(row);
  const b = document.createElement('button'); b.type = 'button'; b.className = 'pill' + (primary ? ' dark' : ''); b.textContent = action; b.style.alignSelf = 'flex-start';
  if (onAction) b.onclick = () => onAction(b); else b.disabled = true;
  el.appendChild(b); return el;
}

// ---------- Looks enregistrés (sur cet appareil) ----------
const LOOKS_KEY = 'craquage-looks-v1';
let savedLooks = (store.get(LOOKS_KEY) || []).filter(l => Array.isArray(l.items));
const lookKey = items => items.map(x => x.id).sort().join('|');
function saveLook(ids) {
  const items = ids.map(id => ({ id, k: colorIdx(id) })), key = lookKey(items);
  if (!savedLooks.some(l => lookKey(l.items) === key)) { savedLooks.unshift({ items, at: Date.now() }); store.set(LOOKS_KEY, savedLooks); }
  flash(t('look_saved')); renderStyles();
}

// ---------- Fiche article ----------
let sheetId = null, toastTimer = null;
function fillSheet() {
  const id = sheetId, p = byId.get(id), c = curColor(id);
  const g = $('sheet-gallery'), dots = $('sheet-dots'), list = photosOf(c); g.innerHTML = ''; dots.hidden = list.length < 2;
  list.forEach((n, j) => { const im = document.createElement('img'); im.alt = `${p.n}, ${c.c}, vue ${j + 1}`; im.loading = j < 2 ? 'eager' : 'lazy';
    im.onerror = () => { badPhoto.add(c.i + '_' + n); im.remove(); }; im.src = IMG + c.i + '_hd' + n + '.jpg'; g.appendChild(im); });
  dots.innerHTML = list.length > 1 ? list.map((_, j) => `<i class="${j ? '' : 'on'}"></i>`).join('') : '';
  g.scrollLeft = 0;
  g.onscroll = () => { const w = g.clientWidth || 1, k = Math.round(g.scrollLeft / w);
    dots.querySelectorAll('i').forEach((d, j) => d.classList.toggle('on', j === k)); if (k > 0 && !g.dataset.learned) { g.dataset.learned = 1; learn(id, .08); } };
  delete g.dataset.learned;
  $('sheet-title').textContent = p.n;
  $('sheet-price').innerHTML = priceHtml(c); $('sheet-price').className = 'price' + (discount(c) ? ' is-promo' : '');
  $('sheet-buy').href = c.u;
  $('sheet-colour').innerHTML = `${t('colour')} <b>${esc(colourName(c))}</b>`;
  const st = sizeText(p, c), ss = $('sheet-sizes'); ss.hidden = !st;
  ss.innerHTML = st ? `${t('sizes_av')} : <b>${esc(st)}</b>` + (fits(p, c, true) ? '' : ` · <span class="no">${t('not_my_size')}</span>`) : '';
  const like = $('sheet-like'); like.classList.toggle('liked', verdicts[id] === 'yes'); like.setAttribute('aria-label', verdicts[id] === 'yes' ? t('remove_wish') : t('add_wish'));
  const sw = $('sheet-sw'); sw.innerHTML = ''; sw.hidden = p.c.length < 2;
  p.c.forEach((cc, k) => {            // vignettes des couleurs, comme sur la fiche produit Kiabi
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', t('colour') + ' ' + colourName(cc)); b.setAttribute('aria-pressed', String(k === colorIdx(id)));
    b.innerHTML = '<img alt="">'; const im = b.querySelector('img'); im.onerror = () => { im.onerror = null; im.src = photo(cc, 'hd', 0); }; im.src = photo(cc, 'fr', 0);
    b.onclick = () => { chosen[id] = k; learn(id, .1); save(); fillSheet(); if (!$('coll').hidden) { renderColl(); if (!$('pane-styles').hidden) renderStyles(); } };
    sw.appendChild(b);
  });
}
function openSheet(id) { hideToast(); sheetId = id; fillSheet(); $('sheet').scrollTop = 0; $('sheet').hidden = false; $('sheet-close').focus(); }
function closeSheet() { $('sheet').hidden = true; sheetId = null; }
$('sheet-close').onclick = closeSheet;
$('sheet-buy').addEventListener('click', () => sheetId && learn(sheetId, 1.5));
$('toast-buy').addEventListener('click', () => { const id = history.length && history[history.length - 1].id; if (id) learn(id, 1.5); });
$('sheet-share').onclick = () => sheetId && share(sheetId);
$('sheet-like').onclick = () => {     // cœur de la fiche : ajoute ou retire des envies
  const id = sheetId; if (!id) return;
  if (verdicts[id] === 'yes') { verdicts[id] = 'no'; learn(id, -.4); flash(t('removed')); }
  else { verdicts[id] = 'yes'; history.push({ id, choice: 'yes' }); learn(id, 1); flash(t('added')); }
  fillSheet(); if (!$('coll').hidden) { renderColl(); if (!$('pane-styles').hidden) renderStyles(); }
  render();
};
function showToast(id) {
  clearTimeout(toastTimer);
  const img = $('toast-img'); img.hidden = false; setPhoto(img, id, 'fr');
  $('toast-text').textContent = t('added'); $('toast-buy').hidden = false; $('toast-buy').href = curColor(id).u;
  $('toast').hidden = false; toastTimer = setTimeout(hideToast, 3500);
}
function hideToast() { clearTimeout(toastTimer); $('toast').hidden = true; }

// ---------- Nouveautés ----------
let CAT_DATE = Date.now();
const isNew = id => { const a = byId.get(id)?.a; return !!a && (CAT_DATE - Date.parse(a)) / 864e5 <= 7; };   // arrivé il y a 7 jours ou moins

// ---------- Démarrage ----------
fetch('data/products.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(data => {
  PRODUCTS = data.products; byId = new Map(PRODUCTS.map(p => [p.id, p])); CAT_DATE = Date.parse(data.updated) || Date.now();
  setSizeData(PRODUCTS.some(p => p.c.some(c => Array.isArray(c.s))));
  const st = store.get(KEY);
  const all = shuffle(PRODUCTS.map(p => p.id));
  if (st && Array.isArray(st.order)) {
    const kept = st.order.filter(id => byId.has(id)), seen = new Set(kept);
    Object.entries(st.verdicts || {}).forEach(([id, v]) => { if (byId.has(id) && (v === 'yes' || v === 'no')) verdicts[id] = v; });
    // les articles arrivés depuis la dernière visite sont glissés dans la pile, 1 carte sur 3 au début (pas tout au fond)
    const fresh = all.filter(id => !seen.has(id)), decided = kept.filter(id => verdicts[id]), todo = kept.filter(id => !verdicts[id]);
    const mix = []; while (todo.length || fresh.length) { if (fresh.length && (mix.length % 3 === 1 || !todo.length)) mix.push(fresh.shift()); else mix.push(todo.shift()); }
    order = decided.concat(mix);
    Object.entries(st.chosen || {}).forEach(([id, k]) => { if (byId.has(id) && Number.isInteger(k)) chosen[id] = k; });
    history = (st.history || []).filter(h => h && byId.has(h.id));
    if (CATS.some(c => c[0] === st.cat)) cat = st.cat;
    if (OCCASIONS[st.occ]) occ = st.occ;
  } else order = all;
  $('loading').hidden = true; render();
  try { if (sessionStorage.getItem('craquage-wiped')) { sessionStorage.removeItem('craquage-wiped'); flash(t('wiped')); } } catch (e) {}
}).catch(() => { $('loading').hidden = true; $('error').hidden = false; });
