function viewDashboard() {
  const S_ = S(),
    m = S_.today.slice(0, 7),
    stock = stockCars(),
    sold = S_.sales.filter((s) => !s.reserved && (s.date || '').startsWith(m));
  const cr = S_.sales.filter(credOpen),
    crKnown = cr.filter((s) => s.balance_known !== false),
    late = cr
      .filter((s) => s.sched && s.sched.arrears > 0)
      .sort((a, b) => b.sched.overdue_days - a.sched.overdue_days);
  const lo = (S_.loans || []).filter((l) => l.status === 'active'),
    loKnown = lo.filter((l) => l.balance_known),
    loLate = lo.filter((l) => l.overdue).sort((a, b) => b.overdue_days - a.overdue_days);
  const unconf = cr.length - crKnown.length + lo.length - loKnown.length;
  const slow = stock
    .filter((c) => daysIn(c) > 60)
    .sort((a, b) => daysIn(b) - daysIn(a))
    .slice(0, 8);
  const noPrice = stock.filter((c) => !c.ask).length,
    noPhoto = stock.filter((c) => !c.photos.length).length;
  return {
    title: 'Dashboard',
    sub: `${esc(App.business)} · ${fmtD(S_.today)}`,
    html: `<div class="grid g4">
      ${kpi('Cars in the yard', `${stock.length} <small style="color:#BFD3F0">cars</small>`, `${KES(sum(stock.map((c) => c.ask)))} at asking prices`, true)}
      ${kpi(`Sold in ${pLabel(m, false)}`, `${sold.length} <small>${sold.length === 1 ? 'car' : 'cars'}</small>`, `${KES(sum(sold.map((s) => s.price)))} in sales`)}
      ${kpi(`Collected in ${pLabel(m, false)}`, short(sum(collectedIn(m).map((p) => p.amount))), 'instalments, deposits, sales & loan repayments')}
      ${kpi('Owed to the yard', short(sum(crKnown.map((s) => s.balance)) + sum(loKnown.map((l) => l.balance))), `${pl(cr.length, 'credit sale')} · ${pl(lo.length, 'logbook loan')}${unconf ? ` · <b class="down">${unconf} unconfirmed</b>` : ''}`)}</div>
    ${unconf ? `<div class="hint warn"><b>${unconf} balances from the old sheet are unconfirmed.</b> Open each one under Instalments or Logbook loans and set today's balance, so the totals are complete.</div>` : ''}
    ${noPrice || noPhoto ? `<div class="hint">${noPrice ? `${pl(noPrice, 'car')} in the yard ${noPrice === 1 ? 'has' : 'have'} no asking price. ` : ''}${noPhoto ? `${pl(noPhoto, 'car')} ${noPhoto === 1 ? 'has' : 'have'} no photos.` : ''} <a href="#/stock">Open Cars / Inventory</a></div>` : ''}
    <div class="grid g2">
      <div class="card"><div class="card-h"><h3>Instalments behind</h3><span class="sub">${pl(late.length, 'buyer')}</span><div class="right"><a class="btn sm" href="#/credit">All instalments</a></div></div>
        ${
          late.length
            ? `<table class="tbl"><tbody>${late
                .slice(0, 8)
                .map(
                  (s) =>
                    `<tr class="click" data-sale="${s.id}"><td><b>${esc(s.buyer_name)}</b><div class="muted" style="font-size:12px">${esc(carName(car(s.car_id)))} · ${esc(car(s.car_id).plate || '')}</div></td><td class="muted nw">${s.sched.overdue_days} days</td><td class="r num down">${K(s.sched.arrears)}</td></tr>`
                )
                .join('')}</tbody></table>`
            : '<div class="empty">No one is behind.</div>'
        }</div>
      <div class="card"><div class="card-h"><h3>Logbook loans past due</h3><span class="sub">${pl(loLate.length, 'loan')}</span><div class="right"><a class="btn sm" href="#/loans">All loans</a></div></div>
        ${
          loLate.length
            ? `<table class="tbl"><tbody>${loLate
                .slice(0, 8)
                .map(
                  (l) =>
                    `<tr class="click" data-loan="${l.id}"><td><b>${esc(l.borrower)}</b><div class="muted" style="font-size:12px">${esc(l.vehicle || '')} ${esc(l.plate || '')}</div></td><td class="muted nw">due ${fmtDs(l.due_date)}</td><td class="r">${balTxt(l.balance, l.balance_known)}</td></tr>`
                )
                .join('')}</tbody></table>`
            : '<div class="empty">None past due.</div>'
        }</div></div>
    <div class="card"><div class="card-h"><h3>Slow movers</h3><span class="sub">in the yard over 60 days</span></div>${slow.length ? `<div class="cars">${slow.map(carCard).join('')}</div>` : '<div class="empty">No car has been in the yard over 60 days.</div>'}</div>`,
  };
}
function viewSales() {
  let list = S().sales.slice();
  if (ui.salesType !== 'all')
    list = list.filter((s) =>
      ui.salesType === 'reserved' ? s.reserved : s.type === ui.salesType && !s.reserved
    );
  if (ui.salesQ) {
    const q = ui.salesQ.toLowerCase().replace(/\s/g, '');
    list = list.filter((s) => {
      const c = car(s.car_id);
      return ((s.buyer_name || '') + (s.buyer_phone || '') + carName(c) + (c.plate || ''))
        .toLowerCase()
        .replace(/\s/g, '')
        .includes(q);
    });
  }
  return {
    title: 'Sales & payments',
    sub: `${pl(S().sales.filter((s) => !s.reserved).length, 'sale')} · ${pl(S().sales.filter((s) => s.reserved).length, 'reservation')}`,
    tools: isMgr() ? `<button class="btn" id="csvSales">${IC.dl} Export</button>` : '',
    html: `<div class="filters"><label class="field">Show<select id="sT">${[
      ['all', 'All'],
      ['reserved', 'Reserved'],
      ['cash', 'Cash'],
      ['credit', 'Credit'],
      ['bank', 'Bank finance'],
    ]
      .map(([v, l]) => `<option value="${v}" ${ui.salesType === v ? 'selected' : ''}>${l}</option>`)
      .join('')}</select></label>
      <label class="field" style="flex:1;min-width:180px">Search<input type="search" id="sQ" value="${esc(ui.salesQ)}" placeholder="Buyer, phone, car or plate"></label></div>
      <div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Car</th><th>Buyer</th><th>Deal</th><th class="r">Price</th><th class="r">Paid</th><th class="r">Balance</th></tr></thead><tbody>
      ${
        list
          .map((s) => {
            const c = car(s.car_id);
            return `<tr class="click" data-sale="${s.id}"><td class="nw muted">${s.date ? fmtD(s.date) : '—'}</td><td>${esc(carName(c))} ${plateHTML(c)}</td><td>${esc(s.buyer_name || '—')}</td><td>${s.reserved ? '<span class="pill warn">Reserved</span>' : `<span class="pill ${s.type === 'credit' ? 'info' : 'gray'}">${{ cash: 'Cash', credit: 'Credit', bank: 'Bank' }[s.type]}</span>`}</td>
        <td class="r num">${s.price != null ? K(s.price) : '—'}</td><td class="r num">${K(s.paid)}</td><td class="r">${s.payable == null && s.balance_known !== false ? '<span class="muted">—</span>' : balTxt(s.balance, s.balance_known)}</td></tr>`;
          })
          .join('') || '<tr><td colspan="7" class="empty">No sales.</td></tr>'
      }</tbody></table></div></div>`,
    bind() {
      $('#sT').onchange = (e) => {
        ui.salesType = e.target.value;
        render();
      };
      let t;
      $('#sQ').oninput = (e) => {
        clearTimeout(t);
        t = setTimeout(() => {
          ui.salesQ = e.target.value;
          render();
          const q = $('#sQ');
          q.focus();
          q.setSelectionRange(q.value.length, q.value.length);
        }, 250);
      };
      if ($('#csvSales'))
        $('#csvSales').onclick = () =>
          csvDownload(`sales-${S().today}.csv`, [
            [
              'Date',
              'Plate',
              'Car',
              'Buyer',
              'Phone',
              'Deal',
              'Price',
              'Paid',
              'Balance',
              'Balance confirmed',
            ],
            ...S().sales.map((s) => {
              const c = car(s.car_id);
              return [
                s.date,
                c.plate,
                carName(c),
                s.buyer_name,
                s.buyer_phone,
                s.reserved ? 'Reserved' : s.type,
                s.price,
                s.paid,
                s.balance,
                s.balance_known === false ? 'No' : 'Yes',
              ];
            }),
          ]);
    },
  };
}
function viewCredit() {
  const all = S().sales.filter((s) => s.type === 'credit' && !s.reserved),
    open = all.filter(credOpen);
  const list = ui.creditTab === 'open' ? open : all.filter((s) => !credOpen(s));
  list.sort(
    (a, b) =>
      (b.sched ? b.sched.arrears : 0) - (a.sched ? a.sched.arrears : 0) ||
      (a.balance_known === false) - (b.balance_known === false)
  );
  const known = open.filter((s) => s.balance_known !== false);
  return {
    title: 'Instalments',
    sub: `${pl(open.length, 'buyer')} paying · ${KES(sum(known.map((s) => s.balance)))} still owed${open.length - known.length ? ` + ${open.length - known.length} unconfirmed` : ''}`,
    tools: `<div class="seg"><button data-ct="open" class="${ui.creditTab === 'open' ? 'on' : ''}">Paying (${open.length})</button><button data-ct="done" class="${ui.creditTab === 'done' ? 'on' : ''}">Paid up (${all.length - open.length})</button></div>`,
    html: list.length
      ? `<div class="list">${list
          .map((s) => {
            const c = car(s.car_id),
              sc = s.sched,
              p = s.payable ? Math.min(100, (s.paid / s.payable) * 100) : 0;
            return `<div class="card loan-card"><div class="top"><b>${esc(s.buyer_name || 'Buyer')}</b>${s.buyer_phone ? `<a href="tel:${esc(s.buyer_phone)}" class="muted">${esc(s.buyer_phone)}</a>` : ''}<span class="muted">${esc(carName(c))}</span> ${plateHTML(c)}
          ${s.balance_known === false ? unc : sc && sc.arrears ? `<span class="pill bad">Behind ${KES(sc.arrears)} · ${sc.overdue_days} days</span>` : num(s.balance) > 0 ? '<span class="pill good">Up to date</span>' : '<span class="pill gray">Paid up</span>'}
          <span class="spacer"></span><button class="btn sm" data-sale="${s.id}">Open</button>${credOpen(s) ? `<button class="btn sm mpesa" data-pay="${s.id}">Record payment</button>` : ''}</div>
        <div class="mini"><div><span>Owed in all</span><b class="num">${s.payable != null ? K(s.payable) : '—'}</b></div><div><span>Paid</span><b class="num">${K(s.paid)}</b></div><div><span>Balance</span>${balTxt(s.balance, s.balance_known)}</div><div><span>${sc && sc.next ? 'Next due' : 'Instalment'}</span><b class="num">${sc && sc.next ? fmtDs(sc.next) + (s.credit_monthly ? ' · ' + K(s.credit_monthly) : '') : s.credit_monthly ? K(s.credit_monthly) : '—'}</b></div></div>
        ${s.balance_known !== false ? `<div class="progress good"><i style="width:${p}%"></i></div>` : ''}</div>`;
          })
          .join('')}</div>`
      : '<div class="card empty">Nothing here.</div>',
    bind() {
      $$('[data-ct]').forEach(
        (b) =>
          (b.onclick = () => {
            ui.creditTab = b.dataset.ct;
            render();
          })
      );
      $$('[data-pay]').forEach((b) => (b.onclick = () => payModal(sale(b.dataset.pay))));
    },
  };
}
function viewLogbooks() {
  const list = S().sales.filter(
    (s) =>
      !s.reserved &&
      s.logbook !== 'transferred' &&
      !(s.legacy && s.logbook === 'pending' && !s.buyer_name)
  );
  const order = ['held', 'pending', 'initiated', 'transferred'];
  return {
    title: 'Logbook Transfers',
    sub: `${pl(list.length, 'logbook')} not yet transferred to the buyer`,
    html: `<div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Car</th><th>Buyer</th><th>Sold</th><th>Step</th><th></th></tr></thead><tbody>
      ${
        list
          .sort((a, b) => order.indexOf(a.logbook) - order.indexOf(b.logbook))
          .map((s) => {
            const c = car(s.car_id),
              owes = s.type === 'credit' && (s.balance_known === false || num(s.balance) > 0);
            const next =
              s.logbook === 'held'
                ? owes
                  ? null
                  : 'pending'
                : s.logbook === 'pending'
                  ? 'initiated'
                  : 'transferred';
            return `<tr><td>${esc(carName(c))} ${plateHTML(c)}</td><td>${esc(s.buyer_name || '—')}</td><td class="muted nw">${s.date ? fmtD(s.date) : '—'}</td>
          <td><div class="lb-steps">${order
            .slice(1)
            .map(
              (k) =>
                `<span class="${order.indexOf(k) < order.indexOf(s.logbook) ? 'done' : k === s.logbook ? 'cur' : ''}">${{ pending: 'Not started', initiated: 'eCitizen', transferred: 'Done' }[k]}</span>`
            )
            .join(
              ''
            )}${s.logbook === 'held' ? `<span class="cur">Held${owes ? ' — balance ' + (s.balance_known === false ? 'unconfirmed' : K(s.balance)) : ''}</span>` : ''}</div></td>
          <td class="r">${next ? `<button class="btn sm" data-lb="${s.id}" data-to="${next}">${{ pending: 'Release logbook', initiated: 'Transfer started', transferred: 'Mark transferred' }[next]}</button>` : ''}</td></tr>`;
          })
          .join('') || '<tr><td colspan="5" class="empty">All logbooks are transferred.</td></tr>'
      }</tbody></table></div></div>
      <div class="muted" style="font-size:12px">Cars sold before the system with no buyer on the sheet are not listed here.</div>`,
    bind() {
      $$('[data-lb]').forEach(
        (b) =>
          (b.onclick = async () => {
            try {
              await API.post('sales.logbook', { id: +b.dataset.lb, to: b.dataset.to });
              await refresh('Logbook updated');
            } catch (e) {
              toast(e.message, 1);
            }
          })
      );
    },
  };
}

('use strict');
