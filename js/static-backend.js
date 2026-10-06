/*
 * static-backend.js — replaces the WordPress admin-ajax.php endpoints with
 * static JSON/HTML data. The original theme scripts (project overlay, project
 * filters, news switcher, live search) keep working unchanged.
 */
(function staticBackend() {
  'use strict';

  const REAL_XHR = window.XMLHttpRequest;
  const realFetch = window.fetch ? window.fetch.bind(window) : null;
  const cache = {};

  function getJSON(url) {
    if (!cache[url]) {
      cache[url] = realFetch(url).then((r) => r.json());
    }
    return cache[url];
  }
  function getText(url) {
    if (!cache[url]) {
      cache[url] = realFetch(url).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      });
    }
    return cache[url];
  }

  /* Returns a Promise<string> with the response body, or null if unknown. */
  function handleAdminAjax(url, body) {
    const qs = (url || '').split('?')[1] || '';
    const p = new URLSearchParams(qs);
    new URLSearchParams(body || '').forEach((v, k) => {
      p.set(k, v);
    });
    const action = p.get('action');

    if (action === 'get_post_by_field_project') {
      const title = p.get('field_value');
      return getJSON('/data/projects.json').then((d) => JSON.stringify(d[title] || []));
    }

    if (action === 'get_filtered_projects') {
      const cur = decodeURIComponent(p.get('currentUrl') || '');
      const rc = p.get('residentalCommercialIF') || '1';
      let key = cur.toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_+|_+$/g, '');
      if (!key) key = 'all';
      return getText(`/data/filters/${key}_${rc}.html`)
        .catch(() => getText('/data/filters/all_1.html'));
    }

    if (action === 'get_post_by_field') {
      const id = p.get('post_identifier');
      return getJSON('/data/news.json').then((d) => {
        if (d[id]) return JSON.stringify(d[id]);
        /* allow lookup by slug too */
        const k = Object.keys(d).find((key) => d[key].data && d[key].data.slug === id);
        return JSON.stringify(k ? d[k] : { success: false });
      });
    }

    if (action === 'my_action') {
      const q = (p.get('inputVal') || '').toLowerCase();
      return getJSON('/data/search.json').then((d) => {
        const hits = d.filter((e) => e.title.toLowerCase().indexOf(q) !== -1);
        return JSON.stringify({ success: true, data: hits });
      });
    }

    return null;
  }

  /* ---- XMLHttpRequest shim ---- */
  function ShimXHR() {
    this.readyState = 0;
    this.status = 0;
    this.responseText = '';
    this.onreadystatechange = null;
    this._real = null;
    this._headers = [];
  }
  ShimXHR.UNSENT = 0;
  ShimXHR.OPENED = 1;
  ShimXHR.HEADERS_RECEIVED = 2;
  ShimXHR.LOADING = 3;
  ShimXHR.DONE = 4;

  ShimXHR.prototype.open = function open(method, url, ...rest) {
    if (/admin-ajax\.php/.test(url)) {
      this._ajax = true;
      this._url = url;
      this.readyState = 1;
    } else {
      this._ajax = false;
      this._real = new REAL_XHR();
      this._real.open(method, url, ...rest);
    }
  };
  ShimXHR.prototype.setRequestHeader = function setRequestHeader(k, v) {
    if (this._real) this._real.setRequestHeader(k, v);
  };
  ShimXHR.prototype.send = function send(body) {
    const self = this;
    if (this._real) {
      this._real.onreadystatechange = function onReadyStateChange() {
        self.readyState = self._real.readyState;
        self.status = self._real.status;
        self.responseText = self._real.responseText;
        self.response = self._real.response;
        if (self.onreadystatechange) self.onreadystatechange();
      };
      this._real.send(body);
      return;
    }
    let pr = handleAdminAjax(self._url || '', body);
    if (!pr) pr = Promise.resolve(JSON.stringify({ success: false }));
    pr.then((text) => {
      self.readyState = 4;
      self.status = 200;
      self.responseText = text;
      if (self.onreadystatechange) self.onreadystatechange();
    });
  };
  ShimXHR.prototype.abort = function abort() {
    if (this._real) this._real.abort();
  };
  ShimXHR.prototype.getResponseHeader = function getResponseHeader() {
    return null;
  };
  ShimXHR.prototype.getAllResponseHeaders = function getAllResponseHeaders() {
    return '';
  };

  window.XMLHttpRequest = ShimXHR;

  /* ---- fetch shim (used by the live search) ---- */
  if (realFetch) {
    window.fetch = function shimFetch(input, init) {
      const url = typeof input === 'string' ? input : input.url;
      if (/admin-ajax\.php/.test(url)) {
        const body = init && init.body ? init.body.toString() : '';
        let pr = handleAdminAjax(url, body);
        if (!pr) pr = Promise.resolve(JSON.stringify({ success: false }));
        return pr.then((text) => ({
          ok: true,
          status: 200,
          json() {
            return Promise.resolve(JSON.parse(text));
          },
          text() {
            return Promise.resolve(text);
          },
        }));
      }
      return realFetch(input, init);
    };
  }
}());
