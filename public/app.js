/* Shilingi Gari — car yard system (production client)
   Shilingi Labs Tech Solutions · shilingilabs.co.ke */
'use strict';

/* ---------- helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = v => Number(v) || 0;
const sum = a => a.reduce((x, y) => x + num(y), 0);
const K = n => Math.round(num(n)).toLocaleString('en-KE');
const KES = n => 'KES ' + K(n);
const short = n => { n = num(n); const a = Math.abs(n); return a >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : a >= 1e4 ? Math.round(n / 1e3) + 'K' : K(n); };
const pad = n => String(n).padStart(2, '0');
const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const D = s => new Date(String(s).slice(0, 10) + 'T12:00:00');
const fmtD = s => s ? D(s).toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'}) : '—';
const fmtDs = s => s ? D(s).toLocaleDateString('en-GB', {day:'numeric', month:'short'}) : '—';
const daysBetween = (a, b) => Math.round((D(b) - D(a)) / 864e5);
const addMonthsP = (p, n) => { const [y, m] = p.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const pLabel = (p, long = true) => { const [y, m] = p.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('en-GB', {month: long ? 'long' : 'short', year: long ? 'numeric' : '2-digit'}); };
const round100 = n => Math.round(n / 100) * 100;
const initials = n => String(n || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
function toast(msg, bad){ const t = document.createElement('div'); t.className = 'toast'; if(bad) t.style.background = '#991B1B'; t.innerHTML = msg; $('#toasts').appendChild(t); setTimeout(() => t.remove(), bad ? 6000 : 4000); }
function csvDownload(name, rows){ const text = rows.map(r => r.map(x => `"${String(x ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n'); const b = new Blob(['﻿' + text], {type:'text/csv'}); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 300); }
function printHTML(html){ $('#print-root').innerHTML = html; document.body.classList.add('printing'); setTimeout(() => window.print(), 80); }
window.addEventListener('afterprint', () => { document.body.classList.remove('printing'); $('#print-root').innerHTML = ''; });

/* ---------- API ---------- */
const API = {
  csrf: null,
  async req(r, opts = {}){
    const url = 'api/?r=' + encodeURIComponent(r) + (opts.params ? '&' + new URLSearchParams(opts.params) : '');
    const init = {method: opts.method || 'GET', credentials:'same-origin', headers:{}};
    if(init.method === 'POST'){
      init.headers['X-CSRF-Token'] = API.csrf || '';
      if(opts.form){ init.body = opts.form; } else { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body || {}); }
    }
    let res, data;
    try { res = await fetch(url, init); data = await res.json(); }
    catch(e){ throw new Error('Could not reach the server. Check your internet connection.'); }
    if(res.status === 401 && r !== 'auth.login'){ App.me = null; render(); throw new Error(data.error || 'Please sign in.'); }
    if(res.status === 419){ await API.refresh(); throw new Error('Your session was refreshed. Please try again.'); }
    if(!res.ok) throw new Error(data.error || 'Something went wrong.');
    return data;
  },
  get(r, params){ return API.req(r, {params}); },
  post(r, body){ return API.req(r, {method:'POST', body}); },
  upload(r, form){ return API.req(r, {method:'POST', form}); },
  async refresh(){ const m = await API.get('auth.me'); API.csrf = m.csrf; return m; }
};

