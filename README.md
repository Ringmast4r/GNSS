<div align="center">

<img width="100%" alt="GNSS" src="https://capsule-render.vercel.app/api?type=waving&color=0:000000,100:1D7B7F&height=220&section=header&text=GNSS&fontSize=60&fontColor=ffffff&animation=twinkling&fontAlignY=35&desc=Web%20%7C%20JavaScript%20%7C%20GPS%20%7C%20Visualization&descSize=16&descAlignY=58"/>

`Web` [`JavaScript`](https://developer.mozilla.org/en-US/docs/Web/JavaScript) `GPS` `Visualization` - Real-time GPS satellite tracker - Educational visualization tool

[Project website / live view](https://ringmast4r.github.io/GNSS/)

[![Typing SVG](https://readme-typing-svg.herokuapp.com?font=Fira+Code&weight=600&size=20&pause=1000&color=1D7B7F&center=true&vCenter=true&multiline=true&repeat=true&width=950&height=90&lines=Real-time+GPS+satellite+tracker+-+Educational+visualization+tool%3BWeb+%2F+JavaScript+%2F+GPS+%2F+Visualization)](https://git.io/typing-svg)

![Existing project screenshot or recording](GNSS.PNG)

<br>

[![Project](https://img.shields.io/badge/Project-GNSS-1D7B7F?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Ringmast4r/GNSS)
[![Format](https://img.shields.io/badge/Format-JavaScript-000000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Ringmast4r/GNSS/tree/main)

[![Stars](https://img.shields.io/github/stars/Ringmast4r/GNSS?style=flat-square&color=1D7B7F)](https://github.com/Ringmast4r/GNSS/stargazers)
[![Forks](https://img.shields.io/github/forks/Ringmast4r/GNSS?style=flat-square&color=1D7B7F)](https://github.com/Ringmast4r/GNSS/network/members)
[![Repo Size](https://img.shields.io/github/repo-size/Ringmast4r/GNSS?style=flat-square&color=1D7B7F)](https://github.com/Ringmast4r/GNSS)
[![Last Commit](https://img.shields.io/github/last-commit/Ringmast4r/GNSS?style=flat-square&color=1D7B7F)](https://github.com/Ringmast4r/GNSS/commits/main)

</div>

---

# GPS Satellite Tracker

![License](https://img.shields.io/badge/license-CC%20BY%204.0-blue.svg)

A real-time visualization tool to see which GPS satellites you're actually connecting to when using GPS modules.

🌐 **[Live Demo](https://ringmast4r.github.io/GNSS/)**

![GNSS Satellite Tracker Screenshot](GNSS.PNG)

<a id="why-this-exists"></a>
## `> why_this_exists`

I wanted to create an educational tool to visualize which satellites my GPS modules connect with - which ones are overhead, their signal strength, and which are actively being used for positioning. This makes the invisible world of GPS visible and helps understand how GPS positioning actually works.

<a id="features"></a>
## `> features`

- **Real-time satellite tracking** - See all 32 GPS satellites moving overhead
- **Live GPS module connection** - Connect your GPS receiver via USB to see real signal data
- **Signal strength visualization** - SNR bars for each satellite
- **Color-coded status**:
  - Gray: Below horizon
  - Blue: Above horizon (visible)
  - Orange: Detected by your GPS module
  - Green: Actively used for position fix

<a id="quick-start"></a>
## `> quick_start`

1. Open `index.html` in Chrome or Edge
2. Click "Get My Location" or enter coordinates
3. (Optional) Connect GPS module via "Connect GPS Module" button
4. Watch satellites move in real-time

<a id="supported-gps-modules"></a>
## `> supported_gps_modules`

Any NMEA-compatible GPS module:
- u-blox (NEO-6M, NEO-7M, NEO-8M, NEO-M9N)
- Adafruit GPS modules
- GlobalSat BU-353
- Generic USB GPS receivers

<a id="browser-requirements"></a>
## `> browser_requirements`

Chrome 89+, Edge 89+, or Opera 75+ (Web Serial API required for GPS module connection)

<a id="credits"></a>
## `> credits`

Built with Satellite.js, Leaflet, and TLE data from Celestrak

<a id="license"></a>
## `> license`

CC BY 4.0 (Creative Commons Attribution 4.0 International) - Free to use with **attribution to Ringmast4r required**. See [LICENSE](LICENSE) file for details.

---

<div align="center">

<img width="100%" alt="GNSS footer" src="https://capsule-render.vercel.app/api?type=waving&color=0:1D7B7F,100:000000&height=120&section=footer&text=RINGMAST4R%20%2F%2F%20VISUALIZATION&fontSize=18&fontColor=ffffff&fontAlignY=65"/>

</div>
