/* ---------- vehicle details ---------- */
const STEPS = [
  ['added', 'Car Added', IC.check, 's-green'],
  ['logbook', 'Logbook Received', IC.book, 's-purple'],
  ['price', 'Price Updated', IC.tag, 's-blue'],
  ['reserved', 'Reserved', IC.hand, 's-amber'],
  ['sold', 'Sold', IC.car, 's-gray'],
];
function vehicleSheet(c) {
  // printable details (asking price only: buying price and lowest price stay internal)
  const st = S().settings,
    ck = CHECKS.filter(([k]) => c.inspection && c.inspection[k]);
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
function carModal(c) {
  const mgr = isMgr(),
    s = ['sold', 'reserved'].includes(c.status) ? saleOf(c.id) : null,
    cost = carCost(c);
  const L = [
    [IC.cal, 'Year of Manufacture', c.year],
    [IC.palette, 'Colour', c.color],
    [IC.fuel, 'Fuel', c.fuel],
    [IC.cog, 'Gearbox', c.gearbox],
    [IC.engine, 'Engine', engineTxt(c) ? `${engineTxt(c)} (${K(c.cc)} cc)` : null],
    [IC.barcode, 'Chassis No.', c.chassis],
  ];
  const R = [
    [IC.car, 'Make', c.make],
    [IC.layers, 'Model', c.model],
    [IC.car, 'Body', BODYNAME[c.body]],
    [IC.gauge, 'Mileage', c.mileage ? K(c.mileage) + ' km' : null],
    [IC.swap, 'Source', (SOURCE[c.source] || SOURCE.local)[0]],
    [IC.book, 'Logbook Status', c.logbook_status ? LBS[c.logbook_status][0] : null],
  ];
  const spec = (rows) =>
    rows
      .map(([ic, l, v]) => `<div class="sp">${ic}<span>${l}:</span><b>${esc(v ?? '—')}</b></div>`)
      .join('');
  const ck = CHECKS.filter(([k]) => c.inspection && c.inspection[k]);
  const body = `<div class="vd-top"><div class="vd-gal">${gallery(c)}
      <div class="ph-tools"><label class="btn sm">${IC.cam} Add photos<input type="file" id="phF" accept="image/jpeg,image/png,image/webp" multiple hidden></label>
      ${mgr && c.photos.length ? `<button class="btn sm" id="phCover">Make cover</button><button class="btn sm danger" id="phDel">Delete photo</button>` : ''}<span class="muted" id="phMsg" style="font-size:12px"></span></div></div>
    <div class="vd-info"><div class="vd-head"><div><h2>${esc([c.make, c.model].filter(Boolean).join(' '))}</h2>${c.plate ? `<span class="plate-red">${esc(c.plate)}</span>` : ''}</div><span class="st-big ${STATUS[c.status][1]}">${IC.check}${STATUS[c.status][0]}</span></div>
      <div class="vd-specs"><div>${spec(L)}</div><div>${spec(R)}</div></div>
      ${mgr && c.status === 'prep' ? '<button class="btn sm good" id="stAv">Mark as available</button>' : mgr && c.status === 'available' ? '<button class="btn sm" id="stPr">Move to In Service</button>' : ''}</div></div>
    <div class="vd-boxes"><div class="box">${panelH(IC.clip, 'Vehicle Checks &amp; Condition')}<div class="box-b">${ck.length ? ck.map(([k, l]) => `<div class="ckr"><span>${l}</span><span class="pill ${checkCls(c.inspection[k])}">${esc(checkTxt(c.inspection[k]))}</span></div>`).join('') : '<span class="muted">Not recorded.</span>'}</div></div>
      <div class="box">${panelH(IC.layers, 'Pricing (KES)')}<div class="box-b pr-b"><div class="prr"><span>Asking Price</span><b class="num">${c.ask ? K(c.ask) : '—'}</b></div><div class="prr"><span>Lowest Price</span><b class="num">${c.floor ? K(c.floor) : '—'}</b></div>
        ${
          mgr
            ? `<div class="prr"><span>Bought For</span><b class="num">${c.buy != null ? K(c.buy) : '—'}</b></div>${(c.costs || []).length ? `<div class="prr sm"><span>+ Costs (${c.costs.length})</span><b class="num">${K(cost - num(c.buy))}</b></div>` : ''}
        <div class="prr tot"><span>${s && !s.reserved && s.price ? 'Profit on sale' : 'Profit at asking'}</span><b class="num">${c.buy == null ? '—' : K((s && !s.reserved && s.price ? s.price : num(c.ask)) - cost)}</b></div>
        <button class="btn sm" id="cmCost">${IC.plus} Add a cost</button>${(c.costs || []).length ? ` <button class="btn sm" id="cmCosts">Costs</button>` : ''}`
            : ''
        }</div></div>
      <div class="box">${panelH(IC.book, 'Logbook Information')}<div class="box-b">${
        mgr
          ? `<div class="lbr"><span>Logbook No.</span><b>${esc(c.logbook_no || '—')}</b></div><div class="lbr"><span>Date Received</span><b>${fmtD(c.logbook_date)}</b></div>
        <div class="lbr"><span>Issuing Office</span><b>${esc(c.logbook_office || '—')}</b></div><div class="lbr"><span>Remarks</span><b>${esc(c.logbook_remarks || '—')}</b></div>
        ${c.logbook_file ? `<a class="btn sm" href="api/?r=logbooks.file&car_id=${c.id}" target="_blank" rel="noopener">${IC.doc} View logbook scan</a>` : ''}`
          : `<div class="lbr"><span>Status</span>${lbPill(c.logbook_status)}</div>`
      }</div></div></div>
    <div class="box hist">${panelH(IC.clock, 'Vehicle History')}<div class="tl" id="vdTl">${STEPS.map(([k, l, ic, cl]) => `<div class="tl-s ${cl}" data-st="${k}"><span class="tl-ic">${ic}</span><b>${l}</b><span class="tl-d">…</span></div>`).join('')}</div></div>
    ${s ? `<div class="hint">${s.reserved ? 'Reserved' : 'Sold'} to <b>${esc(s.buyer_name || 'buyer not recorded')}</b> · ${DEAL[s.type]}${s.date ? ' · ' + fmtD(s.date) : ''}${s.reserved && s.hold_until ? ` · hold until ${fmtD(s.hold_until)}` : ''} <a href="#" id="openSale">Open the sale</a></div>` : ''}
    ${daysIn(c) > 60 && c.status !== 'sold' ? `<div class="hint warn">In the yard ${daysIn(c)} days. Consider a price drop or featuring it in adverts.</div>` : ''}
    ${c.notes ? `<div class="muted" style="font-size:12px">${esc(c.notes)}</div>` : ''}`;
  const acts = [
    {
      label: `${IC.print} Print Details`,
      fn: () => {
        printHTML(vehicleSheet(c));
        return false;
      },
    },
    {
      label: `${IC.dl} Download (PDF)`,
      fn: () => {
        toast('Choose “Save as PDF” as the printer to download it.');
        printHTML(vehicleSheet(c));
        return false;
      },
    },
  ];
  if (mgr) acts.push({ label: `${IC.edit} Edit Car`, fn: () => openCarForm({ edit: c.id }) });
  if (c.status === 'reserved')
    acts.push({ label: 'Complete sale', cls: 'primary', fn: () => saleWizard(c, s) });
  else if (['available', 'prep'].includes(c.status))
    acts.push({ label: 'Reserve / sell', cls: 'primary', fn: () => saleWizard(c) });
  else if (s) acts.push({ label: `${IC.doc} Sale agreement`, fn: () => agreementModal(s) });
  acts.push({ label: `${IC.car} Close`, cls: 'red' });
  const bg = modal(`${IC.car} Vehicle Details`, body, acts, 'xwide');
  const cur = bindGallery(bg, c);
  API.get('cars.history', { id: c.id })
    .then((h) =>
      h.steps.forEach((x) => {
        const el = $(`[data-st="${x.k}"]`, bg);
        if (!el) return;
        el.classList.toggle('done', !!x.date);
        $('.tl-d', el).textContent = x.date ? fmtD(x.date) : '—';
      })
    )
    .catch(() => $$('.tl-d', bg).forEach((x) => (x.textContent = '—')));
  $('#phF', bg).onchange = async (e) => {
    const files = [...e.target.files];
    if (!files.length) return;
    $('#phMsg', bg).textContent = `Uploading ${pl(files.length, 'photo')}…`;
    try {
      for (let i = 0; i < files.length; i += 5) {
        const fd = new FormData();
        fd.append('car_id', c.id);
        files.slice(i, i + 5).forEach((f) => fd.append('photos[]', f));
        await API.upload('photos.upload', fd);
        $('#phMsg', bg).textContent =
          `Uploaded ${Math.min(i + 5, files.length)} of ${files.length}…`;
      }
      bg._close();
      await refresh(`${pl(files.length, 'photo')} added`);
      carModal(car(c.id));
    } catch (err) {
      $('#phMsg', bg).textContent = err.message;
    }
  };
  const again = async (msg) => {
    bg._close();
    await refresh(msg);
    carModal(car(c.id));
  };
  if ($('#phCover', bg))
    $('#phCover', bg).onclick = async () => {
      try {
        await API.post('photos.cover', { id: cur().id });
        await again('Cover photo set');
      } catch (e) {
        toast(e.message, 1);
      }
    };
  if ($('#phDel', bg))
    $('#phDel', bg).onclick = () =>
      confirmBox(
        'Delete this photo?',
        'The photo will be deleted from the server.',
        'Delete',
        async () => {
          await API.post('photos.delete', { id: cur().id });
          await again('Photo deleted');
        }
      );
  if ($('#stAv', bg))
    $('#stAv', bg).onclick = async () => {
      try {
        await API.post('cars.status', { id: c.id, status: 'available' });
        await again('Now available for sale');
      } catch (e) {
        toast(e.message, 1);
      }
    };
  if ($('#stPr', bg))
    $('#stPr', bg).onclick = async () => {
      try {
        await API.post('cars.status', { id: c.id, status: 'prep' });
        await again('Moved to In Service');
      } catch (e) {
        toast(e.message, 1);
      }
    };
  if ($('#cmCost', bg))
    $('#cmCost', bg).onclick = () => {
      bg._close();
      costModal(c);
    };
  if ($('#cmCosts', bg)) $('#cmCosts', bg).onclick = () => costsList(c);
  if ($('#openSale', bg))
    $('#openSale', bg).onclick = (e) => {
      e.preventDefault();
      bg._close();
      saleModal(s);
    };
}
function costsList(c) {
  const bg = modal(
    `Costs · ${esc(carName(c))}`,
    `<table class="tbl"><tbody><tr><td>Bought for</td><td class="muted nw">${fmtD(c.in_date)}</td><td class="r num">${c.buy != null ? K(c.buy) : '—'}</td><td></td></tr>
    ${(c.costs || []).map((x) => `<tr><td>${esc(x.category)}${x.description ? ' — ' + esc(x.description) : ''}</td><td class="muted nw">${fmtD(x.date)}</td><td class="r num">${K(x.amount)}</td><td><button class="btn sm danger" data-dc="${x.id}">×</button></td></tr>`).join('')}
    <tr><td><b>Total cost</b></td><td></td><td class="r num"><b>${K(carCost(c))}</b></td><td></td></tr></tbody></table>`,
    [{ label: 'Close' }]
  );
  $$('[data-dc]', bg).forEach(
    (b) =>
      (b.onclick = () =>
        confirmBox('Remove this cost?', 'It will be taken off this car.', 'Remove', async () => {
          await API.post('costs.delete', { id: +b.dataset.dc });
          bg._close();
          $$('.modal-bg').forEach((x) => x._close && x._close());
          await refresh('Cost removed');
          carModal(car(c.id));
        }))
  );
}
function costModal(c) {
  modal(
    `Add a cost · ${esc(carName(c))}`,
    `<div class="form-grid"><label class="field">Type<select id="xc">${S()
      .cost_types.map((t) => `<option>${t}</option>`)
      .join(
        ''
      )}</select></label><label class="field">Amount (KES)<input type="number" id="xa" min="1"></label>
    <label class="field">Date<input type="date" id="xd" value="${S().today}" max="${S().today}"></label><label class="field">Details (optional)<input id="xn" placeholder="e.g. 4 new tyres"></label></div>`,
    [
      { label: 'Cancel' },
      {
        label: 'Add cost',
        cls: 'primary',
        fn: async (bg) => {
          await API.post('costs.add', {
            car_id: c.id,
            category: fv(bg, 'xc'),
            amount: fv(bg, 'xa'),
            date: fv(bg, 'xd'),
            description: fv(bg, 'xn'),
          });
          await refresh('Cost added');
          carModal(car(c.id));
        },
      },
    ]
  );
}

/* ================= CREATE / EDIT CAR (full page) ================= */
const DRAFT_KEY = 'gari.carDraft';
const draftGet = () => {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
  } catch (e) {
    return null;
  }
};
const draftSet = (v) => {
  try {
    v ? localStorage.setItem(DRAFT_KEY, JSON.stringify(v)) : localStorage.removeItem(DRAFT_KEY);
  } catch (e) {}
};
function openCarForm(o) {
  ui.form = o;
  if (location.hash === '#/create') render();
  else location.hash = '#/create';
  window.scrollTo(0, 0);
}
function viewCreate() {
  const f = ui.form || {},
    src = f.edit ? car(f.edit) : f.dup ? car(f.dup) : null,
    editing = !!f.edit && src;
  let e = src
    ? { ...src, inspection: { ...(src.inspection || {}) } }
    : {
        body: '',
        source: 'local',
        inspection: {
          wheel_check: 'Available',
          wheel_spanner: 'Available',
          spare_wheel: 'Available',
          additional_spare: 'Not available',
          battery: 'Good',
          radio: 'Normal',
        },
        in_date: S().today,
        logbook_status: 'with_us',
        status: 'available',
      };
  if (f.dup && src)
    Object.assign(e, {
      id: null,
      plate: '',
      chassis: '',
      logbook_no: '',
      logbook_date: '',
      logbook_remarks: '',
      logbook_file: false,
      in_date: S().today,
      status: 'available',
      buy: src.buy,
      mileage: '',
    });
  const draft = !editing && !f.dup ? draftGet() : null;
  if (draft) e = draft;
  const i = e.inspection || {},
    req = editing ? '' : '<i class="req">*</i>',
    row = (ic, l, ctl, r = true) =>
      `<div class="fr">${ic ? `<span class="fr-ic">${ic}</span>` : ''}<label>${l}${r ? req : ''}</label>${ctl}</div>`;
  const yrs = [];
  for (let y = +S().today.slice(0, 4) + 1; y >= 1980; y--) yrs.push(String(y));
  return {
    title: editing ? 'Edit Car' : 'Create Car',
    sub: editing
      ? `${esc(carName(src))} · ${esc(src.plate || '')}`
      : 'Add a new vehicle to the inventory',
    html: `${draft ? '<div class="hint">A saved draft was restored. <a href="#" id="dropDraft">Discard it</a></div>' : ''}${f.dup && src ? `<div class="hint">Copied from ${esc(carName(src))}. Enter the plate, chassis and logbook of the new car.</div>` : ''}
    <form id="cf" class="cf3" autocomplete="off">
      <div class="panel">${panelH(IC.clip, editing ? 'Edit Car' : 'Create Car')}
        <div class="sec-h">Section 1: Vehicle Checks &amp; Condition</div>
        ${CHECKS.map(([k, l, list]) => row('', l, `<select id="i_${k}">${opts(list, i[k] || '', '—')}</select>`, false)).join('')}
        ${row('', 'In the yard since', `<input type="date" id="cIn" value="${esc(e.in_date)}" max="${S().today}">`)}
        ${row(
          '',
          'Source',
          `<select id="cSr">${opts(
            [
              ['local', 'Locally used'],
              ['import', 'Fresh import'],
              ['tradein', 'Trade-in'],
            ],
            e.source
          )}</select>`
        )}
        ${
          e.status === 'available' || e.status === 'prep' || !editing
            ? row(
                '',
                'Status',
                `<select id="cSt">${opts(
                  [
                    ['available', 'Available for sale'],
                    ['prep', 'In Service (not yet on sale)'],
                  ],
                  e.status === 'prep' ? 'prep' : 'available'
                )}</select>`
              )
            : ''
        }
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
        ${row(
          '',
          'Logbook Status',
          `<select id="lSt">${opts(
            Object.entries(LBS).map(([k, v]) => [k, v[0].replace(/\b\w/g, (x) => x.toUpperCase())]),
            e.logbook_status || '',
            '—'
          )}</select>`
        )}
        <div class="sub-box"><div class="sub-h">${IC.doc} Logbook Details</div>
          ${row('', 'Logbook No.', `<input id="lNo" value="${esc(e.logbook_no || '')}" placeholder="Enter logbook number">`, false)}
          ${row('', 'Logbook Date', `<input type="date" id="lDt" value="${esc(e.logbook_date || '')}" max="${S().today}">`, false)}
          ${row('', 'Issuing Office', `<select id="lOf">${opts(OFFICES, e.logbook_office || '', 'Select office')}</select>`, false)}
          ${row('', 'Remarks', `<textarea id="lRm" placeholder="Enter remarks (optional)">${esc(e.logbook_remarks || '')}</textarea>`, false)}</div>
        <label class="drop">${IC.upload}<b>Upload Logbook (Scan / Photo)</b><span>PNG, JPG or PDF (Max 5 MB)</span><span class="btn sm red-o">${IC.upload} Choose File</span>
          <input type="file" id="lFile" accept="application/pdf,image/jpeg,image/png" hidden><span class="drop-f" id="lFn">${editing && src.logbook_file ? 'A scan is on file. Choose a file to replace it.' : 'No file selected'}</span></label></div>
      <div class="cf-acts"><button type="button" class="btn" id="cfDraft">${IC.reset} Save Draft</button><button type="button" class="btn" id="cfCancel">Cancel</button><button type="submit" class="btn red big" id="cfSave">${IC.save} Save Car</button><div class="err" id="cfErr"></div></div>
    </form>`,
    bind() {
      const g = (id) => fv(document, id);
      const collect = () => {
        const inspection = {};
        CHECKS.forEach(([k]) => (inspection[k] = g('i_' + k)));
        return {
          make: g('cMk'),
          model: g('cMd'),
          plate: g('cPl'),
          year: g('cYr'),
          body: g('cBd'),
          color: g('cCo'),
          mileage: g('cMi'),
          engine: g('cEn'),
          fuel: g('cFu'),
          gearbox: g('cGb'),
          chassis: g('cCh'),
          source: g('cSr'),
          in_date: g('cIn'),
          ask: g('cAs'),
          floor: g('cFl'),
          buy: g('cBy'),
          notes: g('cNo'),
          inspection,
          status: g('cSt'),
          logbook_status: g('lSt'),
          logbook_no: g('lNo'),
          logbook_date: g('lDt'),
          logbook_office: g('lOf'),
          logbook_remarks: g('lRm'),
        };
      };
      $('#lFile').onchange = (e) => {
        const x = e.target.files[0];
        $('#lFn').textContent = x
          ? `${x.name} · ${(x.size / 1048576).toFixed(1)} MB`
          : 'No file selected';
        if (x && x.size > 5 * 1048576) {
          toast('The logbook file is over 5 MB.', 1);
          e.target.value = '';
          $('#lFn').textContent = 'No file selected';
        }
      };
      if ($('#dropDraft'))
        $('#dropDraft').onclick = (ev) => {
          ev.preventDefault();
          draftSet(null);
          render();
        };
      $('#cfDraft').onclick = () => {
        if (editing) {
          toast('Drafts are for new cars. Save your changes instead.');
          return;
        }
        draftSet(collect());
        toast('Draft saved on this device');
      };
      $('#cfCancel').onclick = () => {
        ui.form = null;
        location.hash = '#/stock';
      };
      $('#cf').onsubmit = async (ev) => {
        ev.preventDefault();
        $('#cfErr').textContent = '';
        const b = $('#cfSave');
        b.disabled = true;
        try {
          const d = collect(),
            body = {
              ...d,
              id: editing ? src.id : null,
              ready: d.status !== 'prep',
              featured: editing ? src.featured : false,
            };
          const r = await API.post('cars.save', body);
          if (
            editing &&
            d.status &&
            d.status !== src.status &&
            ['available', 'prep'].includes(src.status)
          )
            await API.post('cars.status', { id: src.id, status: d.status });
          const file = $('#lFile').files[0];
          if (file) {
            const fd = new FormData();
            fd.append('car_id', r.id);
            fd.append('file', file);
            try {
              await API.upload('logbooks.upload', fd);
            } catch (err) {
              toast('The car was saved, but the logbook file was not: ' + err.message, 1);
            }
          }
          if (!editing) draftSet(null);
          ui.form = null;
          location.hash = '#/stock';
          await refresh(editing ? 'Car saved' : 'Car added — now add its photos');
          carModal(car(r.id));
        } catch (err) {
          $('#cfErr').textContent = err.message;
          toast(err.message, 1);
        } finally {
          b.disabled = false;
        }
      };
    },
  };
}

/* ================= LOGBOOK MANAGEMENT (the car's own logbook) ================= */
('use strict');
