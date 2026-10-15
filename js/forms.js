/* eslint-disable no-alert -- the theme answers a form with an alert */
/* The contact and brief forms post to the Worker endpoint after a Turnstile check. */
(function forms() {
  'use strict';

  const ENDPOINT = '/api/message';
  const SENT = 'Thank you. Your message has been sent.';
  const ERRORS = { contact: 'Error.', brief: 'Error when submitting the form.' };
  const TURNSTILE_API = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  const TEST_SITEKEY = '1x00000000000000000000AA';
  // Replace with the sitekey that npm run infra prints.
  const SITEKEY = '1x00000000000000000000AA';
  const LOCAL = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const widgets = new Map();
  const pending = new Map();
  let api;

  function loadApi() {
    if (!api) {
      api = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = TURNSTILE_API;
        script.onload = () => resolve(window.turnstile);
        script.onerror = () => {
          api = null;
          reject(new Error('Turnstile did not load'));
        };
        document.head.appendChild(script);
      });
    }
    return api;
  }

  function widget(form) {
    if (!widgets.has(form)) {
      const settle = (method) => (value) => {
        const wait = pending.get(form);
        pending.delete(form);
        if (wait) wait[method](value);
      };
      const id = loadApi().then((turnstile) => {
        const box = document.createElement('div');
        form.querySelector('[type="submit"]').before(box);
        return turnstile.render(box, {
          sitekey: LOCAL ? TEST_SITEKEY : SITEKEY,
          appearance: 'interaction-only',
          execution: 'execute',
          callback: settle('resolve'),
          'error-callback': () => {
            settle('reject')(new Error('Turnstile failed'));
            return true;
          },
          'timeout-callback': () => settle('reject')(new Error('Turnstile timeout')),
        });
      });
      id.catch(() => widgets.delete(form));
      widgets.set(form, id);
    }
    return widgets.get(form);
  }

  function token(form, id) {
    return new Promise((resolve, reject) => {
      pending.set(form, { resolve, reject });
      window.turnstile.execute(id);
    });
  }

  function post(form) {
    const kind = form.getAttribute('name');
    const button = form.querySelector('[type="submit"]');
    let id;
    button.disabled = true;
    return widget(form)
      .then((widgetId) => {
        id = widgetId;
        return token(form, id);
      })
      .then((value) => {
        const data = new FormData(form);
        if (kind === 'brief') data.delete('files[]');
        data.set('cf-turnstile-response', value);
        const headers = { 'X-Requested-With': 'fetch' };
        return fetch(ENDPOINT, { method: 'POST', body: data, headers });
      })
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
        if (id !== undefined) window.turnstile.reset(id);
      });
  }

  document.querySelectorAll('form[name="contact"], form[name="brief"]').forEach((form) => {
    form.addEventListener('focusin', () => widget(form).catch(() => {}), { once: true });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      post(form);
    });
  });
}());
