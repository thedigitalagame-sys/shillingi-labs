/* ---------- state ---------- */
const App = { me: null, S: null, business: 'Car yard' };
const ui = {
  status: 'all',
  make: 'all',
  page: 1,
  lbSt: 'all',
  lbQ: '',
  lbPage: 1,
  lbCar: null,
  form: null,
  body: 'all',
  q: '',
  sort: 'new',
  month: '',
  salesQ: '',
  salesType: 'all',
  loanTab: 'active',
  creditTab: 'open',
};
let charts = [];
const S = () => App.S;
const isMgr = () => App.me && ['owner', 'manager'].includes(App.me.role);
const isOwner = () => App.me && App.me.role === 'owner';
const car = (id) => S().cars.find((c) => c.id === +id);
const sale = (id) => S().sales.find((s) => s.id === +id);
const loan = (id) => (S().loans || []).find((l) => l.id === +id);
const user = (id) => S().users.find((u) => u.id === +id);
const saleOf = (carId) => S().sales.find((s) => s.car_id === +carId);
const carName = (c) => [c.year, c.make, c.model].filter(Boolean).join(' ');
const carCost = (c) => num(c.buy) + sum((c.costs || []).map((x) => x.amount));
const daysIn = (c) => daysBetween(c.in_date || App.S.today, c.sold_date || App.S.today);
const stockCars = () => S().cars.filter((c) => c.status !== 'sold');
const METHOD = () => S().pay_methods;
const STATUS = {
  available: ['Available', 'good'],
  reserved: ['Reserved', 'warn'],
  prep: ['In Service', 'purple'],
  sold: ['Sold', 'gray'],
};
const statusPill = (c) => `<span class="pill ${STATUS[c.status][1]}">${STATUS[c.status][0]}</span>`;
const plateHTML = (c) =>
  c.plate
    ? `<span class="plate">${esc(c.plate)}</span>`
    : '<span class="plate new">No plate</span>';
const DEAL = { cash: 'Cash', credit: 'Credit (instalments)', bank: 'Bank finance' };
const LB = {
  pending: 'Not started',
  initiated: 'Transfer started on eCitizen',
  transferred: 'Transferred to buyer',
  held: 'Held until fully paid',
};
const BODYNAME = {
  hatch: 'Hatchback',
  sedan: 'Saloon',
  wagon: 'Station wagon',
  suv: 'SUV',
  pickup: 'Pick-up',
  van: 'Van / MPV',
};
const INSP = [
  ['wheel_check', 'Wheel check'],
  ['wheel_spanner', 'Wheel spanner'],
  ['spare_wheel', 'Spare wheel'],
  ['battery', 'Battery'],
  ['radio', 'Radio'],
];
const unc =
  '<span class="pill unc" title="The balance was blank on the old sheet. Set it from the sale or loan.">Unconfirmed</span>';
const balTxt = (bal, known) => (known === false ? `${unc}` : `<b class="num">${K(bal)}</b>`);
const credOpen = (s) =>
  s.type === 'credit' && !s.reserved && (s.balance_known === false || num(s.balance) > 0);

async function loadState() {
  App.S = await API.get('state');
  App.me = App.S.me;
  App.business = App.S.settings.business_name;
}
async function refresh(msg) {
  await loadState();
  render();
  if (msg) toast(msg);
}

('use strict');
