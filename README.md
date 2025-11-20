# GPS Satellite Tracker

![Visitors](https://visitor-badge.laobi.icu/badge?page_id=Ringmast4r.GNSS)
![Repo Size](https://img.shields.io/github/repo-size/Ringmast4r/GNSS?style=flat&logo=github)
![License](https://img.shields.io/badge/license-CC%20BY%204.0-blue.svg)

A real-time visualization tool to see which GPS satellites you're actually connecting to when using GPS modules.

🌐 **[Live Demo](https://ringmast4r.github.io/GNSS/)**

## Why This Exists

I wanted to create an educational tool to visualize which satellites my GPS modules connect with - which ones are overhead, their signal strength, and which are actively being used for positioning. This makes the invisible world of GPS visible and helps understand how GPS positioning actually works.

## Features

- **Real-time satellite tracking** - See all 32 GPS satellites moving overhead
- **Live GPS module connection** - Connect your GPS receiver via USB to see real signal data
- **Signal strength visualization** - SNR bars for each satellite
- **Color-coded status**:
  - Gray: Below horizon
  - Blue: Above horizon (visible)
  - Orange: Detected by your GPS module
  - Green: Actively used for position fix

## Quick Start

1. Open `index.html` in Chrome or Edge
2. Click "Get My Location" or enter coordinates
3. (Optional) Connect GPS module via "Connect GPS Module" button
4. Watch satellites move in real-time

## Supported GPS Modules

Any NMEA-compatible GPS module:
- u-blox (NEO-6M, NEO-7M, NEO-8M, NEO-M9N)
- Adafruit GPS modules
- GlobalSat BU-353
- Generic USB GPS receivers

## Browser Requirements

Chrome 89+, Edge 89+, or Opera 75+ (Web Serial API required for GPS module connection)

## Credits

Built with Satellite.js, Leaflet, and TLE data from Celestrak

## License

CC BY 4.0 (Creative Commons Attribution 4.0 International) - Free to use with **attribution to Ringmast4r required**. See [LICENSE](LICENSE) file for details.
