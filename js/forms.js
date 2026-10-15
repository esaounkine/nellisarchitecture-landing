/* eslint-disable no-alert -- the theme answers a form with an alert */
/* The contact and brief forms post to the Worker endpoint after a Turnstile check. */
(function forms() {
  'use strict';

  const ENDPOINT = '/api/message';
  const SENT = 'Thank you. Your message has been sent.';
  // worker/files.js has the same limits (test/worker-files.test.js checks them).
  const MAX_FILES = 5;
  const MAX_FILE_BYTES = 5000000;
  const EXTENSIONS = ['.gif', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.pdf'];
  const TOO_LARGE = 'too large (max 5 MB)';
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

  function problem(file) {
    if (file.size > MAX_FILE_BYTES) return `${file.name}: ${TOO_LARGE}`;
    const name = file.name.toLowerCase();
    if (!EXTENSIONS.some((ext) => name.endsWith(ext))) return `${file.name}: file type not allowed`;
    return null;
  }

  function problems(files) {
    const list = files.map(problem).filter(Boolean);
    if (files.length > MAX_FILES) list.unshift(`No more than ${MAX_FILES} files.`);
    return list;
  }

  function progressBar(form, file) {
    const rows = Array.from(form.querySelectorAll('.loadingFile'));
    const row = rows.find((item) => item.style.display === 'flex'
      && item.querySelector('.loadingFile__name').textContent === file.name);
    if (!row) return null;
    row.querySelector('.loadingFile__scrollContainer').style.display = '';
    return row.querySelector('.loadingFile__scrollBar');
  }

  /* Resolves with an error text, or null when the file is stored. */
  function upload(form, file, url) {
    const bar = progressBar(form, file);
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url);
      xhr.upload.onprogress = (event) => {
        if (!bar || !event.lengthComputable) return;
        bar.style.width = `${(event.loaded / event.total) * 100}%`;
      };
      xhr.onload = () => {
        if (xhr.status === 201) resolve(null);
        else resolve(`${file.name}: ${xhr.status === 413 ? TOO_LARGE : 'upload failed'}`);
      };
      xhr.onerror = () => resolve(`${file.name}: upload failed`);
      xhr.send(file);
    });
  }

  /* One file at a time, then the send call. Rejects with the error rows. */
  function uploadAll(form, files, data) {
    const uploads = files.reduce((chain, file, i) => chain
      .then((errors) => upload(form, file, data.uploads[i].url)
        .then((error) => (error ? [...errors, error] : errors))), Promise.resolve([]));
    return uploads.then((errors) => {
      if (errors.length) throw Object.assign(new Error('upload'), { rows: errors });
      const url = `${ENDPOINT}/${data.id}/send?exp=${data.exp}&sig=${data.sendSig}`;
      return fetch(url, { method: 'POST', headers: { 'X-Requested-With': 'fetch' } });
    });
  }

  function post(form) {
    const kind = form.getAttribute('name');
    const button = form.querySelector('[type="submit"]');
    const input = form.querySelector('input[type="file"]');
    const files = input ? Array.from(input.files) : [];
    const bad = problems(files);
    let id;
    if (bad.length) {
      alert(bad.join('\n'));
      return Promise.resolve();
    }
    button.disabled = true;
    return widget(form)
      .then((widgetId) => {
        id = widgetId;
        return token(form, id);
      })
      .then((value) => {
        const data = new FormData(form);
        if (kind === 'brief') data.delete('files[]');
        const manifest = files.map(({ name, size }) => ({ name, size }));
        if (files.length) data.set('files', JSON.stringify(manifest));
        data.set('cf-turnstile-response', value);
        const headers = { 'X-Requested-With': 'fetch' };
        return fetch(ENDPOINT, { method: 'POST', body: data, headers });
      })
      .then((response) => {
        if (!response.ok || !files.length) return response;
        return response.json().then((data) => uploadAll(form, files, data));
      })
      .then((response) => {
        if (!response.ok) throw new Error(response.status);
        alert(SENT);
        form.reset();
        form.querySelectorAll('.loadingFile').forEach((label) => {
          label.style.display = 'none'; // eslint-disable-line no-param-reassign
        });
      })
      .catch((error) => alert(error.rows ? error.rows.join('\n') : ERRORS[kind]))
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
