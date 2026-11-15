/* ---------- reports & expenses ---------- */
function viewReports() {
  const S_ = S(),
    m = ui.month || S_.today.slice(0, 7),
    sold = S_.sales.filter((s) => !s.reserved && (s.date || '').startsWith(m));
  const priced = sold.filter((s) => s.price != null),
    withCost = priced.filter((s) => car(s.car_id).buy != null),
    gross = sum(withCost.map((s) => s.price - carCost(car(s.car_id))));
  const col = collectedIn(m),
    exp = (S_.expenses || []).filter((e) => e.date.startsWith(m)),
    expT = sum(exp.map((e) => e.amount));
  const byM = {};
  col.forEach((p) => (byM[p.method] = (byM[p.method] || 0) + p.amount));
  const months = Array.from({ length: 6 }, (_, i) => addMonthsP(S_.today.slice(0, 7), i - 5));
  const stock = stockCars(),
    ages = [
      ['0–30 days', 0, 30, '#15803D'],
      ['31–60 days', 31, 60, '#0C8B86'],
      ['61–90 days', 61, 90, '#D4A72C'],
      ['Over 90 days', 91, 1e9, '#B91C1C'],
    ].map(([l, a, b, c]) => ({
      l,
      c,
      n: stock.filter((x) => daysIn(x) >= a && daysIn(x) <= b).length,
    }));
  const opts = Array.from({ length: 18 }, (_, i) => addMonthsP(S_.today.slice(0, 7), -i))
    .map((p) => `<option value="${p}" ${p === m ? 'selected' : ''}>${pLabel(p)}</option>`)
    .join('');
  return {
    title: 'Reports & expenses',
    sub: pLabel(m),
    tools: `<select id="rM">${opts}</select><button class="btn primary" id="addExp">${IC.plus} Add an expense</button>`,
    html: `<div class="grid g4">${kpi('Cars sold', sold.length, `${KES(sum(priced.map((s) => s.price)))} in sales`, true)}${kpi('Gross profit on cars', short(gross), withCost.length < sold.length ? `${withCost.length} of ${sold.length} sales have a buying price` : 'price less buying price and costs')}
      ${kpi(
        'Money collected',
        short(sum(col.map((p) => p.amount))),
        Object.entries(byM)
          .map(([k, v]) => `${esc(METHOD()[k])} ${short(v)}`)
          .join(' · ') || 'none'
      )}${kpi('Yard expenses', short(expT), `${pl(exp.length, 'entry')}`)}</div>
    <div class="grid g-7-5"><div class="card"><div class="card-h"><h3>Money collected</h3><span class="sub">last 6 months</span></div><div class="chart-box"><canvas id="chCol"></canvas></div></div>
      <div class="card"><div class="card-h"><h3>How long cars have been in the yard</h3></div><div class="agebars">${ages.map((a) => `<div class="row"><span>${a.l}</span><div class="bar"><i style="width:${stock.length ? (a.n / stock.length) * 100 : 0}%;background:${a.c}"></i></div><b class="num" style="width:30px;text-align:right">${a.n}</b></div>`).join('')}</div></div></div>
    <div class="grid g2"><div class="card"><div class="card-h"><h3>Cars sold in ${pLabel(m, false)}</h3></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Car</th><th>Buyer</th><th class="r">Price</th><th class="r">Profit</th></tr></thead><tbody>
      ${
        sold
          .map((s) => {
            const c = car(s.car_id);
            return `<tr class="click" data-sale="${s.id}"><td>${esc(carName(c))} ${plateHTML(c)}</td><td>${esc(s.buyer_name || '—')}</td><td class="r num">${s.price != null ? K(s.price) : '—'}</td><td class="r num">${s.price != null && c.buy != null ? K(s.price - carCost(c)) : '—'}</td></tr>`;
          })
          .join('') || '<tr><td colspan="4" class="empty">No sales this month.</td></tr>'
      }</tbody></table></div></div>
      <div class="card"><div class="card-h"><h3>Yard expenses</h3></div><div class="tbl-wrap"><table class="tbl"><tbody>
      ${exp.map((e) => `<tr><td class="nw muted">${fmtDs(e.date)}</td><td>${esc(e.category)}${e.description ? `<div class="muted" style="font-size:12px">${esc(e.description)}</div>` : ''}</td><td class="r num">${K(e.amount)}</td><td class="r"><button class="btn sm danger" data-de="${e.id}">×</button></td></tr>`).join('') || '<tr><td class="empty">No expenses this month.</td></tr>'}</tbody></table></div></div></div>`,
    bind() {
      $('#rM').onchange = (e) => {
        ui.month = e.target.value;
        render();
      };
      $('#addExp').onclick = () =>
        modal(
          'Add a yard expense',
          `<div class="form-grid"><label class="field">Type<select id="eC">${S_.expense_types.map((t) => `<option>${t}</option>`).join('')}</select></label><label class="field">Amount (KES)<input type="number" id="eA"></label><label class="field">Date<input type="date" id="eD" value="${S_.today}" max="${S_.today}"></label><label class="field">Details<input id="eN"></label></div>`,
          [
            { label: 'Cancel' },
            {
              label: 'Add',
              cls: 'primary',
              fn: async (bg) => {
                await API.post('expenses.add', {
                  category: fv(bg, 'eC'),
                  amount: fv(bg, 'eA'),
                  date: fv(bg, 'eD'),
                  description: fv(bg, 'eN'),
                });
                await refresh('Expense added');
              },
            },
          ]
        );
      $$('[data-de]').forEach(
        (b) =>
          (b.onclick = () =>
            confirmBox(
              'Remove this expense?',
              'It will be taken off the report.',
              'Remove',
              async () => {
                await API.post('expenses.delete', { id: +b.dataset.de });
                await refresh('Expense removed');
              }
            ))
      );
      if (window.Chart) {
        const all = [
          ...S_.sales.flatMap((s) => s.payments),
          ...(S_.loans || []).flatMap((l) => l.payments),
        ].filter((p) => !['before', 'tradein'].includes(p.method));
        charts.push(
          new Chart($('#chCol'), {
            type: 'bar',
            data: {
              labels: months.map((p) => pLabel(p, false)),
              datasets: [
                {
                  label: 'Collected',
                  data: months.map((p) =>
                    sum(all.filter((x) => x.date.startsWith(p)).map((x) => x.amount))
                  ),
                  backgroundColor: '#0C8B86',
                  borderRadius: 6,
                },
              ],
            },
            options: {
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (x) => KES(x.raw) } },
              },
              scales: { y: { ticks: { callback: (v) => short(v) } } },
            },
          })
        );
      }
    },
  };
}

('use strict');
