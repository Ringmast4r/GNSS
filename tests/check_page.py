"""Headless check of GNSS // Tracker from file:// (no server; the logic needs no network).
   py -3.13 tests/check_page.py [--shots DIR]
Checks: the house frame (globe drawn and turning, theme flips the rail, rail hides), orbit sanity
(GPS altitude ~20,200 km, period ~11.97 h, range 19,000-27,000 km, |L1 Doppler| < 5.5 kHz), the sky
plot, every tab, an NMEA replay with good and bad checksums (GPS + GLONASS, fix, DOP), and no
sideways scroll at phone width. Exits 1 on any failure."""
import sys
import pathlib
import functools
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
URL = (ROOT / 'index.html').as_uri() + '?lat=33.7490&lon=-84.3880'
SHOTS = None
if '--shots' in sys.argv:
    SHOTS = pathlib.Path(sys.argv[sys.argv.index('--shots') + 1])
    SHOTS.mkdir(parents=True, exist_ok=True)


def nmea(body):
    x = functools.reduce(lambda a, c: a ^ ord(c), body, 0)
    return '$%s*%02X' % (body, x)


GOOD = [nmea('GPGSV,2,1,06,05,62,075,44,13,36,309,41,15,31,213,38,18,48,147,42'),
        nmea('GPGSV,2,2,06,20,12,040,30,24,08,280,'),
        nmea('GLGSV,1,1,02,65,40,100,35,72,22,250,28'),
        nmea('GNGSA,A,3,05,13,15,18,,,,,,,,,1.6,0.9,1.3,1'),
        nmea('GNGSA,A,3,65,72,,,,,,,,,,,1.6,0.9,1.3,2'),
        nmea('GNGGA,231500.00,3344.940,N,08423.280,W,1,06,0.9,320.5,M,-30.1,M,,'),
        nmea('GNRMC,231500.00,A,3344.940,N,08423.280,W,0.1,0.0,161126,,,A')]
BAD = ['$GPGSV,1,1,01,07,10,010,20*00']

fails = []
count = [0]


def ok(cond, label, got=None):
    count[0] += 1
    if not cond:
        fails.append('%s -> %r' % (label, got))


def quiet(text):
    return ('Fetch API cannot load file' in text or 'Failed to load resource' in text or 'gps-ops.txt' in text)


