/* ---------- start ---------- */
(async () => {
  if (window.Chart) {
    Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
    Chart.defaults.font.size = 12;
    Chart.defaults.color = '#5E6A7D';
  }
  try {
    const m = await API.refresh();
    App.business = m.business;
    App.location = m.location || '';
    if (m.user) {
      await loadState();
    }
  } catch (e) {
    $('#app').innerHTML = `<div class="loading">${esc(e.message)} <a href="">Try again</a></div>`;
    return;
  }
  render();
})();
('use strict');
