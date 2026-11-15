function saleWizard(c, r) {
  const st = S().settings,
    paidSoFar = r ? r.paid : 0;
  const bg = modal(
    `${r ? 'Complete sale' : 'Reserve or sell'} · ${esc(carName(c))}`,
    `
    <div class="form-grid"><label class="field">Buyer's full name<input id="wN" value="${esc(r ? r.buyer_name : '')}"></label><label class="field">Buyer's phone<input id="wP" type="tel" value="${esc(r ? r.buyer_phone : '')}" placeholder="07XX XXX XXX"></label>
      <label class="field">National ID no. (for the agreement)<input id="wI" value="${esc(r ? r.buyer_id_no : '')}"></label><label class="field">KRA PIN (for the logbook transfer)<input id="wK" value="${esc(r ? r.buyer_kra : '')}"></label></div>
    <div class="form-grid"><label class="field">Agreed price (KES)<input type="number" id="wPr" value="${r && r.price ? r.price : c.ask || ''}"></label><label class="field">Sold by<select id="wA">${S()
      .users.filter((u) => u.active)
      .map(
        (u) =>
          `<option value="${u.id}" ${u.id === (r ? r.agent_id : App.me.id) ? 'selected' : ''}>${esc(u.name)}</option>`
      )
      .join('')}</select></label></div>
    <div class="field" style="font-size:12px;font-weight:600;color:var(--muted)">How is the buyer paying?<div class="seg" id="wT">${['cash', 'credit', 'bank'].map((t) => `<button type="button" data-t="${t}" class="${(r ? r.type : 'cash') === t ? 'on' : ''}">${DEAL[t]}</button>`).join('')}</div></div>
    <div id="wCr" class="form-grid" hidden><label class="field">Pay the balance over<select id="wMo">${[1, 2, 3, 4, 5, 6, 8, 10, 12, 18, 24].map((m) => `<option value="${m}" ${m === 3 ? 'selected' : ''}>${pl(m, 'month')}</option>`).join('')}</select></label><label class="field">Interest (% a month, flat)<input type="number" id="wRt" step="0.1" min="0" value="${st.credit_rate}"></label></div>
    <div id="wBank" hidden><label class="field">Bank<input id="wBk" placeholder="e.g. Equity Bank"></label></div>
    ${
      r
        ? ''
        : `<label class="switch"><input type="checkbox" id="wTi"> The buyer is trading in a car</label>
    <div id="wTiBox" hidden class="form-grid"><label class="field">Trade-in car (make and model)<input id="wTm" placeholder="Toyota Premio"></label><label class="field">Plate<input id="wTp" placeholder="KCB 123A"></label><label class="field">Agreed trade-in value (KES)<input type="number" id="wTv" value="0"></label><label class="field">Body<select id="wTb">${Object.entries(
      BODYNAME
    )
      .map(([v, l]) => `<option value="${v}">${l}</option>`)
      .join('')}</select></label></div>`
    }
    <div class="form-grid"><label class="field">${r ? 'Paying now' : 'Paying now (deposit or full amount)'} (KES)<input type="number" id="wAm" value="${r ? Math.max(0, num(r.price) - paidSoFar) || '' : ''}"></label><label class="field">Paid by<select id="wM">${methodOpts()}</select></label>
      <label class="field">M-Pesa code / reference<input id="wRef" placeholder="e.g. TJK4XXXXXX"></label><label class="field">Date<input type="date" id="wD" value="${S().today}" max="${S().today}"></label></div>
    <div class="hint" id="wSum"></div>`,
    [
      { label: 'Cancel' },
      ...(r ? [] : [{ label: 'Reserve with deposit', fn: (bg) => finish(bg, true) }]),
      { label: r ? 'Complete sale' : 'Record sale', cls: 'primary', fn: (bg) => finish(bg, false) },
    ],
    true
  );
  let type = r ? r.type : 'cash';
  const price = () => num(fv(bg, 'wPr')),
    tiv = () => (fv(bg, 'wTi') ? num(fv(bg, 'wTv')) : 0);
  const upd = () => {
    $('#wCr', bg).hidden = type !== 'credit';
    $('#wBank', bg).hidden = type !== 'bank';
    const p = price(),
      ti = tiv(),
      now = num(fv(bg, 'wAm')),
      up = paidSoFar + now + ti,
      lines = [];
    if (isMgr() && c.buy != null)
      lines.push(
        `Profit at ${KES(p)}: <b class="${p - carCost(c) < 0 ? 'down' : 'up'}">${KES(p - carCost(c))}</b>`
      );
    if (c.floor && p < c.floor)
      lines.push(
        `<span class="down">Below the lowest price (${KES(c.floor)})${isMgr() ? '' : ' — the owner or a manager must record it'}</span>`
      );
    if (ti) lines.push(`Trade-in counts as ${KES(ti)} paid`);
    if (type === 'credit') {
      const amt = Math.max(0, p - up),
        m = num(fv(bg, 'wMo')),
        t = creditTerms(amt, m, num(fv(bg, 'wRt'))),
        minDep = round100((p * st.min_deposit) / 100);
      lines.push(
        `Deposit ${KES(up)}${up < minDep ? ` <span class="down">(minimum ${st.min_deposit}% is ${KES(minDep)})</span>` : ''} · balance on credit <b>${KES(amt)}</b>${t.interest ? ` + interest ${KES(t.interest)}` : ''} → <b>${pl(m, 'instalment')} of ${KES(t.monthly)}</b>. The logbook is held until fully paid.`
      );
    } else if (type === 'cash')
      lines.push(
        `Paid ${r ? 'so far ' + KES(paidSoFar) + ' + ' : ''}now ${KES(now + ti)} of ${KES(p)}${up < p ? ` · <b>${KES(p - up)}</b> short — use "Reserve with deposit" for a part payment, or Credit` : ''}`
      );
    else lines.push("The buyer pays a deposit; record the bank's payment later from the sale.");
    if (fv(bg, 'wM') === 'mpesa' && now > 250000)
      lines.push(
        '<span class="down">M-Pesa allows up to KES 250,000 per transaction — record two payments or use a bank transfer.</span>'
      );
    $('#wSum', bg).innerHTML = lines.join('<br>');
  };
  $$('#wT button', bg).forEach(
    (x) =>
      (x.onclick = () => {
        type = x.dataset.t;
        $$('#wT button', bg).forEach((y) => y.classList.toggle('on', y === x));
        upd();
      })
  );
  if ($('#wTi', bg))
    $('#wTi', bg).onchange = (e) => {
      $('#wTiBox', bg).hidden = !e.target.checked;
      upd();
    };
  $$('input,select', bg).forEach((i) => i.addEventListener('input', upd));
  upd();
  async function finish(bg, reserve) {
    const body = {
      car_id: c.id,
      reserve,
      buyer_name: fv(bg, 'wN'),
      buyer_phone: fv(bg, 'wP'),
      buyer_id_no: fv(bg, 'wI'),
      buyer_kra: fv(bg, 'wK'),
      price: fv(bg, 'wPr'),
      agent_id: fv(bg, 'wA'),
      type,
      months: fv(bg, 'wMo'),
      rate: fv(bg, 'wRt'),
      bank: fv(bg, 'wBk'),
      amount: fv(bg, 'wAm'),
      method: fv(bg, 'wM'),
      reference: fv(bg, 'wRef'),
      date: fv(bg, 'wD'),
    };
    if (fv(bg, 'wTi'))
      body.trade_in = {
        model: fv(bg, 'wTm'),
        plate: fv(bg, 'wTp'),
        value: fv(bg, 'wTv'),
        body: fv(bg, 'wTb'),
      };
    const res = await API.post('sales.create', body);
    await refresh(
      reserve
        ? `${esc(carName(c))} reserved for ${esc(body.buyer_name)}`
        : `Sold to ${esc(body.buyer_name)}`
    );
    if (!reserve) setTimeout(() => agreementModal(sale(res.sale_id)), 300);
  }
}
function payModal(s) {
  const c = car(s.car_id),
    next = s.sched && s.sched.next;
  modal(
    `Record a payment · ${esc(s.buyer_name || '')}`,
    `<div class="muted">${esc(carName(c))} ${esc(c.plate || '')} · balance ${s.balance_known === false ? 'unconfirmed' : KES(s.balance)}${s.sched && s.sched.arrears ? ` · <span class="down">behind by ${KES(s.sched.arrears)}</span>` : ''}${next ? ` · next due ${fmtD(next)}` : ''}</div>
    <div class="form-grid"><label class="field">Amount (KES)<input type="number" id="pA" value="${s.credit_monthly && s.balance ? Math.min(s.credit_monthly, s.balance) : s.balance || ''}"></label><label class="field">Paid by<select id="pM">${methodOpts()}</select></label>
      <label class="field">M-Pesa code / reference<input id="pR"></label><label class="field">Date<input type="date" id="pD" value="${S().today}" max="${S().today}"></label></div>`,
    [
      { label: 'Cancel' },
      {
        label: 'Record payment',
        cls: 'mpesa',
        fn: async (bg) => {
          const r = await API.post('sales.pay', {
            sale_id: s.id,
            amount: fv(bg, 'pA'),
            method: fv(bg, 'pM'),
            reference: fv(bg, 'pR'),
            date: fv(bg, 'pD'),
          });
          await refresh(
            `Payment recorded${r.balance != null ? ` · balance ${KES(r.balance)}` : ''}`
          );
        },
      },
    ]
  );
}
function payTable(list, kind) {
  return list.length
    ? `<table class="tbl pays"><thead><tr><th>Date</th><th>How</th><th>Reference</th><th>Note</th><th class="r">Amount</th>${isOwner() ? '<th></th>' : ''}</tr></thead><tbody>${list.map((p) => `<tr><td class="nw">${fmtD(p.date)}</td><td>${esc(METHOD()[p.method] || p.method)}</td><td class="muted">${esc(p.reference || '')}</td><td class="muted">${esc(p.note || '')}</td><td class="r num">${K(p.amount)}</td>${isOwner() ? `<td><button class="btn sm danger" data-vp="${p.id}" title="Cancel this payment">×</button></td>` : ''}</tr>`).join('')}</tbody></table>`
    : '<div class="muted">No payments yet.</div>';
}
function bindVoid(bg, after) {
  $$('[data-vp]', bg).forEach(
    (b) =>
      (b.onclick = () =>
        confirmBox(
          'Cancel this payment?',
          'The payment stays in the records as cancelled and is taken off the balance.',
          'Cancel payment',
          async (why) => {
            await API.post('payments.void', { id: +b.dataset.vp, reason: why });
            bg._close();
            await refresh('Payment cancelled');
            after();
          },
          true
        ))
  );
}
function saleModal(s) {
  const c = car(s.car_id),
    sc = s.sched,
    ag = user(s.agent_id);
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
  const acts = [{ label: 'Close' }];
  if (isOwner())
    acts.push({
      label: 'Cancel sale',
      cls: 'danger',
      fn: () =>
        confirmBox(
          'Cancel this sale?',
          `The car goes back to stock and all payments on this sale are marked cancelled.`,
          'Cancel sale',
          async (why) => {
            await API.post('sales.void', { id: s.id, reason: why });
            await refresh('Sale cancelled');
          },
          true
        ),
    });
  if (isMgr()) acts.push({ label: 'Edit', fn: () => saleEdit(s) });
  if (!s.reserved) acts.push({ label: `${IC.doc} Agreement`, fn: () => agreementModal(s) });
  if (s.reserved) acts.push({ label: 'Complete sale', cls: 'primary', fn: () => saleWizard(c, s) });
  else if (s.balance_known === false || num(s.balance) > 0 || s.payable == null)
    acts.push({ label: 'Record payment', cls: 'mpesa', fn: () => payModal(s) });
  const bg = modal(`Sale · ${esc(s.buyer_name || carName(c))}`, body, acts, true);
  bindVoid(bg, () => saleModal(sale(s.id)));
}
function saleEdit(s) {
  const cr = s.type === 'credit';
  modal(
    'Edit sale',
    `<div class="form-grid"><label class="field">Buyer's name<input id="eN" value="${esc(s.buyer_name)}"></label><label class="field">Phone<input id="eP" value="${esc(s.buyer_phone)}"></label>
      <label class="field">Second phone<input id="eP2" value="${esc(s.buyer_phone2)}"></label><label class="field">National ID no.<input id="eI" value="${esc(s.buyer_id_no)}"></label>
      <label class="field">KRA PIN<input id="eK" value="${esc(s.buyer_kra)}"></label><label class="field">Sale date<input type="date" id="eD" value="${esc(s.date)}"></label>
      <label class="field">Price (KES)<input type="number" id="ePr" value="${esc(s.price)}" placeholder="${s.legacy ? 'not on the old sheet' : ''}"></label><div></div>
      ${
        cr
          ? `<label class="field">Amount on credit (KES)<input type="number" id="eCa" value="${esc(s.credit_amount)}"></label><label class="field">Months<input type="number" id="eMo" value="${esc(s.credit_months)}"></label>
      <label class="field">Interest (% a month)<input type="number" step="0.1" id="eRt" value="${esc(s.credit_rate)}"></label><label class="field">Instalments counted from<input type="date" id="eSt" value="${esc(s.credit_start)}"></label>`
          : ''
      }
      ${s.legacy && cr ? `<label class="field" style="grid-column:1/-1">Balance the buyer owes today (KES)<input type="number" id="eBl" value="${s.balance_known ? esc(s.balance) : ''}" placeholder="from your records"></label>` : ''}</div>
    <label class="field">Notes<textarea id="eNo">${esc(s.notes)}</textarea></label>
    ${s.legacy && cr ? '<div class="muted" style="font-size:12px">For sales from the old sheet, setting the balance records the difference as "paid before the system". New payments are kept.</div>' : ''}`,
    [
      { label: 'Cancel' },
      {
        label: 'Save',
        cls: 'primary',
        fn: async (bg) => {
          await API.post('sales.edit', {
            id: s.id,
            buyer_name: fv(bg, 'eN'),
            buyer_phone: fv(bg, 'eP'),
            buyer_phone2: fv(bg, 'eP2'),
            buyer_id_no: fv(bg, 'eI'),
            buyer_kra: fv(bg, 'eK'),
            date: fv(bg, 'eD'),
            price: fv(bg, 'ePr'),
            credit_amount: fv(bg, 'eCa'),
            months: fv(bg, 'eMo'),
            rate: fv(bg, 'eRt'),
            credit_start: fv(bg, 'eSt'),
            balance: fv(bg, 'eBl'),
            notes: fv(bg, 'eNo'),
          });
          await refresh('Sale saved');
          saleModal(sale(s.id));
        },
      },
    ],
    true
  );
}
function agreementModal(s) {
  const c = car(s.car_id),
    st = S().settings,
    ag = user(s.agent_id),
    ti = s.trade_in_car ? car(s.trade_in_car) : null;
  const html = `<div class="doc"><h2>Motor vehicle sale agreement</h2><div class="c" style="font-size:12px">${esc(st.business_name)}${st.location ? ' · ' + esc(st.location) : ''}${st.phone ? ' · ' + esc(st.phone) : ''} · Agreement no. ${s.id}</div>
    <p>This agreement is made on <b>${fmtD(s.date)}</b> between <b>${esc(st.business_name)}</b> (the Seller) and <b>${esc(s.buyer_name || '__________')}</b>, ID no. ${esc(s.buyer_id_no || '__________')}, KRA PIN ${esc(s.buyer_kra || '__________')}, phone ${esc(s.buyer_phone || '__________')} (the Buyer).</p>
    <table><tbody><tr><td>Vehicle</td><td>${esc(carName(c))}${c.color ? ' · ' + esc(c.color) : ''}</td></tr><tr><td>Registration</td><td>${esc(c.plate || '—')}</td></tr><tr><td>Chassis no.</td><td>${esc(c.chassis || '__________')}</td></tr>
    <tr><td>Engine</td><td>${[c.cc ? c.cc + ' cc' : '', c.fuel, c.gearbox].filter(Boolean).map(esc).join(' · ') || '—'}</td></tr><tr><td>Mileage at sale</td><td>${c.mileage ? K(c.mileage) + ' km' : '—'}</td></tr>
    <tr><td>Agreed price</td><td><b>${s.price != null ? KES(s.price) : '__________'}</b></td></tr>${ti ? `<tr><td>Trade-in</td><td>${esc(carName(ti))} ${esc(ti.plate || '')}, valued at ${KES(s.trade_in_value)}</td></tr>` : ''}
    <tr><td>Terms</td><td>${s.type === 'cash' ? 'Cash sale.' : s.type === 'bank' ? `Deposit paid by the Buyer; balance financed by ${esc(s.bank || 'the bank')}.` : `Credit: ${KES(s.credit_amount)} payable${s.credit_interest ? ` with interest of ${KES(s.credit_interest)}` : ''} in ${s.credit_months} monthly instalments of ${KES(s.credit_monthly)}${s.sched && s.sched.dues.length ? `, the first due on ${fmtD(s.sched.dues[0])}` : ''}. The logbook stays with the Seller until the last instalment is paid.`}</td></tr>
    <tr><td>Paid to date</td><td>${KES(s.paid)}${num(s.balance) ? ` · balance ${KES(s.balance)}` : ''}</td></tr></tbody></table>
    <p style="font-size:12px">The Buyer has inspected and test-driven the vehicle and accepts it in its present condition. The Seller confirms the vehicle is free of any loan, lien or police case and will transfer ownership through NTSA (eCitizen) ${s.type === 'credit' ? 'once fully paid' : 'within 7 days of full payment'}.</p>
    <div class="sig"><div>For the Seller${ag ? ': ' + esc(ag.name) : ''}</div><div>Buyer: ${esc(s.buyer_name || '')}</div></div></div>`;
  modal(
    `Sale agreement · no. ${s.id}`,
    html,
    [
      { label: 'Close' },
      {
        label: `${IC.print} Print`,
        cls: 'primary',
        fn: () => {
          printHTML(html);
          return false;
        },
      },
    ],
    true
  );
}

/* ================= VIEWS ================= */
function kpi(l, v, d, hero) {
  return `<div class="card kpi ${hero ? 'hero' : ''}"><span class="l">${l}</span><span class="v num">${v}</span><span class="d">${d || ''}</span></div>`;
}
const collectedIn = (m) =>
  [...S().sales.flatMap((s) => s.payments), ...(S().loans || []).flatMap((l) => l.payments)].filter(
    (p) => !['before', 'tradein'].includes(p.method) && p.date.startsWith(m)
  );
('use strict');
