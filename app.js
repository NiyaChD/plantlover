/* PlantLover — small runtime that runs the prototype screens as a normal web app.
   Each screen (screens.js) is a template with {{holes}}, <sc-if>/<sc-for> blocks and a
   Component class. This file turns them into Preact elements and handles navigation. */
(function () {
  'use strict';
  var h = preact.h, render = preact.render, PComponent = preact.Component;
  var SCREENS = window.PL_SCREENS || {};
  var START = 'Main';
  var cache = {};

  // ---------- Base class the screens extend ----------
  function DCLogic(props) { this.props = props || {}; this.state = {}; }
  DCLogic.prototype.setState = function (patch, cb) {
    var p = typeof patch === 'function' ? patch(this.state, this.props) : patch;
    this.state = Object.assign({}, this.state, p || {});
    if (this.__host) this.__host.schedule();
    if (cb) cb();
  };
  DCLogic.prototype.forceUpdate = function () { if (this.__host) this.__host.schedule(); };

  // ---------- Prepare a screen (parse once) ----------
  function prep(name) {
    if (cache[name]) return cache[name];
    var src = SCREENS[name];
    var body = (src.match(/<x-dc>([\s\S]*?)<\/x-dc>/) || [, ''])[1];
    var helmet = (body.match(/<helmet>([\s\S]*?)<\/helmet>/) || [, ''])[1];
    body = body.replace(/<helmet>[\s\S]*?<\/helmet>/, '')
      .replace(/<sc-(if|for)\b/g, '<template data-sc="$1"')
      .replace(/<\/sc-(if|for)>/g, '</template>');
    var tpl = document.createElement('template');
    tpl.innerHTML = body;
    // Make the fixed 390px artboard fill the phone screen
    var root = tpl.content.firstElementChild;
    if (root) {
      var st = root.getAttribute('style') || '';
      st = st.replace(/width:\s*390px;\s*height:\s*\d+px;/, 'width: 100%; max-width: 480px; margin: 0 auto; height: 100%; overflow-y: auto; overflow-x: hidden;')
        .replace(/;\s*overflow:\s*hidden/, '');
      root.setAttribute('style', st);
    }
    // Safari ignores bottom padding at the end of a scrolling flex column, so the last
    // items could not be scrolled into view. Move that padding into a real spacer.
    Array.prototype.forEach.call(tpl.content.querySelectorAll('[style]'), function (el) {
      var st = el.getAttribute('style');
      if (!/overflow-y:\s*auto/.test(st)) return;
      var pb = 0, m = /(?:^|;)\s*padding:\s*([^;]+)/.exec(st);
      if (m) { var parts = m[1].trim().split(/\s+/); pb = parseFloat(parts.length >= 3 ? parts[2] : parts[0]) || 0; }
      var m2 = /padding-bottom:\s*([\d.]+)px/.exec(st); if (m2) pb = parseFloat(m2[1]);
      el.setAttribute('style', st + '; padding-bottom: 0; -webkit-overflow-scrolling: touch; overscroll-behavior: contain');
      el.setAttribute('class', ((el.getAttribute('class') || '') + ' pl-scroll').trim());
      var spacer = document.createElement('div');
      spacer.setAttribute('aria-hidden', 'true');
      spacer.setAttribute('style', 'flex: 0 0 auto; width: 100%; height: calc(' + pb + 'px + env(safe-area-inset-bottom))');
      el.appendChild(spacer);
    });
    Array.prototype.forEach.call(tpl.content.querySelectorAll('nav[style]'), function (nav) {
      nav.setAttribute('style', nav.getAttribute('style').replace('position: absolute; left: 16px; right: 16px; bottom: 18px',
        'position: fixed; z-index: 5; left: max(16px, calc(50% - 224px)); right: max(16px, calc(50% - 224px)); bottom: calc(18px + env(safe-area-inset-bottom))'));
    });
    var sm = src.match(/<script type="text\/x-dc"[^>]*?data-props='([^']*)'[^>]*>([\s\S]*?)<\/script>/);
    var props = {};
    try { var defs = JSON.parse(sm[1]); Object.keys(defs).forEach(function (k) { if (k.charAt(0) !== '$' && defs[k] && 'default' in defs[k]) props[k] = defs[k]['default']; }); } catch (e) {}
    var Cls = new Function('DCLogic', sm[2] + '\nreturn Component;')(DCLogic);
    var title = (src.match(/<title>([^<]*)<\/title>/) || [, 'PlantLover'])[1];
    return (cache[name] = { nodes: Array.prototype.slice.call(tpl.content.childNodes), head: helmet, Cls: Cls, props: props, title: title });
  }

  // ---------- Holes ----------
  var ONE = /^\{\{\s*([\w$.]+)\s*\}\}$/;
  var ANY = /\{\{\s*([\w$.]+)\s*\}\}/g;
  function lookup(path, scopes) {
    if (path === 'true') return true;
    if (path === 'false') return false;
    var parts = path.split('.');
    for (var i = scopes.length - 1; i >= 0; i--) {
      var s = scopes[i];
      if (s && Object.prototype.hasOwnProperty.call(s, parts[0])) {
        var v = s;
        for (var j = 0; j < parts.length; j++) { if (v == null) return undefined; v = v[parts[j]]; }
        return v;
      }
    }
    return undefined;
  }
  function interp(str, scopes) {
    return str.replace(ANY, function (_, p) { var v = lookup(p, scopes); return v == null ? '' : String(v); });
  }

  // ---------- Template -> Preact elements ----------
  var EVENTS = { onclick: 'onClick', onkeydown: 'onKeyDown', onkeyup: 'onKeyUp', oninput: 'onInput', onblur: 'onBlur', onfocus: 'onFocus', onsubmit: 'onSubmit' };
  function convList(nodes, scopes, out) {
    for (var i = 0; i < nodes.length; i++) conv(nodes[i], scopes, out);
    return out;
  }
  function conv(node, scopes, out) {
    if (node.nodeType === 3) { out.push(interp(node.nodeValue, scopes)); return; }
    if (node.nodeType !== 1) return;
    var tag = node.localName;
    if (tag === 'template' && node.getAttribute('data-sc')) {
      var kids = node.content.childNodes;
      if (node.getAttribute('data-sc') === 'if') {
        var m = (node.getAttribute('value') || '').match(ONE);
        if (m && lookup(m[1], scopes)) convList(kids, scopes, out);
      } else {
        var lm = (node.getAttribute('list') || '').match(ONE);
        var list = lm ? lookup(lm[1], scopes) : null, as = node.getAttribute('as');
        if (Array.isArray(list)) list.forEach(function (item) { var sc = {}; sc[as] = item; convList(kids, scopes.concat([sc]), out); });
      }
      return;
    }
    var props = {}, attrs = node.attributes;
    var type = (node.getAttribute('type') || '').toLowerCase();
    for (var a = 0; a < attrs.length; a++) {
      var name = attrs[a].name, val = attrs[a].value;
      if (name.indexOf('hint-') === 0) continue;
      var one = val.match(ONE);
      if (name.indexOf('on') === 0) {
        var fn = one ? lookup(one[1], scopes) : null;
        if (typeof fn !== 'function') continue;
        var ev = EVENTS[name];
        if (name === 'onchange') ev = ((tag === 'input' && ['file', 'checkbox', 'radio'].indexOf(type) === -1) || tag === 'textarea') ? 'onInput' : 'onChange';
        if (ev) props[ev] = fn;
        continue;
      }
      if (one) { var v = lookup(one[1], scopes); if (v !== undefined) props[name] = v; }
      else props[name] = val.indexOf('{{') === -1 ? val : interp(val, scopes);
    }
    if (tag === 'a') {
      var href = props.href || '';
      var target = /^([\w-]+)\.dc\.html$/.exec(href);
      if (target || href === '#') {
        var orig = props.onClick, dest = target && target[1];
        props.href = dest ? '#/' + dest : '#';
        props.onClick = function (e) { if (orig) orig(e); if (e) e.preventDefault(); if (dest) go(dest); };
      }
    }
    out.push(h.apply(null, [tag, props].concat(convList(node.childNodes, scopes, []))));
  }

  // ---------- Host component for one screen ----------
  function Host(p) {
    PComponent.call(this, p);
    var d = prep(p.name);
    this.inst = new d.Cls(Object.assign({}, d.props));
    this.inst.__host = this;
  }
  Host.prototype = Object.create(PComponent.prototype);
  Host.prototype.constructor = Host;
  Host.prototype.schedule = function () {
    var self = this;
    if (self._q || self._dead) return;
    self._q = true;
    Promise.resolve().then(function () { self._q = false; if (!self._dead) PComponent.prototype.forceUpdate.call(self); });
  };
  Host.prototype.componentDidMount = function () { if (this.inst.componentDidMount) this.inst.componentDidMount(); };
  Host.prototype.componentWillUnmount = function () { this._dead = true; if (this.inst.componentWillUnmount) this.inst.componentWillUnmount(); };
  Host.prototype.render = function () {
    var vals = this.inst.renderVals ? this.inst.renderVals() : {};
    return h(preact.Fragment, null, convList(prep(this.props.name).nodes, [vals], []));
  };

  // ---------- Navigation ----------
  var mount = document.getElementById('app');
  var headSlot = document.getElementById('screen-head');
  // Stay logged in: someone who logged in (or signed up) on this device opens straight into the garden
  // until they tap Log out. The welcome screen is only the start for people who are not logged in.
  function loggedIn() { try { return !!window.localStorage.getItem('plantlover-current'); } catch (e) { return false; } }
  function current() { var m = /^#\/([\w-]+)/.exec(location.hash); return m && SCREENS[m[1]] ? m[1] : (loggedIn() ? 'Home' : START); }
  if (!/^#\/[\w-]+/.test(location.hash) || location.hash === '#/Main') { if (loggedIn()) history.replaceState(null, '', '#/Home'); }
  function go(name) { if (current() === name) draw(); else location.hash = '#/' + name; }
  function draw() {
    var name = current(), d = prep(name);
    headSlot.innerHTML = d.head;
    document.title = 'PlantLover · ' + d.title;
    render(h(Host, { name: name, key: name }), mount);
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', draw);
  document.addEventListener('submit', function (e) { e.preventDefault(); }, true);
  draw();
})();
