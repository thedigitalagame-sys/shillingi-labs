/* ---------- drawn car (when there is no photo yet) ---------- */
const BODY = {
  hatch: {
    b: 'M18 62 L20 50 Q22 44 32 42 L58 38 L78 22 Q82 19 90 19 L136 19 Q144 19 148 25 L160 44 L176 47 Q184 49 184 56 L184 64 Q184 68 178 68 L24 68 Q18 68 18 62 Z',
    w: 'M66 40 L82 25 Q85 23 90 23 L110 23 L110 40 Z M114 23 L136 23 Q141 23 144 28 L154 41 L114 41 Z',
    wh: [52, 150],
  },
  sedan: {
    b: 'M10 62 L12 51 Q14 45 26 43 L58 39 L80 24 Q85 21 93 21 L128 21 Q137 21 143 27 L158 40 L184 43 Q194 45 194 54 L194 64 Q194 68 188 68 L16 68 Q10 68 10 62 Z',
    w: 'M68 40 L84 27 Q87 25 93 25 L110 25 L110 40 Z M114 25 L128 25 Q134 25 139 30 L149 40 L114 41 Z',
    wh: [48, 158],
  },
  wagon: {
    b: 'M10 62 L12 51 Q14 45 26 43 L58 39 L80 24 Q85 21 93 21 L176 21 Q182 21 184 27 L188 42 Q194 45 194 54 L194 64 Q194 68 188 68 L16 68 Q10 68 10 62 Z',
    w: 'M68 40 L84 27 Q87 25 93 25 L112 25 L112 40 Z M116 25 L144 25 L144 41 L116 41 Z M148 25 L174 25 Q178 25 179 29 L182 41 L148 41 Z',
    wh: [48, 158],
  },
  suv: {
    b: 'M10 64 L11 46 Q12 40 22 38 L52 34 L72 16 Q77 12 86 12 L170 12 Q178 12 181 19 L188 38 Q194 41 194 50 L194 66 Q194 70 188 70 L16 70 Q10 70 10 64 Z',
    w: 'M62 35 L78 19 Q81 17 87 17 L110 17 L110 35 Z M114 17 L142 17 L142 36 L114 36 Z M146 17 L170 17 Q175 17 177 22 L182 36 L146 36 Z',
    wh: [46, 160],
  },
  pickup: {
    b: 'M10 64 L11 46 Q12 40 22 38 L48 34 L66 16 Q71 12 80 12 L118 12 Q124 12 125 18 L127 36 L190 36 Q195 36 195 42 L195 66 Q195 70 189 70 L16 70 Q10 70 10 64 Z',
    w: 'M56 35 L72 19 Q75 17 81 17 L96 17 L96 35 Z M100 17 L118 17 Q121 17 121 21 L122 35 L100 35 Z',
    wh: [46, 162],
  },
  van: {
    b: 'M10 64 L11 40 Q12 32 22 30 L40 28 L58 12 Q63 8 72 8 L180 8 Q188 8 190 16 L194 40 L194 66 Q194 70 188 70 L16 70 Q10 70 10 64 Z',
    w: 'M48 29 L62 14 Q65 12 71 12 L96 12 L96 30 Z M100 12 L134 12 L134 31 L100 31 Z M138 12 L176 12 Q182 12 184 18 L186 31 L138 31 Z',
    wh: [46, 160],
  },
};
const HEX = {
  white: '#F4F6F8',
  pearl: '#ECEAE4',
  silver: '#B8BEC6',
  grey: '#6B7280',
  gray: '#6B7280',
  black: '#1F2328',
  blue: '#1E3A6B',
  red: '#C0262D',
  wine: '#7A1F2B',
  maroon: '#7A1F2B',
  green: '#24493A',
  gold: '#CDBA94',
  champagne: '#CDBA94',
  brown: '#6B4A2F',
  beige: '#D8C8A8',
};
const hexOf = (c) => {
  const k = String(c || '').toLowerCase();
  for (const w in HEX) if (k.includes(w)) return HEX[w];
  return '#B8BEC6';
};
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16),
    f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return (
    '#' +
    [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('')
  );
}
function carSVG(c) {
  const s = BODY[c.body] || BODY.sedan,
    hex = hexOf(c.color),
    dark = shade(hex, 0.72),
    light = parseInt(hex.slice(1), 16) > 0xd0d0d0;
  const wheel = (x) =>
    `<g><circle cx="${x}" cy="68" r="15" fill="#1C2024"/><circle cx="${x}" cy="68" r="8.5" fill="#C9CED6"/><circle cx="${x}" cy="68" r="3" fill="#6B7280"/></g>`;
  return `<svg viewBox="0 0 204 90" role="img" aria-label="${esc(carName(c))}"><ellipse cx="102" cy="84" rx="94" ry="5" fill="rgba(15,23,42,.14)"/>
    <path d="${s.b}" fill="${hex}" stroke="${light ? '#9AA3AE' : dark}" stroke-width="1.4"/><path d="${s.w}" fill="#2A3442" opacity=".88"/>
    <path d="M24 54 L186 54" stroke="${light ? '#C2C8D0' : dark}" stroke-width="1" opacity=".7"/>
    <rect x="${s.wh[1] + 20}" y="47" width="9" height="5" rx="2" fill="#F7E7B0"/><rect x="12" y="49" width="7" height="5" rx="2" fill="#D9473B"/>${wheel(s.wh[0])}${wheel(s.wh[1])}</svg>`;
}

('use strict');
