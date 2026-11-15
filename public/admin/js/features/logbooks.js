function viewLogbookMgmt() {
  const PER = 10,
    list0 = S().cars.filter((c) => c.status !== 'sold' || c.logbook_status);
  let list = list0.filter(
    (c) =>
      ui.lbSt === 'all' || (ui.lbSt === 'none' ? !c.logbook_status : c.logbook_status === ui.lbSt)
  );
  if (ui.lbQ) {
    const q = ui.lbQ.toLowerCase().replace(/\s/g, '');
    list = list.filter((c) =>
      ((c.plate || '') + (c.logbook_no || '') + (c.chassis || '') + carName(c))
        .toLowerCase()
        .replace(/\s/g, '')
        .includes(q)
    );
  }
  list.sort(
    (a, b) =>
      (a.logbook_status === 'not_received' ? 0 : 1) -
        (b.logbook_status === 'not_received' ? 0 : 1) ||
      (b.in_date || '').localeCompare(a.in_date || '')
  );
  const pages = Math.max(1, Math.ceil(list.length / PER));
  if (ui.lbPage > pages) ui.lbPage = pages;
  const shown = list.slice((ui.lbPage - 1) * PER, ui.lbPage * PER),
    sel = ui.lbCar ? car(ui.lbCar) : null,
    cnt = (k) => list0.filter((c) => c.logbook_status === k).length;
  return {
    title: 'Logbook Management',
    sub: 'Manage vehicle logbooks: add, update, track status and history',
    html: `<div class="lb-grid"><div class="panel">${panelH(IC.book, 'Logbook Management')}
      <div class="tiles t4">${tile('t-red', IC.book, 'Total Vehicles', list0.length)}${tile('t-green', IC.check, 'With Us', cnt('with_us'))}${tile('t-amber', IC.clock, 'Not Yet Received', cnt('not_received'))}${tile('t-blue', IC.reset, 'In Process', cnt('in_process'))}</div>
      <div class="filters fl-inv"><label class="search">${IC.search}<input type="search" id="lbQ" value="${esc(ui.lbQ)}" placeholder="Search by plate, logbook no. or chassis no."></label>
        <select id="lbS" aria-label="Logbook status">${opts([['all', 'All Logbook Status'], ...Object.entries(LBS).map(([k, v]) => [k, v[0]]), ['none', 'Not recorded']], ui.lbSt)}</select>
        <button class="btn red" id="lbAdd">${IC.plus} Add Logbook</button></div>
      <div class="tbl-wrap"><table class="tbl inv"><thead><tr><th>#</th><th>Plate</th><th>Make &amp; Model</th><th>Logbook No.</th><th>Status</th><th>Date Received</th><th>Actions</th></tr></thead><tbody>
      ${
        shown
          .map(
            (
              c,
              i
            ) => `<tr class="${sel && sel.id === c.id ? 'sel' : ''}"><td class="muted">${(ui.lbPage - 1) * PER + i + 1}</td><td><b class="nw">${esc(c.plate || '—')}</b></td><td>${esc([c.make, c.model].filter(Boolean).join(' '))}</td>
        <td>${esc(c.logbook_no || '—')}</td><td>${lbPill(c.logbook_status)}</td><td class="nw">${c.logbook_status === 'with_us' && c.logbook_date ? fmtD(c.logbook_date) : '—'}</td>
        <td><div class="acts"><button class="ia" data-car="${c.id}" title="View car">${IC.eye}</button><button class="ia" data-lbe="${c.id}" title="Update logbook">${IC.edit}</button><button class="ia" data-lbh="${c.id}" title="History">${IC.clock}</button>${c.logbook_file ? `<a class="ia" href="api/?r=logbooks.file&car_id=${c.id}" target="_blank" rel="noopener" title="Logbook scan">${IC.doc}</a>` : ''}</div></td></tr>`
          )
          .join('') || '<tr><td colspan="7" class="empty">No vehicles match.</td></tr>'
      }</tbody></table></div>
      ${pager(list.length, ui.lbPage, PER, 'lpg', 'records')}</div>
    <div class="lb-side"><div class="panel">${panelH(IC.book, 'Add / Update Logbook')}<form id="lbF" class="frs" autocomplete="off">
        <div class="fr"><span class="fr-ic">${IC.car}</span><label>Vehicle<i class="req">*</i></label><select id="fCar"><option value="">Select vehicle (Plate / Make / Model)</option>${S()
          .cars.filter((c) => c.status !== 'sold' || c.logbook_status)
          .map(
            (c) =>
              `<option value="${c.id}" ${sel && sel.id === c.id ? 'selected' : ''}>${esc((c.plate || 'No plate') + ' · ' + [c.make, c.model].filter(Boolean).join(' '))}</option>`
          )
          .join('')}</select></div>
        <div class="fr"><span class="fr-ic">${IC.book}</span><label>Logbook No.</label><input id="fNo" value="${esc(sel ? sel.logbook_no || '' : '')}" placeholder="Enter logbook number"></div>
        <div class="fr"><span class="fr-ic">${IC.reset}</span><label>Logbook Status<i class="req">*</i></label><select id="fSt">${opts(
          Object.entries(LBS).map(([k, v]) => [k, v[0]]),
          sel ? sel.logbook_status || '' : '',
          '—'
        )}</select></div>
        <div class="fr"><span class="fr-ic">${IC.cal}</span><label>Date Received</label><input type="date" id="fDt" max="${S().today}" value="${esc(sel ? sel.logbook_date || '' : '')}"></div>
        <div class="fr"><span class="fr-ic">${IC.office}</span><label>Issuing Office</label><select id="fOf">${opts(OFFICES, sel ? sel.logbook_office || '' : '', 'Select issuing office')}</select></div>
        <div class="fr"><span class="fr-ic">${IC.chat}</span><label>Remarks</label><textarea id="fRm" placeholder="Enter remarks (e.g. transfer, follow up, etc.)">${esc(sel ? sel.logbook_remarks || '' : '')}</textarea></div>
        <div class="fr"><span class="fr-ic">${IC.upload}</span><label>Scan / photo</label><input type="file" id="fFile" accept="application/pdf,image/jpeg,image/png"></div>
        <div class="err" id="fErr"></div><div class="lb-acts"><button type="button" class="btn" id="fClr">${IC.reset} Clear</button><button class="btn red big">${IC.save} Save Logbook</button></div></form></div>
      <div class="panel">${panelH(IC.clock, 'Logbook History')}<div id="lbHist">${sel ? '<div class="muted">Loading…</div>' : '<div class="muted" style="padding:6px 2px">Choose a vehicle to see its logbook history.</div>'}</div></div></div></div>`,
    bind() {
      $('#lbS').onchange = (e) => {
        ui.lbSt = e.target.value;
        ui.lbPage = 1;
        render();
      };
      let t;
      $('#lbQ').oninput = (e) => {
        clearTimeout(t);
        t = setTimeout(() => {
          ui.lbQ = e.target.value;
          ui.lbPage = 1;
          render();
          const q = $('#lbQ');
          q.focus();
          q.setSelectionRange(q.value.length, q.value.length);
        }, 250);
      };
      $$('[data-lpg]').forEach(
        (b) =>
          (b.onclick = () => {
            ui.lbPage = +b.dataset.lpg;
            render();
          })
      );
      $$('[data-lbe],[data-lbh]').forEach(
        (b) =>
          (b.onclick = () => {
            ui.lbCar = +(b.dataset.lbe || b.dataset.lbh);
            render();
          })
      );
      $('#lbAdd').onclick = () => {
        ui.lbCar = null;
        render();
        $('#fCar').focus();
      };
      $('#fCar').onchange = (e) => {
        ui.lbCar = +e.target.value || null;
        render();
      };
      $('#fClr').onclick = () => {
        ui.lbCar = null;
        render();
      };
      $('#lbF').onsubmit = async (ev) => {
        ev.preventDefault();
        $('#fErr').textContent = '';
        try {
          const id = +fv(document, 'fCar');
          if (!id) throw new Error('Choose the vehicle.');
          await API.post('logbooks.save', {
            car_id: id,
            logbook_no: fv(document, 'fNo'),
            logbook_status: fv(document, 'fSt'),
            logbook_date: fv(document, 'fDt'),
            logbook_office: fv(document, 'fOf'),
            logbook_remarks: fv(document, 'fRm'),
          });
          const file = $('#fFile').files[0];
          if (file) {
            if (file.size > 5 * 1048576) throw new Error('The logbook file is over 5 MB.');
            const fd = new FormData();
            fd.append('car_id', id);
            fd.append('file', file);
            await API.upload('logbooks.upload', fd);
          }
          ui.lbCar = id;
          await refresh('Logbook saved');
        } catch (err) {
          $('#fErr').textContent = err.message;
        }
      };
      if (sel)
        API.get('logbooks.history', { car_id: sel.id })
          .then((h) => {
            const box = $('#lbHist');
            if (!box) return;
            box.innerHTML = h.length
              ? `<table class="tbl"><thead><tr><th>Date</th><th>Status</th><th>Remarks</th><th>Updated By</th></tr></thead><tbody>${h.map((x) => `<tr><td class="nw">${fmtD(x.date)}</td><td>${lbPill(x.status)}</td><td>${esc(x.remarks || '')}</td><td>${esc(x.name || 'System')}</td></tr>`).join('')}</tbody></table>`
              : '<div class="muted">No history yet.</div>';
          })
          .catch((err) => {
            if ($('#lbHist')) $('#lbHist').innerHTML = `<div class="err">${esc(err.message)}</div>`;
          });
    },
  };
}

/* ================= SELLING ================= */
const creditTerms = (amount, months, rate) => {
  const interest = round100(((amount * rate) / 100) * months);
  return { interest, monthly: months > 0 ? round100((amount + interest) / months) : 0 };
};
const methodOpts = (sel = 'mpesa') =>
  Object.entries(METHOD())
    .filter(([k]) => !['tradein', 'before'].includes(k))
    .map(([k, l]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${l}</option>`)
    .join('');
('use strict');
