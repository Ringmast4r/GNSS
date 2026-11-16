/* GNSS // Tracker: the receiver side.
 *
 * Reads NMEA 0183 from a GPS / GNSS receiver (live over Web Serial, or a saved log) and keeps one
 * picture of it: every satellite it hears (any constellation) with elevation, azimuth and C/N0,
 * which ones are in the fix, the fix itself (type, quality, position, DOP, time, speed).
 * Sentences with a bad checksum are counted and dropped.
 *
 * Sentences read: GSV (in view), GSA (used + DOP), GGA (fix), RMC (position, time, speed).
 * Talkers: GP GPS, GL GLONASS, GA Galileo, GB / BD BeiDou, GQ QZSS, GI NavIC, GN combined.
 * window.GNSSNmea.
 */
(function (root) {
  'use strict';

  var TALKER = { GP: 'GPS', GL: 'GLONASS', GA: 'Galileo', GB: 'BeiDou', BD: 'BeiDou', GQ: 'QZSS', QZ: 'QZSS', GI: 'NavIC', GN: null };
  var SYSID = { 1: 'GPS', 2: 'GLONASS', 3: 'Galileo', 4: 'BeiDou', 5: 'QZSS', 6: 'NavIC' };

  // A GN (combined) satellite number without a system id: the NMEA 0183 ranges.
  function systemOfPrn(prn) {
    if (prn >= 1 && prn <= 32) return 'GPS';
    if ((prn >= 33 && prn <= 64) || (prn >= 120 && prn <= 158)) return 'SBAS';
    if (prn >= 65 && prn <= 96) return 'GLONASS';
    if (prn >= 193 && prn <= 202) return 'QZSS';
    if (prn >= 201 && prn <= 263) return 'BeiDou';
    if (prn >= 301 && prn <= 336) return 'Galileo';
    return 'Other';
  }

  function checksumOk(line) {
    var star = line.lastIndexOf('*');
    if (line[0] !== '$' && line[0] !== '!') return false;
    if (star < 0) return false;
    var want = parseInt(line.slice(star + 1, star + 3), 16);
    if (isNaN(want)) return false;
    var x = 0;
    for (var i = 1; i < star; i++) x ^= line.charCodeAt(i);
    return x === want;
  }

  function coord(v, hemi) {
    if (!v) return null;
    var dot = v.indexOf('.'), degLen = dot - 2;
    if (degLen < 1) return null;
    var d = +v.slice(0, degLen), m = +v.slice(degLen);
    if (isNaN(d) || isNaN(m)) return null;
    var out = d + m / 60;
    return (hemi === 'S' || hemi === 'W') ? -out : out;
  }
  function num(v) { if (v === '' || v == null) return null; var n = +v; return isNaN(n) ? null : n; }

  function Receiver() { this.reset(); }
  Receiver.prototype.reset = function () {
    this.sats = new Map();          // key "GPS-13" -> { sys, prn, el, az, snr, seen }
    this.used = {};                 // sys -> Set of prn
    this.usedSeen = {};             // sys -> time of the last GSA for it
    this.fix = { type: null, quality: null, satsUsed: null, hdop: null, vdop: null, pdop: null,
                 lat: null, lon: null, alt: null, time: null, date: null, speedKn: null, course: null, valid: null };
    this.counts = { sentences: 0, bad: 0, ignored: 0 };
    this.last = null;               // time of the last good sentence
  };

  // Feed one line. Returns 'ok', 'bad' (checksum), or 'skip' (not a sentence we read).
  Receiver.prototype.feed = function (raw, now) {
    var line = String(raw || '').trim();
    if (!line) return 'skip';
    now = now || Date.now();
    if (!checksumOk(line)) { if (line[0] === '$') this.counts.bad++; return 'bad'; }
    this.counts.sentences++;
    this.last = now;
    var body = line.slice(1, line.lastIndexOf('*')), f = body.split(',');
    var talker = f[0].slice(0, 2), type = f[0].slice(2);
    if (type === 'GSV') this._gsv(talker, f, now);
    else if (type === 'GSA') this._gsa(talker, f, now);
    else if (type === 'GGA') this._gga(f);
    else if (type === 'RMC') this._rmc(f);
    else { this.counts.ignored++; return 'skip'; }
    return 'ok';
  };

  Receiver.prototype._gsv = function (talker, f, now) {
    var sys = TALKER[talker];
    for (var i = 4; i + 3 < f.length; i += 4) {
      var prn = num(f[i]); if (prn == null) continue;
      var s = sys || systemOfPrn(prn), key = s + '-' + prn;
      var cur = this.sats.get(key) || { sys: s, prn: prn };
      cur.el = num(f[i + 1]); cur.az = num(f[i + 2]);
      var snr = num(f[i + 3]); cur.snr = snr; cur.seen = now;
      this.sats.set(key, cur);
    }
  };

  Receiver.prototype._gsa = function (talker, f, now) {
    // $xxGSA,mode,fix,prn x12,pdop,hdop,vdop[,systemId]
    var fixType = num(f[2]);
    this.fix.type = fixType === 3 ? '3D' : fixType === 2 ? '2D' : 'none';
    var ids = f.slice(3, 15).map(num).filter(function (v) { return v != null; });
    this.fix.pdop = num(f[15]); this.fix.hdop = num(f[16]); this.fix.vdop = num(f[17]);
    var sysFromId = f.length > 18 ? SYSID[num(f[18])] : null;
    var self = this, bySys = {};
    ids.forEach(function (prn) {
      var s = sysFromId || TALKER[talker] || systemOfPrn(prn);
      (bySys[s] = bySys[s] || new Set()).add(prn);
    });
    var named = sysFromId || TALKER[talker];
    if (named) { this.used[named] = bySys[named] || new Set(); this.usedSeen[named] = now; }
    else Object.keys(bySys).forEach(function (s) { self.used[s] = bySys[s]; self.usedSeen[s] = now; });
  };

  Receiver.prototype._gga = function (f) {
    // $xxGGA,time,lat,N,lon,E,quality,numSats,hdop,alt,M,sep,M,...
    var q = num(f[6]);
    this.fix.quality = q;
    this.fix.satsUsed = num(f[7]);
    if (num(f[8]) != null) this.fix.hdop = num(f[8]);
    this.fix.alt = num(f[9]);
    if (f[1]) this.fix.time = f[1];
    if (q) { var la = coord(f[2], f[3]), lo = coord(f[4], f[5]); if (la != null && lo != null) { this.fix.lat = la; this.fix.lon = lo; } }
  };

  Receiver.prototype._rmc = function (f) {
    // $xxRMC,time,status,lat,N,lon,E,speedKn,course,date,...
    this.fix.valid = f[2] === 'A';
    if (f[1]) this.fix.time = f[1];
    if (f[9]) this.fix.date = f[9];
    this.fix.speedKn = num(f[7]); this.fix.course = num(f[8]);
    if (this.fix.valid) { var la = coord(f[3], f[4]), lo = coord(f[5], f[6]); if (la != null && lo != null) { this.fix.lat = la; this.fix.lon = lo; } }
  };

  // Drop satellites not heard for `ms`, and used-lists not refreshed for `ms`.
  Receiver.prototype.prune = function (now, ms) {
    var self = this;
    this.sats.forEach(function (s, k) { if (now - s.seen > ms) self.sats.delete(k); });
    Object.keys(this.usedSeen).forEach(function (s) { if (now - self.usedSeen[s] > ms) { delete self.used[s]; delete self.usedSeen[s]; } });
  };

  Receiver.prototype.isUsed = function (sys, prn) { return !!(this.used[sys] && this.used[sys].has(prn)); };
  Receiver.prototype.usedCount = function () {
    var self = this; return Object.keys(this.used).reduce(function (n, s) { return n + self.used[s].size; }, 0);
  };
  Receiver.prototype.list = function () {
    return Array.from(this.sats.values()).sort(function (a, b) { return a.sys === b.sys ? a.prn - b.prn : a.sys < b.sys ? -1 : 1; });
  };

  /* ---------------------------------------------------------------- Web Serial */
  // Open a port and find its speed: listen at each rate until two good sentences arrive.
  var RATES = [9600, 4800, 38400, 57600, 115200, 19200];

  function Serial(onLine, onStatus) { this.onLine = onLine; this.onStatus = onStatus; this.port = null; this.reader = null; this.baud = null; this.stopped = true; }
  Serial.supported = function () { return !!(root.navigator && navigator.serial); };

  Serial.prototype.connect = async function (baudChoice) {
    if (!Serial.supported()) throw new Error('This browser cannot open serial ports. Use Chrome or Edge on a computer.');
    var port = await navigator.serial.requestPort();
    this.port = port; this.stopped = false;
    var rates = baudChoice ? [baudChoice] : RATES;
    for (var i = 0; i < rates.length; i++) {
      this.onStatus('trying', rates[i]);
      try { await port.open({ baudRate: rates[i] }); } catch (e) { if (/already open/i.test(e.message)) { await port.close(); await port.open({ baudRate: rates[i] }); } else throw e; }
      var good = baudChoice ? 2 : await this._sniff(2500);
      if (good >= 2 || baudChoice) { this.baud = rates[i]; this.onStatus('open', rates[i]); this._loop(); return rates[i]; }
      await port.close();
    }
    this.port = null; this.stopped = true;
    throw new Error('No NMEA heard at ' + rates.join(', ') + ' baud. Check the cable and that the receiver sends NMEA.');
  };

  Serial.prototype._sniff = async function (ms) {
    var reader = this.port.readable.getReader(), dec = new TextDecoder(), buf = '', good = 0, until = Date.now() + ms;
    var timer = setTimeout(function () { reader.cancel().catch(function () {}); }, ms);
    try {
      while (Date.now() < until && good < 2) {
        var r = await reader.read(); if (r.done) break;
        buf += dec.decode(r.value, { stream: true });
        var parts = buf.split(/\r?\n/); buf = parts.pop();
        parts.forEach(function (l) { if (checksumOk(l.trim())) good++; });
      }
    } catch (e) { /* cancelled */ }
    clearTimeout(timer);
    try { reader.releaseLock(); } catch (e) {}
    return good;
  };

  Serial.prototype._loop = async function () {
    var self = this, dec = new TextDecoder(), buf = '';
    while (this.port && this.port.readable && !this.stopped) {
      this.reader = this.port.readable.getReader();
      try {
        for (;;) {
          var r = await this.reader.read(); if (r.done) break;
          buf += dec.decode(r.value, { stream: true });
          var parts = buf.split(/\r?\n/); buf = parts.pop();
          parts.forEach(function (l) { if (l.trim()) self.onLine(l.trim()); });
        }
      } catch (e) {
        if (!this.stopped) this.onStatus('error', e.message);
      } finally {
        try { this.reader.releaseLock(); } catch (e2) {}
      }
      if (this.stopped) break;
    }
    if (!this.stopped) { this.stopped = true; this.onStatus('closed'); }
  };

  Serial.prototype.disconnect = async function () {
    this.stopped = true;
    try { if (this.reader) await this.reader.cancel(); } catch (e) {}
    try { if (this.port) await this.port.close(); } catch (e) {}
    this.port = null; this.reader = null; this.baud = null;
    this.onStatus('closed');
  };

  root.GNSSNmea = { Receiver: Receiver, Serial: Serial, checksumOk: checksumOk, systemOfPrn: systemOfPrn };
})(window);
