/* contato.js — lógica da página Contato */
(function () {
  'use strict';

  var form = document.getElementById('contact-form');
  var statusEl = document.getElementById('form-status');

  if (!form) return;

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    var btn = form.querySelector('button[type="submit"]');
    var originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Enviando…';
    statusEl.textContent = '';
    statusEl.className = 'form-status';

    var formData = new FormData(form);
    fetch(form.action, {
      method: 'POST',
      body: formData,
      headers: { 'Accept': 'application/json' }
    })
    .then(function(r) {
      if (r.ok) {
        statusEl.textContent = 'Mensagem enviada! Respondo em breve.';
        statusEl.className = 'form-status success';
        form.reset();
      } else {
        return r.json().then(function(err) {
          throw new Error(err.errors ? err.errors.map(function(e) { return e.message; }).join(', ') : 'Erro ao enviar');
        });
      }
    })
    .catch(function(err) {
      statusEl.textContent = err.message || 'Erro ao enviar. Tente pelo WhatsApp ou e-mail direto.';
      statusEl.className = 'form-status error';
    })
    .finally(function() {
      btn.disabled = false;
      btn.textContent = 'Enviar mensagem';
    });
  });
})();