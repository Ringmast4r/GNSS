"""Refresh the GPS orbits: CelesTrak gps-ops TLEs -> data/gps-ops.txt and data/gps-ops-fallback.js.

    py -3.13 scripts/refresh_orbits.py

The page fetches data/gps-ops.txt; the .js copy is only for opening index.html from disk (file://
cannot fetch). CelesTrak asks for no more than one pull of a group every two hours, and refuses a
repeat inside that window, so run this at most a few times a day. Keeps the old files if the pull
fails or comes back short.
"""
import json
import pathlib
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
URL = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=gps-ops&FORMAT=tle'


def main() -> int:
    req = urllib.request.Request(URL, headers={'User-Agent': 'gnss-tracker/0.2 (+https://github.com/Ringmast4r/GNSS)'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            text = r.read().decode('utf-8', 'replace')
    except Exception as e:  # noqa: BLE001 - report and keep the old files
        print('pull failed, old files kept:', e)
        return 1
    sets = sum(1 for line in text.splitlines() if line.startswith('1 '))
    if sets < 24:
        print(f'only {sets} TLE sets came back, old files kept')
        return 1
    text = '\n'.join(line.rstrip() for line in text.splitlines()) + '\n'
    (ROOT / 'data' / 'gps-ops.txt').write_text(text, encoding='utf-8', newline='\n')
    (ROOT / 'data' / 'gps-ops-fallback.js').write_text(
        '/* GNSS // Tracker: a copy of data/gps-ops.txt for when the page is opened from disk (file:// cannot fetch).\n'
        '   Rebuilt by scripts/refresh_orbits.py. The page always prefers data/gps-ops.txt. */\n'
        'window.GNSS_TLE_FALLBACK = ' + json.dumps(text) + ';\n', encoding='utf-8', newline='\n')
    print(f'{sets} GPS TLE sets saved')
    return 0


if __name__ == '__main__':
    sys.exit(main())