with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-unsafe-swiftshader'])
    for label, w, h in [('desk', 1440, 900), ('phone', 390, 844)]:
        pg = b.new_page(viewport={'width': w, 'height': h})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and not quiet(m.text) else None)
        pg.goto(URL)
        pg.wait_for_timeout(2500)
        info = pg.evaluate("""() => ({ total: document.getElementById('st-total').textContent,
            up: +document.getElementById('st-up').textContent,
            sky: document.querySelectorAll('#sky g.sat').length, title: document.getElementById('title').textContent,
            rail: document.querySelectorAll('#sat-list .scan-item').length,
            globe: document.querySelector('.brand .mark').classList.contains('drawn'),
            theme: document.documentElement.getAttribute('data-theme') })""")
        ok(info['total'] == '32', label + ': 32 satellites', info['total'])
        ok(4 <= info['up'] <= 16, label + ': 4-16 above the mask', info['up'])
        ok(info['sky'] >= info['up'], label + ': sky plot draws them', info['sky'])
        ok(info['rail'] == info['up'], label + ': rail lists them', info['rail'])
        ok('33.7490' in info['title'], label + ': observer from the link', info['title'])
        ok(info['theme'] == 'light', label + ': light by default', info['theme'])
        ok(info['globe'], label + ': globe drawn live')
        if label == 'desk':
            phys = pg.evaluate("""() => { const O = GNSSOrbits, obs = O.observer(33.749, -84.388, 0), now = new Date();
                return O.parseTLE(window.GNSS_TLE_FALLBACK).map(s => { const st = O.state(s, now, obs);
                  return [s.prn, st.alt, st.range, st.doppler, s.period, st.el]; }); }""")
            for prn, alt, rng, dop, per, el in phys:
                ok(19300 < alt < 21100, 'PRN %s altitude' % prn, alt)
                if el >= 0:
                    ok(19000 < rng < 26500, 'PRN %s range above the horizon' % prn, rng)
                else:
                    ok(25000 < rng < 34000, 'PRN %s range below the horizon' % prn, rng)
                ok(abs(dop) < 5500, 'PRN %s Doppler' % prn, dop)
                ok(715 < per < 722, 'PRN %s period (min)' % prn, per)
            mark = pg.locator('.brand .mark')
            ok(mark.locator('canvas').count() == 2, 'globe has its two layers', mark.locator('canvas').count())
            a = mark.screenshot()
            pg.wait_for_timeout(1500)
            c = mark.screenshot()
            ok(a != c, 'globe turns between two frames')
            if SHOTS:
                pg.screenshot(path=str(SHOTS / 'sky-light.png'))
            pg.locator('#sky g.sat').first.click()
            pg.wait_for_timeout(300)
            ok('PRN' in pg.inner_text('#sel-prn'), 'clicking a satellite selects it', pg.inner_text('#sel-prn'))
            pg.click('#theme')
            pg.wait_for_timeout(400)
            bg = pg.evaluate("getComputedStyle(document.querySelector('.rail')).backgroundColor")
            ok(bg == 'rgb(19, 19, 19)', 'dark theme flips the rail to #131313', bg)
            if SHOTS:
                pg.screenshot(path=str(SHOTS / 'sky-dark.png'))
            pg.click('#theme')
            for tab in ['map', 'sats', 'rx', 'method', 'sky']:
                pg.click('#tabs button[data-tab="%s"]' % tab)
                pg.wait_for_timeout(700)
                ok(pg.locator('.pane[data-pane="%s"]' % tab).is_visible(), 'tab %s shows' % tab)
                if tab == 'sats':
                    rows = pg.locator('#sat-table > tbody > tr:not(.detail)').count()
                    ok(rows == 32, 'table has 32 rows', rows)
                    pg.click('#sat-table th[data-sort="prn"]')
                    pg.wait_for_timeout(200)
                    first = pg.locator('#sat-table > tbody > tr:not(.detail) > td').first.inner_text()
                    ok(first.strip() == '01', 'sort by PRN puts 01 first', first)
                    if SHOTS:
                        pg.screenshot(path=str(SHOTS / 'satellites.png'))
                if tab == 'map':
                    pins = pg.locator('.sat-pin').count()
                    ok(pins == 32, 'map has 32 pins', pins)
                    if SHOTS:
                        pg.wait_for_timeout(1500)
                        pg.screenshot(path=str(SHOTS / 'map.png'))
                if tab == 'rx':
                    # GSV / GSA built from four satellites really above the mask now, so the sky plot can show them
                    vis = pg.evaluate("""() => Array.from(document.querySelectorAll('#sky g.sat.up'))
                        .map(g => +g.dataset.prn)""")[:4]
                    ok(len(vis) == 4, 'four satellites to replay', vis)
                    others = [x for x in range(1, 33) if x not in vis][:2]
                    lines = [nmea('GPGSV,2,1,06,' + ','.join('%02d,45,090,40' % v for v in vis)),
                             nmea('GPGSV,2,2,06,%02d,12,040,30,%02d,08,280,' % tuple(others)),
                             GOOD[2],
                             nmea('GNGSA,A,3,' + ','.join('%02d' % v for v in vis) + ',,,,,,,,,1.6,0.9,1.3,1'),
                             GOOD[4], GOOD[5], GOOD[6]]
                    pg.fill('#nmea-paste', '\n'.join(lines + BAD))
                    pg.click('#btn-import')
                    pg.wait_for_timeout(1200)
                    note = pg.inner_text('#import-note')
                    ok('7 read' in note and '1 bad' in note, 'replay counts good and bad sentences', note)
                    heard = pg.locator('#heard-table tbody tr').count()
                    ok(heard == 8, 'heard table lists 6 GPS + 2 GLONASS', heard)
                    verdict = pg.inner_text('#fix-verdict').strip()
                    ok(verdict == '3D FIX', 'header shows the 3D fix', verdict)
                    used = pg.inner_text('#st-used').strip()
                    ok(used == '6', 'six satellites in the fix', used)
                    fixtxt = pg.inner_text('#rx-fix')
                    ok('33.7490' in fixtxt and '84.3880' in fixtxt, 'receiver position parsed', fixtxt[:200])
                    ok('1.6 / 0.9 / 1.3' in fixtxt, 'DOP parsed', fixtxt)
                    if SHOTS:
                        pg.screenshot(path=str(SHOTS / 'receiver.png'), full_page=True)
            pg.wait_for_timeout(500)
            used_sky = pg.locator('#sky g.sat.used').count()
            ok(used_sky >= 1, 'sky plot marks satellites in the fix', used_sky)
            other = pg.locator('#sky g.other').count()
            ok(other == 2, 'sky plot shows the two GLONASS satellites', other)
            pg.click('#btn-hide')
            pg.wait_for_timeout(200)
            ok(pg.locator('#btn-show').is_visible(), 'rail hides to a Show tab')
            pg.click('#btn-show')
            pg.wait_for_timeout(200)
            ok(pg.locator('#rail').is_visible(), 'rail comes back')
        sw = pg.evaluate('document.documentElement.scrollWidth')
        ok(sw <= w, label + ': no sideways scroll', sw)
        if label == 'phone' and SHOTS:
            pg.screenshot(path=str(SHOTS / 'phone.png'), full_page=True)
        ok(not errs, label + ': console clean', errs[:5])
        pg.close()
    b.close()

print('%d passed, %d failed' % (count[0] - len(fails), len(fails)))
for f in fails:
    print('  FAIL', f)
sys.exit(1 if fails else 0)
