/* ---------- modal ---------- */
function modal(title, body, actions = [], wide) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal ${wide ? (wide === 'xwide' ? 'wide xwide' : 'wide') : ''}" role="dialog" aria-modal="true"><div class="modal-h"><h3>${title}</h3><button type="button" aria-label="Close" data-x>&times;</button></div><div class="modal-b">${body}<div class="err" data-err></div></div><div class="modal-f"></div></div>`;
  const f = $('.modal-f', bg),
    close = () => {
      bg.remove();
      document.removeEventListener('keydown', onKey);
    };
  const onKey = (e) => {
    if (e.key === 'Escape' && document.body.lastElementChild === bg) close();
  };
  bg._close = close;
  actions.forEach((a) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn ' + (a.cls || '');
    b.innerHTML = a.label;
    b.onclick = async () => {
      if (!a.fn) {
        close();
        return;
      }
      $('[data-err]', bg).textContent = '';
      b.disabled = true;
      try {
        const r = await a.fn(bg);
        if (r !== false) close();
      } catch (e) {
        $('[data-err]', bg).textContent = e.message;
      } finally {
        b.disabled = false;
      }
    };
    f.appendChild(b);
  });
  bg.addEventListener('click', (e) => {
    if (e.target.hasAttribute('data-x')) close();
  });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(bg);
  return bg;
}
const fv = (bg, id) => {
  const el = $('#' + id, bg);
  if (!el) return undefined;
  return el.type === 'checkbox' ? el.checked : el.value.trim();
};
function confirmBox(title, text, label, fn, reason) {
  modal(
    title,
    `<p style="margin:0">${text}</p>${reason ? '<label class="field">Reason<input id="cfR" maxlength="200"></label>' : ''}`,
    [
      { label: 'Cancel' },
      {
        label,
        cls: 'primary',
        fn: async (bg) => {
          if (reason && !fv(bg, 'cfR')) throw new Error('Give a reason.');
          await fn(reason ? fv(bg, 'cfR') : null);
        },
      },
    ]
  );
}

('use strict');
