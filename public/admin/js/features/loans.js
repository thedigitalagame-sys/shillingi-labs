/* ---------- logbook loans ---------- */
function viewLoans() {
  const L = S().loans || [],
    tabs = {
      active: L.filter((l) => l.status === 'active'),
      cleared: L.filter((l) => l.status === 'cleared'),
      written_off: L.filter((l) => l.status === 'written_off'),
    };
  const list = tabs[ui.loanTab].slice().sort((a, b) => b.overdue_days - a.overdue_days),
    known = tabs.active.filter((l) => l.balance_known);
  return {
    title: 'Logbook loans',
    sub: `${pl(tabs.active.length, 'active loan')} · ${KES(sum(known.map((l) => l.balance)))} owed${tabs.active.length - known.length ? ` + ${tabs.active.length - known.length} unconfirmed` : ''}`,
    tools: `<div class="seg">${[
      ['active', 'Active'],
      ['cleared', 'Cleared'],
      ['written_off', 'Written off'],
    ]
      .map(
        ([k, l]) =>
          `<button data-lt="${k}" class="${ui.loanTab === k ? 'on' : ''}">${l} (${tabs[k].length})</button>`
      )
      .join('')}</div><button class="btn primary" id="addLoan">${IC.plus} New loan</button>`,
    html: `<div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Borrower</th><th>Logbook of</th><th class="r">Lent</th><th class="r">Interest</th><th class="r">Paid</th><th class="r">Balance</th><th>Due</th></tr></thead><tbody>
      ${
        list
          .map(
            (
              l
            ) => `<tr class="click" data-loan="${l.id}"><td class="nw muted">${fmtD(l.date)}</td><td><b>${esc(l.borrower)}</b><div class="muted" style="font-size:12px">${esc(l.phone || '')}</div></td><td>${esc(l.vehicle || '')} ${l.plate ? `<span class="plate">${esc(l.plate)}</span>` : ''}</td>
        <td class="r num">${K(l.amount)}</td><td class="r num">${l.interest ? K(l.interest) : '—'}</td><td class="r num">${K(l.paid)}</td><td class="r">${balTxt(l.balance, l.balance_known)}</td>
        <td class="nw">${l.due_date ? (l.overdue ? `<span class="pill bad">${fmtDs(l.due_date)} · ${l.overdue_days}d late</span>` : fmtDs(l.due_date)) : '<span class="muted">not set</span>'}</td></tr>`
          )
          .join('') || '<tr><td colspan="8" class="empty">No loans here.</td></tr>'
      }</tbody></table></div></div>`,
    bind() {
      $$('[data-lt]').forEach(
        (b) =>
          (b.onclick = () => {
            ui.loanTab = b.dataset.lt;
            render();
          })
      );
      $('#addLoan').onclick = () => loanForm();
    },
  };
}
function loanModal(l) {
  const body = `<div><b style="font-size:15px">${esc(l.borrower)}</b>${l.phone ? ` · <a href="tel:${esc(l.phone)}">${esc(l.phone)}</a>` : ''}${l.phone2 ? ` · ${esc(l.phone2)}` : ''}<div class="muted" style="font-size:13px">Logbook of ${esc(l.vehicle || '—')} ${esc(l.plate || '')} · lent ${fmtD(l.date)}${l.months ? ` for ${pl(l.months, 'month')}` : ''}${l.logbook_held ? ' · logbook held' : ''}</div></div>
    <div class="kv"><div><span>Lent</span><b class="num">${K(l.amount)}</b></div><div><span>Interest</span><b class="num">${K(l.interest)}${l.rate ? ` <small class="muted">(${l.rate}%/month)</small>` : ''}</b></div><div><span>To repay</span><b class="num">${K(l.payable)}</b></div>
      <div><span>Paid</span><b class="num">${K(l.paid)}</b></div><div><span>Balance</span>${l.balance_known ? `<b class="num ${l.balance > 0 ? 'down' : 'up'}">${K(l.balance)}</b>` : unc}</div><div><span>Due</span><b class="${l.overdue ? 'down' : ''}">${l.due_date ? fmtD(l.due_date) : 'not set'}</b></div></div>
    ${!l.balance_known ? '<div class="hint warn">The balance was blank on the old Loan Details sheet. Use <b>Edit</b> to set what is owed today, and the interest agreed.</div>' : ''}
    <div><div class="card-h" style="margin-bottom:6px"><h3>Repayments</h3></div>${payTable(l.payments)}</div>${l.notes ? `<div class="muted" style="font-size:12px">${esc(l.notes)}</div>` : ''}`;
  const acts = [{ label: 'Close' }, { label: 'Edit', fn: () => loanForm(l) }];
  if (isOwner())
    acts.push(
      l.status === 'active'
        ? {
            label: 'Write off',
            cls: 'danger',
            fn: () =>
              confirmBox(
                'Write off this loan?',
                'It moves to Written off. You can reopen it later.',
                'Write off',
                async (why) => {
                  await API.post('loans.close', { id: l.id, to: 'written_off', reason: why });
                  await refresh('Loan written off');
                },
                true
              ),
          }
        : {
            label: 'Reopen',
            fn: async () => {
              await API.post('loans.close', { id: l.id, to: 'active' });
              await refresh('Loan reopened');
            },
          }
    );
  if (isOwner() && l.status === 'active' && l.balance_known && l.balance <= 0)
    acts.push({
      label: 'Mark cleared',
      cls: 'good',
      fn: async () => {
        await API.post('loans.close', { id: l.id, to: 'cleared' });
        await refresh('Loan cleared');
      },
    });
  if (l.status === 'active')
    acts.push({
      label: 'Record repayment',
      cls: 'mpesa',
      fn: () =>
        modal(
          `Repayment · ${esc(l.borrower)}`,
          `<div class="form-grid"><label class="field">Amount (KES)<input type="number" id="rA" value="${l.balance_known ? l.balance : ''}"></label><label class="field">Paid by<select id="rM">${methodOpts()}</select></label><label class="field">M-Pesa code / reference<input id="rR"></label><label class="field">Date<input type="date" id="rD" value="${S().today}" max="${S().today}"></label></div>`,
          [
            { label: 'Cancel' },
            {
              label: 'Record',
              cls: 'mpesa',
              fn: async (bg) => {
                await API.post('loans.pay', {
                  loan_id: l.id,
                  amount: fv(bg, 'rA'),
                  method: fv(bg, 'rM'),
                  reference: fv(bg, 'rR'),
                  date: fv(bg, 'rD'),
                });
                await refresh('Repayment recorded');
              },
            },
          ]
        ),
    });
  const bg = modal(`Logbook loan · ${esc(l.borrower)}`, body, acts, true);
  bindVoid(bg, () => loanModal(loan(l.id)));
}
function loanForm(l) {
  const e = l || { date: S().today, logbook_held: true };
  modal(
    l ? 'Edit loan' : 'New logbook loan',
    `<div class="form-grid"><label class="field">Borrower's name<input id="lB" value="${esc(e.borrower)}"></label><label class="field">Phone<input id="lP" value="${esc(e.phone)}"></label>
      <label class="field">Second phone<input id="lP2" value="${esc(e.phone2)}"></label><label class="field">National ID no.<input id="lI" value="${esc(e.id_no)}"></label>
      <label class="field">Vehicle (logbook held)<input id="lV" value="${esc(e.vehicle)}" placeholder="Toyota Premio"></label><label class="field">Plate<input id="lPl" value="${esc(e.plate)}"></label>
      <label class="field">Amount lent (KES)<input type="number" id="lA" value="${esc(e.amount)}"></label><label class="field">Date lent<input type="date" id="lD" value="${esc(e.date)}"></label>
      <label class="field">Months<input type="number" id="lM" value="${esc(e.months)}"></label><label class="field">Interest (% a month, flat)<input type="number" step="0.1" id="lR" value="${esc(e.rate)}"></label>
      <label class="field">Interest amount (KES) <span class="muted" style="font-size:11px">· blank = worked out</span><input type="number" id="lIn" value="${l ? esc(e.interest) : ''}"></label><label class="field">Due date <span class="muted" style="font-size:11px">· blank = date + months</span><input type="date" id="lDu" value="${esc(e.due_date)}"></label>
      ${l && l.legacy ? `<label class="field" style="grid-column:1/-1">Balance owed today (KES)<input type="number" id="lBl" value="${l.balance_known ? esc(l.balance) : ''}" placeholder="from your records"></label>` : ''}</div>
    <label class="switch"><input type="checkbox" id="lH" ${e.logbook_held ? 'checked' : ''}> We are holding the logbook</label><label class="field">Notes<textarea id="lN">${esc(e.notes)}</textarea></label>`,
    [
      { label: 'Cancel' },
      {
        label: 'Save',
        cls: 'primary',
        fn: async (bg) => {
          const r = await API.post('loans.save', {
            id: l ? l.id : null,
            borrower: fv(bg, 'lB'),
            phone: fv(bg, 'lP'),
            phone2: fv(bg, 'lP2'),
            id_no: fv(bg, 'lI'),
            vehicle: fv(bg, 'lV'),
            plate: fv(bg, 'lPl'),
            amount: fv(bg, 'lA'),
            date: fv(bg, 'lD'),
            months: fv(bg, 'lM'),
            rate: fv(bg, 'lR'),
            interest: fv(bg, 'lIn'),
            due_date: fv(bg, 'lDu'),
            balance: fv(bg, 'lBl'),
            logbook_held: fv(bg, 'lH'),
            notes: fv(bg, 'lN'),
          });
          await refresh('Loan saved');
          loanModal(loan(r.id));
        },
      },
    ],
    true
  );
}

('use strict');
