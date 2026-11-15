/* ---------- API ---------- */
const API = {
  csrf: null,
  async req(r, opts = {}) {
    const url =
      'api/?r=' +
      encodeURIComponent(r) +
      (opts.params ? '&' + new URLSearchParams(opts.params) : '');
    const init = { method: opts.method || 'GET', credentials: 'same-origin', headers: {} };
    if (init.method === 'POST') {
      init.headers['X-CSRF-Token'] = API.csrf || '';
      if (opts.form) {
        init.body = opts.form;
      } else {
        init.headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(opts.body || {});
      }
    }
    let res, data;
    try {
      res = await fetch(url, init);
      data = await res.json();
    } catch (e) {
      throw new Error('Could not reach the server. Check your internet connection.');
    }
    if (res.status === 401 && r !== 'auth.login') {
      App.me = null;
      render();
      throw new Error(data.error || 'Please sign in.');
    }
    if (res.status === 419) {
      await API.refresh();
      throw new Error('Your session was refreshed. Please try again.');
    }
    if (!res.ok) throw new Error(data.error || 'Something went wrong.');
    return data;
  },
  get(r, params) {
    return API.req(r, { params });
  },
  post(r, body) {
    return API.req(r, { method: 'POST', body });
  },
  upload(r, form) {
    return API.req(r, { method: 'POST', form });
  },
  async refresh() {
    const m = await API.get('auth.me');
    API.csrf = m.csrf;
    return m;
  },
};

('use strict');
