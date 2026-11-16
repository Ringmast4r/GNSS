/* GNSS // Tracker: the page. Orbits from js/orbits.js, the receiver from js/nmea.js.
 * One tick a second: positions, stats, and whichever tab is open. Rise / set and sky tracks once a
 * minute or when the observer or the mask changes. The observer, mask, theme, rail and tab are
 * remembered in this browser only; nothing leaves it. */
(function () {
  'use strict';
  var O = window.GNSSOrbits, N = window.GNSSNmea;
  var root = document.documentElement;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function put(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  var STALE_DAYS = 14, TRACK_MIN = 120, PRUNE_MS = 12000;
  var DEFAULT = { lat: 51.4779, lon: -0.0015, label: 'Greenwich, the default' };
  var SYS_LETTER = { GPS: 'G', GLONASS: 'R', Galileo: 'E', BeiDou: 'C', QZSS: 'J', NavIC: 'I', SBAS: 'S', Other: '?' };

  var S = {
    sats: [], byPrn: {}, orbitsFrom: '', epochAge: null,
    obs: null, obsLabel: '', mask: 10, sel: null, tab: 'sky', now: new Date(),
    st: {}, pass: {}, tracks: {}, dop: null, passAt: 0,
    sort: { key: 'el', asc: false }, mapAll: true, base: 'streets'
  };
  var rx = new N.Receiver(), rxActive = false, rxLive = false, rxError = null, logLines = [], logDirty = false;

  /* ---------------------------------------------------------------- format */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function t12(d, secs) {
    var h = d.getHours(), m = d.getMinutes();
    return ((h % 12) || 12) + ':' + pad(m) + (secs ? ':' + pad(d.getSeconds()) : '') + ' ' + (h < 12 ? 'AM' : 'PM');
  }
  function utc(d) { return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds()); }
  function dayTag(d) {
    var a = new Date(S.now); a.setHours(0, 0, 0, 0);
    var b = new Date(d); b.setHours(0, 0, 0, 0);
    var diff = Math.round((b - a) / 864e5);
    return diff === 0 ? '' : diff === 1 ? ' tomorrow' : ' ' + (b.getMonth() + 1) + '/' + b.getDate();
  }
  function when(d) { return d ? t12(d) + dayTag(d) : '-'; }
  function lat(v) { return Math.abs(v).toFixed(4) + '°' + (v >= 0 ? 'N' : 'S'); }
  function lon(v) { return Math.abs(v).toFixed(4) + '°' + (v >= 0 ? 'E' : 'W'); }
  function deg(v, dp) { return v == null ? '-' : v.toFixed(dp == null ? 0 : dp) + '°'; }
  function km(v) { return v == null ? '-' : Math.round(v).toLocaleString('en-US'); }
  function prn2(p) { return p == null ? '--' : pad(p); }
  function compass(az) { return ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(az / 22.5) % 16]; }
  function launchOf(s) { return s.launched || (s.launchYear ? String(s.launchYear) : '-'); }

  /* ---------------------------------------------------------------- house frame */
  function initFrame() {
    if (window.NWGlobe) NWGlobe.mount(document.querySelector('.brand .mark'), { mark: true });
    $('theme').addEventListener('click', function () {
      var dark = root.getAttribute('data-theme') === 'dark';
      root.setAttribute('data-theme', dark ? 'light' : 'dark');
      put('gnss-theme', dark ? 'light' : 'dark');
      if (map) styleMapPaths();
    });
    function rail(hidden) {
      $('app').classList.toggle('rail-collapsed', hidden);
      $('btn-show').classList.toggle('hidden', !hidden);
      put('gnss-rail', hidden ? 'hidden' : 'shown');
      if (map) setTimeout(function () { map.invalidateSize(); }, 50);
    }
    $('btn-hide').addEventListener('click', function () { rail(true); });
    $('btn-show').addEventListener('click', function () { rail(false); });
    if (get('gnss-rail') === 'hidden') rail(true);
    if (/(^|\.)networks-corp\.com$/i.test(location.hostname)) $('hub-link').classList.remove('hidden');
    document.querySelectorAll('#tabs button').forEach(function (b) {
      b.addEventListener('click', function () { showTab(b.dataset.tab); });
    });
  }
  function showTab(name) {
    S.tab = name; put('gnss-tab', name);
    document.querySelectorAll('#tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === name); b.setAttribute('aria-selected', b.dataset.tab === name); });
    document.querySelectorAll('.pane').forEach(function (p) { p.classList.toggle('hidden', p.dataset.pane !== name); });
    if (name === 'map') { initMap(); setTimeout(function () { map.invalidateSize(); updateMap(true); }, 30); }
    render(true);
  }

  /* ---------------------------------------------------------------- observer */
  function initObserver() {
    var q = new URLSearchParams(location.search), qa = parseFloat(q.get('lat')), qo = parseFloat(q.get('lon'));
    var saved = null; try { saved = JSON.parse(get('gnss-obs') || 'null'); } catch (e) {}
    var m = parseInt(get('gnss-mask'), 10); if (!isNaN(m)) { S.mask = m; $('mask').value = String(m); }
    if (!isNaN(qa) && !isNaN(qo)) setObserver(qa, qo, 'From the link', false);
    else if (saved && typeof saved.lat === 'number') setObserver(saved.lat, saved.lon, saved.label || 'Saved in this browser', false);
    else setObserver(DEFAULT.lat, DEFAULT.lon, DEFAULT.label, false);
    $('observer').addEventListener('submit', function (e) {
      e.preventDefault();
      var a = parseFloat($('lat').value), o = parseFloat($('lon').value);
      var okA = !isNaN(a) && a >= -90 && a <= 90, okO = !isNaN(o) && o >= -180 && o <= 180;
      $('lat').classList.toggle('bad', !okA); $('lon').classList.toggle('bad', !okO);
      if (!okA || !okO) { note('Latitude is -90 to 90 and longitude -180 to 180, in decimal degrees.', true); return; }
      setObserver(a, o, 'Typed in', true);
    });
    $('mask').addEventListener('change', function () { S.mask = +$('mask').value; put('gnss-mask', String(S.mask)); recompute(); });
    $('btn-locate').addEventListener('click', locate);
  }
  function note(msg, bad) { var n = $('obs-note'); n.textContent = msg; n.classList.toggle('bad', !!bad); }
  function setObserver(a, o, label, persist) {
    S.obs = O.observer(a, o, 0); S.obsLabel = label;
    $('lat').value = a.toFixed(4); $('lon').value = o.toFixed(4);
    $('lat').classList.remove('bad'); $('lon').classList.remove('bad');
    note(label);
    if (persist) put('gnss-obs', JSON.stringify({ lat: a, lon: o, label: label }));
    recompute();
    if (map && obsMarker) { obsMarker.setLatLng([a, o]); }
  }
  function locate() {
    if (!navigator.geolocation) { note('This browser has no location service. Type the position in.', true); return; }
    var b = $('btn-locate'); b.disabled = true; b.textContent = 'Locating';
    navigator.geolocation.getCurrentPosition(function (p) {
      b.disabled = false; b.textContent = 'Use my location';
      setObserver(p.coords.latitude, p.coords.longitude, 'From this device, within ' + Math.round(p.coords.accuracy) + ' m', true);
      if (map) map.setView([p.coords.latitude, p.coords.longitude], Math.max(map.getZoom(), 3));
    }, function (err) {
      b.disabled = false; b.textContent = 'Use my location';
      note(err.code === 1 ? 'Location was refused. Allow it for this site, or type the position in.' : 'No location: ' + err.message, true);
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
  }

  /* ---------------------------------------------------------------- orbits */
  async function loadOrbits() {
    var text = null;
    try {
      var r = await fetch('data/gps-ops.txt', { cache: 'no-cache' });
      if (r.ok) { var t = await r.text(); if ((t.match(/^1 \d{5}/gm) || []).length >= 4) { text = t; S.orbitsFrom = 'CelesTrak gps-ops'; } }
    } catch (e) { /* file:// or offline */ }
    if (!text && window.GNSS_TLE_FALLBACK) { text = window.GNSS_TLE_FALLBACK; S.orbitsFrom = 'built-in copy'; }
    S.sats = text ? O.parseTLE(text) : [];
    S.byPrn = {}; S.sats.forEach(function (s) { S.byPrn[s.prn] = s; });
    if (S.sats.length) {
      var ep = S.sats.map(function (s) { return s.epoch.getTime(); }).sort(function (a, b) { return a - b; });
      S.epoch = new Date(ep[Math.floor(ep.length / 2)]);
    }
  }
  function orbitLine() {
    var el = $('orbit-line');
    if (!S.sats.length) { el.textContent = 'no orbit data'; el.className = 'bad'; return; }
    var age = (S.now - S.epoch) / 864e5;
    S.epochAge = age;
    el.textContent = 'orbits: ' + S.orbitsFrom + ', ' + S.sats.length + ' sats, epoch ' + (S.epoch.getUTCMonth() + 1) + '/' + S.epoch.getUTCDate() + '/' + S.epoch.getUTCFullYear();
    el.className = age > STALE_DAYS ? 'bad' : '';
  }

  /* ---------------------------------------------------------------- compute */
  function recompute() { S.passAt = 0; tick(true); }
  function compute() {
    var now = S.now, up = [];
    S.sats.forEach(function (s) {
      var st = O.state(s, now, S.obs); S.st[s.prn] = st;
      if (st && st.el >= S.mask) up.push(st);
    });
    S.dop = O.dop(up);
    if (now - S.passAt > 60000) {
      S.passAt = now.getTime();
      var end = new Date(now.getTime() + TRACK_MIN * 60e3);
      S.sats.forEach(function (s) {
        var p = O.passes(s, now, S.obs, S.mask, 12); S.pass[s.prn] = p;
        var soon = p.up || (p.rise && p.rise < end);
        S.tracks[s.prn] = soon ? O.track(s, now, end, S.obs, 120e3) : null;
      });
      trackStale = true;
    }
    if (rxLive) rx.prune(now.getTime(), PRUNE_MS);
  }
  function statusOf(s) {
    var st = S.st[s.prn]; if (!st) return 'down';
    var h = rx.sats.get('GPS-' + s.prn);
    if (rx.isUsed('GPS', s.prn)) return 'used';
    if (h && h.snr) return 'heard';
    return st.el >= S.mask ? 'up' : (st.el >= 0 ? 'low' : 'down');
  }
  function snrOf(prn) { var h = rx.sats.get('GPS-' + prn); return h && h.snr ? h.snr : null; }

  /* ---------------------------------------------------------------- render: header, stats, rail */
  function renderHead() {
    $('title').textContent = 'Over ' + lat(S.obs.lat) + ' ' + lon(S.obs.lon);
    $('meta').textContent = t12(S.now, true) + ' local · ' + utc(S.now) + ' UTC · mask ' + S.mask + '° · ' + S.obsLabel.toLowerCase();
    $('clock-line').textContent = 'updated ' + t12(S.now, true);
    var up = S.sats.filter(function (s) { var st = S.st[s.prn]; return st && st.el >= S.mask; }).length;
    $('st-total').textContent = S.sats.length || '-';
    $('st-up').textContent = S.sats.length ? up : '-';
    $('st-pdop').textContent = S.dop ? S.dop.p.toFixed(1) : '-';
    var heard = 0; rx.sats.forEach(function (h) { if (h.snr) heard++; });
    $('st-heard').innerHTML = rxActive ? heard + (heard ? ' <small>' + countGpsHeard() + ' GPS</small>' : '') : '-';
    $('st-used').textContent = rxActive ? rx.usedCount() : '-';
    var age = $('st-age');
    if (S.epochAge == null) { age.textContent = '-'; age.classList.remove('bad'); }
    else { age.textContent = S.epochAge < 1 ? Math.round(S.epochAge * 24) + ' h' : S.epochAge.toFixed(1) + ' d'; age.classList.toggle('bad', S.epochAge > STALE_DAYS); }
    var v = $('fix-verdict');
    if (rxError) { v.textContent = 'RECEIVER ERROR'; v.className = 'verdict error'; }
    else if (!rxActive) { v.textContent = 'NO RECEIVER'; v.className = 'verdict idle'; }
    else if (rx.fix.type === '3D') { v.textContent = '3D FIX'; v.className = 'verdict fix3'; }
    else if (rx.fix.type === '2D') { v.textContent = '2D FIX'; v.className = 'verdict fix2'; }
    else { v.textContent = rxLive ? 'NO FIX YET' : 'NO FIX'; v.className = 'verdict nofix'; }
  }
  function countGpsHeard() { var n = 0; rx.sats.forEach(function (h) { if (h.sys === 'GPS' && h.snr) n++; }); return n; }

  function renderRail() {
    var list = S.sats.filter(function (s) { var st = S.st[s.prn]; return st && st.el >= S.mask; })
      .sort(function (a, b) { return S.st[b.prn].el - S.st[a.prn].el; });
    $('sat-list').innerHTML = list.length ? list.map(function (s) {
      var st = S.st[s.prn], k = statusOf(s), snr = snrOf(s.prn);
      return '<button type="button" class="scan-item' + (S.sel === s.prn ? ' on' : '') + '" data-prn="' + s.prn + '">' +
        '<div class="q"><i class="dot ' + (k === 'used' || k === 'heard' ? k : '') + '"></i><b>PRN ' + prn2(s.prn) + '</b>' + esc(s.short) + '</div>' +
        '<div class="s">el ' + deg(st.el) + ' · az ' + deg(st.az) + ' ' + compass(st.az) + (snr ? ' · ' + snr + ' dB-Hz' : '') + '</div></button>';
    }).join('') : '<p class="empty">' + (S.sats.length ? 'None above ' + S.mask + '° right now.' : 'No orbit data.') + '</p>';
  }

  /* ---------------------------------------------------------------- render: sky */
  function polar(az, el) {
    var r = 100 * (90 - Math.max(el, 0)) / 90, a = az * Math.PI / 180;
    return [r * Math.sin(a), -r * Math.cos(a)];
  }
  function renderSky() {
    var h = [];
    h.push('<circle class="ring edge" r="100"/><circle class="ring" r="66.67"/><circle class="ring" r="33.33"/>');
    if (S.mask > 0) h.push('<circle class="ring mask" r="' + (100 * (90 - S.mask) / 90).toFixed(2) + '"/>');
    for (var a = 0; a < 360; a += 30) { var p = polar(a, 0); h.push('<line class="spoke" x1="0" y1="0" x2="' + p[0].toFixed(2) + '" y2="' + p[1].toFixed(2) + '"/>'); }
    [['N', 0], ['E', 90], ['S', 180], ['W', 270]].forEach(function (c) {
      var p = polar(c[1], -12); h.push('<text class="card-pt" x="' + p[0].toFixed(1) + '" y="' + p[1].toFixed(1) + '" text-anchor="middle" dominant-baseline="central">' + c[0] + '</text>');
    });
    h.push('<text class="lbl" x="2" y="-64.5">30°</text><text class="lbl" x="2" y="-31.2">60°</text><text class="lbl" x="2" y="-1.5">90°</text>');
    // tracks
    S.sats.forEach(function (s) {
      var tr = S.tracks[s.prn]; if (!tr) return;
      var segs = [], cur = [];
      tr.forEach(function (pt) {
        if (pt && pt.el >= 0) { var p = polar(pt.az, pt.el); cur.push(p[0].toFixed(1) + ',' + p[1].toFixed(1)); }
        else if (cur.length) { segs.push(cur); cur = []; }
      });
      if (cur.length) segs.push(cur);
      segs.forEach(function (sg) { if (sg.length > 1) h.push('<polyline class="trk' + (S.sel === s.prn ? ' sel' : '') + '" points="' + sg.join(' ') + '"/>'); });
    });
    // other constellations the receiver hears
    rx.sats.forEach(function (o) {
      if (o.sys === 'GPS' || o.el == null || o.az == null || o.el < 0) return;
      var p = polar(o.az, o.el);
      h.push('<g class="other"><circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="5"/><text x="' + p[0].toFixed(1) + '" y="' + p[1].toFixed(1) + '" text-anchor="middle" dominant-baseline="central">' + (SYS_LETTER[o.sys] || '?') + o.prn + '</text></g>');
    });
    // GPS satellites above the horizon
    S.sats.forEach(function (s) {
      var st = S.st[s.prn]; if (!st || st.el < 0) return;
      var k = statusOf(s), p = polar(st.az, st.el), x = p[0].toFixed(1), y = p[1].toFixed(1);
      var cls = 'sat ' + k + (S.sel === s.prn ? ' sel' : '');
      var op = st.el < S.mask ? ' opacity="0.4"' : '';
      h.push('<g class="' + cls + '" data-prn="' + s.prn + '"' + op + '><title>PRN ' + prn2(s.prn) + ' ' + esc(s.short) + ', el ' + deg(st.el) + ' az ' + deg(st.az) + '</title>' +
        '<circle class="halo" cx="' + x + '" cy="' + y + '" r="10"/><circle cx="' + x + '" cy="' + y + '" r="7.2"/><text x="' + x + '" y="' + y + '">' + prn2(s.prn) + '</text></g>');
    });
    $('sky').innerHTML = h.join('');
    var up = S.sats.filter(function (s) { var st = S.st[s.prn]; return st && st.el >= S.mask; }).length;
    $('sky-sub').textContent = up + ' above ' + S.mask + '°';
  }

  function renderSig() {
    var gpsHeard = [];
    rx.sats.forEach(function (o) { if (o.sys === 'GPS' && o.snr) gpsHeard.push(o); });
    var rows, title;
    if (gpsHeard.length) {
      title = 'C/N0, GPS satellites heard';
      rows = gpsHeard.sort(function (a, b) { return b.snr - a.snr; }).map(function (o) {
        return { prn: o.prn, pct: Math.min(100, o.snr / 55 * 100), v: o.snr + ' dB', used: rx.isUsed('GPS', o.prn) };
      });
    } else {
      title = 'Elevation, satellites above the mask';
      rows = S.sats.filter(function (s) { var st = S.st[s.prn]; return st && st.el >= S.mask; })
        .sort(function (a, b) { return S.st[b.prn].el - S.st[a.prn].el; })
        .map(function (s) { var st = S.st[s.prn]; return { prn: s.prn, pct: st.el / 90 * 100, v: deg(st.el), used: false }; });
    }
    $('sig-title').innerHTML = esc(title) + ' <b>' + rows.length + '</b>';
    $('sig').innerHTML = rows.length ? rows.map(barRow).join('') : '<p class="empty">Nothing to show.</p>';
  }
  function barRow(r) {
    return '<div class="row' + (r.used ? ' used' : '') + (S.sel === r.prn ? ' on' : '') + '" data-prn="' + r.prn + '"><span class="lab">PRN ' + prn2(r.prn) + '</span>' +
      '<span class="track"><span class="fill" style="width:' + r.pct.toFixed(1) + '%"></span></span><span class="v">' + r.v + '</span></div>';
  }

  function renderNext() {
    var end = S.now.getTime() + TRACK_MIN * 60e3, ev = [];
    S.sats.forEach(function (s) {
      var p = S.pass[s.prn]; if (!p) return;
      if (!p.up && p.rise && p.rise.getTime() < end) ev.push({ t: p.rise, prn: s.prn, txt: 'rises in the ' + compass(lookAt(s, p.rise).az) + ' at ' + when(p.rise) + (p.peakEl ? ', peaks at ' + Math.round(p.peakEl) + '° at ' + when(p.peak) : '') });
      if (p.up && p.set && p.set.getTime() < end) ev.push({ t: p.set, prn: s.prn, txt: 'sets in the ' + compass(lookAt(s, p.set).az) + ' at ' + when(p.set) });
    });
    ev.sort(function (a, b) { return a.t - b.t; });
    $('next-sub').textContent = ev.length ? ev.length + ' events' : '';
    $('next').innerHTML = ev.length ? ev.slice(0, 12).map(function (e) {
      return '<div class="next-row" data-prn="' + e.prn + '"><b>PRN ' + prn2(e.prn) + '</b><span>' + esc(e.txt) + '</span></div>';
    }).join('') : '<p class="empty">No satellite crosses the ' + S.mask + '° mask in the next two hours.</p>';
  }
  var lookCache = {};
  function lookAt(s, d) {
    var k = s.prn + '@' + d.getTime();
    return lookCache[k] || (lookCache[k] = O.look(s, d, S.obs) || { az: 0 });
  }

  function renderSel() {
    var s = S.sel != null ? S.byPrn[S.sel] : null;
    if (!s) { $('sel-prn').textContent = ''; $('sel-body').className = 'empty'; $('sel-body').innerHTML = 'Click a satellite on the sky plot, the map or the list.'; return; }
    $('sel-prn').textContent = 'PRN ' + prn2(s.prn);
    $('sel-body').className = '';
    $('sel-body').innerHTML = detailHtml(s);
  }
  function detailHtml(s) {
    var st = S.st[s.prn] || {}, p = S.pass[s.prn] || {}, snr = snrOf(s.prn), k = statusOf(s);
    var rows = [
      ['Satellite', esc(s.short) + ' · PRN ' + prn2(s.prn)],
      ['Status', chip(k)],
      ['Elevation / azimuth', deg(st.el, 1) + ' / ' + deg(st.az, 1) + ' ' + (st.az != null ? compass(st.az) : '')],
      ['Range', km(st.range) + ' km'],
      ['Range rate', st.rate != null ? (st.rate >= 0 ? '+' : '') + st.rate.toFixed(3) + ' km/s' : '-'],
      ['L1 Doppler', st.doppler != null ? (st.doppler >= 0 ? '+' : '') + (st.doppler / 1000).toFixed(2) + ' kHz' : '-'],
      ['Under it', st.lat != null ? lat(st.lat) + ' ' + lon(st.lon) : '-'],
      ['Altitude', km(st.alt) + ' km'],
      [p.up ? 'Sets' : 'Rises', p.up ? when(p.set) : when(p.rise)],
      ['Peak', p.peakEl == null ? '-' : (p.up && p.peak.getTime() <= S.now.getTime() + 60e3) ? 'past its peak, descending' : Math.round(p.peakEl) + '° at ' + when(p.peak)],
      ['Receiver C/N0', snr ? snr + ' dB-Hz' : (rxActive ? 'not heard' : 'no receiver')],
      ['Block', s.info ? esc(s.info.design) + ' · ' + esc(s.info.maker) : '-'],
      ['Launched', esc(launchOf(s))],
      ['Signals', s.info ? esc(s.info.signals) : '-'],
      ['NORAD / COSPAR', s.norad + ' / ' + esc(s.intl)],
      ['Orbit', s.incl.toFixed(2) + '° incl · ' + (s.period ? (s.period / 60).toFixed(2) + ' h' : '-') + ' period']
    ];
    return '<table class="kv"><tbody>' + rows.map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + r[1] + '</td></tr>'; }).join('') + '</tbody></table>' +
      (s.info ? '<p class="sel-desc">' + esc(s.info.note) + '</p>' : '');
  }
  function chip(k) {
    var t = { used: 'In the fix', heard: 'Heard', up: 'Above the mask', low: 'Below the mask', down: 'Below the horizon' }[k];
    return '<span class="chip ' + (k === 'low' ? '' : k === 'down' ? '' : k) + '">' + t + '</span>';
  }

  /* ---------------------------------------------------------------- render: table */
  function sortVal(s, key) {
    var st = S.st[s.prn] || {}, p = S.pass[s.prn] || {};
    switch (key) {
      case 'prn': return s.prn; case 'short': return s.short; case 'block': return s.block || '';
      case 'launch': return launchOf(s); case 'el': return st.el != null ? st.el : -99; case 'az': return st.az || 0;
      case 'range': return st.range || 0; case 'doppler': return st.doppler || 0;
      case 'next': var t = p.up ? p.set : p.rise; return t ? t.getTime() : 9e15;
      case 'snr': return snrOf(s.prn) || 0;
    }
    return 0;
  }
  function renderTable() {
    var key = S.sort.key, asc = S.sort.asc;
    var list = S.sats.slice().sort(function (a, b) {
      var x = sortVal(a, key), y = sortVal(b, key);
      return (x < y ? -1 : x > y ? 1 : 0) * (asc ? 1 : -1);
    });
    document.querySelectorAll('#sat-table th[data-sort]').forEach(function (th) {
      th.classList.toggle('sorted', th.dataset.sort === key); th.classList.toggle('asc', th.dataset.sort === key && asc);
    });
    $('sat-table').querySelector('tbody').innerHTML = list.map(function (s) {
      var st = S.st[s.prn] || {}, p = S.pass[s.prn] || {}, k = statusOf(s), snr = snrOf(s.prn);
      var next = p.up ? 'sets ' + when(p.set) : p.rise ? 'rises ' + when(p.rise) : '-';
      var row = '<tr class="' + (k === 'down' || k === 'low' ? 'down' : '') + (S.sel === s.prn ? ' on' : '') + '" data-prn="' + s.prn + '">' +
        '<td class="mono"><b>' + prn2(s.prn) + '</b></td><td>' + esc(s.short) + '</td><td>' + esc(s.info ? s.info.design : '-') + '</td><td class="mono">' + esc(launchOf(s)) + '</td>' +
        '<td class="num">' + deg(st.el, 1) + '</td><td class="num">' + deg(st.az, 1) + '</td><td class="num">' + km(st.range) + '</td>' +
        '<td class="num">' + (st.doppler != null ? (st.doppler >= 0 ? '+' : '') + (st.doppler / 1000).toFixed(2) + ' kHz' : '-') + '</td>' +
        '<td class="mono">' + esc(next) + '</td><td class="num">' + (snr ? snr + ' dB' : '-') + '</td><td>' + chip(k) + '</td></tr>';
      if (S.sel === s.prn) row += '<tr class="detail"><td colspan="11">' + detailHtml(s) + '</td></tr>';
      return row;
    }).join('');
  }

  /* ---------------------------------------------------------------- map */
  var map = null, pins = {}, obsMarker = null, selTrack = null, selFoot = null, bases = {}, trackStale = false;
  function initMap() {
    if (map) return;
    map = L.map('map', { worldCopyJump: true, minZoom: 1, maxZoom: 12, zoomControl: true }).setView([S.obs.lat, S.obs.lon], 2);
    bases.streets = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      className: 'tiles-mono', maxZoom: 19, referrerPolicy: 'strict-origin-when-cross-origin',
      attribution: '&copy; OpenStreetMap contributors'
    });
    bases.imagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18, attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics'
    });
    bases[S.base].addTo(map);
    obsMarker = L.marker([S.obs.lat, S.obs.lon], { icon: L.divIcon({ className: '', html: '<div class="obs-pin" title="Observer"></div>', iconSize: [14, 14], iconAnchor: [7, 7] }), zIndexOffset: 1000, keyboard: false }).addTo(map);
    document.querySelectorAll('[data-base]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (S.base === b.dataset.base) return;
        map.removeLayer(bases[S.base]); S.base = b.dataset.base; bases[S.base].addTo(map);
        document.querySelectorAll('[data-base]').forEach(function (x) { x.classList.toggle('on', x === b); });
      });
    });
    $('map-all').addEventListener('change', function () { S.mapAll = this.checked; updateMap(true); });
  }
  function ink() { return getComputedStyle(root).getPropertyValue('--text').trim() || '#000'; }
  function styleMapPaths() {
    if (selTrack) selTrack.setStyle({ color: ink() });
    if (selFoot) selFoot.setStyle({ color: ink(), fillColor: ink() });
  }
  function updateMap(force) {
    if (!map) return;
    S.sats.forEach(function (s) {
      var st = S.st[s.prn]; if (!st) return;
      var k = statusOf(s), show = S.mapAll || k !== 'down' && k !== 'low';
      var cls = 'sat-pin ' + (k === 'down' || k === 'low' ? 'down' : k) + (S.sel === s.prn ? ' sel' : '');
      var pin = pins[s.prn];
      if (!show) { if (pin) { map.removeLayer(pin.m); delete pins[s.prn]; } return; }
      if (!pin) {
        var m = L.marker([st.lat, st.lon], { icon: L.divIcon({ className: '', html: '<div class="' + cls + '">' + prn2(s.prn) + '</div>', iconSize: null, iconAnchor: [13, 9] }), title: 'PRN ' + prn2(s.prn) + ' ' + s.short });
        m.on('click', function () { select(s.prn); });
        m.addTo(map); pins[s.prn] = { m: m, cls: cls };
      } else {
        pin.m.setLatLng([st.lat, st.lon]);
        if (pin.cls !== cls || force) { pin.m.setIcon(L.divIcon({ className: '', html: '<div class="' + cls + '">' + prn2(s.prn) + '</div>', iconSize: null, iconAnchor: [13, 9] })); pin.cls = cls; }
      }
    });
    // selected: ground track +/- 3 h and the area it stands above the mask from
    var s = S.sel != null ? S.byPrn[S.sel] : null;
    if (!s) { if (selTrack) { map.removeLayer(selTrack); selTrack = null; } if (selFoot) { map.removeLayer(selFoot); selFoot = null; } return; }
    var st = S.st[s.prn];
    if (!selTrack || force || trackStale) {
      trackStale = false;
      if (selTrack) map.removeLayer(selTrack);
      var pts = O.track(s, new Date(S.now.getTime() - 3 * 3600e3), new Date(S.now.getTime() + 3 * 3600e3), S.obs, 180e3);
      var segs = [], cur = [], prev = null;
      pts.forEach(function (p) {
        if (!p) return;
        if (prev != null && Math.abs(p.lon - prev) > 180) { segs.push(cur); cur = []; }
        cur.push([p.lat, p.lon]); prev = p.lon;
      });
      if (cur.length) segs.push(cur);
      selTrack = L.polyline(segs, { color: ink(), weight: 1.5, dashArray: '4 4', interactive: false }).addTo(map);
    }
    var r = O.footprintKm(st.alt, S.mask) * 1000;
    if (!selFoot) selFoot = L.circle([st.lat, st.lon], { radius: r, color: ink(), weight: 1, fillColor: ink(), fillOpacity: 0.05, interactive: false }).addTo(map);
    else { selFoot.setLatLng([st.lat, st.lon]); selFoot.setRadius(r); }
  }

  /* ---------------------------------------------------------------- receiver */
  var serial = null;
  function initReceiver() {
    var ok = N.Serial.supported();
    serial = new N.Serial(onLine, onSerial);
    ['btn-connect', 'btn-connect2'].forEach(function (id) {
      $(id).addEventListener('click', function () { if (serial.port) disconnect(); else connect(); });
    });
    $('btn-disconnect').addEventListener('click', disconnect);
    if (!ok) {
      $('rx-line').textContent = 'Serial ports open in Chrome or Edge on a computer.';
      $('rx-msg').textContent = 'This browser cannot open serial ports. A saved log can still be read below.';
    }
    $('btn-use-rx').addEventListener('click', function () {
      if (rx.fix.lat != null) setObserver(rx.fix.lat, rx.fix.lon, 'From the receiver', true);
    });
    $('btn-log-copy').addEventListener('click', function () {
      var t = logLines.map(function (l) { return l.t; }).join('\n');
      if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { $('nmea-sub').textContent = 'copied'; }, function () {});
    });
    $('btn-log-clear').addEventListener('click', function () { logLines = []; logDirty = true; renderLog(); });
    $('btn-import').addEventListener('click', function () { importText($('nmea-paste').value, 'pasted'); });
    $('nmea-file').addEventListener('change', function () {
      var f = this.files && this.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () { importText(String(rd.result || ''), f.name); };
      rd.readAsText(f);
      this.value = '';
    });
  }
  async function connect() {
    rxError = null;
    var baud = $('baud').value ? +$('baud').value : null;
    setRxMsg('Pick the receiver’s port in the browser’s list.', false);
    try {
      rx.reset(); logLines = []; logDirty = true;
      await serial.connect(baud);
    } catch (e) {
      if (e && e.name === 'NotFoundError') { setRxMsg('No port was picked.', false); return; }
      rxError = e.message || String(e); setRxMsg(rxError, true); rxActive = false; rxLive = false; syncRxButtons(); render(true);
    }
  }
  async function disconnect() { await serial.disconnect(); }
  function onSerial(kind, val) {
    if (kind === 'trying') { $('rx-state').textContent = 'listening at ' + val; setRxMsg('Listening at ' + val + ' baud for NMEA…', false); }
    else if (kind === 'open') { rxActive = true; rxLive = true; rxError = null; $('rx-state').textContent = 'connected, ' + val + ' baud'; setRxMsg('Reading the receiver at ' + val + ' baud.', false); $('rx-line').textContent = 'Connected, ' + val + ' baud'; }
    else if (kind === 'error') { rxError = val; setRxMsg('Serial error: ' + val, true); $('rx-line').textContent = 'Error: ' + val; }
    else if (kind === 'closed') { rxLive = false; $('rx-state').textContent = 'not connected'; $('rx-line').textContent = rxActive ? 'Disconnected; last picture kept' : 'Not connected'; if (!rxError) setRxMsg('Disconnected.', false); }
    syncRxButtons(); render(true);
  }
  function syncRxButtons() {
    var on = !!(serial && serial.port);
    $('btn-connect').textContent = on ? 'Disconnect receiver' : 'Connect GPS receiver';
    $('btn-connect2').disabled = on || !N.Serial.supported();
    $('btn-connect').disabled = !N.Serial.supported() && !on;
    $('btn-disconnect').disabled = !on;
  }
  function setRxMsg(t, bad) { var m = $('rx-msg'); m.textContent = t; m.classList.toggle('bad', !!bad); $('rx-line').classList.toggle('bad', !!bad); }
  function onLine(l) {
    var r = rx.feed(l);
    logLines.push({ t: l, bad: r === 'bad' }); if (logLines.length > 400) logLines.splice(0, logLines.length - 400);
    logDirty = true;
  }
  function importText(text, label) {
    var lines = String(text || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    if (!lines.length) { $('import-note').textContent = 'Nothing to read.'; return; }
    if (!(serial && serial.port)) { rx.reset(); logLines = []; }
    var now = Date.now(), ok = 0, bad = 0;
    lines.forEach(function (l) { var r = rx.feed(l, now); if (r === 'ok') ok++; else if (r === 'bad') bad++; logLines.push({ t: l, bad: r === 'bad' }); });
    if (logLines.length > 400) logLines.splice(0, logLines.length - 400);
    logDirty = true; rxActive = true; rxError = null;
    $('import-note').innerHTML = esc(label) + ': ' + ok.toLocaleString('en-US') + ' read' + (bad ? ', <span class="bad">' + bad.toLocaleString('en-US') + ' bad checksum</span>' : '');
    $('rx-line').textContent = 'Log read: ' + label;
    render(true);
  }
  function renderLog() {
    if (!logDirty) return; logDirty = false;
    var pre = $('nmea-log'), atBottom = pre.scrollTop + pre.clientHeight >= pre.scrollHeight - 8;
    pre.innerHTML = logLines.slice(-300).map(function (l) { return l.bad ? '<span class="bad">' + esc(l.t) + '</span>' : esc(l.t); }).join('\n');
    if (atBottom) pre.scrollTop = pre.scrollHeight;
    $('nmea-sub').textContent = rx.counts.sentences.toLocaleString('en-US') + ' sentences' + (rx.counts.bad ? ', ' + rx.counts.bad + ' bad' : '');
  }
  function renderRx() {
    var f = rx.fix;
    var rows = [
      ['Fix', f.type ? (f.type === 'none' ? 'none' : f.type) : '-'],
      ['Quality', f.quality == null ? '-' : ['invalid', 'GPS', 'DGPS', 'PPS', 'RTK fixed', 'RTK float', 'estimated', 'manual', 'simulation'][f.quality] || f.quality],
      ['Satellites in the fix', rxActive ? rx.usedCount() + (f.satsUsed != null ? ' (GGA ' + f.satsUsed + ')' : '') : '-'],
      ['PDOP / HDOP / VDOP', [f.pdop, f.hdop, f.vdop].map(function (v) { return v == null ? '-' : v.toFixed(1); }).join(' / ')],
      ['Position', f.lat != null ? lat(f.lat) + ' ' + lon(f.lon) : '-'],
      ['Altitude', f.alt != null ? f.alt.toFixed(1) + ' m' : '-'],
      ['Receiver time (UTC)', f.time ? f.time.slice(0, 2) + ':' + f.time.slice(2, 4) + ':' + f.time.slice(4, 6) : '-'],
      ['Speed / course', f.speedKn != null ? (f.speedKn * 1.15078).toFixed(1) + ' mph' + (f.course != null ? ' / ' + f.course.toFixed(0) + '°' : '') : '-'],
      ['Predicted PDOP here', S.dop ? S.dop.p.toFixed(1) : '-']
    ];
    $('rx-fix').querySelector('tbody').innerHTML = rows.map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + esc(r[1]) + '</td></tr>'; }).join('');
    $('btn-use-rx').disabled = f.lat == null;
    var list = rx.list();
    $('heard-sub').textContent = list.length ? list.length + ' in view' : '';
    $('heard-table').querySelector('tbody').innerHTML = list.length ? list.map(function (o) {
      return '<tr><td>' + esc(o.sys) + '</td><td class="num">' + o.prn + '</td><td class="num">' + deg(o.el) + '</td><td class="num">' + deg(o.az) + '</td><td class="num">' + (o.snr ? o.snr + ' dB-Hz' : '-') + '</td><td>' + (rx.isUsed(o.sys, o.prn) ? '<span class="chip used">In the fix</span>' : '') + '</td></tr>';
    }).join('') : '<tr><td colspan="6" class="empty">' + (rxActive ? 'No satellites reported yet.' : 'Connect a receiver or read a log.') + '</td></tr>';
    var heard = list.filter(function (o) { return o.snr; }).sort(function (a, b) { return b.snr - a.snr; });
    $('snr-sub').textContent = heard.length ? heard.length + ' with signal' : '';
    $('snr').innerHTML = heard.length ? heard.map(function (o) {
      var lab = (SYS_LETTER[o.sys] || '?') + pad(o.prn);
      return '<div class="row' + (rx.isUsed(o.sys, o.prn) ? ' used' : '') + '"' + (o.sys === 'GPS' ? ' data-prn="' + o.prn + '"' : '') + '><span class="lab">' + lab + '</span><span class="track"><span class="fill" style="width:' + Math.min(100, o.snr / 55 * 100).toFixed(1) + '%"></span></span><span class="v">' + o.snr + ' dB</span></div>';
    }).join('') : '<p class="empty">' + (rxActive ? 'No signal reported yet.' : 'No receiver.') + '</p>';
    renderLog();
  }

  /* ---------------------------------------------------------------- selection */
  function select(prn) {
    S.sel = (S.sel === prn) ? null : prn;
    if (map) { if (selTrack) { map.removeLayer(selTrack); selTrack = null; } if (selFoot) { map.removeLayer(selFoot); selFoot = null; } }
    render(true);
    if (map && S.sel != null && S.tab === 'map') { var st = S.st[S.sel]; if (st) map.panTo([st.lat, st.lon]); }
  }
  function initSelection() {
    document.addEventListener('click', function (e) {
      var g = e.target.closest('[data-prn]');
      if (!g || !g.closest('#sky, #sat-list, #sig, #snr, #next, #sat-table')) return;
      if (g.closest('tr.detail')) return;
      select(+g.dataset.prn);
    });
    document.querySelectorAll('#sat-table th[data-sort]').forEach(function (th) {
      th.addEventListener('click', function () {
        var k = th.dataset.sort;
        if (S.sort.key === k) S.sort.asc = !S.sort.asc; else { S.sort.key = k; S.sort.asc = (k === 'prn' || k === 'short' || k === 'next' || k === 'block'); }
        renderTable();
      });
    });
  }

  /* ---------------------------------------------------------------- loop */
  function render(all) {
    if (!S.obs) return;
    renderHead(); renderRail(); orbitLine();
    if (S.tab === 'sky') { renderSky(); renderSig(); renderSel(); if (all || S.now.getSeconds() % 10 === 0) renderNext(); }
    else if (S.tab === 'map') updateMap(false);
    else if (S.tab === 'sats') renderTable();
    else if (S.tab === 'rx') renderRx();
  }
  function tick(all) {
    S.now = new Date();
    if (S.sats.length && S.obs) compute();
    if (Object.keys(lookCache).length > 2000) lookCache = {};
    render(all);
  }

  async function start() {
    initFrame(); initSelection(); initReceiver(); syncRxButtons();
    await loadOrbits();
    initObserver();
    var t = get('gnss-tab'); if (t && t !== 'sky' && document.querySelector('[data-pane="' + t + '"]')) showTab(t);
    tick(true);
    setInterval(function () { if (!document.hidden) tick(false); }, 1000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) recompute(); });
  }
  start();
})();
