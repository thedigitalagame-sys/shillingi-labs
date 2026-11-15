/* ---------- sign in ---------- */
function viewLogin() {
  return `<div class="lg"><div class="lg-card"><div class="lg-logo">${brandHTML()}</div>
      <h1>Login</h1><p class="lg-sub">Access the ${esc(App.business.replace(/\s+\S+$/, (m) => (App.location && m.trim().toLowerCase() === App.location.toLowerCase() ? '' : m)))} system</p>
      <form id="lf" autocomplete="on"><label class="lg-in">${IC.mail}<input type="email" id="le" autocomplete="username" placeholder="Email" aria-label="Email" required></label>
        <label class="lg-in">${IC.lock}<input type="password" id="lp" autocomplete="current-password" placeholder="Password" aria-label="Password" required><button type="button" class="lg-eye" id="lpEye" aria-label="Show password">${IC.eye}</button></label>
        <div class="lg-row"><label class="lg-ck"><input type="checkbox" id="lr"> Remember me</label><a href="#" id="lgForgot">Forgot password?</a></div>
        <div class="err" id="lerr"></div><button class="btn red lg-btn">Login</button></form></div>
    <div class="lg-pow">${POWERED}</div></div>`;
}
function bindLogin() {
  $('#lpEye').onclick = () => {
    const p = $('#lp'),
      show = p.type === 'password';
    p.type = show ? 'text' : 'password';
    $('#lpEye').innerHTML = show ? IC.eyeOff : IC.eye;
    $('#lpEye').setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  };
  $('#lgForgot').onclick = (e) => {
    e.preventDefault();
    $('#lerr').textContent = '';
    modal(
      'Forgot your password?',
      '<p style="margin:0">Ask the owner to set a new password for you under <b>Staff</b>. If you are the owner, contact Shilingi Labs Tech Solutions to reset it.</p>',
      [{ label: 'OK', cls: 'primary' }]
    );
  };
  $('#lf').onsubmit = async (e) => {
    e.preventDefault();
    $('#lerr').textContent = '';
    const b = $('#lf .lg-btn');
    b.disabled = true;
    try {
      const r = await API.post('auth.login', {
        email: $('#le').value,
        password: $('#lp').value,
        remember: $('#lr').checked,
      });
      API.csrf = r.csrf;
      await loadState();
      location.hash = '#/' + navFor()[0][0];
      render();
    } catch (err) {
      $('#lerr').textContent = err.message;
    } finally {
      b.disabled = false;
    }
  };
}
function passwordModal() {
  modal(
    'Change your password',
    `<label class="field">Current password<input type="password" id="pc"></label><label class="field">New password (8+ characters, letters and numbers)<input type="password" id="pn"></label>`,
    [
      { label: 'Cancel' },
      {
        label: 'Change password',
        cls: 'primary',
        fn: async (bg) => {
          await API.post('auth.password', { current: fv(bg, 'pc'), new: fv(bg, 'pn') });
          toast('Password changed');
        },
      },
    ]
  );
}

('use strict');