/* ---------- modal ---------- */
function modal(title, body, actions = [], wide){
  const bg = document.createElement('div'); bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true"><div class="modal-h"><h3>${title}</h3><button type="button" aria-label="Close" data-x>&times;</button></div><div class="modal-b">${body}<div class="err" data-err></div></div><div class="modal-f"></div></div>`;
  const f = $('.modal-f', bg), close = () => { bg.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if(e.key === 'Escape' && document.body.lastElementChild === bg) close(); };
  bg._close = close;
  actions.forEach(a => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ' + (a.cls || ''); b.innerHTML = a.label;
    b.onclick = async () => {
      if(!a.fn){ close(); return; }
      $('[data-err]', bg).textContent = ''; b.disabled = true;
      try { const r = await a.fn(bg); if(r !== false) close(); }
      catch(e){ $('[data-err]', bg).textContent = e.message; }
      finally { b.disabled = false; }
    };
    f.appendChild(b);
  });
  bg.addEventListener('click', e => { if(e.target.hasAttribute('data-x')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(bg);
  return bg;
}
const fv = (bg, id) => { const el = $('#' + id, bg); if(!el) return undefined; return el.type === 'checkbox' ? el.checked : el.value.trim(); };
function confirmBox(title, text, label, fn, reason){
  modal(title, `<p style="margin:0">${text}</p>${reason ? '<label class="field">Reason<input id="cfR" maxlength="200"></label>' : ''}`,
    [{label:'Cancel'}, {label, cls:'primary', fn:async bg => { if(reason && !fv(bg, 'cfR')) throw new Error('Give a reason.'); await fn(reason ? fv(bg, 'cfR') : null); }}]);
}

/* ---------- icons ---------- */
const svg = p => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const IC = {
  dash:svg('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
  car:svg('<path d="M5 17h14M3 13l2-5a2 2 0 0 1 2-1.3h10A2 2 0 0 1 19 8l2 5v4a1 1 0 0 1-1 1h-1M4 18H3a1 1 0 0 1-1-1v-4"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>'),
  people:svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'),
  key:svg('<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 21 2M16 7l3 3M18 5l2 2"/>'),
  doc:svg('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>'),
  cash:svg('<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>'),
  chart:svg('<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>'),
  wallet:svg('<path d="M20 7H5a2 2 0 0 1 0-4h13v4"/><path d="M3 5v14a2 2 0 0 0 2 2h15V7"/><circle cx="16" cy="14" r="1.5"/>'),
  shield:svg('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
  cog:svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  list:svg('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
  dl:svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>'), plus:svg('<path d="M12 5v14M5 12h14"/>'),
  print:svg('<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7"/>'),
  cam:svg('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>')
};
const LOGO = `<span class="logo-mark brand-mark">${svg('<path d="M5 17h14M3 13l2-5a2 2 0 0 1 2-1.3h10A2 2 0 0 1 19 8l2 5v4a1 1 0 0 1-1 1h-1M4 18H3a1 1 0 0 1-1-1v-4"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>')}</span>`;
const BYLINE = '<a class="byline" href="https://shilingilabs.co.ke" target="_blank" rel="noopener">by Shilingi Labs Tech Solutions</a>';

/* ---------- drawn car (when there is no photo yet) ---------- */
const BODY = {
  hatch:{b:'M18 62 L20 50 Q22 44 32 42 L58 38 L78 22 Q82 19 90 19 L136 19 Q144 19 148 25 L160 44 L176 47 Q184 49 184 56 L184 64 Q184 68 178 68 L24 68 Q18 68 18 62 Z', w:'M66 40 L82 25 Q85 23 90 23 L110 23 L110 40 Z M114 23 L136 23 Q141 23 144 28 L154 41 L114 41 Z', wh:[52, 150]},
  sedan:{b:'M10 62 L12 51 Q14 45 26 43 L58 39 L80 24 Q85 21 93 21 L128 21 Q137 21 143 27 L158 40 L184 43 Q194 45 194 54 L194 64 Q194 68 188 68 L16 68 Q10 68 10 62 Z', w:'M68 40 L84 27 Q87 25 93 25 L110 25 L110 40 Z M114 25 L128 25 Q134 25 139 30 L149 40 L114 41 Z', wh:[48, 158]},
  wagon:{b:'M10 62 L12 51 Q14 45 26 43 L58 39 L80 24 Q85 21 93 21 L176 21 Q182 21 184 27 L188 42 Q194 45 194 54 L194 64 Q194 68 188 68 L16 68 Q10 68 10 62 Z', w:'M68 40 L84 27 Q87 25 93 25 L112 25 L112 40 Z M116 25 L144 25 L144 41 L116 41 Z M148 25 L174 25 Q178 25 179 29 L182 41 L148 41 Z', wh:[48, 158]},
  suv:{b:'M10 64 L11 46 Q12 40 22 38 L52 34 L72 16 Q77 12 86 12 L170 12 Q178 12 181 19 L188 38 Q194 41 194 50 L194 66 Q194 70 188 70 L16 70 Q10 70 10 64 Z', w:'M62 35 L78 19 Q81 17 87 17 L110 17 L110 35 Z M114 17 L142 17 L142 36 L114 36 Z M146 17 L170 17 Q175 17 177 22 L182 36 L146 36 Z', wh:[46, 160]},
  pickup:{b:'M10 64 L11 46 Q12 40 22 38 L48 34 L66 16 Q71 12 80 12 L118 12 Q124 12 125 18 L127 36 L190 36 Q195 36 195 42 L195 66 Q195 70 189 70 L16 70 Q10 70 10 64 Z', w:'M56 35 L72 19 Q75 17 81 17 L96 17 L96 35 Z M100 17 L118 17 Q121 17 121 21 L122 35 L100 35 Z', wh:[46, 162]},
  van:{b:'M10 64 L11 40 Q12 32 22 30 L40 28 L58 12 Q63 8 72 8 L180 8 Q188 8 190 16 L194 40 L194 66 Q194 70 188 70 L16 70 Q10 70 10 64 Z', w:'M48 29 L62 14 Q65 12 71 12 L96 12 L96 30 Z M100 12 L134 12 L134 31 L100 31 Z M138 12 L176 12 Q182 12 184 18 L186 31 L138 31 Z', wh:[46, 160]}
};
const HEX = {white:'#F4F6F8', pearl:'#ECEAE4', silver:'#B8BEC6', grey:'#6B7280', gray:'#6B7280', black:'#1F2328', blue:'#1E3A6B', red:'#C0262D', wine:'#7A1F2B', maroon:'#7A1F2B', green:'#24493A', gold:'#CDBA94', champagne:'#CDBA94', brown:'#6B4A2F', beige:'#D8C8A8'};
const hexOf = c => { const k = String(c || '').toLowerCase(); for(const w in HEX) if(k.includes(w)) return HEX[w]; return '#B8BEC6'; };
function shade(hex, k){ const n = parseInt(hex.slice(1), 16), f = v => Math.max(0, Math.min(255, Math.round(v * k))); return '#' + [f(n >> 16), f(n >> 8 & 255), f(n & 255)].map(v => v.toString(16).padStart(2, '0')).join(''); }
function carSVG(c){
  const s = BODY[c.body] || BODY.sedan, hex = hexOf(c.color), dark = shade(hex, .72), light = parseInt(hex.slice(1), 16) > 0xD0D0D0;
  const wheel = x => `<g><circle cx="${x}" cy="68" r="15" fill="#1C2024"/><circle cx="${x}" cy="68" r="8.5" fill="#C9CED6"/><circle cx="${x}" cy="68" r="3" fill="#6B7280"/></g>`;
  return `<svg viewBox="0 0 204 90" role="img" aria-label="${esc(carName(c))}"><ellipse cx="102" cy="84" rx="94" ry="5" fill="rgba(15,23,42,.14)"/>
    <path d="${s.b}" fill="${hex}" stroke="${light ? '#9AA3AE' : dark}" stroke-width="1.4"/><path d="${s.w}" fill="#2A3442" opacity=".88"/>
    <path d="M24 54 L186 54" stroke="${light ? '#C2C8D0' : dark}" stroke-width="1" opacity=".7"/>
    <rect x="${s.wh[1] + 20}" y="47" width="9" height="5" rx="2" fill="#F7E7B0"/><rect x="12" y="49" width="7" height="5" rx="2" fill="#D9473B"/>${wheel(s.wh[0])}${wheel(s.wh[1])}</svg>`;
}

/* ---------- state ---------- */
const App = {me:null, S:null, business:'Car yard'};
const ui = {status:'stock', body:'all', q:'', sort:'new', month:'', salesQ:'', salesType:'all', loanTab:'active', creditTab:'open'};
let charts = [];
const S = () => App.S;
const isMgr = () => App.me && ['owner', 'manager'].includes(App.me.role);
const isOwner = () => App.me && App.me.role === 'owner';
const car = id => S().cars.find(c => c.id === +id);
const sale = id => S().sales.find(s => s.id === +id);
const loan = id => (S().loans || []).find(l => l.id === +id);
const user = id => S().users.find(u => u.id === +id);
const saleOf = carId => S().sales.find(s => s.car_id === +carId);
const carName = c => [c.year, c.make, c.model].filter(Boolean).join(' ');
const carCost = c => num(c.buy) + sum((c.costs || []).map(x => x.amount));
const daysIn = c => daysBetween(c.in_date || App.S.today, c.sold_date || App.S.today);
const stockCars = () => S().cars.filter(c => c.status !== 'sold');
const METHOD = () => S().pay_methods;
const STATUS = {available:['Available','good'], reserved:['Reserved','warn'], prep:['Preparing','info'], sold:['Sold','gray']};
const statusPill = c => `<span class="pill ${STATUS[c.status][1]}">${STATUS[c.status][0]}</span>`;
const plateHTML = c => c.plate ? `<span class="plate">${esc(c.plate)}</span>` : '<span class="plate new">No plate</span>';
const DEAL = {cash:'Cash', credit:'Credit (instalments)', bank:'Bank finance'};
const LB = {pending:'Not started', initiated:'Transfer started on eCitizen', transferred:'Transferred to buyer', held:'Held until fully paid'};
const BODYNAME = {hatch:'Hatchback', sedan:'Saloon', wagon:'Station wagon', suv:'SUV', pickup:'Pick-up', van:'Van / MPV'};
const INSP = [['wheel_check', 'Wheel check'], ['wheel_spanner', 'Wheel spanner'], ['spare_wheel', 'Spare wheel'], ['battery', 'Battery'], ['radio', 'Radio']];
const unc = '<span class="pill unc" title="The balance was blank on the old sheet. Set it from the sale or loan.">Unconfirmed</span>';
const balTxt = (bal, known) => known === false ? `${unc}` : `<b class="num">${K(bal)}</b>`;
const credOpen = s => s.type === 'credit' && !s.reserved && (s.balance_known === false || num(s.balance) > 0);

async function loadState(){ App.S = await API.get('state'); App.me = App.S.me; App.business = App.S.settings.business_name; }
async function refresh(msg){ await loadState(); render(); if(msg) toast(msg); }

/* ---------- navigation ---------- */
function navFor(){
  const S_ = S(), arrears = S_.sales.filter(s => s.sched && s.sched.arrears > 0).length;
  const lbPending = S_.sales.filter(s => !s.reserved && s.logbook !== 'transferred' && s.logbook !== 'held' && !s.legacy).length;
  const n = [];
  if(isMgr()) n.push(['dashboard', 'Dashboard', IC.dash]);
  n.push(['stock', 'Stock', IC.car, stockCars().filter(c => daysIn(c) > 60).length]);
  n.push(['sales', 'Sales & payments', IC.cash]);
  n.push(['credit', 'Instalments', IC.wallet, arrears]);
  if(isMgr()) n.push(['loans', 'Logbook loans', IC.key, (S_.loans || []).filter(l => l.overdue).length]);
  n.push(['logbooks', 'Logbooks', IC.doc, lbPending]);
  if(isMgr()) n.push(['reports', 'Reports & expenses', IC.chart]);
  if(isOwner()) n.push(['staff', 'Staff', IC.people], ['settings', 'Settings', IC.cog], ['activity', 'Activity', IC.list]);
  return n;
}
function currentView(){ const v = location.hash.replace(/^#\/?/, ''); const nav = navFor().map(n => n[0]); return nav.includes(v) ? v : nav[0]; }
function render(){
  charts.forEach(c => c.destroy()); charts = [];
  document.title = App.business;
  const app = $('#app');
  if(!App.me){ app.innerHTML = viewLogin(); bindLogin(); return; }
  const view = currentView(), V = VIEWS[view]();
  app.innerHTML = `<div class="layout">
    <aside class="side"><div class="logo">${LOGO}<div class="logo-text">${esc(App.business)}<small>${esc(S().settings.location && !App.business.toLowerCase().includes(S().settings.location.toLowerCase()) ? S().settings.location : 'Car yard system')}</small></div></div>
      <nav class="nav">${navFor().map(([k, l, ic, cnt]) => `<a href="#/${k}" class="${k === view ? 'on' : ''}">${ic}<span>${l}</span>${cnt ? `<span class="cnt">${cnt}</span>` : ''}</a>`).join('')}</nav>
      <div class="side-user"><div class="avatar">${initials(App.me.name)}</div><div class="who"><b>${esc(App.me.name)}</b>${{owner:'Owner', manager:'Manager', sales:'Sales'}[App.me.role]} · <a href="#" id="chpw" style="color:#C9D5E8">password</a></div><button id="logout">Sign out</button></div><div class="side-by">${BYLINE}</div></aside>
    <main class="main"><header class="topbar"><div><h1>${V.title}</h1><div class="sub">${V.sub || ''}</div></div><div class="tools">${V.tools || ''}</div></header><div class="content">${V.html}</div></main></div>`;
  $('#logout').onclick = async () => { try { const r = await API.post('auth.logout'); API.csrf = r.csrf; } catch(e){} App.me = null; App.S = null; history.replaceState(null, '', location.pathname); render(); };
  $('#chpw').onclick = e => { e.preventDefault(); passwordModal(); };
  $$('[data-car]').forEach(b => b.onclick = e => { e.stopPropagation(); carModal(car(b.dataset.car)); });
  $$('[data-sale]').forEach(b => b.onclick = e => { e.stopPropagation(); saleModal(sale(b.dataset.sale)); });
  $$('[data-loan]').forEach(b => b.onclick = e => { e.stopPropagation(); loanModal(loan(b.dataset.loan)); });
  if(V.bind) V.bind();
}
window.addEventListener('hashchange', () => { if(App.me){ render(); window.scrollTo(0, 0); } });

/* ---------- sign in ---------- */
function viewLogin(){
  return `<div class="login"><section class="login-brand">
      <div class="logo">${LOGO}<div class="logo-text">${esc(App.business)}<small>Car yard system</small></div></div>
      <h1>Stock, sales and instalments in one place.</h1>
      <p>Every car with its photos and real cost, deposits and sales, instalments, logbook loans and transfers.</p>
    </section><section class="login-panel">
      <h2>Sign in</h2>
      <form class="login-form" id="lf"><label class="field">Email<input type="email" id="le" autocomplete="username" required></label>
        <label class="field">Password<input type="password" id="lp" autocomplete="current-password" required></label>
        <div class="err" id="lerr"></div><button class="btn primary">Sign in</button></form>
      <p class="muted" style="font-size:12px;margin:0">Forgot your password? Ask the owner to set a new one under Staff.</p>
      <p class="muted" style="font-size:12px;margin:8px 0 0">${BYLINE}</p>
    </section></div>`;
}
function bindLogin(){
  $('#lf').onsubmit = async e => {
    e.preventDefault(); $('#lerr').textContent = ''; const b = $('#lf button'); b.disabled = true;
    try { const r = await API.post('auth.login', {email:$('#le').value, password:$('#lp').value}); API.csrf = r.csrf; await loadState(); location.hash = '#/' + navFor()[0][0]; render(); }
    catch(err){ $('#lerr').textContent = err.message; } finally { b.disabled = false; }
  };
}
function passwordModal(){
  modal('Change your password', `<label class="field">Current password<input type="password" id="pc"></label><label class="field">New password (8+ characters, letters and numbers)<input type="password" id="pn"></label>`,
    [{label:'Cancel'}, {label:'Change password', cls:'primary', fn:async bg => { await API.post('auth.password', {current:fv(bg, 'pc'), new:fv(bg, 'pn')}); toast('Password changed'); }}]);
}

/* ================= STOCK ================= */
function carPic(c){
  const p = c.photos[0];
  return p ? `<img src="${esc(p.thumb)}" alt="${esc(carName(c))}" loading="lazy">${c.photos.length > 1 ? `<span class="nph">${c.photos.length} photos</span>` : ''}` : carSVG(c);
}
function carCard(c){
  const d = daysIn(c);
  return `<button class="carc" data-car="${c.id}"><div class="pic">${carPic(c)}${statusPill(c)}${c.status !== 'sold' ? `<span class="age ${d > 60 ? 'old' : ''}">${d} days in yard</span>` : ''}</div>
    <div class="bd"><span class="ttl">${esc(carName(c))}</span>
      <span class="spec">${[c.mileage ? K(c.mileage) + ' km' : '', c.cc ? c.cc + ' cc' : '', c.fuel, c.gearbox, c.color].filter(Boolean).map(x => `<span>${esc(x)}</span>`).join('')}</span>
      <span>${plateHTML(c)}</span>
      <div class="pr"><b class="num">${c.ask ? KES(c.ask) : '<span class="muted" style="font-size:13px">No price yet</span>'}</b><span>${isMgr() && c.buy ? `profit ${short(num(c.ask) - carCost(c))}` : c.floor && !isMgr() ? `lowest ${short(c.floor)}` : ''}</span></div></div></button>`;
}
function viewStock(){
  let cars = S().cars.filter(c => ui.status === 'all' ? true : ui.status === 'stock' ? c.status !== 'sold' : c.status === ui.status);
  if(ui.body !== 'all') cars = cars.filter(c => c.body === ui.body);
  if(ui.q){ const q = ui.q.toLowerCase().replace(/\s/g, ''); cars = cars.filter(c => (carName(c) + (c.plate || '') + (c.color || '')).toLowerCase().replace(/\s/g, '').includes(q)); }
  const sorts = {new:(a, b) => (b.in_date || '').localeCompare(a.in_date || '') || b.id - a.id, old:(a, b) => daysIn(b) - daysIn(a), cheap:(a, b) => num(a.ask) - num(b.ask), dear:(a, b) => num(b.ask) - num(a.ask)};
  cars.sort(sorts[ui.sort]);
  const stock = stockCars();
  return {title:'Stock', sub:`${pl(stock.length, 'car')} in the yard · ${KES(sum(stock.map(c => c.ask)))} at asking prices`,
    tools:`${isMgr() ? `<button class="btn primary" id="addCar">${IC.plus} Add a car</button><button class="btn" id="csvStock">${IC.dl} Export</button>` : ''}`,
    html:`<div class="filters"><label class="field">Show<select id="fS">${[['stock', 'In the yard'], ['available', 'Available'], ['reserved', 'Reserved'], ['prep', 'Preparing'], ['sold', 'Sold'], ['all', 'All cars']].map(([v, l]) => `<option value="${v}" ${ui.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="field">Body<select id="fB"><option value="all">All</option>${Object.entries(BODYNAME).map(([v, l]) => `<option value="${v}" ${ui.body === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="field">Sort<select id="fO">${[['new', 'Newest in'], ['old', 'Longest in yard'], ['cheap', 'Price: low to high'], ['dear', 'Price: high to low']].map(([v, l]) => `<option value="${v}" ${ui.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="field" style="flex:1;min-width:180px">Search<input type="search" id="fQ" value="${esc(ui.q)}" placeholder="Model, plate or colour"></label></div>
      ${cars.length ? `<div class="cars">${cars.map(carCard).join('')}</div>` : '<div class="card empty">No cars match.</div>'}`,
    bind(){
      $('#fS').onchange = e => { ui.status = e.target.value; render(); };
      $('#fB').onchange = e => { ui.body = e.target.value; render(); };
      $('#fO').onchange = e => { ui.sort = e.target.value; render(); };
      let t; $('#fQ').oninput = e => { clearTimeout(t); t = setTimeout(() => { ui.q = e.target.value; render(); const q = $('#fQ'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 250); };
      if($('#addCar')) $('#addCar').onclick = () => carForm();
      if($('#csvStock')) $('#csvStock').onclick = () => csvDownload(`stock-${S().today}.csv`, [['Plate', 'Car', 'Body', 'Colour', 'Status', 'In yard since', 'Days', 'Asking', 'Lowest', 'Bought for', 'Costs', 'Photos'],
        ...stockCars().map(c => [c.plate, carName(c), BODYNAME[c.body], c.color, STATUS[c.status][0], c.in_date, daysIn(c), c.ask, c.floor, c.buy, sum((c.costs || []).map(x => x.amount)), c.photos.length])]);
    }};
}

function gallery(c){
  if(!c.photos.length) return `<div class="car-hero">${carSVG(c)}</div><div class="muted" style="font-size:12px">No photos yet.</div>`;
  return `<div class="gal"><div class="main"><img id="gImg" src="${esc(c.photos[0].url)}" alt="${esc(carName(c))}">${c.photos.length > 1 ? '<button class="nav-b l" id="gP" aria-label="Previous">‹</button><button class="nav-b r" id="gN" aria-label="Next">›</button>' : ''}<span class="cnt" id="gC">1 / ${c.photos.length}</span><button class="full-b" id="gFull" title="View full size">⤢ Full size</button></div>
    <div class="thumbs">${c.photos.map((p, i) => `<button data-i="${i}" class="${i ? '' : 'on'}"><img src="${esc(p.thumb)}" alt="" loading="lazy"></button>`).join('')}</div></div>`;
}
function bindGallery(bg, c){
  let i = 0; const show = n => { if(!c.photos.length) return; i = (n + c.photos.length) % c.photos.length; $('#gImg', bg).src = c.photos[i].url; $('#gC', bg).textContent = `${i + 1} / ${c.photos.length}`; $$('.thumbs button', bg).forEach((b, k) => b.classList.toggle('on', k === i)); };
  $$('.thumbs button', bg).forEach(b => b.onclick = () => show(+b.dataset.i));
  if($('#gImg', bg)) $('#gImg', bg).onclick = () => lightbox(c, i, n => show(n));
  if($('#gFull', bg)) $('#gFull', bg).onclick = () => lightbox(c, i, n => show(n));
  if($('#gP', bg)){ $('#gP', bg).onclick = () => show(i - 1); $('#gN', bg).onclick = () => show(i + 1); }
  return () => c.photos[i];
}
/* full-size photo viewer: arrows, swipe, Esc; tap the photo to zoom to its real size */
function lightbox(c, start, onChange){
  let i = start, zoom = false;
  const lb = document.createElement('div'); lb.className = 'lb';
  lb.innerHTML = `<div class="lb-top"><span id="lbC"></span><span class="spacer"></span><a id="lbO" target="_blank" rel="noopener" class="lb-btn">Open original</a><button class="lb-btn" id="lbX" aria-label="Close">✕</button></div>
    <div class="lb-stage" id="lbS"><img id="lbI" alt=""></div>${c.photos.length > 1 ? '<button class="lb-nav l" id="lbP" aria-label="Previous">‹</button><button class="lb-nav r" id="lbN" aria-label="Next">›</button>' : ''}
    <div class="lb-hint">Tap the photo to zoom · arrows or swipe for the next photo</div>`;
  const show = n => { i = (n + c.photos.length) % c.photos.length; zoom = false; lb.classList.remove('zoom'); $('#lbI', lb).src = c.photos[i].url; $('#lbO', lb).href = c.photos[i].url; $('#lbC', lb).textContent = `${carName(c)}${c.plate ? ' · ' + c.plate : ''} — ${i + 1} / ${c.photos.length}`; if(onChange) onChange(i); };
  const close = () => { lb.remove(); document.removeEventListener('keydown', key, true); };
  const key = e => { if(e.key === 'Escape'){ e.stopPropagation(); close(); } else if(e.key === 'ArrowRight') show(i + 1); else if(e.key === 'ArrowLeft') show(i - 1); };
  document.addEventListener('keydown', key, true);
  $('#lbX', lb).onclick = close;
  if($('#lbP', lb)){ $('#lbP', lb).onclick = () => show(i - 1); $('#lbN', lb).onclick = () => show(i + 1); }
  $('#lbI', lb).onclick = e => { e.stopPropagation(); zoom = !zoom; lb.classList.toggle('zoom', zoom); };
  $('#lbS', lb).onclick = e => { if(e.target.id === 'lbS') close(); };
  let x0 = null; $('#lbS', lb).addEventListener('touchstart', e => { x0 = zoom ? null : e.touches[0].clientX; }, {passive:true});
  $('#lbS', lb).addEventListener('touchend', e => { if(x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if(Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1)); x0 = null; });
  document.body.appendChild(lb); show(i);
}
function carModal(c){
  const mgr = isMgr(), s = ['sold', 'reserved'].includes(c.status) ? saleOf(c.id) : null, cost = carCost(c);
  const specs = [['Year', c.year], ['Mileage', c.mileage ? K(c.mileage) + ' km' : null], ['Engine', c.cc ? c.cc + ' cc' : null], ['Fuel', c.fuel], ['Gearbox', c.gearbox], ['Colour', c.color], ['Body', BODYNAME[c.body]], ['In yard since', fmtD(c.in_date)]];
  const insp = INSP.filter(([k]) => c.inspection && c.inspection[k]);
  const body = `${gallery(c)}
    <div class="ph-tools"><label class="btn sm">${IC.cam} Add photos<input type="file" id="phF" accept="image/jpeg,image/png,image/webp" multiple hidden></label>
      ${mgr && c.photos.length ? `<button class="btn sm" id="phCover">Make this the cover photo</button><button class="btn sm danger" id="phDel">Delete this photo</button>` : ''}<span class="muted" id="phMsg" style="font-size:12px"></span></div>
    <div class="row" style="flex-wrap:wrap">${plateHTML(c)}${statusPill(c)}<span class="muted" style="font-size:12px">${{local:'Locally used', import:'Fresh import', tradein:'Trade-in'}[c.source] || ''}${c.status !== 'sold' ? ` · in yard ${daysIn(c)} days` : ''}${c.chassis ? ` · chassis ${esc(c.chassis)}` : ''}</span></div>
    <div class="specs">${specs.map(([l, v]) => `<div><span>${l}</span><b>${esc(v ?? '—')}</b></div>`).join('')}</div>
    ${insp.length ? `<div><div class="muted" style="font-size:12px;font-weight:600;margin-bottom:6px">Checklist</div><div class="insp">${insp.map(([k, l]) => `<div><span>${l}</span><b>${esc(c.inspection[k])}</b></div>`).join('')}</div></div>` : ''}
    ${mgr ? `<div class="grid g2" style="gap:14px;align-items:start"><div><div class="card-h" style="margin-bottom:6px"><h3>What this car has cost</h3></div><table class="tbl costs"><tbody>
        <tr><td>Bought for</td><td class="muted nw">${fmtD(c.in_date)}</td><td class="r num">${c.buy != null ? K(c.buy) : '<span class="muted">not set</span>'}</td></tr>
        ${(c.costs || []).map(x => `<tr><td>${esc(x.category)}${x.description ? ' — ' + esc(x.description) : ''}</td><td class="muted nw">${fmtD(x.date)}</td><td class="r num">${K(x.amount)} <button class="btn sm danger" data-dc="${x.id}" title="Remove">×</button></td></tr>`).join('')}
        <tr><td><b>Total cost</b></td><td></td><td class="r num"><b>${K(cost)}</b></td></tr></tbody></table>
        <button class="btn sm" id="cmCost" style="margin-top:8px">${IC.plus} Add a cost</button></div>
      <div class="list"><div class="kv" style="grid-template-columns:1fr 1fr"><div><span>Asking price</span><b class="num">${c.ask ? K(c.ask) : '—'}</b></div><div><span>Lowest price</span><b class="num">${c.floor ? K(c.floor) : '—'}</b></div>
        <div><span>${s && !s.reserved && s.price ? 'Profit on sale' : 'Profit at asking'}</span><b class="num">${c.buy == null ? '—' : K((s && !s.reserved && s.price ? s.price : num(c.ask)) - cost)}</b></div><div><span>Profit at lowest</span><b class="num">${c.buy == null || !c.floor ? '—' : K(c.floor - cost)}</b></div></div>
        ${c.buy == null && c.status !== 'sold' ? '<div class="hint warn">Add the buying price (Edit) to see the profit on this car.</div>' : ''}
        ${daysIn(c) > 60 && c.status !== 'sold' ? `<div class="hint warn">In the yard ${daysIn(c)} days. Consider a price drop or featuring it in adverts.</div>` : ''}</div></div>`
    : `<div class="kv"><div><span>Asking price</span><b class="num">${c.ask ? K(c.ask) : '—'}</b></div><div><span>Lowest you can accept</span><b class="num">${c.floor ? K(c.floor) : '—'}</b></div><div><span>Status</span><b>${STATUS[c.status][0]}</b></div></div>`}
    ${s ? `<div class="hint">${s.reserved ? 'Reserved' : 'Sold'} to <b>${esc(s.buyer_name || 'buyer not recorded')}</b> · ${DEAL[s.type]}${s.date ? ' · ' + fmtD(s.date) : ''}${s.reserved && s.hold_until ? ` · hold until ${fmtD(s.hold_until)}` : ''} <a href="#" id="openSale">Open the sale</a></div>` : ''}
    ${c.notes ? `<div class="muted" style="font-size:12px">${esc(c.notes)}</div>` : ''}`;
  const acts = [{label:'Close'}];
  if(mgr) acts.push({label:'Edit', fn:() => carForm(c)});
  if(isOwner() && c.status !== 'sold' && !s) acts.push({label:'Remove', cls:'danger', fn:() => confirmBox('Remove this car?', `${esc(carName(c))} ${esc(c.plate || '')} will be removed from stock. The record is kept in the activity log.`, 'Remove', async why => { await API.post('cars.delete', {id:c.id, reason:why}); await refresh('Car removed'); }, true)});
  if(mgr && c.status === 'prep') acts.push({label:'Ready for sale', cls:'good', fn:async () => { await API.post('cars.status', {id:c.id, status:'available'}); await refresh(`${esc(carName(c))} is on sale`); }});
  if(mgr && c.status === 'available') acts.push({label:'Back to preparing', fn:async () => { await API.post('cars.status', {id:c.id, status:'prep'}); await refresh('Moved to preparing'); }});
  if(c.status === 'reserved') acts.push({label:'Complete sale', cls:'primary', fn:() => saleWizard(c, s)});
  else if(['available', 'prep'].includes(c.status)) acts.push({label:'Reserve / sell', cls:'primary', fn:() => saleWizard(c)});
  else if(s) acts.push({label:`${IC.doc} Sale agreement`, fn:() => agreementModal(s)});
  const bg = modal(esc(carName(c)) + (c.plate ? ' · ' + esc(c.plate) : ''), body, acts, true);
  const cur = bindGallery(bg, c);
  $('#phF', bg).onchange = async e => {
    const files = [...e.target.files]; if(!files.length) return;
    $('#phMsg', bg).textContent = `Uploading ${pl(files.length, 'photo')}…`;
    try {
      for(let i = 0; i < files.length; i += 5){ const fd = new FormData(); fd.append('car_id', c.id); files.slice(i, i + 5).forEach(f => fd.append('photos[]', f)); await API.upload('photos.upload', fd); $('#phMsg', bg).textContent = `Uploaded ${Math.min(i + 5, files.length)} of ${files.length}…`; }
      bg._close(); await refresh(`${pl(files.length, 'photo')} added`); carModal(car(c.id));
    } catch(err){ $('#phMsg', bg).textContent = err.message; }
  };
  if($('#phCover', bg)) $('#phCover', bg).onclick = async () => { try { await API.post('photos.cover', {id:cur().id}); bg._close(); await refresh('Cover photo set'); carModal(car(c.id)); } catch(e){ toast(e.message, 1); } };
  if($('#phDel', bg)) $('#phDel', bg).onclick = () => confirmBox('Delete this photo?', 'The photo will be deleted from the server.', 'Delete', async () => { await API.post('photos.delete', {id:cur().id}); bg._close(); await refresh('Photo deleted'); carModal(car(c.id)); });
  if($('#cmCost', bg)) $('#cmCost', bg).onclick = () => { bg._close(); costModal(c); };
  $$('[data-dc]', bg).forEach(b => b.onclick = () => confirmBox('Remove this cost?', 'It will be taken off this car.', 'Remove', async () => { await API.post('costs.delete', {id:+b.dataset.dc}); bg._close(); await refresh('Cost removed'); carModal(car(c.id)); }));
  if($('#openSale', bg)) $('#openSale', bg).onclick = e => { e.preventDefault(); bg._close(); saleModal(s); };
}
function costModal(c){
  modal(`Add a cost · ${esc(carName(c))}`, `<div class="form-grid"><label class="field">Type<select id="xc">${S().cost_types.map(t => `<option>${t}</option>`).join('')}</select></label><label class="field">Amount (KES)<input type="number" id="xa" min="1"></label>
    <label class="field">Date<input type="date" id="xd" value="${S().today}" max="${S().today}"></label><label class="field">Details (optional)<input id="xn" placeholder="e.g. 4 new tyres"></label></div>`,
    [{label:'Cancel'}, {label:'Add cost', cls:'primary', fn:async bg => { await API.post('costs.add', {car_id:c.id, category:fv(bg, 'xc'), amount:fv(bg, 'xa'), date:fv(bg, 'xd'), description:fv(bg, 'xn')}); await refresh('Cost added'); carModal(car(c.id)); }}]);
}
function carForm(c){
  const e = c || {body:'sedan', source:'local', inspection:{}, in_date:S().today}, i = e.inspection || {};
  const o = (v, cur) => `<option value="${v}" ${v === cur ? 'selected' : ''}>`;
  modal(c ? `Edit · ${esc(carName(c))}` : 'Add a car', `<div class="form-grid">
    <label class="field">Make<input id="cMk" value="${esc(e.make)}" placeholder="Toyota"></label><label class="field">Model<input id="cMd" value="${esc(e.model)}" placeholder="Fielder"></label>
    <label class="field">Plate<input id="cPl" value="${esc(e.plate)}" placeholder="KDA 123A"></label><label class="field">Year of manufacture<input type="number" id="cYr" value="${esc(e.year)}"></label>
    <label class="field">Body<select id="cBd">${Object.entries(BODYNAME).map(([v, l]) => o(v, e.body) + l + '</option>').join('')}</select></label><label class="field">Colour<input id="cCo" value="${esc(e.color)}"></label>
    <label class="field">Mileage (km)<input type="number" id="cMi" value="${esc(e.mileage)}"></label><label class="field">Engine (cc)<input type="number" id="cCc" value="${esc(e.cc)}"></label>
    <label class="field">Fuel<select id="cFu"><option value=""></option>${['Petrol', 'Diesel', 'Hybrid', 'Electric'].map(v => o(v, e.fuel) + v + '</option>').join('')}</select></label><label class="field">Gearbox<select id="cGb"><option value=""></option>${['Automatic', 'Manual'].map(v => o(v, e.gearbox) + v + '</option>').join('')}</select></label>
    <label class="field">Chassis no.<input id="cCh" value="${esc(e.chassis)}"></label><label class="field">Source<select id="cSr">${[['local', 'Locally used'], ['import', 'Fresh import'], ['tradein', 'Trade-in']].map(([v, l]) => o(v, e.source) + l + '</option>').join('')}</select></label>
    <label class="field">In the yard since<input type="date" id="cIn" value="${esc(e.in_date)}"></label><label class="field">Logbook<select id="cLb"><option value=""></option>${[['present', 'With us'], ['missing', 'Not yet received']].map(([v, l]) => o(v, e.logbook) + l + '</option>').join('')}</select></label>
    <label class="field">Asking price (KES)<input type="number" id="cAs" value="${esc(e.ask)}"></label><label class="field">Lowest price sales staff may accept<input type="number" id="cFl" value="${esc(e.floor)}"></label>
    <label class="field">Bought for (KES) <span class="muted" style="font-size:11px">· owner & managers only</span><input type="number" id="cBy" value="${esc(e.buy)}"></label><div></div></div>
    <div class="muted" style="font-size:12px;font-weight:600">Checklist</div><div class="insp">${INSP.map(([k, l]) => `<label class="field">${l}<input id="i_${k}" value="${esc(i[k])}"></label>`).join('')}</div>
    <label class="field">Notes<textarea id="cNo">${esc(e.notes)}</textarea></label>
    ${c ? '' : '<label class="switch"><input type="checkbox" id="cRd" checked> Ready for sale now (otherwise it is listed as Preparing)</label>'}`,
    [{label:'Cancel'}, {label:c ? 'Save' : 'Add car', cls:'primary', fn:async bg => {
      const inspection = {}; INSP.forEach(([k]) => inspection[k] = fv(bg, 'i_' + k));
      const r = await API.post('cars.save', {id:c ? c.id : null, make:fv(bg, 'cMk'), model:fv(bg, 'cMd'), plate:fv(bg, 'cPl'), year:fv(bg, 'cYr'), body:fv(bg, 'cBd'), color:fv(bg, 'cCo'), mileage:fv(bg, 'cMi'), cc:fv(bg, 'cCc'),
        fuel:fv(bg, 'cFu'), gearbox:fv(bg, 'cGb'), chassis:fv(bg, 'cCh'), source:fv(bg, 'cSr'), in_date:fv(bg, 'cIn'), logbook:fv(bg, 'cLb'), ask:fv(bg, 'cAs'), floor:fv(bg, 'cFl'), buy:fv(bg, 'cBy'),
        inspection, notes:fv(bg, 'cNo'), ready:fv(bg, 'cRd'), featured:c ? c.featured : false});
      await refresh(c ? 'Car saved' : 'Car added — now add its photos'); carModal(car(r.id));
    }}], true);
}

/* ================= SELLING ================= */
const creditTerms = (amount, months, rate) => { const interest = round100(amount * rate / 100 * months); return {interest, monthly:months > 0 ? round100((amount + interest) / months) : 0}; };
const methodOpts = (sel = 'mpesa') => Object.entries(METHOD()).filter(([k]) => !['tradein', 'before'].includes(k)).map(([k, l]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${l}</option>`).join('');
function saleWizard(c, r){
  const st = S().settings, paidSoFar = r ? r.paid : 0;
  const bg = modal(`${r ? 'Complete sale' : 'Reserve or sell'} · ${esc(carName(c))}`, `
    <div class="form-grid"><label class="field">Buyer's full name<input id="wN" value="${esc(r ? r.buyer_name : '')}"></label><label class="field">Buyer's phone<input id="wP" type="tel" value="${esc(r ? r.buyer_phone : '')}" placeholder="07XX XXX XXX"></label>
      <label class="field">National ID no. (for the agreement)<input id="wI" value="${esc(r ? r.buyer_id_no : '')}"></label><label class="field">KRA PIN (for the logbook transfer)<input id="wK" value="${esc(r ? r.buyer_kra : '')}"></label></div>
    <div class="form-grid"><label class="field">Agreed price (KES)<input type="number" id="wPr" value="${r && r.price ? r.price : c.ask || ''}"></label><label class="field">Sold by<select id="wA">${S().users.filter(u => u.active).map(u => `<option value="${u.id}" ${u.id === (r ? r.agent_id : App.me.id) ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select></label></div>
    <div class="field" style="font-size:12px;font-weight:600;color:var(--muted)">How is the buyer paying?<div class="seg" id="wT">${['cash', 'credit', 'bank'].map(t => `<button type="button" data-t="${t}" class="${(r ? r.type : 'cash') === t ? 'on' : ''}">${DEAL[t]}</button>`).join('')}</div></div>
    <div id="wCr" class="form-grid" hidden><label class="field">Pay the balance over<select id="wMo">${[1, 2, 3, 4, 5, 6, 8, 10, 12, 18, 24].map(m => `<option value="${m}" ${m === 3 ? 'selected' : ''}>${pl(m, 'month')}</option>`).join('')}</select></label><label class="field">Interest (% a month, flat)<input type="number" id="wRt" step="0.1" min="0" value="${st.credit_rate}"></label></div>
    <div id="wBank" hidden><label class="field">Bank<input id="wBk" placeholder="e.g. Equity Bank"></label></div>
    ${r ? '' : `<label class="switch"><input type="checkbox" id="wTi"> The buyer is trading in a car</label>
    <div id="wTiBox" hidden class="form-grid"><label class="field">Trade-in car (make and model)<input id="wTm" placeholder="Toyota Premio"></label><label class="field">Plate<input id="wTp" placeholder="KCB 123A"></label><label class="field">Agreed trade-in value (KES)<input type="number" id="wTv" value="0"></label><label class="field">Body<select id="wTb">${Object.entries(BODYNAME).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label></div>`}
    <div class="form-grid"><label class="field">${r ? 'Paying now' : 'Paying now (deposit or full amount)'} (KES)<input type="number" id="wAm" value="${r ? Math.max(0, num(r.price) - paidSoFar) || '' : ''}"></label><label class="field">Paid by<select id="wM">${methodOpts()}</select></label>
      <label class="field">M-Pesa code / reference<input id="wRef" placeholder="e.g. TJK4XXXXXX"></label><label class="field">Date<input type="date" id="wD" value="${S().today}" max="${S().today}"></label></div>
    <div class="hint" id="wSum"></div>`,
    [{label:'Cancel'}, ...(r ? [] : [{label:'Reserve with deposit', fn:bg => finish(bg, true)}]), {label:r ? 'Complete sale' : 'Record sale', cls:'primary', fn:bg => finish(bg, false)}], true);
  let type = r ? r.type : 'cash';
  const price = () => num(fv(bg, 'wPr')), tiv = () => fv(bg, 'wTi') ? num(fv(bg, 'wTv')) : 0;
  const upd = () => {
    $('#wCr', bg).hidden = type !== 'credit'; $('#wBank', bg).hidden = type !== 'bank';
    const p = price(), ti = tiv(), now = num(fv(bg, 'wAm')), up = paidSoFar + now + ti, lines = [];
    if(isMgr() && c.buy != null) lines.push(`Profit at ${KES(p)}: <b class="${p - carCost(c) < 0 ? 'down' : 'up'}">${KES(p - carCost(c))}</b>`);
    if(c.floor && p < c.floor) lines.push(`<span class="down">Below the lowest price (${KES(c.floor)})${isMgr() ? '' : ' — the owner or a manager must record it'}</span>`);
    if(ti) lines.push(`Trade-in counts as ${KES(ti)} paid`);
    if(type === 'credit'){
      const amt = Math.max(0, p - up), m = num(fv(bg, 'wMo')), t = creditTerms(amt, m, num(fv(bg, 'wRt'))), minDep = round100(p * st.min_deposit / 100);
      lines.push(`Deposit ${KES(up)}${up < minDep ? ` <span class="down">(minimum ${st.min_deposit}% is ${KES(minDep)})</span>` : ''} · balance on credit <b>${KES(amt)}</b>${t.interest ? ` + interest ${KES(t.interest)}` : ''} → <b>${pl(m, 'instalment')} of ${KES(t.monthly)}</b>. The logbook is held until fully paid.`);
    } else if(type === 'cash') lines.push(`Paid ${r ? 'so far ' + KES(paidSoFar) + ' + ' : ''}now ${KES(now + ti)} of ${KES(p)}${up < p ? ` · <b>${KES(p - up)}</b> short — use "Reserve with deposit" for a part payment, or Credit` : ''}`);
    else lines.push('The buyer pays a deposit; record the bank\'s payment later from the sale.');
    if(fv(bg, 'wM') === 'mpesa' && now > 250000) lines.push('<span class="down">M-Pesa allows up to KES 250,000 per transaction — record two payments or use a bank transfer.</span>');
    $('#wSum', bg).innerHTML = lines.join('<br>');
  };
  $$('#wT button', bg).forEach(x => x.onclick = () => { type = x.dataset.t; $$('#wT button', bg).forEach(y => y.classList.toggle('on', y === x)); upd(); });
  if($('#wTi', bg)) $('#wTi', bg).onchange = e => { $('#wTiBox', bg).hidden = !e.target.checked; upd(); };
  $$('input,select', bg).forEach(i => i.addEventListener('input', upd)); upd();
  async function finish(bg, reserve){
    const body = {car_id:c.id, reserve, buyer_name:fv(bg, 'wN'), buyer_phone:fv(bg, 'wP'), buyer_id_no:fv(bg, 'wI'), buyer_kra:fv(bg, 'wK'), price:fv(bg, 'wPr'), agent_id:fv(bg, 'wA'), type,
      months:fv(bg, 'wMo'), rate:fv(bg, 'wRt'), bank:fv(bg, 'wBk'), amount:fv(bg, 'wAm'), method:fv(bg, 'wM'), reference:fv(bg, 'wRef'), date:fv(bg, 'wD')};
    if(fv(bg, 'wTi')) body.trade_in = {model:fv(bg, 'wTm'), plate:fv(bg, 'wTp'), value:fv(bg, 'wTv'), body:fv(bg, 'wTb')};
    const res = await API.post('sales.create', body);
    await refresh(reserve ? `${esc(carName(c))} reserved for ${esc(body.buyer_name)}` : `Sold to ${esc(body.buyer_name)}`);
    if(!reserve) setTimeout(() => agreementModal(sale(res.sale_id)), 300);
  }
}
function payModal(s){
  const c = car(s.car_id), next = s.sched && s.sched.next;
  modal(`Record a payment · ${esc(s.buyer_name || '')}`, `<div class="muted">${esc(carName(c))} ${esc(c.plate || '')} · balance ${s.balance_known === false ? 'unconfirmed' : KES(s.balance)}${s.sched && s.sched.arrears ? ` · <span class="down">behind by ${KES(s.sched.arrears)}</span>` : ''}${next ? ` · next due ${fmtD(next)}` : ''}</div>
    <div class="form-grid"><label class="field">Amount (KES)<input type="number" id="pA" value="${s.credit_monthly && s.balance ? Math.min(s.credit_monthly, s.balance) : s.balance || ''}"></label><label class="field">Paid by<select id="pM">${methodOpts()}</select></label>
      <label class="field">M-Pesa code / reference<input id="pR"></label><label class="field">Date<input type="date" id="pD" value="${S().today}" max="${S().today}"></label></div>`,
    [{label:'Cancel'}, {label:'Record payment', cls:'mpesa', fn:async bg => { const r = await API.post('sales.pay', {sale_id:s.id, amount:fv(bg, 'pA'), method:fv(bg, 'pM'), reference:fv(bg, 'pR'), date:fv(bg, 'pD')}); await refresh(`Payment recorded${r.balance != null ? ` · balance ${KES(r.balance)}` : ''}`); }}]);
}
function payTable(list, kind){
  return list.length ? `<table class="tbl pays"><thead><tr><th>Date</th><th>How</th><th>Reference</th><th>Note</th><th class="r">Amount</th>${isOwner() ? '<th></th>' : ''}</tr></thead><tbody>${list.map(p => `<tr><td class="nw">${fmtD(p.date)}</td><td>${esc(METHOD()[p.method] || p.method)}</td><td class="muted">${esc(p.reference || '')}</td><td class="muted">${esc(p.note || '')}</td><td class="r num">${K(p.amount)}</td>${isOwner() ? `<td><button class="btn sm danger" data-vp="${p.id}" title="Cancel this payment">×</button></td>` : ''}</tr>`).join('')}</tbody></table>` : '<div class="muted">No payments yet.</div>';
}
function bindVoid(bg, after){
  $$('[data-vp]', bg).forEach(b => b.onclick = () => confirmBox('Cancel this payment?', 'The payment stays in the records as cancelled and is taken off the balance.', 'Cancel payment', async why => { await API.post('payments.void', {id:+b.dataset.vp, reason:why}); bg._close(); await refresh('Payment cancelled'); after(); }, true));
}
function saleModal(s){
  const c = car(s.car_id), sc = s.sched, ag = user(s.agent_id);
  const body = `<div class="row" style="gap:14px;align-items:flex-start;flex-wrap:wrap"><div style="width:140px;border-radius:8px;overflow:hidden;background:#EEF3F8">${c.photos[0] ? `<img src="${esc(c.photos[0].thumb)}" style="width:100%;display:block" alt="">` : carSVG(c)}</div>
      <div style="flex:1;min-width:200px"><b style="font-size:15px">${esc(carName(c))}</b> ${plateHTML(c)}<div class="muted" style="font-size:13px">${s.reserved ? 'Reserved' : 'Sold'} ${s.date ? fmtD(s.date) : ''} · ${DEAL[s.type]}${ag ? ' · by ' + esc(ag.name) : ''}${s.legacy ? ' · from the old sheet' : ''}</div>
      <div style="margin-top:4px">${esc(s.buyer_name || 'Buyer not recorded')}${s.buyer_phone ? ` · <a href="tel:${esc(s.buyer_phone)}">${esc(s.buyer_phone)}</a>` : ''}${s.buyer_phone2 ? ` · ${esc(s.buyer_phone2)}` : ''}</div></div></div>
    <div class="kv"><div><span>Price</span><b class="num">${s.price != null ? K(s.price) : '—'}</b></div><div><span>${s.type === 'credit' ? 'Owed incl. interest' : 'To pay'}</span><b class="num">${s.payable != null ? K(s.payable) : '—'}</b></div><div><span>Paid</span><b class="num">${K(s.paid)}</b></div>
      <div><span>Balance</span>${s.balance_known === false ? unc : `<b class="num ${num(s.balance) > 0 ? 'down' : 'up'}">${s.balance != null ? K(s.balance) : '—'}</b>`}</div>
      ${sc ? `<div><span>Instalment</span><b class="num">${s.credit_monthly ? K(s.credit_monthly) + ' × ' + s.credit_months : '—'}</b></div><div><span>${sc.arrears ? 'Behind by' : 'Next due'}</span><b class="num ${sc.arrears ? 'down' : ''}">${sc.arrears ? K(sc.arrears) : sc.next ? fmtD(sc.next) : sc.done ? 'Paid up' : '—'}</b></div>` : ''}</div>
    ${s.reserved && s.hold_until ? `<div class="hint ${s.hold_until < S().today ? 'warn' : ''}">Reserved until ${fmtD(s.hold_until)}${s.hold_until < S().today ? ' — the hold has expired' : ''}.</div>` : ''}
    ${s.balance_known === false ? '<div class="hint warn">The balance was blank on the old Loan Details sheet. Use <b>Edit</b> to set the balance the buyer owes today.</div>' : ''}
    <div><div class="card-h" style="margin-bottom:6px"><h3>Payments</h3></div>${payTable(s.payments)}</div>
    <div class="row" style="flex-wrap:wrap;font-size:13px"><span class="muted">Logbook:</span> <b>${LB[s.logbook]}</b></div>
    ${s.notes ? `<div class="muted" style="font-size:12px">${esc(s.notes)}</div>` : ''}`;
  const acts = [{label:'Close'}];
  if(isOwner()) acts.push({label:'Cancel sale', cls:'danger', fn:() => confirmBox('Cancel this sale?', `The car goes back to stock and all payments on this sale are marked cancelled.`, 'Cancel sale', async why => { await API.post('sales.void', {id:s.id, reason:why}); await refresh('Sale cancelled'); }, true)});
  if(isMgr()) acts.push({label:'Edit', fn:() => saleEdit(s)});
  if(!s.reserved) acts.push({label:`${IC.doc} Agreement`, fn:() => agreementModal(s)});
  if(s.reserved) acts.push({label:'Complete sale', cls:'primary', fn:() => saleWizard(c, s)});
  else if(s.balance_known === false || num(s.balance) > 0 || s.payable == null) acts.push({label:'Record payment', cls:'mpesa', fn:() => payModal(s)});
  const bg = modal(`Sale · ${esc(s.buyer_name || carName(c))}`, body, acts, true);
  bindVoid(bg, () => saleModal(sale(s.id)));
}
function saleEdit(s){
  const cr = s.type === 'credit';
  modal('Edit sale', `<div class="form-grid"><label class="field">Buyer's name<input id="eN" value="${esc(s.buyer_name)}"></label><label class="field">Phone<input id="eP" value="${esc(s.buyer_phone)}"></label>
      <label class="field">Second phone<input id="eP2" value="${esc(s.buyer_phone2)}"></label><label class="field">National ID no.<input id="eI" value="${esc(s.buyer_id_no)}"></label>
      <label class="field">KRA PIN<input id="eK" value="${esc(s.buyer_kra)}"></label><label class="field">Sale date<input type="date" id="eD" value="${esc(s.date)}"></label>
      <label class="field">Price (KES)<input type="number" id="ePr" value="${esc(s.price)}" placeholder="${s.legacy ? 'not on the old sheet' : ''}"></label><div></div>
      ${cr ? `<label class="field">Amount on credit (KES)<input type="number" id="eCa" value="${esc(s.credit_amount)}"></label><label class="field">Months<input type="number" id="eMo" value="${esc(s.credit_months)}"></label>
      <label class="field">Interest (% a month)<input type="number" step="0.1" id="eRt" value="${esc(s.credit_rate)}"></label><label class="field">Instalments counted from<input type="date" id="eSt" value="${esc(s.credit_start)}"></label>` : ''}
      ${s.legacy && cr ? `<label class="field" style="grid-column:1/-1">Balance the buyer owes today (KES)<input type="number" id="eBl" value="${s.balance_known ? esc(s.balance) : ''}" placeholder="from your records"></label>` : ''}</div>
    <label class="field">Notes<textarea id="eNo">${esc(s.notes)}</textarea></label>
    ${s.legacy && cr ? '<div class="muted" style="font-size:12px">For sales from the old sheet, setting the balance records the difference as "paid before the system". New payments are kept.</div>' : ''}`,
    [{label:'Cancel'}, {label:'Save', cls:'primary', fn:async bg => {
      await API.post('sales.edit', {id:s.id, buyer_name:fv(bg, 'eN'), buyer_phone:fv(bg, 'eP'), buyer_phone2:fv(bg, 'eP2'), buyer_id_no:fv(bg, 'eI'), buyer_kra:fv(bg, 'eK'), date:fv(bg, 'eD'), price:fv(bg, 'ePr'),
        credit_amount:fv(bg, 'eCa'), months:fv(bg, 'eMo'), rate:fv(bg, 'eRt'), credit_start:fv(bg, 'eSt'), balance:fv(bg, 'eBl'), notes:fv(bg, 'eNo')});
      await refresh('Sale saved'); saleModal(sale(s.id));
    }}], true);
}
function agreementModal(s){
  const c = car(s.car_id), st = S().settings, ag = user(s.agent_id), ti = s.trade_in_car ? car(s.trade_in_car) : null;
  const html = `<div class="doc"><h2>Motor vehicle sale agreement</h2><div class="c" style="font-size:12px">${esc(st.business_name)}${st.location ? ' · ' + esc(st.location) : ''}${st.phone ? ' · ' + esc(st.phone) : ''} · Agreement no. ${s.id}</div>
    <p>This agreement is made on <b>${fmtD(s.date)}</b> between <b>${esc(st.business_name)}</b> (the Seller) and <b>${esc(s.buyer_name || '__________')}</b>, ID no. ${esc(s.buyer_id_no || '__________')}, KRA PIN ${esc(s.buyer_kra || '__________')}, phone ${esc(s.buyer_phone || '__________')} (the Buyer).</p>
    <table><tbody><tr><td>Vehicle</td><td>${esc(carName(c))}${c.color ? ' · ' + esc(c.color) : ''}</td></tr><tr><td>Registration</td><td>${esc(c.plate || '—')}</td></tr><tr><td>Chassis no.</td><td>${esc(c.chassis || '__________')}</td></tr>
    <tr><td>Engine</td><td>${[c.cc ? c.cc + ' cc' : '', c.fuel, c.gearbox].filter(Boolean).map(esc).join(' · ') || '—'}</td></tr><tr><td>Mileage at sale</td><td>${c.mileage ? K(c.mileage) + ' km' : '—'}</td></tr>
    <tr><td>Agreed price</td><td><b>${s.price != null ? KES(s.price) : '__________'}</b></td></tr>${ti ? `<tr><td>Trade-in</td><td>${esc(carName(ti))} ${esc(ti.plate || '')}, valued at ${KES(s.trade_in_value)}</td></tr>` : ''}
    <tr><td>Terms</td><td>${s.type === 'cash' ? 'Cash sale.' : s.type === 'bank' ? `Deposit paid by the Buyer; balance financed by ${esc(s.bank || 'the bank')}.` : `Credit: ${KES(s.credit_amount)} payable${s.credit_interest ? ` with interest of ${KES(s.credit_interest)}` : ''} in ${s.credit_months} monthly instalments of ${KES(s.credit_monthly)}${s.sched && s.sched.dues.length ? `, the first due on ${fmtD(s.sched.dues[0])}` : ''}. The logbook stays with the Seller until the last instalment is paid.`}</td></tr>
    <tr><td>Paid to date</td><td>${KES(s.paid)}${num(s.balance) ? ` · balance ${KES(s.balance)}` : ''}</td></tr></tbody></table>
    <p style="font-size:12px">The Buyer has inspected and test-driven the vehicle and accepts it in its present condition. The Seller confirms the vehicle is free of any loan, lien or police case and will transfer ownership through NTSA (eCitizen) ${s.type === 'credit' ? 'once fully paid' : 'within 7 days of full payment'}.</p>
    <div class="sig"><div>For the Seller${ag ? ': ' + esc(ag.name) : ''}</div><div>Buyer: ${esc(s.buyer_name || '')}</div></div></div>`;
  modal(`Sale agreement · no. ${s.id}`, html, [{label:'Close'}, {label:`${IC.print} Print`, cls:'primary', fn:() => { printHTML(html); return false; }}], true);
}

/* ================= VIEWS ================= */
function kpi(l, v, d, hero){ return `<div class="card kpi ${hero ? 'hero' : ''}"><span class="l">${l}</span><span class="v num">${v}</span><span class="d">${d || ''}</span></div>`; }
const collectedIn = m => [...S().sales.flatMap(s => s.payments), ...(S().loans || []).flatMap(l => l.payments)].filter(p => !['before', 'tradein'].includes(p.method) && p.date.startsWith(m));
function viewDashboard(){
  const S_ = S(), m = S_.today.slice(0, 7), stock = stockCars(), sold = S_.sales.filter(s => !s.reserved && (s.date || '').startsWith(m));
  const cr = S_.sales.filter(credOpen), crKnown = cr.filter(s => s.balance_known !== false), late = cr.filter(s => s.sched && s.sched.arrears > 0).sort((a, b) => b.sched.overdue_days - a.sched.overdue_days);
  const lo = (S_.loans || []).filter(l => l.status === 'active'), loKnown = lo.filter(l => l.balance_known), loLate = lo.filter(l => l.overdue).sort((a, b) => b.overdue_days - a.overdue_days);
  const unconf = cr.length - crKnown.length + lo.length - loKnown.length;
  const slow = stock.filter(c => daysIn(c) > 60).sort((a, b) => daysIn(b) - daysIn(a)).slice(0, 8);
  const noPrice = stock.filter(c => !c.ask).length, noPhoto = stock.filter(c => !c.photos.length).length;
  return {title:'Dashboard', sub:`${esc(App.business)} · ${fmtD(S_.today)}`,
    html:`<div class="grid g4">
      ${kpi('Cars in the yard', `${stock.length} <small style="color:#BFD3F0">cars</small>`, `${KES(sum(stock.map(c => c.ask)))} at asking prices`, true)}
      ${kpi(`Sold in ${pLabel(m, false)}`, `${sold.length} <small>${sold.length === 1 ? 'car' : 'cars'}</small>`, `${KES(sum(sold.map(s => s.price)))} in sales`)}
      ${kpi(`Collected in ${pLabel(m, false)}`, short(sum(collectedIn(m).map(p => p.amount))), 'instalments, deposits, sales & loan repayments')}
      ${kpi('Owed to the yard', short(sum(crKnown.map(s => s.balance)) + sum(loKnown.map(l => l.balance))), `${pl(cr.length, 'credit sale')} · ${pl(lo.length, 'logbook loan')}${unconf ? ` · <b class="down">${unconf} unconfirmed</b>` : ''}`)}</div>
    ${unconf ? `<div class="hint warn"><b>${unconf} balances from the old sheet are unconfirmed.</b> Open each one under Instalments or Logbook loans and set today's balance, so the totals are complete.</div>` : ''}
    ${noPrice || noPhoto ? `<div class="hint">${noPrice ? `${pl(noPrice, 'car')} in the yard ${noPrice === 1 ? 'has' : 'have'} no asking price. ` : ''}${noPhoto ? `${pl(noPhoto, 'car')} ${noPhoto === 1 ? 'has' : 'have'} no photos.` : ''} <a href="#/stock">Open stock</a></div>` : ''}
    <div class="grid g2">
      <div class="card"><div class="card-h"><h3>Instalments behind</h3><span class="sub">${pl(late.length, 'buyer')}</span><div class="right"><a class="btn sm" href="#/credit">All instalments</a></div></div>
        ${late.length ? `<table class="tbl"><tbody>${late.slice(0, 8).map(s => `<tr class="click" data-sale="${s.id}"><td><b>${esc(s.buyer_name)}</b><div class="muted" style="font-size:12px">${esc(carName(car(s.car_id)))} · ${esc(car(s.car_id).plate || '')}</div></td><td class="muted nw">${s.sched.overdue_days} days</td><td class="r num down">${K(s.sched.arrears)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No one is behind.</div>'}</div>
      <div class="card"><div class="card-h"><h3>Logbook loans past due</h3><span class="sub">${pl(loLate.length, 'loan')}</span><div class="right"><a class="btn sm" href="#/loans">All loans</a></div></div>
        ${loLate.length ? `<table class="tbl"><tbody>${loLate.slice(0, 8).map(l => `<tr class="click" data-loan="${l.id}"><td><b>${esc(l.borrower)}</b><div class="muted" style="font-size:12px">${esc(l.vehicle || '')} ${esc(l.plate || '')}</div></td><td class="muted nw">due ${fmtDs(l.due_date)}</td><td class="r">${balTxt(l.balance, l.balance_known)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">None past due.</div>'}</div></div>
    <div class="card"><div class="card-h"><h3>Slow movers</h3><span class="sub">in the yard over 60 days</span></div>${slow.length ? `<div class="cars">${slow.map(carCard).join('')}</div>` : '<div class="empty">No car has been in the yard over 60 days.</div>'}</div>`};
}
function viewSales(){
  let list = S().sales.slice();
  if(ui.salesType !== 'all') list = list.filter(s => ui.salesType === 'reserved' ? s.reserved : s.type === ui.salesType && !s.reserved);
  if(ui.salesQ){ const q = ui.salesQ.toLowerCase().replace(/\s/g, ''); list = list.filter(s => { const c = car(s.car_id); return ((s.buyer_name || '') + (s.buyer_phone || '') + carName(c) + (c.plate || '')).toLowerCase().replace(/\s/g, '').includes(q); }); }
  return {title:'Sales & payments', sub:`${pl(S().sales.filter(s => !s.reserved).length, 'sale')} · ${pl(S().sales.filter(s => s.reserved).length, 'reservation')}`,
    tools:isMgr() ? `<button class="btn" id="csvSales">${IC.dl} Export</button>` : '',
    html:`<div class="filters"><label class="field">Show<select id="sT">${[['all', 'All'], ['reserved', 'Reserved'], ['cash', 'Cash'], ['credit', 'Credit'], ['bank', 'Bank finance']].map(([v, l]) => `<option value="${v}" ${ui.salesType === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="field" style="flex:1;min-width:180px">Search<input type="search" id="sQ" value="${esc(ui.salesQ)}" placeholder="Buyer, phone, car or plate"></label></div>
      <div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Car</th><th>Buyer</th><th>Deal</th><th class="r">Price</th><th class="r">Paid</th><th class="r">Balance</th></tr></thead><tbody>
      ${list.map(s => { const c = car(s.car_id); return `<tr class="click" data-sale="${s.id}"><td class="nw muted">${s.date ? fmtD(s.date) : '—'}</td><td>${esc(carName(c))} ${plateHTML(c)}</td><td>${esc(s.buyer_name || '—')}</td><td>${s.reserved ? '<span class="pill warn">Reserved</span>' : `<span class="pill ${s.type === 'credit' ? 'info' : 'gray'}">${{cash:'Cash', credit:'Credit', bank:'Bank'}[s.type]}</span>`}</td>
        <td class="r num">${s.price != null ? K(s.price) : '—'}</td><td class="r num">${K(s.paid)}</td><td class="r">${s.payable == null && s.balance_known !== false ? '<span class="muted">—</span>' : balTxt(s.balance, s.balance_known)}</td></tr>`; }).join('') || '<tr><td colspan="7" class="empty">No sales.</td></tr>'}</tbody></table></div></div>`,
    bind(){
      $('#sT').onchange = e => { ui.salesType = e.target.value; render(); };
      let t; $('#sQ').oninput = e => { clearTimeout(t); t = setTimeout(() => { ui.salesQ = e.target.value; render(); const q = $('#sQ'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 250); };
      if($('#csvSales')) $('#csvSales').onclick = () => csvDownload(`sales-${S().today}.csv`, [['Date', 'Plate', 'Car', 'Buyer', 'Phone', 'Deal', 'Price', 'Paid', 'Balance', 'Balance confirmed'],
        ...S().sales.map(s => { const c = car(s.car_id); return [s.date, c.plate, carName(c), s.buyer_name, s.buyer_phone, s.reserved ? 'Reserved' : s.type, s.price, s.paid, s.balance, s.balance_known === false ? 'No' : 'Yes']; })]);
    }};
}
function viewCredit(){
  const all = S().sales.filter(s => s.type === 'credit' && !s.reserved), open = all.filter(credOpen);
  const list = ui.creditTab === 'open' ? open : all.filter(s => !credOpen(s));
  list.sort((a, b) => (b.sched ? b.sched.arrears : 0) - (a.sched ? a.sched.arrears : 0) || (a.balance_known === false) - (b.balance_known === false));
  const known = open.filter(s => s.balance_known !== false);
  return {title:'Instalments', sub:`${pl(open.length, 'buyer')} paying · ${KES(sum(known.map(s => s.balance)))} still owed${open.length - known.length ? ` + ${open.length - known.length} unconfirmed` : ''}`,
    tools:`<div class="seg"><button data-ct="open" class="${ui.creditTab === 'open' ? 'on' : ''}">Paying (${open.length})</button><button data-ct="done" class="${ui.creditTab === 'done' ? 'on' : ''}">Paid up (${all.length - open.length})</button></div>`,
    html:list.length ? `<div class="list">${list.map(s => { const c = car(s.car_id), sc = s.sched, p = s.payable ? Math.min(100, s.paid / s.payable * 100) : 0;
      return `<div class="card loan-card"><div class="top"><b>${esc(s.buyer_name || 'Buyer')}</b>${s.buyer_phone ? `<a href="tel:${esc(s.buyer_phone)}" class="muted">${esc(s.buyer_phone)}</a>` : ''}<span class="muted">${esc(carName(c))}</span> ${plateHTML(c)}
          ${s.balance_known === false ? unc : sc && sc.arrears ? `<span class="pill bad">Behind ${KES(sc.arrears)} · ${sc.overdue_days} days</span>` : num(s.balance) > 0 ? '<span class="pill good">Up to date</span>' : '<span class="pill gray">Paid up</span>'}
          <span class="spacer"></span><button class="btn sm" data-sale="${s.id}">Open</button>${credOpen(s) ? `<button class="btn sm mpesa" data-pay="${s.id}">Record payment</button>` : ''}</div>
        <div class="mini"><div><span>Owed in all</span><b class="num">${s.payable != null ? K(s.payable) : '—'}</b></div><div><span>Paid</span><b class="num">${K(s.paid)}</b></div><div><span>Balance</span>${balTxt(s.balance, s.balance_known)}</div><div><span>${sc && sc.next ? 'Next due' : 'Instalment'}</span><b class="num">${sc && sc.next ? fmtDs(sc.next) + (s.credit_monthly ? ' · ' + K(s.credit_monthly) : '') : s.credit_monthly ? K(s.credit_monthly) : '—'}</b></div></div>
        ${s.balance_known !== false ? `<div class="progress good"><i style="width:${p}%"></i></div>` : ''}</div>`; }).join('')}</div>` : '<div class="card empty">Nothing here.</div>',
    bind(){
      $$('[data-ct]').forEach(b => b.onclick = () => { ui.creditTab = b.dataset.ct; render(); });
      $$('[data-pay]').forEach(b => b.onclick = () => payModal(sale(b.dataset.pay)));
    }};
}
function viewLogbooks(){
  const list = S().sales.filter(s => !s.reserved && s.logbook !== 'transferred' && !(s.legacy && s.logbook === 'pending' && !s.buyer_name));
  const order = ['held', 'pending', 'initiated', 'transferred'];
  return {title:'Logbooks', sub:`${pl(list.length, 'logbook')} not yet transferred to the buyer`,
    html:`<div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Car</th><th>Buyer</th><th>Sold</th><th>Step</th><th></th></tr></thead><tbody>
      ${list.sort((a, b) => order.indexOf(a.logbook) - order.indexOf(b.logbook)).map(s => { const c = car(s.car_id), owes = s.type === 'credit' && (s.balance_known === false || num(s.balance) > 0);
        const next = s.logbook === 'held' ? (owes ? null : 'pending') : s.logbook === 'pending' ? 'initiated' : 'transferred';
        return `<tr><td>${esc(carName(c))} ${plateHTML(c)}</td><td>${esc(s.buyer_name || '—')}</td><td class="muted nw">${s.date ? fmtD(s.date) : '—'}</td>
          <td><div class="lb-steps">${order.slice(1).map(k => `<span class="${order.indexOf(k) < order.indexOf(s.logbook) ? 'done' : k === s.logbook ? 'cur' : ''}">${{pending:'Not started', initiated:'eCitizen', transferred:'Done'}[k]}</span>`).join('')}${s.logbook === 'held' ? `<span class="cur">Held${owes ? ' — balance ' + (s.balance_known === false ? 'unconfirmed' : K(s.balance)) : ''}</span>` : ''}</div></td>
          <td class="r">${next ? `<button class="btn sm" data-lb="${s.id}" data-to="${next}">${{pending:'Release logbook', initiated:'Transfer started', transferred:'Mark transferred'}[next]}</button>` : ''}</td></tr>`; }).join('') || '<tr><td colspan="5" class="empty">All logbooks are transferred.</td></tr>'}</tbody></table></div></div>
      <div class="muted" style="font-size:12px">Cars sold before the system with no buyer on the sheet are not listed here.</div>`,
    bind(){ $$('[data-lb]').forEach(b => b.onclick = async () => { try { await API.post('sales.logbook', {id:+b.dataset.lb, to:b.dataset.to}); await refresh('Logbook updated'); } catch(e){ toast(e.message, 1); } }); }};
}

/* ---------- logbook loans ---------- */
function viewLoans(){
  const L = S().loans || [], tabs = {active:L.filter(l => l.status === 'active'), cleared:L.filter(l => l.status === 'cleared'), written_off:L.filter(l => l.status === 'written_off')};
  const list = tabs[ui.loanTab].slice().sort((a, b) => b.overdue_days - a.overdue_days), known = tabs.active.filter(l => l.balance_known);
  return {title:'Logbook loans', sub:`${pl(tabs.active.length, 'active loan')} · ${KES(sum(known.map(l => l.balance)))} owed${tabs.active.length - known.length ? ` + ${tabs.active.length - known.length} unconfirmed` : ''}`,
    tools:`<div class="seg">${[['active', 'Active'], ['cleared', 'Cleared'], ['written_off', 'Written off']].map(([k, l]) => `<button data-lt="${k}" class="${ui.loanTab === k ? 'on' : ''}">${l} (${tabs[k].length})</button>`).join('')}</div><button class="btn primary" id="addLoan">${IC.plus} New loan</button>`,
    html:`<div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Borrower</th><th>Logbook of</th><th class="r">Lent</th><th class="r">Interest</th><th class="r">Paid</th><th class="r">Balance</th><th>Due</th></tr></thead><tbody>
      ${list.map(l => `<tr class="click" data-loan="${l.id}"><td class="nw muted">${fmtD(l.date)}</td><td><b>${esc(l.borrower)}</b><div class="muted" style="font-size:12px">${esc(l.phone || '')}</div></td><td>${esc(l.vehicle || '')} ${l.plate ? `<span class="plate">${esc(l.plate)}</span>` : ''}</td>
        <td class="r num">${K(l.amount)}</td><td class="r num">${l.interest ? K(l.interest) : '—'}</td><td class="r num">${K(l.paid)}</td><td class="r">${balTxt(l.balance, l.balance_known)}</td>
        <td class="nw">${l.due_date ? (l.overdue ? `<span class="pill bad">${fmtDs(l.due_date)} · ${l.overdue_days}d late</span>` : fmtDs(l.due_date)) : '<span class="muted">not set</span>'}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">No loans here.</td></tr>'}</tbody></table></div></div>`,
    bind(){
      $$('[data-lt]').forEach(b => b.onclick = () => { ui.loanTab = b.dataset.lt; render(); });
      $('#addLoan').onclick = () => loanForm();
    }};
}
function loanModal(l){
  const body = `<div><b style="font-size:15px">${esc(l.borrower)}</b>${l.phone ? ` · <a href="tel:${esc(l.phone)}">${esc(l.phone)}</a>` : ''}${l.phone2 ? ` · ${esc(l.phone2)}` : ''}<div class="muted" style="font-size:13px">Logbook of ${esc(l.vehicle || '—')} ${esc(l.plate || '')} · lent ${fmtD(l.date)}${l.months ? ` for ${pl(l.months, 'month')}` : ''}${l.logbook_held ? ' · logbook held' : ''}</div></div>
    <div class="kv"><div><span>Lent</span><b class="num">${K(l.amount)}</b></div><div><span>Interest</span><b class="num">${K(l.interest)}${l.rate ? ` <small class="muted">(${l.rate}%/month)</small>` : ''}</b></div><div><span>To repay</span><b class="num">${K(l.payable)}</b></div>
      <div><span>Paid</span><b class="num">${K(l.paid)}</b></div><div><span>Balance</span>${l.balance_known ? `<b class="num ${l.balance > 0 ? 'down' : 'up'}">${K(l.balance)}</b>` : unc}</div><div><span>Due</span><b class="${l.overdue ? 'down' : ''}">${l.due_date ? fmtD(l.due_date) : 'not set'}</b></div></div>
    ${!l.balance_known ? '<div class="hint warn">The balance was blank on the old Loan Details sheet. Use <b>Edit</b> to set what is owed today, and the interest agreed.</div>' : ''}
    <div><div class="card-h" style="margin-bottom:6px"><h3>Repayments</h3></div>${payTable(l.payments)}</div>${l.notes ? `<div class="muted" style="font-size:12px">${esc(l.notes)}</div>` : ''}`;
  const acts = [{label:'Close'}, {label:'Edit', fn:() => loanForm(l)}];
  if(isOwner()) acts.push(l.status === 'active' ? {label:'Write off', cls:'danger', fn:() => confirmBox('Write off this loan?', 'It moves to Written off. You can reopen it later.', 'Write off', async why => { await API.post('loans.close', {id:l.id, to:'written_off', reason:why}); await refresh('Loan written off'); }, true)}
    : {label:'Reopen', fn:async () => { await API.post('loans.close', {id:l.id, to:'active'}); await refresh('Loan reopened'); }});
  if(isOwner() && l.status === 'active' && l.balance_known && l.balance <= 0) acts.push({label:'Mark cleared', cls:'good', fn:async () => { await API.post('loans.close', {id:l.id, to:'cleared'}); await refresh('Loan cleared'); }});
  if(l.status === 'active') acts.push({label:'Record repayment', cls:'mpesa', fn:() => modal(`Repayment · ${esc(l.borrower)}`, `<div class="form-grid"><label class="field">Amount (KES)<input type="number" id="rA" value="${l.balance_known ? l.balance : ''}"></label><label class="field">Paid by<select id="rM">${methodOpts()}</select></label><label class="field">M-Pesa code / reference<input id="rR"></label><label class="field">Date<input type="date" id="rD" value="${S().today}" max="${S().today}"></label></div>`,
    [{label:'Cancel'}, {label:'Record', cls:'mpesa', fn:async bg => { await API.post('loans.pay', {loan_id:l.id, amount:fv(bg, 'rA'), method:fv(bg, 'rM'), reference:fv(bg, 'rR'), date:fv(bg, 'rD')}); await refresh('Repayment recorded'); }}])});
  const bg = modal(`Logbook loan · ${esc(l.borrower)}`, body, acts, true);
  bindVoid(bg, () => loanModal(loan(l.id)));
}
function loanForm(l){
  const e = l || {date:S().today, logbook_held:true};
  modal(l ? 'Edit loan' : 'New logbook loan', `<div class="form-grid"><label class="field">Borrower's name<input id="lB" value="${esc(e.borrower)}"></label><label class="field">Phone<input id="lP" value="${esc(e.phone)}"></label>
      <label class="field">Second phone<input id="lP2" value="${esc(e.phone2)}"></label><label class="field">National ID no.<input id="lI" value="${esc(e.id_no)}"></label>
      <label class="field">Vehicle (logbook held)<input id="lV" value="${esc(e.vehicle)}" placeholder="Toyota Premio"></label><label class="field">Plate<input id="lPl" value="${esc(e.plate)}"></label>
      <label class="field">Amount lent (KES)<input type="number" id="lA" value="${esc(e.amount)}"></label><label class="field">Date lent<input type="date" id="lD" value="${esc(e.date)}"></label>
      <label class="field">Months<input type="number" id="lM" value="${esc(e.months)}"></label><label class="field">Interest (% a month, flat)<input type="number" step="0.1" id="lR" value="${esc(e.rate)}"></label>
      <label class="field">Interest amount (KES) <span class="muted" style="font-size:11px">· blank = worked out</span><input type="number" id="lIn" value="${l ? esc(e.interest) : ''}"></label><label class="field">Due date <span class="muted" style="font-size:11px">· blank = date + months</span><input type="date" id="lDu" value="${esc(e.due_date)}"></label>
      ${l && l.legacy ? `<label class="field" style="grid-column:1/-1">Balance owed today (KES)<input type="number" id="lBl" value="${l.balance_known ? esc(l.balance) : ''}" placeholder="from your records"></label>` : ''}</div>
    <label class="switch"><input type="checkbox" id="lH" ${e.logbook_held ? 'checked' : ''}> We are holding the logbook</label><label class="field">Notes<textarea id="lN">${esc(e.notes)}</textarea></label>`,
    [{label:'Cancel'}, {label:'Save', cls:'primary', fn:async bg => {
      const r = await API.post('loans.save', {id:l ? l.id : null, borrower:fv(bg, 'lB'), phone:fv(bg, 'lP'), phone2:fv(bg, 'lP2'), id_no:fv(bg, 'lI'), vehicle:fv(bg, 'lV'), plate:fv(bg, 'lPl'), amount:fv(bg, 'lA'), date:fv(bg, 'lD'),
        months:fv(bg, 'lM'), rate:fv(bg, 'lR'), interest:fv(bg, 'lIn'), due_date:fv(bg, 'lDu'), balance:fv(bg, 'lBl'), logbook_held:fv(bg, 'lH'), notes:fv(bg, 'lN')});
      await refresh('Loan saved'); loanModal(loan(r.id));
    }}], true);
}

/* ---------- reports & expenses ---------- */
function viewReports(){
  const S_ = S(), m = ui.month || S_.today.slice(0, 7), sold = S_.sales.filter(s => !s.reserved && (s.date || '').startsWith(m));
  const priced = sold.filter(s => s.price != null), withCost = priced.filter(s => car(s.car_id).buy != null), gross = sum(withCost.map(s => s.price - carCost(car(s.car_id))));
  const col = collectedIn(m), exp = (S_.expenses || []).filter(e => e.date.startsWith(m)), expT = sum(exp.map(e => e.amount));
  const byM = {}; col.forEach(p => byM[p.method] = (byM[p.method] || 0) + p.amount);
  const months = Array.from({length:6}, (_, i) => addMonthsP(S_.today.slice(0, 7), i - 5));
  const stock = stockCars(), ages = [['0–30 days', 0, 30, '#15803D'], ['31–60 days', 31, 60, '#0C8B86'], ['61–90 days', 61, 90, '#D4A72C'], ['Over 90 days', 91, 1e9, '#B91C1C']].map(([l, a, b, c]) => ({l, c, n:stock.filter(x => daysIn(x) >= a && daysIn(x) <= b).length}));
  const opts = Array.from({length:18}, (_, i) => addMonthsP(S_.today.slice(0, 7), -i)).map(p => `<option value="${p}" ${p === m ? 'selected' : ''}>${pLabel(p)}</option>`).join('');
  return {title:'Reports & expenses', sub:pLabel(m), tools:`<select id="rM">${opts}</select><button class="btn primary" id="addExp">${IC.plus} Add an expense</button>`,
    html:`<div class="grid g4">${kpi('Cars sold', sold.length, `${KES(sum(priced.map(s => s.price)))} in sales`, true)}${kpi('Gross profit on cars', short(gross), withCost.length < sold.length ? `${withCost.length} of ${sold.length} sales have a buying price` : 'price less buying price and costs')}
      ${kpi('Money collected', short(sum(col.map(p => p.amount))), Object.entries(byM).map(([k, v]) => `${esc(METHOD()[k])} ${short(v)}`).join(' · ') || 'none')}${kpi('Yard expenses', short(expT), `${pl(exp.length, 'entry')}`)}</div>
    <div class="grid g-7-5"><div class="card"><div class="card-h"><h3>Money collected</h3><span class="sub">last 6 months</span></div><div class="chart-box"><canvas id="chCol"></canvas></div></div>
      <div class="card"><div class="card-h"><h3>How long cars have been in the yard</h3></div><div class="agebars">${ages.map(a => `<div class="row"><span>${a.l}</span><div class="bar"><i style="width:${stock.length ? a.n / stock.length * 100 : 0}%;background:${a.c}"></i></div><b class="num" style="width:30px;text-align:right">${a.n}</b></div>`).join('')}</div></div></div>
    <div class="grid g2"><div class="card"><div class="card-h"><h3>Cars sold in ${pLabel(m, false)}</h3></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Car</th><th>Buyer</th><th class="r">Price</th><th class="r">Profit</th></tr></thead><tbody>
      ${sold.map(s => { const c = car(s.car_id); return `<tr class="click" data-sale="${s.id}"><td>${esc(carName(c))} ${plateHTML(c)}</td><td>${esc(s.buyer_name || '—')}</td><td class="r num">${s.price != null ? K(s.price) : '—'}</td><td class="r num">${s.price != null && c.buy != null ? K(s.price - carCost(c)) : '—'}</td></tr>`; }).join('') || '<tr><td colspan="4" class="empty">No sales this month.</td></tr>'}</tbody></table></div></div>
      <div class="card"><div class="card-h"><h3>Yard expenses</h3></div><div class="tbl-wrap"><table class="tbl"><tbody>
      ${exp.map(e => `<tr><td class="nw muted">${fmtDs(e.date)}</td><td>${esc(e.category)}${e.description ? `<div class="muted" style="font-size:12px">${esc(e.description)}</div>` : ''}</td><td class="r num">${K(e.amount)}</td><td class="r"><button class="btn sm danger" data-de="${e.id}">×</button></td></tr>`).join('') || '<tr><td class="empty">No expenses this month.</td></tr>'}</tbody></table></div></div></div>`,
    bind(){
      $('#rM').onchange = e => { ui.month = e.target.value; render(); };
      $('#addExp').onclick = () => modal('Add a yard expense', `<div class="form-grid"><label class="field">Type<select id="eC">${S_.expense_types.map(t => `<option>${t}</option>`).join('')}</select></label><label class="field">Amount (KES)<input type="number" id="eA"></label><label class="field">Date<input type="date" id="eD" value="${S_.today}" max="${S_.today}"></label><label class="field">Details<input id="eN"></label></div>`,
        [{label:'Cancel'}, {label:'Add', cls:'primary', fn:async bg => { await API.post('expenses.add', {category:fv(bg, 'eC'), amount:fv(bg, 'eA'), date:fv(bg, 'eD'), description:fv(bg, 'eN')}); await refresh('Expense added'); }}]);
      $$('[data-de]').forEach(b => b.onclick = () => confirmBox('Remove this expense?', 'It will be taken off the report.', 'Remove', async () => { await API.post('expenses.delete', {id:+b.dataset.de}); await refresh('Expense removed'); }));
      if(window.Chart){ const all = [...S_.sales.flatMap(s => s.payments), ...(S_.loans || []).flatMap(l => l.payments)].filter(p => !['before', 'tradein'].includes(p.method));
        charts.push(new Chart($('#chCol'), {type:'bar', data:{labels:months.map(p => pLabel(p, false)), datasets:[{label:'Collected', data:months.map(p => sum(all.filter(x => x.date.startsWith(p)).map(x => x.amount))), backgroundColor:'#0C8B86', borderRadius:6}]},
          options:{maintainAspectRatio:false, plugins:{legend:{display:false}, tooltip:{callbacks:{label:x => KES(x.raw)}}}, scales:{y:{ticks:{callback:v => short(v)}}}}})); }
    }};
}

/* ---------- staff, settings, activity (owner) ---------- */
function viewStaff(){
  return {title:'Staff', sub:'Who can sign in and what they can see', tools:`<button class="btn primary" id="addU">${IC.plus} Add a person</button>`,
    html:`<div class="card" id="uBox"><div class="loading">Loading…</div></div>
      <div class="hint"><b>Owner</b>: everything. <b>Manager</b>: stock with buying prices and costs, sales, instalments, logbook loans, reports. <b>Sales</b>: stock (without buying prices or profit), photos, reserving and selling, recording instalments and logbook steps.</div>`,
    async bind(){
      $('#addU').onclick = () => userForm();
      try { const us = await API.get('users.list'); window.__users = us;
        $('#uBox').innerHTML = `<table class="tbl"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last sign-in</th><th></th></tr></thead><tbody>${us.map(u => `<tr><td><b>${esc(u.name)}</b>${u.active == 1 ? '' : ' <span class="pill gray">Off</span>'}</td><td>${esc(u.email)}</td><td>${{owner:'Owner', manager:'Manager', sales:'Sales'}[u.role]}</td><td class="muted">${u.last_login ? fmtD(u.last_login) : 'never'}</td><td class="r"><button class="btn sm" data-u="${u.id}">Edit</button></td></tr>`).join('')}</tbody></table>`;
        $$('[data-u]').forEach(b => b.onclick = () => userForm(us.find(u => u.id == b.dataset.u)));
      } catch(e){ $('#uBox').innerHTML = `<div class="err">${esc(e.message)}</div>`; }
    }};
}
function userForm(u){
  modal(u ? 'Edit ' + esc(u.name) : 'Add a person', `<div class="form-grid"><label class="field">Full name<input id="uN" value="${esc(u && u.name)}"></label><label class="field">Email (to sign in)<input type="email" id="uE" value="${esc(u && u.email)}"></label>
      <label class="field">Phone<input id="uP" value="${esc(u && u.phone)}"></label><label class="field">Role<select id="uR">${[['sales', 'Sales'], ['manager', 'Manager'], ['owner', 'Owner']].map(([v, l]) => `<option value="${v}" ${(u ? u.role : 'sales') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="field" style="grid-column:1/-1">${u ? 'New password (leave blank to keep)' : 'First password (8+ characters, letters and numbers)'}<input type="password" id="uPw" autocomplete="new-password"></label></div>
    ${u ? `<label class="switch"><input type="checkbox" id="uA" ${u.active == 1 ? 'checked' : ''}> Can sign in</label>` : ''}<div class="muted" style="font-size:12px">Give the password to the person yourself; they can change it after signing in.</div>`,
    [{label:'Cancel'}, {label:'Save', cls:'primary', fn:async bg => { await API.post('users.save', {id:u ? u.id : null, name:fv(bg, 'uN'), email:fv(bg, 'uE'), phone:fv(bg, 'uP'), role:fv(bg, 'uR'), password:fv(bg, 'uPw'), active:u ? fv(bg, 'uA') : true}); await refresh('Saved'); }}]);
}
function viewSettings(){
  const st = S().settings;
  return {title:'Settings', sub:'Business details and credit terms',
    html:`<div class="card" style="max-width:640px"><div class="form-grid"><label class="field">Business name<input id="sN" value="${esc(st.business_name)}"></label><label class="field">Location<input id="sL" value="${esc(st.location)}"></label>
      <label class="field">Business phone<input id="sP" value="${esc(st.phone)}"></label><label class="field">Payment details (Paybill / Till / bank)<input id="sPd" value="${esc(st.pay_details)}"></label>
      <label class="field">Default credit interest (% a month, flat)<input type="number" step="0.1" id="sR" value="${st.credit_rate}"></label><label class="field">Minimum deposit for credit (% of price)<input type="number" id="sD" value="${st.min_deposit}"></label>
      <label class="field">Days a reservation is held<input type="number" id="sH" value="${st.hold_days}"></label></div><div class="err" id="sErr"></div><div style="margin-top:12px"><button class="btn primary" id="sSave">Save settings</button></div></div>`,
    bind(){ $('#sSave').onclick = async () => { $('#sErr').textContent = ''; try { await API.post('settings.save', {business_name:fv(document, 'sN'), location:fv(document, 'sL'), phone:fv(document, 'sP'), pay_details:fv(document, 'sPd'), credit_rate:fv(document, 'sR'), min_deposit:fv(document, 'sD'), hold_days:fv(document, 'sH')}); await refresh('Settings saved'); } catch(e){ $('#sErr').textContent = e.message; } }; }};
}
const ACT = {login:'Signed in', logout:'Signed out', car_add:'Added a car', car_update:'Edited a car', car_status:'Changed car status', car_delete:'Removed a car', cost_add:'Added a cost', cost_delete:'Removed a cost', photos_add:'Added photos', photo_delete:'Deleted a photo',
  car_reserved:'Reserved a car', car_sold:'Sold a car', payment_add:'Recorded a payment', sale_edit:'Edited a sale', sale_void:'Cancelled a sale', payment_void:'Cancelled a payment', logbook:'Logbook step', loan_add:'New logbook loan', loan_edit:'Edited a loan',
  loan_payment:'Loan repayment', loan_status:'Changed loan status', expense_add:'Added an expense', expense_delete:'Removed an expense', user_add:'Added a person', user_save:'Edited a person', settings_update:'Changed settings', password_change:'Changed password', seed_loaded:'Loaded the spreadsheets', setup_complete:'Set up the system'};
function viewActivity(){
  return {title:'Activity', sub:'Who did what, most recent first', html:'<div id="aBox"><div class="card loading">Loading…</div></div>',
    async bind(){
      try { const r = await API.get('audit.list');
        $('#aBox').innerHTML = `${r.seed_issues.length ? `<div class="card"><div class="card-h"><h3>Points to check from the spreadsheets</h3><span class="sub">found when the data was loaded</span></div><ul class="issues">${r.seed_issues.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>` : ''}
          <div class="card"><div class="tbl-wrap"><table class="tbl"><tbody>${r.items.map(a => { let d = ''; try { const j = JSON.parse(a.details || '{}'); d = Object.entries(j).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · '); } catch(e){}
            return `<tr><td class="nw muted">${esc(a.created_at.slice(0, 16))}</td><td>${esc(a.name || '—')}</td><td>${esc(ACT[a.action] || a.action)}${a.entity ? ` <span class="muted">${esc(a.entity)} ${a.entity_id || ''}</span>` : ''}</td><td class="muted" style="font-size:12px">${esc(d)}</td></tr>`; }).join('')}</tbody></table></div></div>`;
      } catch(e){ $('#aBox').innerHTML = `<div class="card err">${esc(e.message)}</div>`; }
    }};
}

const VIEWS = {dashboard:viewDashboard, stock:viewStock, sales:viewSales, credit:viewCredit, loans:viewLoans, logbooks:viewLogbooks, reports:viewReports, staff:viewStaff, settings:viewSettings, activity:viewActivity};

/* ---------- start ---------- */
(async () => {
  if(window.Chart){ Chart.defaults.font.family = 'Inter, system-ui, sans-serif'; Chart.defaults.font.size = 12; Chart.defaults.color = '#5E6A7D'; }
  try { const m = await API.refresh(); App.business = m.business; if(m.user){ await loadState(); } }
  catch(e){ $('#app').innerHTML = `<div class="loading">${esc(e.message)} <a href="">Try again</a></div>`; return; }
  render();
})();
