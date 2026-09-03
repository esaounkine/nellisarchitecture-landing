/*
 * static-backend.js — replaces the WordPress admin-ajax.php endpoints with
 * static JSON/HTML data. The original theme scripts (project overlay, project
 * filters, news switcher, live search) keep working unchanged.
 */
(function () {
  "use strict";

  var REAL_XHR = window.XMLHttpRequest;
  var realFetch = window.fetch ? window.fetch.bind(window) : null;
  var cache = {};

  function getJSON(url) {
    if (!cache[url]) {
      cache[url] = realFetch(url).then(function (r) { return r.json(); });
    }
    return cache[url];
  }
  function getText(url) {
    if (!cache[url]) {
      cache[url] = realFetch(url).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      });
    }
    return cache[url];
  }

  /* Returns a Promise<string> with the response body, or null if unknown. */
  function handleAdminAjax(url, body) {
    var qs = (url || "").split("?")[1] || "";
    var p = new URLSearchParams(qs);
    new URLSearchParams(body || "").forEach(function (v, k) { p.set(k, v); });
    var action = p.get("action");

    if (action === "get_post_by_field_project") {
      var title = p.get("field_value");
      return getJSON("/data/projects.json").then(function (d) {
        return JSON.stringify(d[title] || []);
      });
    }

    if (action === "get_filtered_projects") {
      var cur = decodeURIComponent(p.get("currentUrl") || "");
      var rc = p.get("residentalCommercialIF") || "1";
      var key = cur.toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_+|_+$/g, "");
      if (!key) key = "all";
      return getText("/data/filters/" + key + "_" + rc + ".html")
        .catch(function () { return getText("/data/filters/all_1.html"); });
    }

    if (action === "get_post_by_field") {
      var id = p.get("post_identifier");
      return getJSON("/data/news.json").then(function (d) {
        if (d[id]) return JSON.stringify(d[id]);
        /* allow lookup by slug too */
        for (var k in d) {
          if (d[k].data && d[k].data.slug === id) return JSON.stringify(d[k]);
        }
        return JSON.stringify({ success: false });
      });
    }

    if (action === "my_action") {
      var q = (p.get("inputVal") || "").toLowerCase();
      return getJSON("/data/search.json").then(function (d) {
        var hits = d.filter(function (e) {
          return e.title.toLowerCase().indexOf(q) !== -1;
        });
        return JSON.stringify({ success: true, data: hits });
      });
    }

    return null;
  }

  /* ---- XMLHttpRequest shim ---- */
  function ShimXHR() {
    this.readyState = 0;
    this.status = 0;
    this.responseText = "";
    this.onreadystatechange = null;
    this._real = null;
    this._headers = [];
  }
  ShimXHR.UNSENT = 0;
  ShimXHR.OPENED = 1;
  ShimXHR.HEADERS_RECEIVED = 2;
  ShimXHR.LOADING = 3;
  ShimXHR.DONE = 4;

  ShimXHR.prototype.open = function (method, url) {
    if (/admin-ajax\.php/.test(url)) {
      this._ajax = true;
      this._url = url;
      this.readyState = 1;
    } else {
      this._ajax = false;
      this._real = new REAL_XHR();
      this._real.open.apply(this._real, arguments);
    }
  };
  ShimXHR.prototype.setRequestHeader = function (k, v) {
    if (this._real) this._real.setRequestHeader(k, v);
  };
  ShimXHR.prototype.send = function (body) {
    var self = this;
    if (this._real) {
      this._real.onreadystatechange = function () {
        self.readyState = self._real.readyState;
        self.status = self._real.status;
        self.responseText = self._real.responseText;
        self.response = self._real.response;
        if (self.onreadystatechange) self.onreadystatechange();
      };
      this._real.send(body);
      return;
    }
    var pr = handleAdminAjax(self._url || "", body);
    if (!pr) pr = Promise.resolve(JSON.stringify({ success: false }));
    pr.then(function (text) {
      self.readyState = 4;
      self.status = 200;
      self.responseText = text;
      if (self.onreadystatechange) self.onreadystatechange();
    });
  };
  ShimXHR.prototype.abort = function () { if (this._real) this._real.abort(); };
  ShimXHR.prototype.getResponseHeader = function () { return null; };
  ShimXHR.prototype.getAllResponseHeaders = function () { return ""; };

  window.XMLHttpRequest = ShimXHR;

  /* ---- fetch shim (used by the live search) ---- */
  if (realFetch) {
    window.fetch = function (input, init) {
      var url = typeof input === "string" ? input : input.url;
      if (/admin-ajax\.php/.test(url)) {
        var body = init && init.body ? init.body.toString() : "";
        var pr = handleAdminAjax(url, body);
        if (!pr) pr = Promise.resolve(JSON.stringify({ success: false }));
        return pr.then(function (text) {
          return {
            ok: true,
            status: 200,
            json: function () { return Promise.resolve(JSON.parse(text)); },
            text: function () { return Promise.resolve(text); }
          };
        });
      }
      return realFetch(input, init);
    };
  }
})();
