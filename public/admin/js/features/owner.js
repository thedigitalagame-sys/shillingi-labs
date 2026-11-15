/* ---------- staff, settings, activity (owner) ---------- */
function viewStaff() {
  return {
    title: 'Staff',
    sub: 'Who can sign in and what they can see',
    tools: `<button class="btn primary" id="addU">${IC.plus} Add a person</button>`,
    html: `<div class="card" id="uBox"><div class="loading">Loading…</div></div>
      <div class="hint"><b>Owner</b>: everything. <b>Manager</b>: stock with buying prices and costs, sales, instalments, logbook loans, reports. <b>Sales</b>: stock (without buying prices or profit), photos, reserving and selling, recording instalments and logbook steps.</div>`,
    async bind() {
      $('#addU').onclick = () => userForm();
      try {
        const us = await API.get('users.list');
        window.__users = us;
        $('#uBox').innerHTML =
          `<table class="tbl"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last sign-in</th><th></th></tr></thead><tbody>${us.map((u) => `<tr><td><b>${esc(u.name)}</b>${u.active == 1 ? '' : ' <span class="pill gray">Off</span>'}</td><td>${esc(u.email)}</td><td>${{ owner: 'Owner', manager: 'Manager', sales: 'Sales' }[u.role]}</td><td class="muted">${u.last_login ? fmtD(u.last_login) : 'never'}</td><td class="r"><button class="btn sm" data-u="${u.id}">Edit</button></td></tr>`).join('')}</tbody></table>`;
        $$('[data-u]').forEach(
          (b) => (b.onclick = () => userForm(us.find((u) => u.id == b.dataset.u)))
        );
      } catch (e) {
        $('#uBox').innerHTML = `<div class="err">${esc(e.message)}</div>`;
      }
    },
  };
}
function userForm(u) {
  modal(
    u ? 'Edit ' + esc(u.name) : 'Add a person',
    `<div class="form-grid"><label class="field">Full name<input id="uN" value="${esc(u && u.name)}"></label><label class="field">Email (to sign in)<input type="email" id="uE" value="${esc(u && u.email)}"></label>
      <label class="field">Phone<input id="uP" value="${esc(u && u.phone)}"></label><label class="field">Role<select id="uR">${[
        ['sales', 'Sales'],
        ['manager', 'Manager'],
        ['owner', 'Owner'],
      ]
        .map(
          ([v, l]) =>
            `<option value="${v}" ${(u ? u.role : 'sales') === v ? 'selected' : ''}>${l}</option>`
        )
        .join('')}</select></label>
      <label class="field" style="grid-column:1/-1">${u ? 'New password (leave blank to keep)' : 'First password (8+ characters, letters and numbers)'}<input type="password" id="uPw" autocomplete="new-password"></label></div>
    ${u ? `<label class="switch"><input type="checkbox" id="uA" ${u.active == 1 ? 'checked' : ''}> Can sign in</label>` : ''}<div class="muted" style="font-size:12px">Give the password to the person yourself; they can change it after signing in.</div>`,
    [
      { label: 'Cancel' },
      {
        label: 'Save',
        cls: 'primary',
        fn: async (bg) => {
          await API.post('users.save', {
            id: u ? u.id : null,
            name: fv(bg, 'uN'),
            email: fv(bg, 'uE'),
            phone: fv(bg, 'uP'),
            role: fv(bg, 'uR'),
            password: fv(bg, 'uPw'),
            active: u ? fv(bg, 'uA') : true,
          });
          await refresh('Saved');
        },
      },
    ]
  );
}
function viewSettings() {
  const st = S().settings;
  return {
    title: 'Settings',
    sub: 'Business details and credit terms',
    html: `<div class="card" style="max-width:640px"><div class="form-grid"><label class="field">Business name<input id="sN" value="${esc(st.business_name)}"></label><label class="field">Location<input id="sL" value="${esc(st.location)}"></label>
      <label class="field">Business phone<input id="sP" value="${esc(st.phone)}"></label><label class="field">Payment details (Paybill / Till / bank)<input id="sPd" value="${esc(st.pay_details)}"></label>
      <label class="field">Default credit interest (% a month, flat)<input type="number" step="0.1" id="sR" value="${st.credit_rate}"></label><label class="field">Minimum deposit for credit (% of price)<input type="number" id="sD" value="${st.min_deposit}"></label>
      <label class="field">Days a reservation is held<input type="number" id="sH" value="${st.hold_days}"></label></div><div class="err" id="sErr"></div><div style="margin-top:12px"><button class="btn primary" id="sSave">Save settings</button></div></div>`,
    bind() {
      $('#sSave').onclick = async () => {
        $('#sErr').textContent = '';
        try {
          await API.post('settings.save', {
            business_name: fv(document, 'sN'),
            location: fv(document, 'sL'),
            phone: fv(document, 'sP'),
            pay_details: fv(document, 'sPd'),
            credit_rate: fv(document, 'sR'),
            min_deposit: fv(document, 'sD'),
            hold_days: fv(document, 'sH'),
          });
          await refresh('Settings saved');
        } catch (e) {
          $('#sErr').textContent = e.message;
        }
      };
    },
  };
}
const ACT = {
  login: 'Signed in',
  logout: 'Signed out',
  car_add: 'Added a car',
  car_update: 'Edited a car',
  car_status: 'Changed car status',
  car_delete: 'Removed a car',
  cost_add: 'Added a cost',
  cost_delete: 'Removed a cost',
  photos_add: 'Added photos',
  photo_delete: 'Deleted a photo',
  car_reserved: 'Reserved a car',
  car_sold: 'Sold a car',
  payment_add: 'Recorded a payment',
  sale_edit: 'Edited a sale',
  sale_void: 'Cancelled a sale',
  payment_void: 'Cancelled a payment',
  logbook: 'Logbook step',
  loan_add: 'New logbook loan',
  loan_edit: 'Edited a loan',
  loan_payment: 'Loan repayment',
  loan_status: 'Changed loan status',
  expense_add: 'Added an expense',
  expense_delete: 'Removed an expense',
  user_add: 'Added a person',
  user_save: 'Edited a person',
  settings_update: 'Changed settings',
  password_change: 'Changed password',
  seed_loaded: 'Loaded the spreadsheets',
  setup_complete: 'Set up the system',
};
function viewActivity() {
  return {
    title: 'Activity',
    sub: 'Who did what, most recent first',
    html: '<div id="aBox"><div class="card loading">Loading…</div></div>',
    async bind() {
      try {
        const r = await API.get('audit.list');
        $('#aBox').innerHTML =
          `${r.seed_issues.length ? `<div class="card"><div class="card-h"><h3>Points to check from the spreadsheets</h3><span class="sub">found when the data was loaded</span></div><ul class="issues">${r.seed_issues.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>` : ''}
          <div class="card"><div class="tbl-wrap"><table class="tbl"><tbody>${r.items
            .map((a) => {
              let d = '';
              try {
                const j = JSON.parse(a.details || '{}');
                d = Object.entries(j)
                  .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
                  .join(' · ');
              } catch (e) {}
              return `<tr><td class="nw muted">${esc(a.created_at.slice(0, 16))}</td><td>${esc(a.name || '—')}</td><td>${esc(ACT[a.action] || a.action)}${a.entity ? ` <span class="muted">${esc(a.entity)} ${a.entity_id || ''}</span>` : ''}</td><td class="muted" style="font-size:12px">${esc(d)}</td></tr>`;
            })
            .join('')}</tbody></table></div></div>`;
      } catch (e) {
        $('#aBox').innerHTML = `<div class="card err">${esc(e.message)}</div>`;
      }
    },
  };
}

const VIEWS = {
  dashboard: viewDashboard,
  stock: viewStock,
  create: viewCreate,
  logbookmgmt: viewLogbookMgmt,
  sales: viewSales,
  credit: viewCredit,
  loans: viewLoans,
  logbooks: viewLogbooks,
  reports: viewReports,
  staff: viewStaff,
  settings: viewSettings,
  activity: viewActivity,
};

('use strict');
