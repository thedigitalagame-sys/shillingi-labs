/* ---------- navigation & layout ---------- */
function navFor() {
  const S_ = S(),
    arrears = S_.sales.filter((s) => s.sched && s.sched.arrears > 0).length;
  const lbPending = S_.sales.filter(
    (s) => !s.reserved && s.logbook !== 'transferred' && s.logbook !== 'held' && !s.legacy
  ).length;
  const n = [];
  if (isMgr()) n.push(['dashboard', 'Dashboard', IC.home]);
  n.push(['stock', 'Cars / Inventory', IC.car]);
  if (isMgr())
    n.push(
      ['create', 'Create Car', IC.plusSq],
      [
        'logbookmgmt',
        'Logbook Management',
        IC.book,
        stockCars().filter((c) => c.logbook_status === 'not_received').length,
      ]
    );
  n.push(['sales', 'Sales', IC.cash]);
  n.push(['credit', 'Instalments', IC.wallet, arrears]);
  if (isMgr())
    n.push(['loans', 'Logbook Loans', IC.key, (S_.loans || []).filter((l) => l.overdue).length]);
  n.push(['logbooks', 'Logbook Transfers', IC.doc, lbPending]);
  if (isMgr()) n.push(['reports', 'Reports', IC.chart]);
  if (isOwner())
    n.push(
      ['staff', 'Staff', IC.people],
      ['settings', 'Settings', IC.cog],
      ['activity', 'Activity', IC.list]
    );
  return n;
}
function currentView() {
  const v = location.hash.replace(/^#\/?/, '');
  const nav = navFor().map((n) => n[0]);
  return nav.includes(v) ? v : nav[0];
}
/* the client's word mark: first word white, the rest red, the town underneath */
function brandHTML() {
  const loc = (S() && S().settings.location) || App.location || '',
    name = App.business || 'Car yard';
  let main = name;
  if (loc && name.toLowerCase().endsWith(' ' + loc.toLowerCase()))
    main = name.slice(0, -loc.length - 1);
  const w = main.split(/\s+/);
  return `<div class="brand"><span class="brand-arc"></span><span class="brand-name"><b>${esc(w[0])}</b>${w.length > 1 ? `<em>${esc(w.slice(1).join(' '))}</em>` : ''}</span>${loc ? `<span class="brand-loc">${esc(loc)}</span>` : ''}</div>`;
}
const POWERED = `<a class="powered" href="https://shilingilabs.co.ke" target="_blank" rel="noopener"><span>Powered &amp; Developed by</span><span class="sl"><img src="shared/assets/logo-icon.png" alt=""><span><b>SHILINGI<i>LABS</i></b><small>TECH SOLUTIONS</small></span></span></a>`;
function alertsList() {
  const S_ = S(),
    a = [],
    late = S_.sales.filter((s) => s.sched && s.sched.arrears > 0),
    lo = (S_.loans || []).filter((l) => l.overdue);
  const lbMissing = stockCars().filter((c) => c.logbook_status === 'not_received'),
    exp = S_.sales.filter((s) => s.reserved && s.hold_until && s.hold_until < S_.today);
  if (late.length) a.push(['credit', `${pl(late.length, 'buyer')} behind on instalments`]);
  if (lo.length) a.push(['loans', `${pl(lo.length, 'logbook loan')} past due`]);
  if (exp.length) a.push(['sales', `${pl(exp.length, 'reservation')} past the hold date`]);
  if (isMgr() && lbMissing.length)
    a.push(['logbookmgmt', `${pl(lbMissing.length, 'car')} in the yard without the logbook`]);
  return a;
}
function render() {
  charts.forEach((c) => c.destroy());
  charts = [];
  document.title = App.business;
  const app = $('#app');
  if (!App.me) {
    app.innerHTML = viewLogin();
    bindLogin();
    return;
  }
  const view = currentView(),
    V = VIEWS[view](),
    nav = navFor(),
    cur = nav.find((n) => n[0] === view),
    al = alertsList();
  app.innerHTML = `<div class="shell">
    <header class="hdr"><a href="#/${nav[0][0]}" class="hdr-brand">${brandHTML()}</a><span class="hdr-sep"></span>
      <div class="hdr-title"><span class="hdr-ic">${(cur && cur[2]) || IC.car}</span><div><h1>${V.title}</h1><div class="sub">${V.sub || ''}</div></div></div>
      <div class="hdr-tools"><div class="dd"><button class="bell" id="bell" aria-label="Alerts">${IC.bell}${al.length ? `<i>${al.length}</i>` : ''}</button>
          <div class="dd-menu" id="bellM" hidden>${al.length ? al.map(([k, t]) => `<a href="#/${k}">${t}</a>`).join('') : '<span class="muted">Nothing needs attention.</span>'}</div></div>
        <div class="dd"><button class="me" id="meB"><span class="avatar">${initials(App.me.name)}</span><span class="me-n">${esc(App.me.name.split(' ')[0])}</span> ▾</button>
          <div class="dd-menu" id="meM" hidden><div class="me-h"><b>${esc(App.me.name)}</b><span>${{ owner: 'Owner', manager: 'Manager', sales: 'Sales' }[App.me.role]}</span></div><a href="#" id="chpw">Change password</a><a href="#" id="logout">Sign out</a></div></div></div></header>
    <aside class="side"><nav class="nav">${nav.map(([k, l, ic, cnt]) => `<a href="#/${k}" class="${k === view ? 'on' : ''}">${ic}<span>${l}</span>${cnt ? `<span class="cnt">${cnt}</span>` : ''}</a>`).join('')}</nav>${POWERED}</aside>
    <main class="main"><div class="content">${V.tools ? `<div class="toolbar">${V.tools}</div>` : ''}${V.html}</div></main></div>`;
  const dd = (b, m) => {
    $(b).onclick = (e) => {
      e.stopPropagation();
      const h = $(m).hidden;
      $$('.dd-menu').forEach((x) => (x.hidden = true));
      $(m).hidden = !h;
    };
  };
  dd('#bell', '#bellM');
  dd('#meB', '#meM');
  document.onclick = () => $$('.dd-menu').forEach((x) => (x.hidden = true));
  $('#logout').onclick = async (e) => {
    e.preventDefault();
    try {
      const r = await API.post('auth.logout');
      API.csrf = r.csrf;
    } catch (err) {}
    App.me = null;
    App.S = null;
    history.replaceState(null, '', location.pathname);
    render();
  };
  $('#chpw').onclick = (e) => {
    e.preventDefault();
    passwordModal();
  };
  $$('[data-car]').forEach(
    (b) =>
      (b.onclick = (e) => {
        e.stopPropagation();
        carModal(car(b.dataset.car));
      })
  );
  $$('[data-sale]').forEach(
    (b) =>
      (b.onclick = (e) => {
        e.stopPropagation();
        saleModal(sale(b.dataset.sale));
      })
  );
  $$('[data-loan]').forEach(
    (b) =>
      (b.onclick = (e) => {
        e.stopPropagation();
        loanModal(loan(b.dataset.loan));
      })
  );
  if (V.bind) V.bind();
}
window.addEventListener('hashchange', () => {
  if (App.me) {
    render();
    window.scrollTo(0, 0);
  }
});

('use strict');
