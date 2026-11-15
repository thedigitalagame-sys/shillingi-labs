/* Shilingi Gari — car yard system (production client)
   Shilingi Labs Tech Solutions · shilingilabs.co.ke */
'use strict';

/* ---------- helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
const num = (v) => Number(v) || 0;
const sum = (a) => a.reduce((x, y) => x + num(y), 0);
const K = (n) => Math.round(num(n)).toLocaleString('en-KE');
const KES = (n) => 'KES ' + K(n);
const short = (n) => {
  n = num(n);
  const a = Math.abs(n);
  return a >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : a >= 1e4 ? Math.round(n / 1e3) + 'K' : K(n);
};
const pad = (n) => String(n).padStart(2, '0');
const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const D = (s) => new Date(String(s).slice(0, 10) + 'T12:00:00');
const fmtD = (s) =>
  s ? D(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtDs = (s) =>
  s ? D(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—';
const daysBetween = (a, b) => Math.round((D(b) - D(a)) / 864e5);
const addMonthsP = (p, n) => {
  const [y, m] = p.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
const pLabel = (p, long = true) => {
  const [y, m] = p.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', {
    month: long ? 'long' : 'short',
    year: long ? 'numeric' : '2-digit',
  });
};
const round100 = (n) => Math.round(n / 100) * 100;
const initials = (n) =>
  String(n || '?')
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
function toast(msg, bad) {
  const t = document.createElement('div');
  t.className = 'toast';
  if (bad) t.style.background = '#991B1B';
  t.innerHTML = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), bad ? 6000 : 4000);
}
function csvDownload(name, rows) {
  const text = rows
    .map((r) => r.map((x) => `"${String(x ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const b = new Blob(['﻿' + text], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 300);
}
function printHTML(html) {
  $('#print-root').innerHTML = html;
  document.body.classList.add('printing');
  setTimeout(() => window.print(), 80);
}
window.addEventListener('afterprint', () => {
  document.body.classList.remove('printing');
  $('#print-root').innerHTML = '';
});
