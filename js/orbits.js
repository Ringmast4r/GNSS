/* GNSS // Tracker: the orbit engine.
 *
 * TLEs (CelesTrak "gps-ops") -> SGP4 (satellite.js) -> where each GPS satellite is, as seen from
 * the observer: azimuth, elevation, range, range rate and the L1 Doppler that follows from it,
 * the point under it, rise / peak / set inside the next 12 hours, sky tracks, and the dilution of
 * precision the geometry would give a receiver right now.
 *
 * Nothing here touches the page. window.GNSSOrbits.
 */
(function (root) {
  'use strict';

  var sat = root.satellite;
  var D2R = Math.PI / 180, R2D = 180 / Math.PI;
  var C_KM_S = 299792.458, L1_HZ = 1575.42e6, RE_KM = 6378.137;

  // What each block of the constellation is. Signals per the GPS modernization record (gps.gov).
  var BLOCKS = {
    'IIR':   { design: 'Block IIR',   maker: 'Lockheed Martin', mass: '2,032 kg', signals: 'L1 C/A, L1 and L2 P(Y)',
               note: 'Replenishment satellites with improved atomic clocks and radiation hardening.' },
    'IIR-M': { design: 'Block IIR-M', maker: 'Lockheed Martin', mass: '2,032 kg', signals: 'L1 C/A, L2C, L1 and L2 P(Y), M-code',
               note: 'The modernized IIR: adds the L2C civil signal and the military M-code.' },
    'IIF':   { design: 'Block IIF',   maker: 'Boeing',          mass: '1,630 kg', signals: 'L1 C/A, L2C, L5, P(Y), M-code',
               note: 'Adds L5, the protected safety-of-life civil signal.' },
    'III':   { design: 'GPS III',     maker: 'Lockheed Martin', mass: '2,161 kg', signals: 'L1 C/A, L1C, L2C, L5, P(Y), M-code',
               note: 'Adds L1C, shared with Galileo, QZSS and BeiDou, with stronger anti-jamming and longer life.' }
  };
  // Launch dates carried over from the first version of this tool. Newer satellites show the
  // launch year read from their international designator instead.
  var LAUNCHED = {
    'BIIR-2': '1997-07-23', 'BIIR-4': '2000-05-11', 'BIIR-5': '2000-07-16', 'BIIR-8': '2003-01-29', 'BIIR-11': '2004-03-20',
    'BIIR-13': '2004-11-06', 'BIIRM-1': '2005-09-26', 'BIIRM-2': '2006-09-25', 'BIIRM-3': '2006-11-17', 'BIIRM-4': '2007-10-17',
    'BIIRM-5': '2007-12-20', 'BIIRM-6': '2008-03-15', 'BIIRM-8': '2009-08-17', 'BIIF-1': '2010-05-28', 'BIIF-3': '2012-10-04',
    'BIIF-4': '2013-05-15', 'BIIF-5': '2014-02-21', 'BIIF-6': '2014-05-17', 'BIIF-7': '2014-08-02', 'BIIF-8': '2014-10-29',
    'BIIF-9': '2015-03-25', 'BIIF-10': '2015-07-15', 'BIIF-11': '2015-10-31', 'BIIF-12': '2016-02-05', 'BIII-1': '2018-12-23',
    'BIII-2': '2019-08-22', 'BIII-3': '2020-06-30', 'BIII-4': '2020-11-05', 'BIII-5': '2021-06-17', 'BIII-6': '2023-01-18',
    'BIII-7': '2024-11-22', 'BIII-8': '2025-11-13'
  };

  function blockOf(name) {
    if (/BIIRM/i.test(name)) return 'IIR-M';
    if (/BIIR/i.test(name)) return 'IIR';
    if (/BIIF/i.test(name)) return 'IIF';
    if (/BIII/i.test(name)) return 'III';
    return null;
  }

  /* ---------------------------------------------------------------- TLEs */
  function parseTLE(text) {
    var lines = String(text || '').split(/\r?\n/).map(function (l) { return l.replace(/\s+$/, ''); });
    var out = [], seen = {};
    for (var i = 0; i < lines.length - 1; i++) {
      var l1 = lines[i], l2 = lines[i + 1];
      if (!/^1 \d{5}/.test(l1) || !/^2 \d{5}/.test(l2)) continue;
      var name = (i > 0 && !/^[12] \d{5}/.test(lines[i - 1])) ? lines[i - 1].trim() : 'NORAD ' + l1.slice(2, 7);
      var rec;
      try { rec = sat.twoline2satrec(l1, l2); } catch (e) { rec = null; }
      i++;
      if (!rec || rec.error) continue;
      var prnM = /PRN\s*0*(\d+)/i.exec(name), prn = prnM ? +prnM[1] : null;
      var key = prn != null ? 'P' + prn : 'N' + rec.satnum;
      if (seen[key]) continue;
      seen[key] = 1;
      var short = name.replace(/^GPS\s+/i, '').replace(/\s*\(PRN.*$/i, '').trim();
      var block = blockOf(short), intl = l1.slice(9, 17).trim(), yy = +intl.slice(0, 2);
      out.push({
        name: name, short: short, prn: prn, norad: +rec.satnum, intl: intl,
        launchYear: isNaN(yy) ? null : (yy < 57 ? 2000 + yy : 1900 + yy),
        launched: LAUNCHED[short] || null,
        block: block, info: block ? BLOCKS[block] : null,
        satrec: rec,
        epoch: new Date((rec.jdsatepoch - 2440587.5) * 864e5),
        incl: rec.inclo * R2D, raan: rec.nodeo * R2D, ecc: rec.ecco,
        period: rec.no ? (2 * Math.PI / rec.no) : null              // minutes (no = rad/min)
      });
    }
    out.sort(function (a, b) { return (a.prn || 999) - (b.prn || 999); });
    return out;
  }

  /* ---------------------------------------------------------------- geometry */
  function observer(lat, lon, altKm) {
    return { latitude: lat * D2R, longitude: lon * D2R, height: altKm || 0, lat: lat, lon: lon };
  }

  function look(s, date, obs) {
    var pv = sat.propagate(s.satrec, date);
    if (!pv || !pv.position || typeof pv.position === 'boolean') return null;
    var gmst = sat.gstime(date);
    var ecf = sat.eciToEcf(pv.position, gmst);
    var la = sat.ecfToLookAngles(obs, ecf);
    var gd = sat.eciToGeodetic(pv.position, gmst);
    return {
      az: (la.azimuth * R2D + 360) % 360, el: la.elevation * R2D, range: la.rangeSat,
      lat: sat.degreesLat(gd.latitude), lon: sat.degreesLong(gd.longitude), alt: gd.height
    };
  }

  // Full state for "now": look angles, range rate by a one-second difference, L1 Doppler.
  function state(s, date, obs) {
    var a = look(s, date, obs);
    if (!a) return null;
    var b = look(s, new Date(date.getTime() + 1000), obs);
    a.rate = b ? (b.range - a.range) : 0;                      // km/s, + = moving away
    a.doppler = -a.rate / C_KM_S * L1_HZ;                       // Hz on L1
    return a;
  }

  // Next rise, peak and set above the mask, inside `hours` (default 12).
  function passes(s, from, obs, maskDeg, hours) {
    var step = 60e3, end = from.getTime() + (hours || 12) * 3600e3, t = from.getTime();
    var cur = look(s, from, obs), up = cur && cur.el >= maskDeg;
    var res = { up: up, rise: null, set: null, peak: null, peakEl: null };
    function cross(t0, t1, wantUp) {        // bisect to one second
      for (var k = 0; k < 12 && t1 - t0 > 1000; k++) {
        var m = (t0 + t1) / 2, e = look(s, new Date(m), obs);
        var isUp = e && e.el >= maskDeg;
        if (isUp === wantUp) t1 = m; else t0 = m;
      }
      return new Date(t1);
    }
    var inPass = up, best = up ? cur.el : -90, bestT = up ? t : null, prev = t;
    for (t = from.getTime() + step; t <= end; t += step) {
      var e = look(s, new Date(t), obs);
      if (!e) { prev = t; continue; }
      var isUp = e.el >= maskDeg;
      if (!inPass && isUp) { res.rise = cross(prev, t, true); inPass = true; best = e.el; bestT = t; }
      else if (inPass && isUp) { if (e.el > best) { best = e.el; bestT = t; } }
      else if (inPass && !isUp) { res.set = cross(prev, t, false); break; }
      prev = t;
    }
    if (inPass) { res.peak = new Date(bestT); res.peakEl = best; }
    return res;
  }

  // Sky track (az/el points above the horizon) from t0 to t1.
  function track(s, t0, t1, obs, stepMs) {
    var pts = [];
    for (var t = t0.getTime(); t <= t1.getTime(); t += (stepMs || 120e3)) {
      var e = look(s, new Date(t), obs);
      pts.push(e ? { az: e.az, el: e.el, lat: e.lat, lon: e.lon, t: t } : null);
    }
    return pts;
  }

  // Dilution of precision from the satellites above the mask (az/el in degrees).
  function dop(list) {
    if (list.length < 4) return null;
    var G = list.map(function (p) {
      var el = p.el * D2R, az = p.az * D2R;
      return [Math.cos(el) * Math.sin(az), Math.cos(el) * Math.cos(az), Math.sin(el), 1];
    });
    var N = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    G.forEach(function (r) { for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) N[i][j] += r[i] * r[j]; });
    var Q = inv4(N); if (!Q) return null;
    var e = Q[0][0], n = Q[1][1], u = Q[2][2], tt = Q[3][3];
    if (e < 0 || n < 0 || u < 0 || tt < 0) return null;
    return { g: Math.sqrt(e + n + u + tt), p: Math.sqrt(e + n + u), h: Math.sqrt(e + n), v: Math.sqrt(u), t: Math.sqrt(tt) };
  }
  function inv4(m) {
    var a = m.map(function (r, i) { return r.concat([0, 0, 0, 0].map(function (_, j) { return i === j ? 1 : 0; })); });
    for (var c = 0; c < 4; c++) {
      var p = c; for (var r = c + 1; r < 4; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
      if (Math.abs(a[p][c]) < 1e-12) return null;
      var tmp = a[c]; a[c] = a[p]; a[p] = tmp;
      var d = a[c][c]; for (var k = 0; k < 8; k++) a[c][k] /= d;
      for (var r2 = 0; r2 < 4; r2++) if (r2 !== c) { var f = a[r2][c]; for (var k2 = 0; k2 < 8; k2++) a[r2][k2] -= f * a[c][k2]; }
    }
    return a.map(function (r) { return r.slice(4); });
  }

  // Ground radius (km) inside which a satellite at `altKm` stands above `maskDeg`.
  function footprintKm(altKm, maskDeg) {
    var m = maskDeg * D2R;
    var lam = Math.acos(RE_KM / (RE_KM + altKm) * Math.cos(m)) - m;
    return RE_KM * lam;
  }

  root.GNSSOrbits = { parseTLE: parseTLE, observer: observer, look: look, state: state, passes: passes,
    track: track, dop: dop, footprintKm: footprintKm, BLOCKS: BLOCKS };
})(window);
