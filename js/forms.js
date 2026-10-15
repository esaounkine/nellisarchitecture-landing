/* eslint-disable no-alert -- the theme answers a form with an alert */
/* The contact and brief forms post to the Worker endpoint. */
(function forms() {
  'use strict';

  const ENDPOINT = '/api/message';
  const SENT = 'Thank you. Your message has been sent.';
  const ERRORS = { contact: 'Error.', brief: 'Error when submitting the form.' };

  function post(form) {
    const kind = form.getAttribute('name');
    const data = new FormData(form);
    if (kind === 'brief') data.delete('files[]');
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    return fetch(ENDPOINT, { method: 'POST', body: data, headers: { 'X-Requested-With': 'fetch' } })
      .then((response) => {
        if (!response.ok) throw new Error(response.status);
        alert(SENT);
        form.reset();
        form.querySelectorAll('.loadingFile').forEach((label) => {
          label.style.display = 'none'; // eslint-disable-line no-param-reassign
        });
      })
      .catch(() => alert(ERRORS[kind]))
      .finally(() => {
        button.disabled = false;
      });
  }

  document.querySelectorAll('form[name="contact"], form[name="brief"]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      post(form);
    });
  });
}());
