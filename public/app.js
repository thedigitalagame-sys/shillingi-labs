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
  bg.innerHTML = `<div class="modal ${wide ? (wide === 'xwide' ? 'wide xwide' : 'wide') : ''}" role="dialog" aria-modal="true"><div class="modal-h"><h3>${title}</h3><button type="button" aria-label="Close" data-x>&times;</button></div><div class="modal-b">${body}<div class="err" data-err></div></div><div class="modal-f"></div></div>`;
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
  home:svg('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>'),
  plusSq:svg('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8M8 12h8"/>'),
  book:svg('<path d="M2 5c3-1.5 7-1.5 10 1 3-2.5 7-2.5 10-1v14c-3-1.5-7-1.5-10 1-3-2.5-7-2.5-10-1z"/><path d="M12 6v14"/>'),
  bell:svg('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>'),
  eye:svg('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  edit:svg('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>'),
  copy:svg('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  trash:svg('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>'),
  search:svg('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
  reset:svg('<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>'),
  hand:svg('<path d="M11 17l2 2a1 1 0 1 0 3-3"/><path d="M14 14l2.5 2.5a1 1 0 1 0 3-3l-3.9-3.9a3 3 0 0 0-4.2 0l-.9.9a1 1 0 1 1-3-3l2.8-2.8a5 5 0 0 1 6.1-.7l.5.3a4 4 0 0 0 2 .5H21"/><path d="M21 3l1 11h-2M3 3L2 14l6.5 6.5a1 1 0 1 0 3-3M3 4h8"/>'),
  tag:svg('<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>'),
  tools:svg('<path d="M14.7 6.3a4 4 0 0 0 5 5L22 14l-8 8-2.3-2.3a4 4 0 0 0-5-5L2 10l8-8z"/>'),
  check:svg('<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>'),
  cal:svg('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>'),
  palette:svg('<circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/><circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/><path d="M12 2a10 10 0 0 0 0 20 2 2 0 0 0 2-2c0-.5-.2-1-.5-1.3a1.7 1.7 0 0 1 1.3-2.7H17a5 5 0 0 0 5-5c0-5-4.5-9-10-9z"/>'),
  fuel:svg('<path d="M3 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18M2 22h14M3 10h12M15 13h2a2 2 0 0 1 2 2v3a2 2 0 0 0 4 0V9l-4-4"/>'),
  engine:svg('<path d="M4 9h2V7h4V5h4v2h3l2 3h2v6h-2l-2 3h-6l-2-2H6v-3H4z"/>'),
  barcode:svg('<path d="M3 5v14M7 5v14M10 5v14M14 5v14M17 5v14M21 5v14"/>'),
  layers:svg('<path d="M12 2l10 5-10 5L2 7z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>'),
  gauge:svg('<path d="M12 14l4-4"/><path d="M3.3 19a10 10 0 1 1 17.4 0"/>'),
  swap:svg('<path d="M17 3l4 4-4 4M3 7h18M7 21l-4-4 4-4M21 17H3"/>'),
  clip:svg('<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4V2h6v2M9 12l2 2 4-4"/>'),
  clock:svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  upload:svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/>'),
  save:svg('<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>'),
  plate:svg('<rect x="2" y="7" width="20" height="10" rx="2"/><path d="M6 12h3M15 12h3"/>'),
  office:svg('<path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1M14 9h1M9 13h1M14 13h1M9 17h1M14 17h1"/>'),
  chat:svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/>'),
  mail:svg('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6l-10 7L2 6"/>'),
  lock:svg('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/><circle cx="12" cy="16" r="1"/>'),
  eyeOff:svg('<path d="M17.9 17.9A10 10 0 0 1 12 19c-6.5 0-10-7-10-7a18 18 0 0 1 4.1-5M9.9 5.2A9 9 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-2.2 3.2M14.1 14.1a3 3 0 1 1-4.2-4.2M2 2l20 20"/>'),
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
const ui = {status:'all', make:'all', page:1, lbSt:'all', lbQ:'', lbPage:1, lbCar:null, form:null, body:'all', q:'', sort:'new', month:'', salesQ:'', salesType:'all', loanTab:'active', creditTab:'open'};
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
const STATUS = {available:['Available','good'], reserved:['Reserved','warn'], prep:['In Service','purple'], sold:['Sold','gray']};
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

/* ---------- navigation & layout ---------- */
function navFor(){
  const S_ = S(), arrears = S_.sales.filter(s => s.sched && s.sched.arrears > 0).length;
  const lbPending = S_.sales.filter(s => !s.reserved && s.logbook !== 'transferred' && s.logbook !== 'held' && !s.legacy).length;
  const n = [];
  if(isMgr()) n.push(['dashboard', 'Dashboard', IC.home]);
  n.push(['stock', 'Cars / Inventory', IC.car]);
  if(isMgr()) n.push(['create', 'Create Car', IC.plusSq], ['logbookmgmt', 'Logbook Management', IC.book, stockCars().filter(c => c.logbook_status === 'not_received').length]);
  n.push(['sales', 'Sales', IC.cash]);
  n.push(['credit', 'Instalments', IC.wallet, arrears]);
  if(isMgr()) n.push(['loans', 'Logbook Loans', IC.key, (S_.loans || []).filter(l => l.overdue).length]);
  n.push(['logbooks', 'Logbook Transfers', IC.doc, lbPending]);
  if(isMgr()) n.push(['reports', 'Reports', IC.chart]);
  if(isOwner()) n.push(['staff', 'Staff', IC.people], ['settings', 'Settings', IC.cog], ['activity', 'Activity', IC.list]);
  return n;
}
function currentView(){ const v = location.hash.replace(/^#\/?/, ''); const nav = navFor().map(n => n[0]); return nav.includes(v) ? v : nav[0]; }
/* the client's word mark: first word white, the rest red, the town underneath */
function brandHTML(){
  const loc = (S() && S().settings.location) || App.location || '', name = App.business || 'Car yard';
  let main = name; if(loc && name.toLowerCase().endsWith(' ' + loc.toLowerCase())) main = name.slice(0, -loc.length - 1);
  const w = main.split(/\s+/);
  return `<div class="brand"><span class="brand-arc"></span><span class="brand-name"><b>${esc(w[0])}</b>${w.length > 1 ? `<em>${esc(w.slice(1).join(' '))}</em>` : ''}</span>${loc ? `<span class="brand-loc">${esc(loc)}</span>` : ''}</div>`;
}
const POWERED = `<a class="powered" href="https://shilingilabs.co.ke" target="_blank" rel="noopener"><span>Powered &amp; Developed by</span><span class="sl"><img src="assets/logo-icon.png" alt=""><span><b>SHILINGI<i>LABS</i></b><small>TECH SOLUTIONS</small></span></span></a>`;
function alertsList(){
  const S_ = S(), a = [], late = S_.sales.filter(s => s.sched && s.sched.arrears > 0), lo = (S_.loans || []).filter(l => l.overdue);
  const lbMissing = stockCars().filter(c => c.logbook_status === 'not_received'), exp = S_.sales.filter(s => s.reserved && s.hold_until && s.hold_until < S_.today);
  if(late.length) a.push(['credit', `${pl(late.length, 'buyer')} behind on instalments`]);
  if(lo.length) a.push(['loans', `${pl(lo.length, 'logbook loan')} past due`]);
  if(exp.length) a.push(['sales', `${pl(exp.length, 'reservation')} past the hold date`]);
  if(isMgr() && lbMissing.length) a.push(['logbookmgmt', `${pl(lbMissing.length, 'car')} in the yard without the logbook`]);
  return a;
}
function render(){
  charts.forEach(c => c.destroy()); charts = [];
  document.title = App.business;
  const app = $('#app');
  if(!App.me){ app.innerHTML = viewLogin(); bindLogin(); return; }
  const view = currentView(), V = VIEWS[view](), nav = navFor(), cur = nav.find(n => n[0] === view), al = alertsList();
  app.innerHTML = `<div class="shell">
    <header class="hdr"><a href="#/${nav[0][0]}" class="hdr-brand">${brandHTML()}</a><span class="hdr-sep"></span>
      <div class="hdr-title"><span class="hdr-ic">${(cur && cur[2]) || IC.car}</span><div><h1>${V.title}</h1><div class="sub">${V.sub || ''}</div></div></div>
      <div class="hdr-tools"><div class="dd"><button class="bell" id="bell" aria-label="Alerts">${IC.bell}${al.length ? `<i>${al.length}</i>` : ''}</button>
          <div class="dd-menu" id="bellM" hidden>${al.length ? al.map(([k, t]) => `<a href="#/${k}">${t}</a>`).join('') : '<span class="muted">Nothing needs attention.</span>'}</div></div>
        <div class="dd"><button class="me" id="meB"><span class="avatar">${initials(App.me.name)}</span><span class="me-n">${esc(App.me.name.split(' ')[0])}</span> ▾</button>
          <div class="dd-menu" id="meM" hidden><div class="me-h"><b>${esc(App.me.name)}</b><span>${{owner:'Owner', manager:'Manager', sales:'Sales'}[App.me.role]}</span></div><a href="#" id="chpw">Change password</a><a href="#" id="logout">Sign out</a></div></div></div></header>
    <aside class="side"><nav class="nav">${nav.map(([k, l, ic, cnt]) => `<a href="#/${k}" class="${k === view ? 'on' : ''}">${ic}<span>${l}</span>${cnt ? `<span class="cnt">${cnt}</span>` : ''}</a>`).join('')}</nav>${POWERED}</aside>
    <main class="main"><div class="content">${V.tools ? `<div class="toolbar">${V.tools}</div>` : ''}${V.html}</div></main></div>`;
  const dd = (b, m) => { $(b).onclick = e => { e.stopPropagation(); const h = $(m).hidden; $$('.dd-menu').forEach(x => x.hidden = true); $(m).hidden = !h; }; };
  dd('#bell', '#bellM'); dd('#meB', '#meM'); document.onclick = () => $$('.dd-menu').forEach(x => x.hidden = true);
  $('#logout').onclick = async e => { e.preventDefault(); try { const r = await API.post('auth.logout'); API.csrf = r.csrf; } catch(err){} App.me = null; App.S = null; history.replaceState(null, '', location.pathname); render(); };
  $('#chpw').onclick = e => { e.preventDefault(); passwordModal(); };
  $$('[data-car]').forEach(b => b.onclick = e => { e.stopPropagation(); carModal(car(b.dataset.car)); });
  $$('[data-sale]').forEach(b => b.onclick = e => { e.stopPropagation(); saleModal(sale(b.dataset.sale)); });
  $$('[data-loan]').forEach(b => b.onclick = e => { e.stopPropagation(); loanModal(loan(b.dataset.loan)); });
  if(V.bind) V.bind();
}
window.addEventListener('hashchange', () => { if(App.me){ render(); window.scrollTo(0, 0); } });

/* ---------- sign in ---------- */
function viewLogin(){
  return `<div class="lg"><div class="lg-card"><div class="lg-logo">${brandHTML()}</div>
      <h1>Login</h1><p class="lg-sub">Access the ${esc(App.business.replace(/\s+\S+$/, (m) => (App.location && m.trim().toLowerCase() === App.location.toLowerCase()) ? '' : m))} system</p>
      <form id="lf" autocomplete="on"><label class="lg-in">${IC.mail}<input type="email" id="le" autocomplete="username" placeholder="Email" aria-label="Email" required></label>
        <label class="lg-in">${IC.lock}<input type="password" id="lp" autocomplete="current-password" placeholder="Password" aria-label="Password" required><button type="button" class="lg-eye" id="lpEye" aria-label="Show password">${IC.eye}</button></label>
        <div class="lg-row"><label class="lg-ck"><input type="checkbox" id="lr"> Remember me</label><a href="#" id="lgForgot">Forgot password?</a></div>
        <div class="err" id="lerr"></div><button class="btn red lg-btn">Login</button></form></div>
    <div class="lg-pow">${POWERED}</div></div>`;
}
function bindLogin(){
  $('#lpEye').onclick = () => { const p = $('#lp'), show = p.type === 'password'; p.type = show ? 'text' : 'password'; $('#lpEye').innerHTML = show ? IC.eyeOff : IC.eye; $('#lpEye').setAttribute('aria-label', show ? 'Hide password' : 'Show password'); };
  $('#lgForgot').onclick = e => { e.preventDefault(); $('#lerr').textContent = ''; modal('Forgot your password?', '<p style="margin:0">Ask the owner to set a new password for you under <b>Staff</b>. If you are the owner, contact Shilingi Labs Tech Solutions to reset it.</p>', [{label:'OK', cls:'primary'}]); };
  $('#lf').onsubmit = async e => {
    e.preventDefault(); $('#lerr').textContent = ''; const b = $('#lf .lg-btn'); b.disabled = true;
    try { const r = await API.post('auth.login', {email:$('#le').value, password:$('#lp').value, remember:$('#lr').checked}); API.csrf = r.csrf; await loadState(); location.hash = '#/' + navFor()[0][0]; render(); }
    catch(err){ $('#lerr').textContent = err.message; } finally { b.disabled = false; }
  };
}
function passwordModal(){
  modal('Change your password', `<label class="field">Current password<input type="password" id="pc"></label><label class="field">New password (8+ characters, letters and numbers)<input type="password" id="pn"></label>`,
    [{label:'Cancel'}, {label:'Change password', cls:'primary', fn:async bg => { await API.post('auth.password', {current:fv(bg, 'pc'), new:fv(bg, 'pn')}); toast('Password changed'); }}]);
}

/* ---------- shared bits ---------- */
const tile = (cls, ic, label, val, sub) => `<div class="tile ${cls}"><span class="tile-ic">${ic}</span><div><span class="tile-l">${label}</span><b class="tile-v num">${val}</b>${sub ? `<span class="tile-s">${sub}</span>` : ''}</div></div>`;
const panelH = (ic, title, right = '') => `<div class="panel-h">${ic}<h2>${title}</h2>${right ? `<div class="right">${right}</div>` : ''}</div>`;
function pager(total, page, per, key, noun){
  const pages = Math.max(1, Math.ceil(total / per)); page = Math.min(page, pages);
  if(total <= per) return total ? `<div class="pager"><span class="muted">Showing ${total} ${noun}</span></div>` : '';
  const nums = []; for(let p = 1; p <= pages; p++) if(p === 1 || p === pages || Math.abs(p - page) <= 1) nums.push(p); else if(nums[nums.length - 1] !== '…') nums.push('…');
  return `<div class="pager"><span class="muted">Showing ${(page - 1) * per + 1} – ${Math.min(total, page * per)} of ${total} ${noun}</span><div class="pg">
    <button data-${key}="${page - 1}" ${page === 1 ? 'disabled' : ''} aria-label="Previous">‹</button>${nums.map(p => p === '…' ? '<span>…</span>' : `<button data-${key}="${p}" class="${p === page ? 'on' : ''}">${p}</button>`).join('')}<button data-${key}="${page + 1}" ${page === pages ? 'disabled' : ''} aria-label="Next">›</button></div></div>`;
}
const SOURCE = {local:['Locally used', 'src-l'], import:['Fresh import', 'src-i'], tradein:['Trade-in', 'src-t']};
const srcPill = c => `<span class="pill ${(SOURCE[c.source] || SOURCE.local)[1]}">${(SOURCE[c.source] || SOURCE.local)[0]}</span>`;
const LBS = {with_us:['With Us', 'good'], not_received:['Not Yet Received', 'warn'], in_process:['In Process', 'info']};
const lbPill = st => st && LBS[st] ? `<span class="pill ${LBS[st][1]}">${LBS[st][0]}</span>` : '<span class="muted">—</span>';
const swatch = c => c.color ? `<span class="sw" style="background:${hexOf(c.color)}"></span>${esc(c.color)}` : '<span class="muted">—</span>';
const engineTxt = c => c.cc ? `${(c.cc / 1000).toFixed(1)}L` : null;
const MAKES = ['Toyota', 'Nissan', 'Mazda', 'Honda', 'Subaru', 'Mitsubishi', 'Isuzu', 'Suzuki', 'Mercedes-Benz', 'BMW', 'Volkswagen', 'Audi', 'Lexus', 'Land Rover', 'Ford', 'Hyundai', 'Kia', 'Peugeot', 'Volvo', 'Jeep', 'Daihatsu', 'Other'];
const COLOURS = ['White', 'Pearl White', 'Silver', 'Grey', 'Black', 'Blue', 'Dark Blue', 'Red', 'Wine Red', 'Maroon', 'Green', 'Champagne', 'Gold', 'Brown', 'Beige', 'Orange', 'Yellow', 'Other'];
const OFFICES = ['NTSA Eldoret', 'NTSA Nairobi', 'NTSA Mombasa', 'NTSA Kisumu', 'NTSA Nakuru', 'NTSA Thika', 'eCitizen (digital logbook)', 'Other'];
const YESNO = ['Available', 'Not available'];
const CHECKS = [['wheel_check', 'Wheel Check', YESNO], ['wheel_spanner', 'Wheel Spanner', YESNO], ['spare_wheel', 'Spare Wheel', YESNO], ['additional_spare', 'Additional Spare Wheel', YESNO],
  ['battery', 'Battery', ['Good', 'Fair', 'Weak', 'Faulty', 'None']], ['radio', 'Radio', ['Normal', 'Screen', 'Double Screen', 'System', 'Faulty', 'None']]];
const checkCls = v => /^(available|good|screen|double screen|system)$/i.test(v) ? 'good' : /^normal$/i.test(v) ? 'info' : /^(fair|weak)$/i.test(v) ? 'warn' : /^(not available|faulty|none)$/i.test(v) ? 'bad' : 'gray';
const checkTxt = v => /^\d+$/.test(v) ? `${v} (sheet code)` : v;
/* a select that keeps a value from the old sheet that isn't in the list */
const opts = (list, cur, blank) => `${blank ? `<option value="">${blank}</option>` : ''}${cur && !list.some(x => (Array.isArray(x) ? x[0] : x) === cur) ? `<option value="${esc(cur)}" selected>${esc(checkTxt(cur))}</option>` : ''}${list.map(x => { const [v, l] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}`;

/* ================= CARS / INVENTORY ================= */
function carPic(c){
  const p = c.photos[0];
  return p ? `<img src="${esc(p.thumb)}" alt="${esc(carName(c))}" loading="lazy">${c.photos.length > 1 ? `<span class="nph">${c.photos.length} photos</span>` : ''}` : carSVG(c);
}
function carCard(c){
  const d = daysIn(c);
  return `<button class="carc" data-car="${c.id}"><div class="pic">${carPic(c)}${statusPill(c)}${c.status !== 'sold' ? `<span class="age ${d > 60 ? 'old' : ''}">${d} days in yard</span>` : ''}</div>
    <div class="bd"><span class="ttl">${esc(carName(c))}</span>
      <span class="spec">${[c.mileage ? K(c.mileage) + ' km' : '', engineTxt(c), c.fuel, c.gearbox, c.color].filter(Boolean).map(x => `<span>${esc(x)}</span>`).join('')}</span>
      <span>${plateHTML(c)}</span>
      <div class="pr"><b class="num">${c.ask ? KES(c.ask) : '<span class="muted" style="font-size:13px">No price yet</span>'}</b><span>${isMgr() && c.buy ? `profit ${short(num(c.ask) - carCost(c))}` : c.floor && !isMgr() ? `lowest ${short(c.floor)}` : ''}</span></div></div></button>`;
}
const makeOf = c => c.make || 'Other';
function viewStock(){
  const all = S().cars, m = S().today.slice(0, 7), PER = 10;
  let cars = all.filter(c => ui.status === 'all' ? true : ui.status === 'stock' ? c.status !== 'sold' : c.status === ui.status);
  if(ui.make !== 'all') cars = cars.filter(c => makeOf(c) === ui.make);
  if(ui.body !== 'all') cars = cars.filter(c => c.body === ui.body);
  if(ui.q){ const q = ui.q.toLowerCase().replace(/\s/g, ''); cars = cars.filter(c => (carName(c) + (c.plate || '') + (c.color || '') + (c.chassis || '')).toLowerCase().replace(/\s/g, '').includes(q)); }
  cars.sort((a, b) => (b.in_date || '').localeCompare(a.in_date || '') || b.id - a.id);
  const pages = Math.max(1, Math.ceil(cars.length / PER)); if(ui.page > pages) ui.page = pages;
  const shown = cars.slice((ui.page - 1) * PER, ui.page * PER), makes = [...new Set(all.map(makeOf))].sort();
  const act = (c) => `<div class="acts"><button class="ia" data-car="${c.id}" title="View">${IC.eye}</button>${isMgr() ? `<button class="ia" data-edit="${c.id}" title="Edit">${IC.edit}</button><button class="ia" data-dup="${c.id}" title="Duplicate">${IC.copy}</button>` : ''}${isOwner() && c.status !== 'sold' && !saleOf(c.id) ? `<button class="ia del" data-del="${c.id}" title="Remove">${IC.trash}</button>` : ''}</div>`;
  return {title:'Cars / Inventory', sub:'Manage your vehicle stock, pricing and status',
    html:`<div class="tiles t5">${tile('t-red', IC.car, 'Total Cars', all.length, `${stockCars().length} in the yard`)}${tile('t-green', IC.car, 'Available', all.filter(c => c.status === 'available').length)}
      ${tile('t-amber', IC.hand, 'Reserved', all.filter(c => c.status === 'reserved').length)}${tile('t-blue', IC.tag, 'Sold (This Month)', S().sales.filter(s => !s.reserved && (s.date || '').startsWith(m)).length)}${tile('t-purple', IC.tools, 'In Service', all.filter(c => c.status === 'prep').length)}</div>
    <div class="panel">${panelH(IC.car, 'Cars / Inventory', `${isMgr() ? `<button class="btn ghost-w" id="csvStock">${IC.dl} Export</button><a class="btn red-w" href="#/create" id="addCar">${IC.plus} Add New Car</a>` : ''}`)}
      <div class="filters fl-inv"><label class="search">${IC.search}<input type="search" id="fQ" value="${esc(ui.q)}" placeholder="Search by plate, make, model or chassis no."></label>
        <select id="fS" aria-label="Status">${[['all', 'All Status'], ['stock', 'In the yard'], ['available', 'Available'], ['reserved', 'Reserved'], ['prep', 'In Service'], ['sold', 'Sold']].map(([v, l]) => `<option value="${v}" ${ui.status === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <select id="fM" aria-label="Make"><option value="all">All Makes</option>${makes.map(x => `<option ${ui.make === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
        <select id="fB" aria-label="Body type"><option value="all">All Body Types</option>${Object.entries(BODYNAME).map(([v, l]) => `<option value="${v}" ${ui.body === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <button class="btn" id="fR">${IC.reset} Reset</button></div>
      <div class="tbl-wrap"><table class="tbl inv cars-t"><thead><tr><th>#</th><th>Photo</th><th>Plate</th><th>Make &amp; Model</th><th>Year</th><th>Colour</th><th class="r">Mileage (km)</th><th>Source</th><th class="r">Asking Price (KES)</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      ${shown.map((c, i) => `<tr class="click" data-car="${c.id}"><td class="muted">${(ui.page - 1) * PER + i + 1}</td><td><span class="thumb">${c.photos[0] ? `<img src="${esc(c.photos[0].thumb)}" alt="" loading="lazy">` : carSVG(c)}</span></td>
        <td><b class="nw">${esc(c.plate || '—')}</b></td><td>${esc([c.make, c.model].filter(Boolean).join(' '))}</td><td>${c.year || '—'}</td><td class="nw">${swatch(c)}</td><td class="r num">${c.mileage ? K(c.mileage) : '—'}</td>
        <td>${srcPill(c)}</td><td class="r num"><b>${c.ask ? K(c.ask) : '—'}</b></td><td>${statusPill(c)}</td><td>${act(c)}</td></tr>`).join('') || '<tr><td colspan="11" class="empty">No cars match.</td></tr>'}</tbody></table></div>
      ${pager(cars.length, ui.page, PER, 'pg', 'cars')}</div>`,
    bind(){
      const re = () => { ui.page = 1; render(); };
      $('#fS').onchange = e => { ui.status = e.target.value; re(); };
      $('#fM').onchange = e => { ui.make = e.target.value; re(); };
      $('#fB').onchange = e => { ui.body = e.target.value; re(); };
      $('#fR').onclick = () => { Object.assign(ui, {status:'all', make:'all', body:'all', q:''}); re(); };
      let t; $('#fQ').oninput = e => { clearTimeout(t); t = setTimeout(() => { ui.q = e.target.value; ui.page = 1; render(); const q = $('#fQ'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 250); };
      $$('[data-pg]').forEach(b => b.onclick = () => { ui.page = +b.dataset.pg; render(); });
      $$('[data-edit]').forEach(b => b.onclick = e => { e.stopPropagation(); openCarForm({edit:+b.dataset.edit}); });
      $$('[data-dup]').forEach(b => b.onclick = e => { e.stopPropagation(); openCarForm({dup:+b.dataset.dup}); });
      $$('[data-del]').forEach(b => b.onclick = e => { e.stopPropagation(); const c = car(b.dataset.del); confirmBox('Remove this car?', `${esc(carName(c))} ${esc(c.plate || '')} will be removed from stock. The record is kept in the activity log.`, 'Remove', async why => { await API.post('cars.delete', {id:c.id, reason:why}); await refresh('Car removed'); }, true); });
      if($('#addCar')) $('#addCar').onclick = e => { e.preventDefault(); openCarForm({}); };
      if($('#csvStock')) $('#csvStock').onclick = () => csvDownload(`stock-${S().today}.csv`, [['Plate', 'Make', 'Model', 'Year', 'Body', 'Colour', 'Mileage', 'Source', 'Status', 'In yard since', 'Days', 'Asking', 'Lowest', 'Bought for', 'Costs', 'Logbook', 'Logbook no.', 'Photos'],
        ...all.map(c => [c.plate, c.make, c.model, c.year, BODYNAME[c.body], c.color, c.mileage, (SOURCE[c.source] || [''])[0], STATUS[c.status][0], c.in_date, daysIn(c), c.ask, c.floor, c.buy, sum((c.costs || []).map(x => x.amount)), c.logbook_status ? LBS[c.logbook_status][0] : '', c.logbook_no, c.photos.length])]);
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

/* ---------- vehicle details ---------- */
const STEPS = [['added', 'Car Added', IC.check, 's-green'], ['logbook', 'Logbook Received', IC.book, 's-purple'], ['price', 'Price Updated', IC.tag, 's-blue'], ['reserved', 'Reserved', IC.hand, 's-amber'], ['sold', 'Sold', IC.car, 's-gray']];
function vehicleSheet(c){   // printable details (asking price only: buying price and lowest price stay internal)
  const st = S().settings, ck = CHECKS.filter(([k]) => c.inspection && c.inspection[k]);
  return `<div class="doc"><h2>Vehicle details</h2><div class="c" style="font-size:12px">${esc(st.business_name)}${st.location ? ' · ' + esc(st.location) : ''}${st.phone ? ' · ' + esc(st.phone) : ''}</div>
    ${c.photos[0] ? `<p class="c"><img src="${esc(c.photos[0].url)}" alt="" style="max-width:100%;max-height:300px;border-radius:6px"></p>` : ''}
    <table><tbody><tr><td>Vehicle</td><td><b>${esc([c.make, c.model].filter(Boolean).join(' '))}</b></td></tr><tr><td>Registration</td><td>${esc(c.plate || '—')}</td></tr>
    <tr><td>Year of manufacture</td><td>${c.year || '—'}</td></tr><tr><td>Body / colour</td><td>${esc(BODYNAME[c.body])} · ${esc(c.color || '—')}</td></tr>
    <tr><td>Engine / fuel / gearbox</td><td>${[engineTxt(c), c.fuel, c.gearbox].filter(Boolean).map(esc).join(' · ') || '—'}</td></tr><tr><td>Mileage</td><td>${c.mileage ? K(c.mileage) + ' km' : '—'}</td></tr>
    <tr><td>Chassis no.</td><td>${esc(c.chassis || '—')}</td></tr><tr><td>Source</td><td>${(SOURCE[c.source] || SOURCE.local)[0]}</td></tr>
    ${ck.map(([k, l]) => `<tr><td>${l}</td><td>${esc(checkTxt(c.inspection[k]))}</td></tr>`).join('')}
    <tr><td>Logbook</td><td>${c.logbook_status ? LBS[c.logbook_status][0] : '—'}</td></tr><tr><td>Asking price</td><td><b>${c.ask ? KES(c.ask) : '—'}</b></td></tr></tbody></table>
    <p style="font-size:11px;color:#555">Printed ${fmtD(S().today)}. Price and availability may change.</p></div>`;
}
function carModal(c){
  const mgr = isMgr(), s = ['sold', 'reserved'].includes(c.status) ? saleOf(c.id) : null, cost = carCost(c);
  const L = [[IC.cal, 'Year of Manufacture', c.year], [IC.palette, 'Colour', c.color], [IC.fuel, 'Fuel', c.fuel], [IC.cog, 'Gearbox', c.gearbox], [IC.engine, 'Engine', engineTxt(c) ? `${engineTxt(c)} (${K(c.cc)} cc)` : null], [IC.barcode, 'Chassis No.', c.chassis]];
  const R = [[IC.car, 'Make', c.make], [IC.layers, 'Model', c.model], [IC.car, 'Body', BODYNAME[c.body]], [IC.gauge, 'Mileage', c.mileage ? K(c.mileage) + ' km' : null], [IC.swap, 'Source', (SOURCE[c.source] || SOURCE.local)[0]], [IC.book, 'Logbook Status', c.logbook_status ? LBS[c.logbook_status][0] : null]];
  const spec = rows => rows.map(([ic, l, v]) => `<div class="sp">${ic}<span>${l}:</span><b>${esc(v ?? '—')}</b></div>`).join('');
  const ck = CHECKS.filter(([k]) => c.inspection && c.inspection[k]);
  const body = `<div class="vd-top"><div class="vd-gal">${gallery(c)}
      <div class="ph-tools"><label class="btn sm">${IC.cam} Add photos<input type="file" id="phF" accept="image/jpeg,image/png,image/webp" multiple hidden></label>
      ${mgr && c.photos.length ? `<button class="btn sm" id="phCover">Make cover</button><button class="btn sm danger" id="phDel">Delete photo</button>` : ''}<span class="muted" id="phMsg" style="font-size:12px"></span></div></div>
    <div class="vd-info"><div class="vd-head"><div><h2>${esc([c.make, c.model].filter(Boolean).join(' '))}</h2>${c.plate ? `<span class="plate-red">${esc(c.plate)}</span>` : ''}</div><span class="st-big ${STATUS[c.status][1]}">${IC.check}${STATUS[c.status][0]}</span></div>
      <div class="vd-specs"><div>${spec(L)}</div><div>${spec(R)}</div></div>
      ${mgr && c.status === 'prep' ? '<button class="btn sm good" id="stAv">Mark as available</button>' : mgr && c.status === 'available' ? '<button class="btn sm" id="stPr">Move to In Service</button>' : ''}</div></div>
    <div class="vd-boxes"><div class="box">${panelH(IC.clip, 'Vehicle Checks &amp; Condition')}<div class="box-b">${ck.length ? ck.map(([k, l]) => `<div class="ckr"><span>${l}</span><span class="pill ${checkCls(c.inspection[k])}">${esc(checkTxt(c.inspection[k]))}</span></div>`).join('') : '<span class="muted">Not recorded.</span>'}</div></div>
      <div class="box">${panelH(IC.layers, 'Pricing (KES)')}<div class="box-b pr-b"><div class="prr"><span>Asking Price</span><b class="num">${c.ask ? K(c.ask) : '—'}</b></div><div class="prr"><span>Lowest Price</span><b class="num">${c.floor ? K(c.floor) : '—'}</b></div>
        ${mgr ? `<div class="prr"><span>Bought For</span><b class="num">${c.buy != null ? K(c.buy) : '—'}</b></div>${(c.costs || []).length ? `<div class="prr sm"><span>+ Costs (${c.costs.length})</span><b class="num">${K(cost - num(c.buy))}</b></div>` : ''}
        <div class="prr tot"><span>${s && !s.reserved && s.price ? 'Profit on sale' : 'Profit at asking'}</span><b class="num">${c.buy == null ? '—' : K((s && !s.reserved && s.price ? s.price : num(c.ask)) - cost)}</b></div>
        <button class="btn sm" id="cmCost">${IC.plus} Add a cost</button>${(c.costs || []).length ? ` <button class="btn sm" id="cmCosts">Costs</button>` : ''}` : ''}</div></div>
      <div class="box">${panelH(IC.book, 'Logbook Information')}<div class="box-b">${mgr ? `<div class="lbr"><span>Logbook No.</span><b>${esc(c.logbook_no || '—')}</b></div><div class="lbr"><span>Date Received</span><b>${fmtD(c.logbook_date)}</b></div>
        <div class="lbr"><span>Issuing Office</span><b>${esc(c.logbook_office || '—')}</b></div><div class="lbr"><span>Remarks</span><b>${esc(c.logbook_remarks || '—')}</b></div>
        ${c.logbook_file ? `<a class="btn sm" href="api/?r=logbooks.file&car_id=${c.id}" target="_blank" rel="noopener">${IC.doc} View logbook scan</a>` : ''}` : `<div class="lbr"><span>Status</span>${lbPill(c.logbook_status)}</div>`}</div></div></div>
    <div class="box hist">${panelH(IC.clock, 'Vehicle History')}<div class="tl" id="vdTl">${STEPS.map(([k, l, ic, cl]) => `<div class="tl-s ${cl}" data-st="${k}"><span class="tl-ic">${ic}</span><b>${l}</b><span class="tl-d">…</span></div>`).join('')}</div></div>
    ${s ? `<div class="hint">${s.reserved ? 'Reserved' : 'Sold'} to <b>${esc(s.buyer_name || 'buyer not recorded')}</b> · ${DEAL[s.type]}${s.date ? ' · ' + fmtD(s.date) : ''}${s.reserved && s.hold_until ? ` · hold until ${fmtD(s.hold_until)}` : ''} <a href="#" id="openSale">Open the sale</a></div>` : ''}
    ${daysIn(c) > 60 && c.status !== 'sold' ? `<div class="hint warn">In the yard ${daysIn(c)} days. Consider a price drop or featuring it in adverts.</div>` : ''}
    ${c.notes ? `<div class="muted" style="font-size:12px">${esc(c.notes)}</div>` : ''}`;
  const acts = [{label:`${IC.print} Print Details`, fn:() => { printHTML(vehicleSheet(c)); return false; }}, {label:`${IC.dl} Download (PDF)`, fn:() => { toast('Choose “Save as PDF” as the printer to download it.'); printHTML(vehicleSheet(c)); return false; }}];
  if(mgr) acts.push({label:`${IC.edit} Edit Car`, fn:() => openCarForm({edit:c.id})});
  if(c.status === 'reserved') acts.push({label:'Complete sale', cls:'primary', fn:() => saleWizard(c, s)});
  else if(['available', 'prep'].includes(c.status)) acts.push({label:'Reserve / sell', cls:'primary', fn:() => saleWizard(c)});
  else if(s) acts.push({label:`${IC.doc} Sale agreement`, fn:() => agreementModal(s)});
  acts.push({label:`${IC.car} Close`, cls:'red'});
  const bg = modal(`${IC.car} Vehicle Details`, body, acts, 'xwide');
  const cur = bindGallery(bg, c);
  API.get('cars.history', {id:c.id}).then(h => h.steps.forEach(x => { const el = $(`[data-st="${x.k}"]`, bg); if(!el) return; el.classList.toggle('done', !!x.date); $('.tl-d', el).textContent = x.date ? fmtD(x.date) : '—'; })).catch(() => $$('.tl-d', bg).forEach(x => x.textContent = '—'));
  $('#phF', bg).onchange = async e => {
    const files = [...e.target.files]; if(!files.length) return;
    $('#phMsg', bg).textContent = `Uploading ${pl(files.length, 'photo')}…`;
    try {
      for(let i = 0; i < files.length; i += 5){ const fd = new FormData(); fd.append('car_id', c.id); files.slice(i, i + 5).forEach(f => fd.append('photos[]', f)); await API.upload('photos.upload', fd); $('#phMsg', bg).textContent = `Uploaded ${Math.min(i + 5, files.length)} of ${files.length}…`; }
      bg._close(); await refresh(`${pl(files.length, 'photo')} added`); carModal(car(c.id));
    } catch(err){ $('#phMsg', bg).textContent = err.message; }
  };
  const again = async msg => { bg._close(); await refresh(msg); carModal(car(c.id)); };
  if($('#phCover', bg)) $('#phCover', bg).onclick = async () => { try { await API.post('photos.cover', {id:cur().id}); await again('Cover photo set'); } catch(e){ toast(e.message, 1); } };
  if($('#phDel', bg)) $('#phDel', bg).onclick = () => confirmBox('Delete this photo?', 'The photo will be deleted from the server.', 'Delete', async () => { await API.post('photos.delete', {id:cur().id}); await again('Photo deleted'); });
  if($('#stAv', bg)) $('#stAv', bg).onclick = async () => { try { await API.post('cars.status', {id:c.id, status:'available'}); await again('Now available for sale'); } catch(e){ toast(e.message, 1); } };
  if($('#stPr', bg)) $('#stPr', bg).onclick = async () => { try { await API.post('cars.status', {id:c.id, status:'prep'}); await again('Moved to In Service'); } catch(e){ toast(e.message, 1); } };
  if($('#cmCost', bg)) $('#cmCost', bg).onclick = () => { bg._close(); costModal(c); };
  if($('#cmCosts', bg)) $('#cmCosts', bg).onclick = () => costsList(c);
  if($('#openSale', bg)) $('#openSale', bg).onclick = e => { e.preventDefault(); bg._close(); saleModal(s); };
}
function costsList(c){
  const bg = modal(`Costs · ${esc(carName(c))}`, `<table class="tbl"><tbody><tr><td>Bought for</td><td class="muted nw">${fmtD(c.in_date)}</td><td class="r num">${c.buy != null ? K(c.buy) : '—'}</td><td></td></tr>
    ${(c.costs || []).map(x => `<tr><td>${esc(x.category)}${x.description ? ' — ' + esc(x.description) : ''}</td><td class="muted nw">${fmtD(x.date)}</td><td class="r num">${K(x.amount)}</td><td><button class="btn sm danger" data-dc="${x.id}">×</button></td></tr>`).join('')}
    <tr><td><b>Total cost</b></td><td></td><td class="r num"><b>${K(carCost(c))}</b></td><td></td></tr></tbody></table>`, [{label:'Close'}]);
  $$('[data-dc]', bg).forEach(b => b.onclick = () => confirmBox('Remove this cost?', 'It will be taken off this car.', 'Remove', async () => { await API.post('costs.delete', {id:+b.dataset.dc}); bg._close(); $$('.modal-bg').forEach(x => x._close && x._close()); await refresh('Cost removed'); carModal(car(c.id)); }));
}
function costModal(c){
  modal(`Add a cost · ${esc(carName(c))}`, `<div class="form-grid"><label class="field">Type<select id="xc">${S().cost_types.map(t => `<option>${t}</option>`).join('')}</select></label><label class="field">Amount (KES)<input type="number" id="xa" min="1"></label>
    <label class="field">Date<input type="date" id="xd" value="${S().today}" max="${S().today}"></label><label class="field">Details (optional)<input id="xn" placeholder="e.g. 4 new tyres"></label></div>`,
    [{label:'Cancel'}, {label:'Add cost', cls:'primary', fn:async bg => { await API.post('costs.add', {car_id:c.id, category:fv(bg, 'xc'), amount:fv(bg, 'xa'), date:fv(bg, 'xd'), description:fv(bg, 'xn')}); await refresh('Cost added'); carModal(car(c.id)); }}]);
}

/* ================= CREATE / EDIT CAR (full page) ================= */
const DRAFT_KEY = 'gari.carDraft';
const draftGet = () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch(e){ return null; } };
const draftSet = v => { try { v ? localStorage.setItem(DRAFT_KEY, JSON.stringify(v)) : localStorage.removeItem(DRAFT_KEY); } catch(e){} };
function openCarForm(o){ ui.form = o; if(location.hash === '#/create') render(); else location.hash = '#/create'; window.scrollTo(0, 0); }
function viewCreate(){
  const f = ui.form || {}, src = f.edit ? car(f.edit) : f.dup ? car(f.dup) : null, editing = !!f.edit && src;
  let e = src ? {...src, inspection:{...(src.inspection || {})}} : {body:'', source:'local', inspection:{wheel_check:'Available', wheel_spanner:'Available', spare_wheel:'Available', additional_spare:'Not available', battery:'Good', radio:'Normal'}, in_date:S().today, logbook_status:'with_us', status:'available'};
  if(f.dup && src) Object.assign(e, {id:null, plate:'', chassis:'', logbook_no:'', logbook_date:'', logbook_remarks:'', logbook_file:false, in_date:S().today, status:'available', buy:src.buy, mileage:''});
  const draft = !editing && !f.dup ? draftGet() : null; if(draft) e = draft;
  const i = e.inspection || {}, req = editing ? '' : '<i class="req">*</i>', row = (ic, l, ctl, r = true) => `<div class="fr">${ic ? `<span class="fr-ic">${ic}</span>` : ''}<label>${l}${r ? req : ''}</label>${ctl}</div>`;
  const yrs = []; for(let y = +S().today.slice(0, 4) + 1; y >= 1980; y--) yrs.push(String(y));
  return {title:editing ? 'Edit Car' : 'Create Car', sub:editing ? `${esc(carName(src))} · ${esc(src.plate || '')}` : 'Add a new vehicle to the inventory',
    html:`${draft ? '<div class="hint">A saved draft was restored. <a href="#" id="dropDraft">Discard it</a></div>' : ''}${f.dup && src ? `<div class="hint">Copied from ${esc(carName(src))}. Enter the plate, chassis and logbook of the new car.</div>` : ''}
    <form id="cf" class="cf3" autocomplete="off">
      <div class="panel">${panelH(IC.clip, editing ? 'Edit Car' : 'Create Car')}
        <div class="sec-h">Section 1: Vehicle Checks &amp; Condition</div>
        ${CHECKS.map(([k, l, list]) => row('', l, `<select id="i_${k}">${opts(list, i[k] || '', '—')}</select>`, false)).join('')}
        ${row('', 'In the yard since', `<input type="date" id="cIn" value="${esc(e.in_date)}" max="${S().today}">`)}
        ${row('', 'Source', `<select id="cSr">${opts([['local', 'Locally used'], ['import', 'Fresh import'], ['tradein', 'Trade-in']], e.source)}</select>`)}
        ${e.status === 'available' || e.status === 'prep' || !editing ? row('', 'Status', `<select id="cSt">${opts([['available', 'Available for sale'], ['prep', 'In Service (not yet on sale)']], e.status === 'prep' ? 'prep' : 'available')}</select>`) : ''}
        <div class="sec-h">Section 2: Pricing</div>
        ${row('', 'Asking Price (KES)', `<input type="number" id="cAs" min="0" value="${esc(e.ask ?? '')}" placeholder="Enter asking price">`)}
        ${row('', 'Lowest Price (KES)', `<input type="number" id="cFl" min="0" value="${esc(e.floor ?? '')}" placeholder="Enter lowest price">`, false)}
        ${row('', 'Bought For (KES)', `<input type="number" id="cBy" min="0" value="${esc(e.buy ?? '')}" placeholder="Enter purchase price">`, false)}
        <label class="field" style="margin-top:8px">Notes<textarea id="cNo" placeholder="Optional">${esc(e.notes || '')}</textarea></label></div>
      <div class="panel">${panelH(IC.car, 'More Details')}<div class="frs">
        ${row(IC.car, 'Make', `<select id="cMk">${opts(MAKES, e.make || '', 'Select make')}</select>`)}
        ${row(IC.layers, 'Model', `<input id="cMd" value="${esc(e.model || '')}" placeholder="Enter model">`)}
        ${row(IC.plate, 'Plate', `<input id="cPl" value="${esc(e.plate || '')}" placeholder="Enter registration number">`)}
        ${row(IC.cal, 'Year of Manufacture', `<select id="cYr">${opts(yrs, e.year ? String(e.year) : '', 'Select year')}</select>`)}
        ${row(IC.car, 'Body', `<select id="cBd">${opts(Object.entries(BODYNAME), e.body || '', 'Select body type')}</select>`)}
        ${row(IC.palette, 'Colour', `<select id="cCo">${opts(COLOURS, e.color || '', 'Select colour')}</select>`)}
        ${row(IC.gauge, 'Mileage', `<input type="number" id="cMi" min="0" value="${esc(e.mileage ?? '')}" placeholder="Enter mileage (e.g. 85,000)">`, false)}
        ${row(IC.engine, 'Engine', `<input id="cEn" value="${esc(e.engine ?? (e.cc ? (e.cc / 1000).toFixed(1) + 'L' : ''))}" placeholder="Enter engine (e.g. 2.0L)">`, false)}
        ${row(IC.fuel, 'Fuel', `<select id="cFu">${opts(['Petrol', 'Diesel', 'Hybrid', 'Electric'], e.fuel || '', 'Select fuel type')}</select>`)}
        ${row(IC.cog, 'Gearbox', `<select id="cGb">${opts(['Automatic', 'Manual'], e.gearbox || '', 'Select gearbox')}</select>`)}
        ${row(IC.barcode, 'Chassis No.', `<input id="cCh" value="${esc(e.chassis || '')}" placeholder="Enter chassis number">`, false)}</div></div>
      <div class="panel">${panelH(IC.book, 'Logbook Management')}
        ${row('', 'Logbook Status', `<select id="lSt">${opts(Object.entries(LBS).map(([k, v]) => [k, v[0].replace(/\b\w/g, x => x.toUpperCase())]), e.logbook_status || '', '—')}</select>`)}
        <div class="sub-box"><div class="sub-h">${IC.doc} Logbook Details</div>
          ${row('', 'Logbook No.', `<input id="lNo" value="${esc(e.logbook_no || '')}" placeholder="Enter logbook number">`, false)}
          ${row('', 'Logbook Date', `<input type="date" id="lDt" value="${esc(e.logbook_date || '')}" max="${S().today}">`, false)}
          ${row('', 'Issuing Office', `<select id="lOf">${opts(OFFICES, e.logbook_office || '', 'Select office')}</select>`, false)}
          ${row('', 'Remarks', `<textarea id="lRm" placeholder="Enter remarks (optional)">${esc(e.logbook_remarks || '')}</textarea>`, false)}</div>
        <label class="drop">${IC.upload}<b>Upload Logbook (Scan / Photo)</b><span>PNG, JPG or PDF (Max 5 MB)</span><span class="btn sm red-o">${IC.upload} Choose File</span>
          <input type="file" id="lFile" accept="application/pdf,image/jpeg,image/png" hidden><span class="drop-f" id="lFn">${editing && src.logbook_file ? 'A scan is on file. Choose a file to replace it.' : 'No file selected'}</span></label></div>
      <div class="cf-acts"><button type="button" class="btn" id="cfDraft">${IC.reset} Save Draft</button><button type="button" class="btn" id="cfCancel">Cancel</button><button type="submit" class="btn red big" id="cfSave">${IC.save} Save Car</button><div class="err" id="cfErr"></div></div>
    </form>`,
    bind(){
      const g = id => fv(document, id);
      const collect = () => { const inspection = {}; CHECKS.forEach(([k]) => inspection[k] = g('i_' + k)); return {make:g('cMk'), model:g('cMd'), plate:g('cPl'), year:g('cYr'), body:g('cBd'), color:g('cCo'), mileage:g('cMi'), engine:g('cEn'),
        fuel:g('cFu'), gearbox:g('cGb'), chassis:g('cCh'), source:g('cSr'), in_date:g('cIn'), ask:g('cAs'), floor:g('cFl'), buy:g('cBy'), notes:g('cNo'), inspection, status:g('cSt'),
        logbook_status:g('lSt'), logbook_no:g('lNo'), logbook_date:g('lDt'), logbook_office:g('lOf'), logbook_remarks:g('lRm')}; };
      $('#lFile').onchange = e => { const x = e.target.files[0]; $('#lFn').textContent = x ? `${x.name} · ${(x.size / 1048576).toFixed(1)} MB` : 'No file selected'; if(x && x.size > 5 * 1048576){ toast('The logbook file is over 5 MB.', 1); e.target.value = ''; $('#lFn').textContent = 'No file selected'; } };
      if($('#dropDraft')) $('#dropDraft').onclick = ev => { ev.preventDefault(); draftSet(null); render(); };
      $('#cfDraft').onclick = () => { if(editing){ toast('Drafts are for new cars. Save your changes instead.'); return; } draftSet(collect()); toast('Draft saved on this device'); };
      $('#cfCancel').onclick = () => { ui.form = null; location.hash = '#/stock'; };
      $('#cf').onsubmit = async ev => {
        ev.preventDefault(); $('#cfErr').textContent = ''; const b = $('#cfSave'); b.disabled = true;
        try {
          const d = collect(), body = {...d, id:editing ? src.id : null, ready:d.status !== 'prep', featured:editing ? src.featured : false};
          const r = await API.post('cars.save', body);
          if(editing && d.status && d.status !== src.status && ['available', 'prep'].includes(src.status)) await API.post('cars.status', {id:src.id, status:d.status});
          const file = $('#lFile').files[0];
          if(file){ const fd = new FormData(); fd.append('car_id', r.id); fd.append('file', file); try { await API.upload('logbooks.upload', fd); } catch(err){ toast('The car was saved, but the logbook file was not: ' + err.message, 1); } }
          if(!editing) draftSet(null);
          ui.form = null; location.hash = '#/stock'; await refresh(editing ? 'Car saved' : 'Car added — now add its photos'); carModal(car(r.id));
        } catch(err){ $('#cfErr').textContent = err.message; toast(err.message, 1); } finally { b.disabled = false; }
      };
    }};
}

/* ================= LOGBOOK MANAGEMENT (the car's own logbook) ================= */
function viewLogbookMgmt(){
  const PER = 10, list0 = S().cars.filter(c => c.status !== 'sold' || c.logbook_status);
  let list = list0.filter(c => ui.lbSt === 'all' || (ui.lbSt === 'none' ? !c.logbook_status : c.logbook_status === ui.lbSt));
  if(ui.lbQ){ const q = ui.lbQ.toLowerCase().replace(/\s/g, ''); list = list.filter(c => ((c.plate || '') + (c.logbook_no || '') + (c.chassis || '') + carName(c)).toLowerCase().replace(/\s/g, '').includes(q)); }
  list.sort((a, b) => (a.logbook_status === 'not_received' ? 0 : 1) - (b.logbook_status === 'not_received' ? 0 : 1) || (b.in_date || '').localeCompare(a.in_date || ''));
  const pages = Math.max(1, Math.ceil(list.length / PER)); if(ui.lbPage > pages) ui.lbPage = pages;
  const shown = list.slice((ui.lbPage - 1) * PER, ui.lbPage * PER), sel = ui.lbCar ? car(ui.lbCar) : null, cnt = k => list0.filter(c => c.logbook_status === k).length;
  return {title:'Logbook Management', sub:'Manage vehicle logbooks: add, update, track status and history',
    html:`<div class="lb-grid"><div class="panel">${panelH(IC.book, 'Logbook Management')}
      <div class="tiles t4">${tile('t-red', IC.book, 'Total Vehicles', list0.length)}${tile('t-green', IC.check, 'With Us', cnt('with_us'))}${tile('t-amber', IC.clock, 'Not Yet Received', cnt('not_received'))}${tile('t-blue', IC.reset, 'In Process', cnt('in_process'))}</div>
      <div class="filters fl-inv"><label class="search">${IC.search}<input type="search" id="lbQ" value="${esc(ui.lbQ)}" placeholder="Search by plate, logbook no. or chassis no."></label>
        <select id="lbS" aria-label="Logbook status">${opts([['all', 'All Logbook Status'], ...Object.entries(LBS).map(([k, v]) => [k, v[0]]), ['none', 'Not recorded']], ui.lbSt)}</select>
        <button class="btn red" id="lbAdd">${IC.plus} Add Logbook</button></div>
      <div class="tbl-wrap"><table class="tbl inv"><thead><tr><th>#</th><th>Plate</th><th>Make &amp; Model</th><th>Logbook No.</th><th>Status</th><th>Date Received</th><th>Actions</th></tr></thead><tbody>
      ${shown.map((c, i) => `<tr class="${sel && sel.id === c.id ? 'sel' : ''}"><td class="muted">${(ui.lbPage - 1) * PER + i + 1}</td><td><b class="nw">${esc(c.plate || '—')}</b></td><td>${esc([c.make, c.model].filter(Boolean).join(' '))}</td>
        <td>${esc(c.logbook_no || '—')}</td><td>${lbPill(c.logbook_status)}</td><td class="nw">${c.logbook_status === 'with_us' && c.logbook_date ? fmtD(c.logbook_date) : '—'}</td>
        <td><div class="acts"><button class="ia" data-car="${c.id}" title="View car">${IC.eye}</button><button class="ia" data-lbe="${c.id}" title="Update logbook">${IC.edit}</button><button class="ia" data-lbh="${c.id}" title="History">${IC.clock}</button>${c.logbook_file ? `<a class="ia" href="api/?r=logbooks.file&car_id=${c.id}" target="_blank" rel="noopener" title="Logbook scan">${IC.doc}</a>` : ''}</div></td></tr>`).join('') || '<tr><td colspan="7" class="empty">No vehicles match.</td></tr>'}</tbody></table></div>
      ${pager(list.length, ui.lbPage, PER, 'lpg', 'records')}</div>
    <div class="lb-side"><div class="panel">${panelH(IC.book, 'Add / Update Logbook')}<form id="lbF" class="frs" autocomplete="off">
        <div class="fr"><span class="fr-ic">${IC.car}</span><label>Vehicle<i class="req">*</i></label><select id="fCar"><option value="">Select vehicle (Plate / Make / Model)</option>${S().cars.filter(c => c.status !== 'sold' || c.logbook_status).map(c => `<option value="${c.id}" ${sel && sel.id === c.id ? 'selected' : ''}>${esc((c.plate || 'No plate') + ' · ' + [c.make, c.model].filter(Boolean).join(' '))}</option>`).join('')}</select></div>
        <div class="fr"><span class="fr-ic">${IC.book}</span><label>Logbook No.</label><input id="fNo" value="${esc(sel ? sel.logbook_no || '' : '')}" placeholder="Enter logbook number"></div>
        <div class="fr"><span class="fr-ic">${IC.reset}</span><label>Logbook Status<i class="req">*</i></label><select id="fSt">${opts(Object.entries(LBS).map(([k, v]) => [k, v[0]]), sel ? sel.logbook_status || '' : '', '—')}</select></div>
        <div class="fr"><span class="fr-ic">${IC.cal}</span><label>Date Received</label><input type="date" id="fDt" max="${S().today}" value="${esc(sel ? sel.logbook_date || '' : '')}"></div>
        <div class="fr"><span class="fr-ic">${IC.office}</span><label>Issuing Office</label><select id="fOf">${opts(OFFICES, sel ? sel.logbook_office || '' : '', 'Select issuing office')}</select></div>
        <div class="fr"><span class="fr-ic">${IC.chat}</span><label>Remarks</label><textarea id="fRm" placeholder="Enter remarks (e.g. transfer, follow up, etc.)">${esc(sel ? sel.logbook_remarks || '' : '')}</textarea></div>
        <div class="fr"><span class="fr-ic">${IC.upload}</span><label>Scan / photo</label><input type="file" id="fFile" accept="application/pdf,image/jpeg,image/png"></div>
        <div class="err" id="fErr"></div><div class="lb-acts"><button type="button" class="btn" id="fClr">${IC.reset} Clear</button><button class="btn red big">${IC.save} Save Logbook</button></div></form></div>
      <div class="panel">${panelH(IC.clock, 'Logbook History')}<div id="lbHist">${sel ? '<div class="muted">Loading…</div>' : '<div class="muted" style="padding:6px 2px">Choose a vehicle to see its logbook history.</div>'}</div></div></div></div>`,
    bind(){
      $('#lbS').onchange = e => { ui.lbSt = e.target.value; ui.lbPage = 1; render(); };
      let t; $('#lbQ').oninput = e => { clearTimeout(t); t = setTimeout(() => { ui.lbQ = e.target.value; ui.lbPage = 1; render(); const q = $('#lbQ'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 250); };
      $$('[data-lpg]').forEach(b => b.onclick = () => { ui.lbPage = +b.dataset.lpg; render(); });
      $$('[data-lbe],[data-lbh]').forEach(b => b.onclick = () => { ui.lbCar = +(b.dataset.lbe || b.dataset.lbh); render(); });
      $('#lbAdd').onclick = () => { ui.lbCar = null; render(); $('#fCar').focus(); };
      $('#fCar').onchange = e => { ui.lbCar = +e.target.value || null; render(); };
      $('#fClr').onclick = () => { ui.lbCar = null; render(); };
      $('#lbF').onsubmit = async ev => {
        ev.preventDefault(); $('#fErr').textContent = '';
        try {
          const id = +fv(document, 'fCar'); if(!id) throw new Error('Choose the vehicle.');
          await API.post('logbooks.save', {car_id:id, logbook_no:fv(document, 'fNo'), logbook_status:fv(document, 'fSt'), logbook_date:fv(document, 'fDt'), logbook_office:fv(document, 'fOf'), logbook_remarks:fv(document, 'fRm')});
          const file = $('#fFile').files[0]; if(file){ if(file.size > 5 * 1048576) throw new Error('The logbook file is over 5 MB.'); const fd = new FormData(); fd.append('car_id', id); fd.append('file', file); await API.upload('logbooks.upload', fd); }
          ui.lbCar = id; await refresh('Logbook saved');
        } catch(err){ $('#fErr').textContent = err.message; }
      };
      if(sel) API.get('logbooks.history', {car_id:sel.id}).then(h => { const box = $('#lbHist'); if(!box) return;
        box.innerHTML = h.length ? `<table class="tbl"><thead><tr><th>Date</th><th>Status</th><th>Remarks</th><th>Updated By</th></tr></thead><tbody>${h.map(x => `<tr><td class="nw">${fmtD(x.date)}</td><td>${lbPill(x.status)}</td><td>${esc(x.remarks || '')}</td><td>${esc(x.name || 'System')}</td></tr>`).join('')}</tbody></table>` : '<div class="muted">No history yet.</div>';
      }).catch(err => { if($('#lbHist')) $('#lbHist').innerHTML = `<div class="err">${esc(err.message)}</div>`; });
    }};
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
    ${noPrice || noPhoto ? `<div class="hint">${noPrice ? `${pl(noPrice, 'car')} in the yard ${noPrice === 1 ? 'has' : 'have'} no asking price. ` : ''}${noPhoto ? `${pl(noPhoto, 'car')} ${noPhoto === 1 ? 'has' : 'have'} no photos.` : ''} <a href="#/stock">Open Cars / Inventory</a></div>` : ''}
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
  return {title:'Logbook Transfers', sub:`${pl(list.length, 'logbook')} not yet transferred to the buyer`,
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

const VIEWS = {dashboard:viewDashboard, stock:viewStock, create:viewCreate, logbookmgmt:viewLogbookMgmt, sales:viewSales, credit:viewCredit, loans:viewLoans, logbooks:viewLogbooks, reports:viewReports, staff:viewStaff, settings:viewSettings, activity:viewActivity};

/* ---------- start ---------- */
(async () => {
  if(window.Chart){ Chart.defaults.font.family = 'Inter, system-ui, sans-serif'; Chart.defaults.font.size = 12; Chart.defaults.color = '#5E6A7D'; }
  try { const m = await API.refresh(); App.business = m.business; App.location = m.location || ''; if(m.user){ await loadState(); } }
  catch(e){ $('#app').innerHTML = `<div class="loading">${esc(e.message)} <a href="">Try again</a></div>`; return; }
  render();
})();
