/* ---------- shared bits ---------- */
const tile = (cls, ic, label, val, sub) =>
  `<div class="tile ${cls}"><span class="tile-ic">${ic}</span><div><span class="tile-l">${label}</span><b class="tile-v num">${val}</b>${sub ? `<span class="tile-s">${sub}</span>` : ''}</div></div>`;
const panelH = (ic, title, right = '') =>
  `<div class="panel-h">${ic}<h2>${title}</h2>${right ? `<div class="right">${right}</div>` : ''}</div>`;
function pager(total, page, per, key, noun) {
  const pages = Math.max(1, Math.ceil(total / per));
  page = Math.min(page, pages);
  if (total <= per)
    return total
      ? `<div class="pager"><span class="muted">Showing ${total} ${noun}</span></div>`
      : '';
  const nums = [];
  for (let p = 1; p <= pages; p++)
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) nums.push(p);
    else if (nums[nums.length - 1] !== '…') nums.push('…');
  return `<div class="pager"><span class="muted">Showing ${(page - 1) * per + 1} – ${Math.min(total, page * per)} of ${total} ${noun}</span><div class="pg">
    <button data-${key}="${page - 1}" ${page === 1 ? 'disabled' : ''} aria-label="Previous">‹</button>${nums.map((p) => (p === '…' ? '<span>…</span>' : `<button data-${key}="${p}" class="${p === page ? 'on' : ''}">${p}</button>`)).join('')}<button data-${key}="${page + 1}" ${page === pages ? 'disabled' : ''} aria-label="Next">›</button></div></div>`;
}
const SOURCE = {
  local: ['Locally used', 'src-l'],
  import: ['Fresh import', 'src-i'],
  tradein: ['Trade-in', 'src-t'],
};
const srcPill = (c) =>
  `<span class="pill ${(SOURCE[c.source] || SOURCE.local)[1]}">${(SOURCE[c.source] || SOURCE.local)[0]}</span>`;
const LBS = {
  with_us: ['With Us', 'good'],
  not_received: ['Not Yet Received', 'warn'],
  in_process: ['In Process', 'info'],
};
const lbPill = (st) =>
  st && LBS[st]
    ? `<span class="pill ${LBS[st][1]}">${LBS[st][0]}</span>`
    : '<span class="muted">—</span>';
const swatch = (c) =>
  c.color
    ? `<span class="sw" style="background:${hexOf(c.color)}"></span>${esc(c.color)}`
    : '<span class="muted">—</span>';
const engineTxt = (c) => (c.cc ? `${(c.cc / 1000).toFixed(1)}L` : null);
const MAKES = [
  'Toyota',
  'Nissan',
  'Mazda',
  'Honda',
  'Subaru',
  'Mitsubishi',
  'Isuzu',
  'Suzuki',
  'Mercedes-Benz',
  'BMW',
  'Volkswagen',
  'Audi',
  'Lexus',
  'Land Rover',
  'Ford',
  'Hyundai',
  'Kia',
  'Peugeot',
  'Volvo',
  'Jeep',
  'Daihatsu',
  'Other',
];
const COLOURS = [
  'White',
  'Pearl White',
  'Silver',
  'Grey',
  'Black',
  'Blue',
  'Dark Blue',
  'Red',
  'Wine Red',
  'Maroon',
  'Green',
  'Champagne',
  'Gold',
  'Brown',
  'Beige',
  'Orange',
  'Yellow',
  'Other',
];
const OFFICES = [
  'NTSA Eldoret',
  'NTSA Nairobi',
  'NTSA Mombasa',
  'NTSA Kisumu',
  'NTSA Nakuru',
  'NTSA Thika',
  'eCitizen (digital logbook)',
  'Other',
];
const YESNO = ['Available', 'Not available'];
const CHECKS = [
  ['wheel_check', 'Wheel Check', YESNO],
  ['wheel_spanner', 'Wheel Spanner', YESNO],
  ['spare_wheel', 'Spare Wheel', YESNO],
  ['additional_spare', 'Additional Spare Wheel', YESNO],
  ['battery', 'Battery', ['Good', 'Fair', 'Weak', 'Faulty', 'None']],
  ['radio', 'Radio', ['Normal', 'Screen', 'Double Screen', 'System', 'Faulty', 'None']],
];
const checkCls = (v) =>
  /^(available|good|screen|double screen|system)$/i.test(v)
    ? 'good'
    : /^normal$/i.test(v)
      ? 'info'
      : /^(fair|weak)$/i.test(v)
        ? 'warn'
        : /^(not available|faulty|none)$/i.test(v)
          ? 'bad'
          : 'gray';
const checkTxt = (v) => (/^\d+$/.test(v) ? `${v} (sheet code)` : v);
/* a select that keeps a value from the old sheet that isn't in the list */
const opts = (list, cur, blank) =>
  `${blank ? `<option value="">${blank}</option>` : ''}${cur && !list.some((x) => (Array.isArray(x) ? x[0] : x) === cur) ? `<option value="${esc(cur)}" selected>${esc(checkTxt(cur))}</option>` : ''}${list
    .map((x) => {
      const [v, l] = Array.isArray(x) ? x : [x, x];
      return `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(l)}</option>`;
    })
    .join('')}`;

/* ================= CARS / INVENTORY ================= */
function carPic(c) {
  const p = c.photos[0];
  return p
    ? `<img src="${esc(p.thumb)}" alt="${esc(carName(c))}">${c.photos.length > 1 ? `<span class="nph">${c.photos.length} photos</span>` : ''}`
    : carSVG(c);
}
function carCard(c) {
  const d = daysIn(c);
  return `<button class="carc" data-car="${c.id}"><div class="pic">${carPic(c)}${statusPill(c)}${c.status !== 'sold' ? `<span class="age ${d > 60 ? 'old' : ''}">${d} days in yard</span>` : ''}</div>
    <div class="bd"><span class="ttl">${esc(carName(c))}</span>
      <span class="spec">${[
        c.mileage ? K(c.mileage) + ' km' : '',
        engineTxt(c),
        c.fuel,
        c.gearbox,
        c.color,
      ]
        .filter(Boolean)
        .map((x) => `<span>${esc(x)}</span>`)
        .join('')}</span>
      <span>${plateHTML(c)}</span>
      <div class="pr"><b class="num">${c.ask ? KES(c.ask) : '<span class="muted" style="font-size:13px">No price yet</span>'}</b><span>${isMgr() && c.buy ? `profit ${short(num(c.ask) - carCost(c))}` : c.floor && !isMgr() ? `lowest ${short(c.floor)}` : ''}</span></div></div></button>`;
}
const makeOf = (c) => c.make || 'Other';
function viewStock() {
  const all = S().cars,
    m = S().today.slice(0, 7),
    PER = 10;
  let cars = all.filter((c) =>
    ui.status === 'all'
      ? true
      : ui.status === 'stock'
        ? c.status !== 'sold'
        : c.status === ui.status
  );
  if (ui.make !== 'all') cars = cars.filter((c) => makeOf(c) === ui.make);
  if (ui.body !== 'all') cars = cars.filter((c) => c.body === ui.body);
  if (ui.q) {
    const q = ui.q.toLowerCase().replace(/\s/g, '');
    cars = cars.filter((c) =>
      (carName(c) + (c.plate || '') + (c.color || '') + (c.chassis || ''))
        .toLowerCase()
        .replace(/\s/g, '')
        .includes(q)
    );
  }
  cars.sort((a, b) => (b.in_date || '').localeCompare(a.in_date || '') || b.id - a.id);
  const pages = Math.max(1, Math.ceil(cars.length / PER));
  if (ui.page > pages) ui.page = pages;
  const shown = cars.slice((ui.page - 1) * PER, ui.page * PER),
    makes = [...new Set(all.map(makeOf))].sort();
  const act = (c) =>
    `<div class="acts"><button class="ia" data-car="${c.id}" title="View">${IC.eye}</button>${isMgr() ? `<button class="ia" data-edit="${c.id}" title="Edit">${IC.edit}</button><button class="ia" data-dup="${c.id}" title="Duplicate">${IC.copy}</button>` : ''}${isOwner() && c.status !== 'sold' && !saleOf(c.id) ? `<button class="ia del" data-del="${c.id}" title="Remove">${IC.trash}</button>` : ''}</div>`;
  return {
    title: 'Cars / Inventory',
    sub: 'Manage your vehicle stock, pricing and status',
    html: `<div class="tiles t5">${tile('t-red', IC.car, 'Total Cars', all.length, `${stockCars().length} in the yard`)}${tile('t-green', IC.car, 'Available', all.filter((c) => c.status === 'available').length)}
      ${tile('t-amber', IC.hand, 'Reserved', all.filter((c) => c.status === 'reserved').length)}${tile('t-blue', IC.tag, 'Sold (This Month)', S().sales.filter((s) => !s.reserved && (s.date || '').startsWith(m)).length)}${tile('t-purple', IC.tools, 'In Service', all.filter((c) => c.status === 'prep').length)}</div>
    <div class="panel">${panelH(IC.car, 'Cars / Inventory', `${isMgr() ? `<button class="btn ghost-w" id="csvStock">${IC.dl} Export</button><a class="btn red-w" href="#/create" id="addCar">${IC.plus} Add New Car</a>` : ''}`)}
      <div class="filters fl-inv"><label class="search">${IC.search}<input type="search" id="fQ" value="${esc(ui.q)}" placeholder="Search by plate, make, model or chassis no."></label>
        <select id="fS" aria-label="Status">${[
          ['all', 'All Status'],
          ['stock', 'In the yard'],
          ['available', 'Available'],
          ['reserved', 'Reserved'],
          ['prep', 'In Service'],
          ['sold', 'Sold'],
        ]
          .map(
            ([v, l]) => `<option value="${v}" ${ui.status === v ? 'selected' : ''}>${l}</option>`
          )
          .join('')}</select>
        <select id="fM" aria-label="Make"><option value="all">All Makes</option>${makes.map((x) => `<option ${ui.make === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
        <select id="fB" aria-label="Body type"><option value="all">All Body Types</option>${Object.entries(
          BODYNAME
        )
          .map(([v, l]) => `<option value="${v}" ${ui.body === v ? 'selected' : ''}>${l}</option>`)
          .join('')}</select>
        <button class="btn" id="fR">${IC.reset} Reset</button></div>
      <div class="tbl-wrap"><table class="tbl inv cars-t"><thead><tr><th>#</th><th>Photo</th><th>Plate</th><th>Make &amp; Model</th><th>Year</th><th>Colour</th><th class="r">Mileage (km)</th><th>Source</th><th class="r">Asking Price (KES)</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      ${
        shown
          .map(
            (
              c,
              i
            ) => `<tr class="click" data-car="${c.id}"><td class="muted">${(ui.page - 1) * PER + i + 1}</td><td><span class="thumb">${c.photos[0] ? `<img src="${esc(c.photos[0].thumb)}" alt="">` : carSVG(c)}</span></td>
        <td><b class="nw">${esc(c.plate || '—')}</b></td><td>${esc([c.make, c.model].filter(Boolean).join(' '))}</td><td>${c.year || '—'}</td><td class="nw">${swatch(c)}</td><td class="r num">${c.mileage ? K(c.mileage) : '—'}</td>
        <td>${srcPill(c)}</td><td class="r num"><b>${c.ask ? K(c.ask) : '—'}</b></td><td>${statusPill(c)}</td><td>${act(c)}</td></tr>`
          )
          .join('') || '<tr><td colspan="11" class="empty">No cars match.</td></tr>'
      }</tbody></table></div>
      ${pager(cars.length, ui.page, PER, 'pg', 'cars')}</div>`,
    bind() {
      const re = () => {
        ui.page = 1;
        render();
      };
      $('#fS').onchange = (e) => {
        ui.status = e.target.value;
        re();
      };
      $('#fM').onchange = (e) => {
        ui.make = e.target.value;
        re();
      };
      $('#fB').onchange = (e) => {
        ui.body = e.target.value;
        re();
      };
      $('#fR').onclick = () => {
        Object.assign(ui, { status: 'all', make: 'all', body: 'all', q: '' });
        re();
      };
      let t;
      $('#fQ').oninput = (e) => {
        clearTimeout(t);
        t = setTimeout(() => {
          ui.q = e.target.value;
          ui.page = 1;
          render();
          const q = $('#fQ');
          q.focus();
          q.setSelectionRange(q.value.length, q.value.length);
        }, 250);
      };
      $$('[data-pg]').forEach(
        (b) =>
          (b.onclick = () => {
            ui.page = +b.dataset.pg;
            render();
          })
      );
      $$('[data-edit]').forEach(
        (b) =>
          (b.onclick = (e) => {
            e.stopPropagation();
            openCarForm({ edit: +b.dataset.edit });
          })
      );
      $$('[data-dup]').forEach(
        (b) =>
          (b.onclick = (e) => {
            e.stopPropagation();
            openCarForm({ dup: +b.dataset.dup });
          })
      );
      $$('[data-del]').forEach(
        (b) =>
          (b.onclick = (e) => {
            e.stopPropagation();
            const c = car(b.dataset.del);
            confirmBox(
              'Remove this car?',
              `${esc(carName(c))} ${esc(c.plate || '')} will be removed from stock. The record is kept in the activity log.`,
              'Remove',
              async (why) => {
                await API.post('cars.delete', { id: c.id, reason: why });
                await refresh('Car removed');
              },
              true
            );
          })
      );
      if ($('#addCar'))
        $('#addCar').onclick = (e) => {
          e.preventDefault();
          openCarForm({});
        };
      if ($('#csvStock'))
        $('#csvStock').onclick = () =>
          csvDownload(`stock-${S().today}.csv`, [
            [
              'Plate',
              'Make',
              'Model',
              'Year',
              'Body',
              'Colour',
              'Mileage',
              'Source',
              'Status',
              'In yard since',
              'Days',
              'Asking',
              'Lowest',
              'Bought for',
              'Costs',
              'Logbook',
              'Logbook no.',
              'Photos',
            ],
            ...all.map((c) => [
              c.plate,
              c.make,
              c.model,
              c.year,
              BODYNAME[c.body],
              c.color,
              c.mileage,
              (SOURCE[c.source] || [''])[0],
              STATUS[c.status][0],
              c.in_date,
              daysIn(c),
              c.ask,
              c.floor,
              c.buy,
              sum((c.costs || []).map((x) => x.amount)),
              c.logbook_status ? LBS[c.logbook_status][0] : '',
              c.logbook_no,
              c.photos.length,
            ]),
          ]);
    },
  };
}

function gallery(c) {
  if (!c.photos.length)
    return `<div class="car-hero">${carSVG(c)}</div><div class="muted" style="font-size:12px">No photos yet.</div>`;
  return `<div class="gal"><div class="main"><img id="gImg" src="${esc(c.photos[0].url)}" alt="${esc(carName(c))}">${c.photos.length > 1 ? '<button class="nav-b l" id="gP" aria-label="Previous">‹</button><button class="nav-b r" id="gN" aria-label="Next">›</button>' : ''}<span class="cnt" id="gC">1 / ${c.photos.length}</span><button class="full-b" id="gFull" title="View full size">⤢ Full size</button></div>
    <div class="thumbs">${c.photos.map((p, i) => `<button data-i="${i}" class="${i ? '' : 'on'}"><img src="${esc(p.thumb)}" alt=""></button>`).join('')}</div></div>`;
}
function bindGallery(bg, c) {
  let i = 0;
  const main = $('.gal .main', bg),
    im = $('#gImg', bg);
  if (im) {
    const done = () => main.classList.remove('loading');
    im.onload = done;
    im.onerror = () => {
      done();
      main.classList.add('failed');
    };
    if (!im.complete) main.classList.add('loading');
  }
  const show = (n) => {
    if (!c.photos.length) return;
    i = (n + c.photos.length) % c.photos.length;
    main.classList.remove('failed');
    if (im.getAttribute('src') !== c.photos[i].url) {
      main.classList.add('loading');
      im.src = c.photos[i].url;
    }
    $('#gC', bg).textContent = `${i + 1} / ${c.photos.length}`;
    $$('.thumbs button', bg).forEach((b, k) => b.classList.toggle('on', k === i));
  };
  $$('.thumbs button', bg).forEach((b) => (b.onclick = () => show(+b.dataset.i)));
  if ($('#gImg', bg)) $('#gImg', bg).onclick = () => lightbox(c, i, (n) => show(n));
  if ($('#gFull', bg)) $('#gFull', bg).onclick = () => lightbox(c, i, (n) => show(n));
  if ($('#gP', bg)) {
    $('#gP', bg).onclick = () => show(i - 1);
    $('#gN', bg).onclick = () => show(i + 1);
  }
  return () => c.photos[i];
}
/* full-size photo viewer: arrows, swipe, Esc; tap the photo to zoom to its real size */
function lightbox(c, start, onChange) {
  let i = start,
    zoom = false;
  const lb = document.createElement('div');
  lb.className = 'lb';
  lb.innerHTML = `<div class="lb-top"><span id="lbC"></span><span class="spacer"></span><a id="lbO" target="_blank" rel="noopener" class="lb-btn">Open original</a><button class="lb-btn" id="lbX" aria-label="Close">✕</button></div>
    <div class="lb-stage" id="lbS"><img id="lbI" alt=""></div>${c.photos.length > 1 ? '<button class="lb-nav l" id="lbP" aria-label="Previous">‹</button><button class="lb-nav r" id="lbN" aria-label="Next">›</button>' : ''}
    <div class="lb-hint">Tap the photo to zoom · arrows or swipe for the next photo</div>`;
  const show = (n) => {
    i = (n + c.photos.length) % c.photos.length;
    zoom = false;
    lb.classList.remove('zoom');
    $('#lbI', lb).src = c.photos[i].url;
    $('#lbO', lb).href = c.photos[i].url;
    $('#lbC', lb).textContent =
      `${carName(c)}${c.plate ? ' · ' + c.plate : ''} — ${i + 1} / ${c.photos.length}`;
    if (onChange) onChange(i);
  };
  const close = () => {
    lb.remove();
    document.removeEventListener('keydown', key, true);
  };
  const key = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    } else if (e.key === 'ArrowRight') show(i + 1);
    else if (e.key === 'ArrowLeft') show(i - 1);
  };
  document.addEventListener('keydown', key, true);
  $('#lbX', lb).onclick = close;
  if ($('#lbP', lb)) {
    $('#lbP', lb).onclick = () => show(i - 1);
    $('#lbN', lb).onclick = () => show(i + 1);
  }
  $('#lbI', lb).onclick = (e) => {
    e.stopPropagation();
    zoom = !zoom;
    lb.classList.toggle('zoom', zoom);
  };
  $('#lbS', lb).onclick = (e) => {
    if (e.target.id === 'lbS') close();
  };
  let x0 = null;
  $('#lbS', lb).addEventListener(
    'touchstart',
    (e) => {
      x0 = zoom ? null : e.touches[0].clientX;
    },
    { passive: true }
  );
  $('#lbS', lb).addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1));
    x0 = null;
  });
  document.body.appendChild(lb);
  show(i);
}

('use strict');
