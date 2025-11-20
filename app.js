// Global variables
let map;
let satellites = [];
let satelliteCircleMarkers = {}; // Store circle markers by PRN for easy lookup (PERSISTENT)
let satelliteTrailLines = []; // Store trail polylines (cleared each update)
let satelliteTrails = {}; // Store trail coordinates for each satellite
let userLocation = { lat: 0, lon: 0 };
let connectedPRNs = [];
let gpsData = {}; // Stores PRN -> {elevation, azimuth, snr, used}
let updateInterval;
let mapStyle = 'dark'; // 'dark', 'light', 'natgeo', or 'space'
let lightTileLayer;
let darkTileLayer;
let natgeoTileLayer;
let spaceTileLayer;
let spaceOverlayMarkers = [];
let firstGPSFix = true; // Only auto-center on first GPS fix
let showTrails = true;
let openPopupPRN = null; // Track which satellite popup is open

// Serial port variables
let port;
let reader;
let isReading = false;
let nmeaBuffer = '';

// TLE data embedded (will load from file)
const TLE_DATA = `GPS BIIR-2  (PRN 13)
1 24876U 97035A   25316.81786533  .00000057  00000+0  00000+0 0  9999
2 24876  55.8805 107.0391 0096491  56.9975 303.9217  2.00563366207613
GPS BIIR-4  (PRN 20)
1 26360U 00025A   25318.68574779 -.00000109  00000+0  00000+0 0  9995
2 26360  55.0291  27.9728 0038526 239.3029 121.7467  2.00570078186976
GPS BIIR-5  (PRN 22)
1 26407U 00040A   25318.14910147 -.00000040  00000+0  00000+0 0  9992
2 26407  54.8983 223.7056 0127613 301.2562 231.9061  2.00567536185631
GPS BIIR-8  (PRN 16)
1 27663U 03005A   25318.73366105 -.00000036  00000+0  00000+0 0  9990
2 27663  54.9310 223.4921 0146247  51.3943 319.3519  2.00572438167017
GPS BIIR-11 (PRN 19)
1 28190U 04009A   25318.00069429 -.00000061  00000+0  00000+0 0  9998
2 28190  55.0114 284.3769 0107970 167.1336 194.2094  2.00561848158634
GPS BIIR-13 (PRN 02)
1 28474U 04045A   25318.41226932 -.00000080  00000+0  00000+0 0  9993
2 28474  55.2541 333.5457 0169995 308.0603  49.8681  2.00568202154111
GPS BIIRM-1 (PRN 17)
1 28874U 05038A   25318.46604652 -.00000065  00000+0  00000+0 0  9997
2 28874  55.0569 281.8390 0133270 292.9131  63.7477  2.00550100147521
GPS BIIRM-2 (PRN 31)
1 29486U 06042A   25316.62700956  .00000059  00000+0  00000+0 0  9995
2 29486  54.6900 159.9361 0107278  51.1601 321.0774  2.00555245140050
GPS BIIRM-3 (PRN 12)
1 29601U 06052A   25318.02995973 -.00000039  00000+0  00000+0 0  9995
2 29601  54.9775 222.5375 0086917  87.1641 273.8730  2.00571597139099
GPS BIIRM-4 (PRN 15)
1 32260U 07047A   25318.83340003  .00000001  00000+0  00000+0 0  9990
2 32260  53.9360  88.9109 0164586  84.8625 276.9960  2.00565659132518
GPS BIIRM-5 (PRN 29)
1 32384U 07062A   25318.39050698 -.00000064  00000+0  00000+0 0  9993
2 32384  55.2071 282.7826 0032213 163.4121   6.8163  2.00575891131204
GPS BIIRM-6 (PRN 07)
1 32711U 08012A   25317.75661220  .00000074  00000+0  00000+0 0  9991
2 32711  54.4723 158.5302 0201431 244.6502 113.3165  2.00564316129435
GPS BIIRM-8 (PRN 05)
1 35752U 09043A   25318.24479083 -.00000102  00000+0  00000+0 0  9996
2 35752  56.0720  35.9068 0052645  82.2390 288.2660  2.00567416119050
GPS BIIF-1  (PRN 25)
1 36585U 10022A   25318.31553006 -.00000029  00000+0  00000+0 0  9994
2 36585  54.3057 217.2201 0124738  64.7412 116.4422  2.00551723113287
GPS BIIF-3  (PRN 24)
1 38833U 12053A   25318.43260264  .00000086  00000+0  00000+0 0  9994
2 38833  53.5522 152.3982 0174866  63.5419 298.3061  2.00564786 95134
GPS BIIF-4  (PRN 27)
1 39166U 13023A   25318.29633698 -.00000065  00000+0  00000+0 0  9999
2 39166  54.6766 277.7239 0136178  48.3361 312.8056  2.00565253 91574
GPS BIIF-5  (PRN 30)
1 39533U 14008A   25318.29184903  .00000079  00000+0  00000+0 0  9995
2 39533  53.6259 158.0851 0078601 226.1992 133.2163  2.00572824 85378
GPS BIIF-6  (PRN 06)
1 39741U 14026A   25318.07444445 -.00000081  00000+0  00000+0 0  9996
2 39741  56.5938 339.8918 0038257 317.4073  42.3397  2.00563410 84228
GPS BIIF-7  (PRN 09)
1 40105U 14045A   25318.16354177  .00000030  00000+0  00000+0 0  9998
2 40105  55.2117  97.0388 0033210 119.0355 241.2862  2.00570773 81769
GPS BIIF-8  (PRN 03)
1 40294U 14068A   25315.54706351 -.00000084  00000+0  00000+0 0  9996
2 40294  56.8357  39.3526 0060976  69.6991 290.9826  2.00562775 80841
GPS BIIF-9  (PRN 26)
1 40534U 15013A   25318.66895414 -.00000019  00000+0  00000+0 0  9997
2 40534  53.2031 213.0526 0105730  37.7488 323.0471  2.00564246 77524
GPS BIIF-10 (PRN 08)
1 40730U 15033A   25318.83049045 -.00000070  00000+0  00000+0 0  9994
2 40730  54.1550 275.9207 0109201  26.1550 334.3742  2.00567013 75697
GPS BIIF-11 (PRN 10)
1 41019U 15062A   25318.39112593 -.00000099  00000+0  00000+0 0  9998
2 41019  56.8123  39.0988 0109886 229.2084 129.8599  2.00567097 73524
GPS BIIF-12 (PRN 32)
1 41328U 16007A   25314.98304705  .00000034  00000+0  00000+0 0  9998
2 41328  55.3876  98.1172 0090614 242.9006 116.1610  2.00562288 71462
GPS BIII-1  (PRN 04)
1 43873U 18109A   25318.86000715  .00000035  00000+0  00000+0 0  9996
2 43873  55.5519 100.6471 0036806 193.9241 339.9573  2.00552925 50776
GPS BIII-2  (PRN 18)
1 44506U 19056A   25318.49198990 -.00000083  00000+0  00000+0 0  9998
2 44506  55.7309 339.6742 0057680 197.9135 326.0368  2.00565462 45765
GPS BIII-3  (PRN 23)
1 45854U 20041A   25315.34640374 -.00000086  00000+0  00000+0 0  9993
2 45854  56.5258  37.4081 0059720 202.2054 154.9948  2.00562398 39669
GPS BIII-4  (PRN 14)
1 46826U 20078A   25316.12603230 -.00000034  00000+0  00000+0 0  9993
2 46826  54.0224 219.5836 0063912 203.4991 326.7749  2.00567032 37157
GPS BIII-5  (PRN 11)
1 48859U 21054A   25318.37755933 -.00000086  00000+0  00000+0 0  9990
2 48859  55.2660 341.0928 0024495 231.9355 310.9286  2.00555100 32449
GPS BIII-6  (PRN 28)
1 55268U 23009A   25316.33169645  .00000060  00000+0  00000+0 0  9998
2 55268  55.0992 157.0398 0003679 359.6076 188.1072  2.00558164 20899
GPS BIII-7  (PRN 01)
1 62339U 24242A   25318.20947369 -.00000088  00000+0  00000+0 0  9991
2 62339  54.9317 342.8960 0010621 342.2154 197.7285  2.00567218  6946
GPS BIII-8  (PRN 21)
1 64202U 25116A   25318.68876968 -.00000100  00000+0  00000+0 0  9996
2 64202  55.0858  39.7738 0004570 301.6372  54.7068  2.00560100  3560`;

// Get satellite information based on type
function getSatelliteInfo(name) {
    const info = {
        operator: 'U.S. Space Force',
        manufacturer: '',
        launchDate: '',
        mass: '',
        design: '',
        description: ''
    };

    if (name.includes('BIIR-2')) { info.manufacturer = 'Lockheed Martin'; info.launchDate = '1997-07-23'; info.mass = '2,032 kg'; info.design = 'Block IIR'; info.description = 'GPS Block IIR (Replenishment) satellites with improved atomic clocks and radiation hardening.'; }
    else if (name.includes('BIIR-4')) { info.manufacturer = 'Lockheed Martin'; info.launchDate = '2000-05-11'; info.mass = '2,032 kg'; info.design = 'Block IIR'; info.description = 'GPS Block IIR (Replenishment) satellites with improved atomic clocks and radiation hardening.'; }
    else if (name.includes('BIIR-5')) { info.manufacturer = 'Lockheed Martin'; info.launchDate = '2000-07-16'; info.mass = '2,032 kg'; info.design = 'Block IIR'; info.description = 'GPS Block IIR (Replenishment) satellites with improved atomic clocks and radiation hardening.'; }
    else if (name.includes('BIIR-8')) { info.manufacturer = 'Lockheed Martin'; info.launchDate = '2003-01-29'; info.mass = '2,032 kg'; info.design = 'Block IIR'; info.description = 'GPS Block IIR (Replenishment) satellites with improved atomic clocks and radiation hardening.'; }
    else if (name.includes('BIIR-11')) { info.manufacturer = 'Lockheed Martin'; info.launchDate = '2004-03-20'; info.mass = '2,032 kg'; info.design = 'Block IIR'; info.description = 'GPS Block IIR (Replenishment) satellites with improved atomic clocks and radiation hardening.'; }
    else if (name.includes('BIIR-13')) { info.manufacturer = 'Lockheed Martin'; info.launchDate = '2004-11-06'; info.mass = '2,032 kg'; info.design = 'Block IIR'; info.description = 'GPS Block IIR (Replenishment) satellites with improved atomic clocks and radiation hardening.'; }
    else if (name.includes('BIIRM-1')) { info.manufacturer = 'Lockheed Martin'; info.launchDate = '2005-09-26'; info.mass = '2,032 kg'; info.design = 'Block IIR-M'; info.description = 'GPS Block IIR-M (Modernized) adds L2C civilian signal and improved military signals.'; }
    else if (name.includes('BIIRM-2')) { info.manufacturer = 'Lockheed Martin'; info.launchDate = '2006-09-25'; info.mass = '2,032 kg'; info.design = 'Block IIR-M'; info.description = 'GPS Block IIR-M (Modernized) adds L2C civilian signal and improved military signals.'; }
    else if (name.includes('BIIRM-3')) { info.manufacturer = 'Lockheed Martin'; info.launchDate = '2006-11-17'; info.mass = '2,032 kg'; info.design = 'Block IIR-M'; info.description = 'GPS Block IIR-M (Modernized) adds L2C civilian signal and improved military signals.'; }
    else if (name.includes('BIIRM-4')) { info.manufacturer = 'Lockheed Martin'; info.launchDate = '2007-10-17'; info.mass = '2,032 kg'; info.design = 'Block IIR-M'; info.description = 'GPS Block IIR-M (Modernized) adds L2C civilian signal and improved military signals.'; }
    else if (name.includes('BIIRM-5')) { info.manufacturer = 'Lockheed Martin'; info.launchDate = '2007-12-20'; info.mass = '2,032 kg'; info.design = 'Block IIR-M'; info.description = 'GPS Block IIR-M (Modernized) adds L2C civilian signal and improved military signals.'; }
    else if (name.includes('BIIRM-6')) { info.manufacturer = 'Lockheed Martin'; info.launchDate = '2008-03-15'; info.mass = '2,032 kg'; info.design = 'Block IIR-M'; info.description = 'GPS Block IIR-M (Modernized) adds L2C civilian signal and improved military signals.'; }
    else if (name.includes('BIIRM-8')) { info.manufacturer = 'Lockheed Martin'; info.launchDate = '2009-08-17'; info.mass = '2,032 kg'; info.design = 'Block IIR-M'; info.description = 'GPS Block IIR-M (Modernized) adds L2C civilian signal and improved military signals.'; }
    else if (name.includes('BIIF-1')) { info.manufacturer = 'Boeing'; info.launchDate = '2010-05-28'; info.mass = '1,630 kg'; info.design = 'Block IIF'; info.description = 'GPS Block IIF satellites with new L5 civilian signal for safety-of-life applications and improved accuracy.'; }
    else if (name.includes('BIIF-3')) { info.manufacturer = 'Boeing'; info.launchDate = '2012-10-04'; info.mass = '1,630 kg'; info.design = 'Block IIF'; info.description = 'GPS Block IIF satellites with new L5 civilian signal for safety-of-life applications and improved accuracy.'; }
    else if (name.includes('BIIF-4')) { info.manufacturer = 'Boeing'; info.launchDate = '2013-05-15'; info.mass = '1,630 kg'; info.design = 'Block IIF'; info.description = 'GPS Block IIF satellites with new L5 civilian signal for safety-of-life applications and improved accuracy.'; }
    else if (name.includes('BIIF-5')) { info.manufacturer = 'Boeing'; info.launchDate = '2014-02-21'; info.mass = '1,630 kg'; info.design = 'Block IIF'; info.description = 'GPS Block IIF satellites with new L5 civilian signal for safety-of-life applications and improved accuracy.'; }
    else if (name.includes('BIIF-6')) { info.manufacturer = 'Boeing'; info.launchDate = '2014-05-17'; info.mass = '1,630 kg'; info.design = 'Block IIF'; info.description = 'GPS Block IIF satellites with new L5 civilian signal for safety-of-life applications and improved accuracy.'; }
    else if (name.includes('BIIF-7')) { info.manufacturer = 'Boeing'; info.launchDate = '2014-08-02'; info.mass = '1,630 kg'; info.design = 'Block IIF'; info.description = 'GPS Block IIF satellites with new L5 civilian signal for safety-of-life applications and improved accuracy.'; }
    else if (name.includes('BIIF-8')) { info.manufacturer = 'Boeing'; info.launchDate = '2014-10-29'; info.mass = '1,630 kg'; info.design = 'Block IIF'; info.description = 'GPS Block IIF satellites with new L5 civilian signal for safety-of-life applications and improved accuracy.'; }
    else if (name.includes('BIIF-9')) { info.manufacturer = 'Boeing'; info.launchDate = '2015-03-25'; info.mass = '1,630 kg'; info.design = 'Block IIF'; info.description = 'GPS Block IIF satellites with new L5 civilian signal for safety-of-life applications and improved accuracy.'; }
    else if (name.includes('BIIF-10')) { info.manufacturer = 'Boeing'; info.launchDate = '2015-07-15'; info.mass = '1,630 kg'; info.design = 'Block IIF'; info.description = 'GPS Block IIF satellites with new L5 civilian signal for safety-of-life applications and improved accuracy.'; }
    else if (name.includes('BIIF-11')) { info.manufacturer = 'Boeing'; info.launchDate = '2015-10-31'; info.mass = '1,630 kg'; info.design = 'Block IIF'; info.description = 'GPS Block IIF satellites with new L5 civilian signal for safety-of-life applications and improved accuracy.'; }
    else if (name.includes('BIIF-12')) { info.manufacturer = 'Boeing'; info.launchDate = '2016-02-05'; info.mass = '1,630 kg'; info.design = 'Block IIF'; info.description = 'GPS Block IIF satellites with new L5 civilian signal for safety-of-life applications and improved accuracy.'; }
    else if (name.includes('BIII-1')) { info.manufacturer = 'Lockheed Martin'; info.launchDate = '2018-12-23'; info.mass = '2,161 kg'; info.design = 'Block III'; info.description = 'Next-gen GPS III satellites with 3x better accuracy, 8x anti-jamming capability, and L1C signal for global interoperability.'; }
    else if (name.includes('BIII-2')) { info.manufacturer = 'Lockheed Martin'; info.launchDate = '2019-08-22'; info.mass = '2,161 kg'; info.design = 'Block III'; info.description = 'Next-gen GPS III satellites with 3x better accuracy, 8x anti-jamming capability, and L1C signal for global interoperability.'; }
    else if (name.includes('BIII-3')) { info.manufacturer = 'Lockheed Martin'; info.launchDate = '2020-06-30'; info.mass = '2,161 kg'; info.design = 'Block III'; info.description = 'Next-gen GPS III satellites with 3x better accuracy, 8x anti-jamming capability, and L1C signal for global interoperability.'; }
    else if (name.includes('BIII-4')) { info.manufacturer = 'Lockheed Martin'; info.launchDate = '2020-11-05'; info.mass = '2,161 kg'; info.design = 'Block III'; info.description = 'Next-gen GPS III satellites with 3x better accuracy, 8x anti-jamming capability, and L1C signal for global interoperability.'; }
    else if (name.includes('BIII-5')) { info.manufacturer = 'Lockheed Martin'; info.launchDate = '2021-06-17'; info.mass = '2,161 kg'; info.design = 'Block III'; info.description = 'Next-gen GPS III satellites with 3x better accuracy, 8x anti-jamming capability, and L1C signal for global interoperability.'; }
    else if (name.includes('BIII-6')) { info.manufacturer = 'Lockheed Martin'; info.launchDate = '2023-01-18'; info.mass = '2,161 kg'; info.design = 'Block III'; info.description = 'Next-gen GPS III satellites with 3x better accuracy, 8x anti-jamming capability, and L1C signal for global interoperability.'; }
    else if (name.includes('BIII-7')) { info.manufacturer = 'Lockheed Martin'; info.launchDate = '2024-11-22'; info.mass = '2,161 kg'; info.design = 'Block III'; info.description = 'Next-gen GPS III satellites with 3x better accuracy, 8x anti-jamming capability, and L1C signal for global interoperability.'; }
    else if (name.includes('BIII-8')) { info.manufacturer = 'Lockheed Martin'; info.launchDate = '2025-11-13'; info.mass = '2,161 kg'; info.design = 'Block III'; info.description = 'Next-gen GPS III satellites with 3x better accuracy, 8x anti-jamming capability, and L1C signal for global interoperability.'; }

    return info;
}

// Parse TLE data
function parseTLE(tleText) {
    const lines = tleText.trim().split('\n');
    const sats = [];

    for (let i = 0; i < lines.length; i += 3) {
        if (i + 2 < lines.length) {
            const name = lines[i].trim();
            const tle1 = lines[i + 1].trim();
            const tle2 = lines[i + 2].trim();

            // Extract PRN from name
            const prnMatch = name.match(/PRN (\d+)/);
            const prn = prnMatch ? parseInt(prnMatch[1]) : null;

            // Get satellite info
            const satInfo = getSatelliteInfo(name);

            sats.push({
                name: name,
                prn: prn,
                tle1: tle1,
                tle2: tle2,
                satrec: satellite.twoline2satrec(tle1, tle2),
                info: satInfo
            });
        }
    }

    return sats;
}

// Calculate satellite position
function getSatellitePosition(sat, date) {
    const positionAndVelocity = satellite.propagate(sat.satrec, date);

    if (!positionAndVelocity.position) {
        return null;
    }

    const positionEci = positionAndVelocity.position;
    const gmst = satellite.gstime(date);
    const positionGd = satellite.eciToGeodetic(positionEci, gmst);

    return {
        latitude: satellite.degreesLat(positionGd.latitude),
        longitude: satellite.degreesLong(positionGd.longitude),
        altitude: positionGd.height,
        eci: positionEci
    };
}

// Calculate elevation angle
function calculateElevation(satPos, userLat, userLon) {
    const R = 6371; // Earth radius in km

    // Convert to radians
    const lat1 = userLat * Math.PI / 180;
    const lon1 = userLon * Math.PI / 180;
    const lat2 = satPos.latitude * Math.PI / 180;
    const lon2 = satPos.longitude * Math.PI / 180;

    // Calculate distance
    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    // Calculate elevation
    const elevation = Math.atan2(satPos.altitude, distance) * 180 / Math.PI;

    return elevation;
}

// Initialize 2D map
function initMap() {
    map = L.map('map-container', {
        minZoom: 1,
        maxZoom: 19,
        worldCopyJump: true
    }).setView([0, 0], 2);

    // Light mode tile layer
    lightTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
        minZoom: 1
    });

    // Dark mode tile layer
    darkTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        maxZoom: 19,
        minZoom: 1
    });

    // National Geographic style tile layer
    natgeoTileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; National Geographic, Esri, DeLorme, NAVTEQ, UNEP-WCMC, USGS, NASA, ESA, METI, NRCAN, GEBCO, NOAA, iPC',
        maxZoom: 16,
        minZoom: 1
    });

    // Space mode - Dark map with space history overlays
    spaceTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        maxZoom: 19,
        minZoom: 1
    });

    // Start with dark mode
    if (mapStyle === 'dark') {
        darkTileLayer.addTo(map);
    } else if (mapStyle === 'natgeo') {
        natgeoTileLayer.addTo(map);
    } else if (mapStyle === 'space') {
        spaceTileLayer.addTo(map);
        addSpaceOverlays();
    } else {
        lightTileLayer.addTo(map);
    }

    // Add user location marker - no animation
    const userMarker = L.circleMarker([0, 0], {
        radius: 10,
        fillColor: '#00ff41',
        color: '#00ff41',
        weight: 3,
        fillOpacity: 0.9,
        className: 'user-location',
        interactive: false // Prevents it from interfering with map interactions
    }).addTo(map);

    userMarker.bindPopup('Your Location');

    // Add wrapped copies of user marker for world map wrap
    userMarker.wrappedMarkers = [];
    [-360, 360].forEach(offset => {
        const wrappedUserMarker = L.circleMarker([0, offset], {
            radius: 10,
            fillColor: '#00ff41',
            color: '#00ff41',
            weight: 3,
            fillOpacity: 0.9,
            className: 'user-location',
            interactive: false
        }).addTo(map);
        wrappedUserMarker.bindPopup('Your Location');
        wrappedUserMarker.lonOffset = offset;
        userMarker.wrappedMarkers.push(wrappedUserMarker);
    });

    // Store reference
    window.userMarker = userMarker;
}

// Add space history overlays to the map
function addSpaceOverlays() {
    // Clear existing overlays
    spaceOverlayMarkers.forEach(marker => map.removeLayer(marker));
    spaceOverlayMarkers = [];

    const spaceLocations = [
        // Launch Sites
        { lat: 28.5721, lon: -80.6480, name: 'Cape Canaveral Space Force Station', icon: '🚀', description: 'Primary launch site for NASA missions since 1950. Launched Apollo missions to the Moon, Space Shuttles, and hundreds of satellites. Home to SpaceX launch facilities.' },
        { lat: 45.9650, lon: 63.3050, name: 'Baikonur Cosmodrome', icon: '🚀', description: 'World\'s first and largest operational space launch facility. Launched Sputnik 1 (1957), Yuri Gagarin (1961), and continues to launch Soyuz missions to the ISS.' },
        { lat: 5.2394, lon: -52.7683, name: 'Guiana Space Centre', icon: '🚀', description: 'European Space Agency\'s primary launch site in French Guiana. Ideal location near equator provides 15% fuel savings. Launches Ariane rockets.' },
        { lat: 34.6332, lon: 120.8920, name: 'Jiuquan Satellite Launch Center', icon: '🚀', description: 'China\'s first launch site (1958). Launched China\'s first satellite Dong Fang Hong I (1970) and first manned mission (2003).' },
        { lat: 39.6206, lon: 140.3135, name: 'Tanegashima Space Center', icon: '🚀', description: 'Japan\'s largest rocket launch complex operated by JAXA. Beautiful island location, launches H-IIA/H-IIB rockets.' },
        { lat: 13.7199, lon: 80.2304, name: 'Satish Dhawan Space Centre', icon: '🚀', description: 'India\'s primary spaceport. ISRO launched record 104 satellites in single mission (2017) from here.' },
        { lat: -0.3729, lon: -47.9589, name: 'Alcântara Launch Center', icon: '🚀', description: 'Brazil\'s spaceport, located just 2.3° from equator - ideal for satellite launches to geostationary orbit.' },

        // Space Agencies
        { lat: 38.8830, lon: -77.0164, name: 'NASA Headquarters', icon: '🛸', description: 'National Aeronautics and Space Administration HQ in Washington, D.C. Founded 1958. Manages US civil space program and aerospace research.' },
        { lat: 48.7479, lon: 2.1895, name: 'ESA Headquarters', icon: '🛸', description: 'European Space Agency HQ in Paris. 22 member states. Developed Ariane rockets, Columbus module for ISS, and Rosetta comet mission.' },
        { lat: 55.9289, lon: 37.8060, name: 'Roscosmos', icon: '🛸', description: 'Russian space agency, successor to Soviet space program. Operates Soyuz spacecraft, only crew transport to ISS from 2011-2020.' },
        { lat: 35.5500, lon: 139.6456, name: 'JAXA Headquarters', icon: '🛸', description: 'Japan Aerospace Exploration Agency. Operates Kibo module on ISS, asteroid sample return missions Hayabusa.' },
        { lat: 39.9792, lon: 116.3500, name: 'CNSA Headquarters', icon: '🛸', description: 'China National Space Administration in Beijing. Operates Tiangong space station, Chang\'e lunar missions, Tianwen Mars mission.' },

        // Historic Space Events
        { lat: 28.6080, lon: -80.6042, name: 'Apollo 11 Launch Site (LC-39A)', icon: '🌙', description: 'July 16, 1969: Apollo 11 launched from here carrying Neil Armstrong, Buzz Aldrin, and Michael Collins to the Moon. "That\'s one small step for man..."' },
        { lat: 45.9200, lon: 63.3420, name: 'Sputnik 1 Launch Site', icon: '🛰️', description: 'October 4, 1957: Sputnik 1 launched - first artificial satellite in orbit. Started the Space Age and Space Race.' },
        { lat: 45.9650, lon: 63.3050, name: 'Vostok 1 Launch (Gagarin)', icon: '👨‍🚀', description: 'April 12, 1961: Yuri Gagarin became first human in space aboard Vostok 1. "Poyekhali!" (Let\'s go!)' },
        { lat: 28.5728, lon: -80.6490, name: 'First US Satellite (Explorer 1)', icon: '🛰️', description: 'January 31, 1958: Explorer 1 launched - first US satellite. Discovered Van Allen radiation belts.' },

        // Tracking Stations
        { lat: -35.4015, lon: 148.9819, name: 'Canberra Deep Space Network', icon: '📡', description: 'One of three NASA Deep Space Network stations. Received Apollo 11 moon landing transmissions. Tracks Voyager probes.' },
        { lat: 40.4274, lon: -4.2483, name: 'Madrid Deep Space Network', icon: '📡', description: 'NASA tracking station in Spain. Part of global network ensuring 24/7 contact with deep space missions.' },
        { lat: 35.3390, lon: -116.8750, name: 'Goldstone Deep Space Network', icon: '📡', description: 'California desert tracking station. First to receive images of Mars from Mariner 4 (1965).' },

        // GPS Related
        { lat: 38.8039, lon: -104.5249, name: 'Schriever Space Force Base', icon: '🌐', description: 'GPS Master Control Station. Controls entire GPS constellation of 32 satellites. Originally built 1983.' },
        { lat: 39.0075, lon: -104.8826, name: 'Buckley Space Force Base', icon: '🌐', description: 'GPS monitoring station. Tracks satellite health, uploads navigation data to GPS constellation.' },

        // Satellite Graveyards
        { lat: -48.0, lon: -123.0, name: 'Spacecraft Cemetery (Point Nemo)', icon: '🪦', description: 'Ocean point furthest from land. 263+ spacecraft deorbited here including Mir space station (2001). Over 300 spacecraft rest here.' },

        // Modern Commercial Space
        { lat: 33.9207, lon: -118.3280, name: 'SpaceX Headquarters', icon: '🚀', description: 'SpaceX HQ and rocket factory in Hawthorne, CA. Revolutionized spaceflight with reusable Falcon 9 rockets and Dragon spacecraft.' },
        { lat: 47.1650, lon: -122.0794, name: 'Blue Origin', icon: '🚀', description: 'Jeff Bezos\' space company. Developing New Glenn orbital rocket and New Shepard suborbital tourism vehicle.' }
    ];

    spaceLocations.forEach(loc => {
        const marker = L.marker([loc.lat, loc.lon], {
            icon: L.divIcon({
                html: `<div style="font-size: 24px; text-shadow: 0 0 10px #667eea;">${loc.icon}</div>`,
                className: 'space-marker',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            })
        }).addTo(map);

        const popupContent = `
            <div style="min-width: 280px;">
                <b style="font-size: 15px; color: #667eea;">${loc.icon} ${loc.name}</b>
                <hr style="margin: 8px 0; border-color: #2d3561;">
                <p style="margin: 8px 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                    ${loc.description}
                </p>
                <small style="color: #60a5fa;">📍 ${loc.lat.toFixed(4)}°, ${loc.lon.toFixed(4)}°</small>
            </div>
        `;

        marker.bindPopup(popupContent);
        spaceOverlayMarkers.push(marker);
    });
}

// Remove space overlays from map
function removeSpaceOverlays() {
    spaceOverlayMarkers.forEach(marker => map.removeLayer(marker));
    spaceOverlayMarkers = [];
}

// Cycle through map styles
function toggleDarkMode() {
    const btn = document.getElementById('dark-mode-btn');

    // Remove current layer
    map.removeLayer(lightTileLayer);
    map.removeLayer(darkTileLayer);
    map.removeLayer(natgeoTileLayer);
    map.removeLayer(spaceTileLayer);

    // Remove space overlays if leaving space mode
    if (mapStyle === 'space') {
        removeSpaceOverlays();
    }

    // Cycle: dark -> light -> natgeo -> space -> dark
    if (mapStyle === 'dark') {
        mapStyle = 'light';
        lightTileLayer.addTo(map);
        btn.textContent = 'Light Mode';
    } else if (mapStyle === 'light') {
        mapStyle = 'natgeo';
        natgeoTileLayer.addTo(map);
        btn.textContent = 'NatGeo Mode';
    } else if (mapStyle === 'natgeo') {
        mapStyle = 'space';
        spaceTileLayer.addTo(map);
        addSpaceOverlays();
        btn.textContent = 'Space Mode';
    } else {
        mapStyle = 'dark';
        darkTileLayer.addTo(map);
        btn.textContent = 'Dark Mode';
    }
}

// Toggle GPS status panel
function toggleGPSPanel() {
    const panel = document.getElementById('gps-status');
    const btn = document.getElementById('gps-panel-btn');

    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        btn.textContent = 'Hide GPS Panel';
    } else {
        panel.style.display = 'none';
        btn.textContent = 'Show GPS Panel';
    }
}

// Toggle stats/overview panel
function toggleStatsPanel() {
    const panel = document.getElementById('stats');
    const btn = document.getElementById('stats-panel-btn');

    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        btn.textContent = 'Hide Overview';
    } else {
        panel.style.display = 'none';
        btn.textContent = 'Show Overview';
    }
}

// Update satellites
function updateSatellites() {
    const now = new Date();

    // Log every 10 updates to confirm it's working
    if (!window.updateCount) window.updateCount = 0;
    window.updateCount++;
    if (window.updateCount % 10 === 0) {
        console.log(`Update #${window.updateCount} at ${now.toLocaleTimeString()}`);
    }

    // Clear only trail lines (NOT circle markers)
    satelliteTrailLines.forEach(trail => map.removeLayer(trail));
    satelliteTrailLines = [];

    // Clear connection lines
    if (window.connectionLines) {
        window.connectionLines.forEach(line => map.removeLayer(line));
    }
    window.connectionLines = [];

    // Update each satellite
    let visibleCount = 0;
    let inViewCount = 0; // GPS module can see these
    const satListHTML = [];
    const connectedListHTML = [];

    satellites.forEach(sat => {
        const pos = getSatellitePosition(sat, now);

        if (!pos) return;

        const elevation = calculateElevation(pos, userLocation.lat, userLocation.lon);
        const isVisible = elevation > 0;
        const isConnected = connectedPRNs.includes(sat.prn);

        // Get GPS module data for this satellite
        const gpsInfo = gpsData[sat.prn] || {};
        const hasGPSData = Object.keys(gpsInfo).length > 0;
        const inView = hasGPSData; // GPS module can see this satellite

        if (isVisible) visibleCount++;
        if (inView) inViewCount++;

        // Determine color
        let color = '#94a3b8'; // Gray for not visible
        if (isVisible) color = '#60a5fa'; // Blue for visible
        if (inView) color = '#f59e0b'; // Orange for in GPS view
        if (isConnected) color = '#00ff41'; // Hacker green for connected

        // Update orbital trail - build continuously
        if (showTrails) {
            if (!satelliteTrails[sat.prn]) {
                satelliteTrails[sat.prn] = [];
            }

            // Add current position to trail
            const lastPos = satelliteTrails[sat.prn][satelliteTrails[sat.prn].length - 1];

            // Only add if position changed (avoid duplicates)
            if (!lastPos || lastPos[0] !== pos.latitude || lastPos[1] !== pos.longitude) {
                satelliteTrails[sat.prn].push([pos.latitude, pos.longitude]);
            }

            // Draw trail for connected satellites - full orbital path
            if (isConnected && satelliteTrails[sat.prn].length > 1) {
                const trail = L.polyline(satelliteTrails[sat.prn], {
                    color: '#00ff41',
                    weight: 3,
                    opacity: 0.6,
                    dashArray: '10, 5'
                }).addTo(map);
                satelliteTrailLines.push(trail);
            }

            // Draw faint trail for satellites in view
            else if (inView && satelliteTrails[sat.prn].length > 1) {
                const trail = L.polyline(satelliteTrails[sat.prn], {
                    color: '#f59e0b',
                    weight: 2,
                    opacity: 0.4,
                    dashArray: '5, 3'
                }).addTo(map);
                satelliteTrailLines.push(trail);
            }
        }

        // Build popup with GPS data and satellite info
        let popupHTML = `
            <div style="min-width: 280px;">
                <b style="font-size: 15px; color: #667eea;">${sat.name}</b><br>
                <small style="color: #8b92b8;">PRN ${sat.prn}</small>
                <hr style="margin: 8px 0; border-color: #2d3561;">

                <b style="color: #60a5fa;">📡 Satellite Information</b><br>
                <small>
                    <b>Type:</b> ${sat.info.design}<br>
                    <b>Launched:</b> ${sat.info.launchDate}<br>
                    <b>Manufacturer:</b> ${sat.info.manufacturer}<br>
                    <b>Operator:</b> ${sat.info.operator}<br>
                    <b>Mass:</b> ${sat.info.mass}<br>
                </small>
                <p style="margin: 8px 0; font-size: 11px; color: #94a3b8; line-height: 1.4;">
                    ${sat.info.description}
                </p>

                <hr style="margin: 8px 0; border-color: #2d3561;">
                <b style="color: #60a5fa;">🌍 Current Position</b><br>
                <small>
                    Lat: ${pos.latitude.toFixed(2)}° | Lon: ${pos.longitude.toFixed(2)}°<br>
                    Alt: ${pos.altitude.toFixed(0)} km<br>
                    Calc. Elevation: ${elevation.toFixed(1)}°
                </small>
        `;

        if (hasGPSData) {
            popupHTML += `
                <hr style="margin: 8px 0; border-color: #2d3561;">
                <b style="color: #f59e0b;">📶 GPS Module Data</b><br>
                <small>`;
            if (gpsInfo.elevation !== undefined) popupHTML += `Elevation: ${gpsInfo.elevation}°<br>`;
            if (gpsInfo.azimuth !== undefined) popupHTML += `Azimuth: ${gpsInfo.azimuth}°<br>`;
            if (gpsInfo.snr !== undefined) popupHTML += `SNR: ${gpsInfo.snr} dB<br>`;
            popupHTML += `</small>`;
        }

        if (isConnected) {
            popupHTML += `<br><b style="color: #00ff41; text-shadow: 0 0 10px #00ff41;">⚡ CONNECTED & LOCKED</b>`;
        }

        popupHTML += `</div>`;

        // Check if marker already exists
        let marker = satelliteCircleMarkers[sat.prn];

        if (marker) {
            // Update existing marker position and style
            marker.setLatLng([pos.latitude, pos.longitude]);
            marker.setStyle({
                radius: isConnected ? 10 : inView ? 6 : 4,
                fillColor: color,
                color: isConnected ? '#00ff41' : '#fff',
                weight: isConnected ? 2 : 1,
                fillOpacity: isConnected ? 1 : 0.9,
                className: isConnected ? 'connected-sat' : ''
            });
            // Update popup content
            marker.getPopup().setContent(popupHTML);

            // Update wrapped markers (for world wrap display)
            if (marker.wrappedMarkers) {
                marker.wrappedMarkers.forEach(wrappedMarker => {
                    const offset = wrappedMarker.lonOffset;
                    wrappedMarker.setLatLng([pos.latitude, pos.longitude + offset]);
                    wrappedMarker.setStyle({
                        radius: isConnected ? 10 : inView ? 6 : 4,
                        fillColor: color,
                        color: isConnected ? '#00ff41' : '#fff',
                        weight: isConnected ? 2 : 1,
                        fillOpacity: isConnected ? 1 : 0.9,
                        className: isConnected ? 'connected-sat' : ''
                    });
                    wrappedMarker.getPopup().setContent(popupHTML);
                });
            }
        } else {
            // Create new marker
            marker = L.circleMarker([pos.latitude, pos.longitude], {
                radius: isConnected ? 10 : inView ? 6 : 4,
                fillColor: color,
                color: isConnected ? '#00ff41' : '#fff',
                weight: isConnected ? 2 : 1,
                fillOpacity: isConnected ? 1 : 0.9,
                className: isConnected ? 'connected-sat' : ''
            }).addTo(map);

            marker.bindPopup(popupHTML);

            // Track popup open/close
            marker.on('popupopen', () => {
                openPopupPRN = sat.prn;
            });
            marker.on('popupclose', () => {
                if (openPopupPRN === sat.prn) {
                    openPopupPRN = null;
                }
            });

            // Store PRN on marker for identification
            marker.satPRN = sat.prn;

            // Create wrapped copies for world map wrap (±360° longitude)
            marker.wrappedMarkers = [];
            [-360, 360].forEach(offset => {
                const wrappedMarker = L.circleMarker([pos.latitude, pos.longitude + offset], {
                    radius: isConnected ? 10 : inView ? 6 : 4,
                    fillColor: color,
                    color: isConnected ? '#00ff41' : '#fff',
                    weight: isConnected ? 2 : 1,
                    fillOpacity: isConnected ? 1 : 0.9,
                    className: isConnected ? 'connected-sat' : ''
                }).addTo(map);

                wrappedMarker.bindPopup(popupHTML);
                wrappedMarker.lonOffset = offset;

                // Track popup open/close for wrapped markers
                wrappedMarker.on('popupopen', () => {
                    openPopupPRN = sat.prn;
                });
                wrappedMarker.on('popupclose', () => {
                    if (openPopupPRN === sat.prn) {
                        openPopupPRN = null;
                    }
                });

                marker.wrappedMarkers.push(wrappedMarker);
            });

            // Store reference
            satelliteCircleMarkers[sat.prn] = marker;
        }

        // Draw connection line for connected satellites
        if (isConnected) {
            const line = L.polyline([
                [userLocation.lat, userLocation.lon],
                [pos.latitude, pos.longitude]
            ], {
                color: '#00ff41',
                weight: 3,
                opacity: 0.8,
                dashArray: '5, 10',
                className: 'connection-line'
            }).addTo(map);

            window.connectionLines.push(line);
        }

        // Build SNR bar if available
        let snrBar = '';
        if (gpsInfo.snr !== undefined) {
            const snrPercent = Math.min((gpsInfo.snr / 50) * 100, 100);
            snrBar = `
                <div class="snr-bar">
                    <div class="snr-fill" style="width: ${snrPercent}%"></div>
                </div>
            `;
        }

        // Add to satellite list
        const satHTML = `
            <div class="sat-item ${isConnected ? 'connected' : ''} ${inView ? 'in-view' : ''}" onclick="focusSatellite(${sat.prn})">
                <span class="prn">PRN ${sat.prn}</span>
                ${hasGPSData && gpsInfo.snr ? ` <small style="color: #f59e0b;">${gpsInfo.snr}dB</small>` : ''}<br>
                <small>
                    ${hasGPSData && gpsInfo.elevation !== undefined ? `El: ${gpsInfo.elevation}° | Az: ${gpsInfo.azimuth}°` : `Calc El: ${elevation.toFixed(1)}°`}
                </small>
                ${snrBar}
                ${isConnected ? '<br><small style="color: #00ff41; text-shadow: 0 0 5px #00ff41;">⚡ LOCKED & USED</small>' : inView ? '<br><small style="color: #f59e0b;">IN VIEW</small>' : ''}
            </div>
        `;

        satListHTML.push(satHTML);

        if (isConnected) {
            connectedListHTML.push(satHTML);
        }
    });

    // Update stats
    document.getElementById('total-sats').textContent = satellites.length;
    document.getElementById('visible-sats').textContent = visibleCount;
    document.getElementById('connected-sats').textContent = connectedPRNs.length;

    // Update quick stats in menu bar
    document.getElementById('quick-total').textContent = satellites.length;
    document.getElementById('quick-visible').textContent = inViewCount;
    document.getElementById('quick-locked').textContent = connectedPRNs.length;

    // Update lists
    document.getElementById('sat-list').innerHTML = satListHTML.join('');
    document.getElementById('connected-list').innerHTML = connectedListHTML.length > 0
        ? connectedListHTML.join('')
        : '<div class="stat-item">No connections</div>';

    // Update satellite button bar
    updateSatelliteBar();
}

// Update satellite buttons in horizontal bar
function updateSatelliteBar() {
    const container = document.getElementById('sat-bar');
    const satButtons = [];

    satellites.forEach(sat => {
        const pos = getSatellitePosition(sat, new Date());
        if (!pos) return;

        const elevation = calculateElevation(pos, userLocation.lat, userLocation.lon);
        const isVisible = elevation > 0;
        const isConnected = connectedPRNs.includes(sat.prn);
        const gpsInfo = gpsData[sat.prn] || {};
        const hasGPSData = Object.keys(gpsInfo).length > 0;
        const inView = hasGPSData;

        // Determine button class and priority for sorting
        const classes = ['sat-btn'];
        let priority = 3; // Default: not visible (gray)

        if (isConnected) {
            classes.push('connected');
            priority = 0; // Highest priority: connected (green)
        } else if (inView) {
            classes.push('in-view');
            priority = 1; // Second priority: in GPS view (orange)
        } else if (isVisible) {
            classes.push('visible');
            priority = 2; // Third priority: visible (blue)
        }

        // Build button label
        let label = `PRN ${sat.prn}`;
        if (gpsInfo.snr) {
            label += ` ${gpsInfo.snr}dB`;
        }

        satButtons.push({
            priority: priority,
            prn: sat.prn,
            html: `
                <button class="${classes.join(' ')}" onclick="focusSatellite(${sat.prn})" title="${sat.name}">
                    ${label}
                </button>
            `
        });
    });

    // Sort by priority (0=connected, 1=in-view, 2=visible, 3=not visible)
    // Then by PRN number for consistency within each group
    satButtons.sort((a, b) => {
        if (a.priority !== b.priority) {
            return a.priority - b.priority;
        }
        return a.prn - b.prn;
    });

    container.innerHTML = satButtons.map(btn => btn.html).join('');
}

// Focus on satellite
function focusSatellite(prn) {
    const sat = satellites.find(s => s.prn === prn);
    if (!sat) return;

    const pos = getSatellitePosition(sat, new Date());
    if (!pos) return;

    // Zoom in closer to see satellite movement better
    map.setView([pos.latitude, pos.longitude], 6);
    console.log(`Focused on PRN ${prn} at position:`, pos.latitude.toFixed(4), pos.longitude.toFixed(4));
}

// Helper function to update user marker and wrapped copies
function updateUserMarkerPosition(lat, lon) {
    window.userMarker.setLatLng([lat, lon]);
    if (window.userMarker.wrappedMarkers) {
        window.userMarker.wrappedMarkers.forEach(wrappedMarker => {
            wrappedMarker.setLatLng([lat, lon + wrappedMarker.lonOffset]);
        });
    }
}

// Get user location
function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            userLocation.lat = position.coords.latitude;
            userLocation.lon = position.coords.longitude;

            document.getElementById('lat').value = userLocation.lat.toFixed(6);
            document.getElementById('lon').value = userLocation.lon.toFixed(6);

            // Center on location
            map.setView([userLocation.lat, userLocation.lon], 8);
            updateUserMarkerPosition(userLocation.lat, userLocation.lon);

            updateSatellites();
        });
    } else {
        alert('Geolocation is not supported by this browser.');
    }
}

// Toggle GPS input
function toggleGPSInput() {
    const input = document.getElementById('gps-input');
    input.style.display = input.style.display === 'none' ? 'block' : 'none';
}

// Parse GPS NMEA data
function parseGPSData() {
    const nmeaData = document.getElementById('nmea-data').value;
    const lines = nmeaData.split('\n');

    connectedPRNs = [];

    lines.forEach(line => {
        // Parse GPGSV sentences (GPS satellites in view)
        if (line.includes('$GPGSV') || line.includes('$GNGSA') || line.includes('$GPGSA')) {
            // Extract PRN numbers from GSA (satellites used) or GSV (satellites in view)
            const parts = line.split(',');

            if (line.includes('GSA')) {
                // GSA format: satellites being used
                for (let i = 3; i < 15; i++) {
                    const prn = parseInt(parts[i]);
                    if (prn && !connectedPRNs.includes(prn)) {
                        connectedPRNs.push(prn);
                    }
                }
            } else if (line.includes('GSV')) {
                // GSV format: satellites in view with SNR
                // For now, just mark satellites with good SNR as connected
                for (let i = 4; i < parts.length; i += 4) {
                    const prn = parseInt(parts[i]);
                    const snr = parseInt(parts[i + 3]);

                    if (prn && snr > 30 && !connectedPRNs.includes(prn)) {
                        connectedPRNs.push(prn);
                    }
                }
            }
        }
    });

    console.log('Connected PRNs:', connectedPRNs);
    updateSatellites();
    toggleGPSInput();
}

// Web Serial API - Connect to GPS Module
async function connectGPS() {
    if (!('serial' in navigator)) {
        alert('Web Serial API is not supported in this browser. Please use Chrome or Edge.');
        return;
    }

    try {
        if (isReading) {
            // Disconnect
            await disconnectGPS();
            return;
        }

        // Request a port with filters for common GPS modules
        // This helps show USB-Serial devices (CH340, FTDI, CP2102, etc.)
        const filters = [
            // Common USB-Serial chips used in GPS modules
            { usbVendorId: 0x1a86 }, // CH340
            { usbVendorId: 0x0403 }, // FTDI
            { usbVendorId: 0x10c4 }, // Silicon Labs CP210x
            { usbVendorId: 0x067b }, // Prolific
            { usbVendorId: 0x2341 }, // Arduino
            { usbVendorId: 0x1546 }  // u-blox
        ];

        port = await navigator.serial.requestPort({ filters });

        // Try different common baud rates
        const baudRates = [9600, 4800, 38400, 57600, 115200];
        let connected = false;

        for (const baudRate of baudRates) {
            try {
                await port.open({ baudRate: baudRate });
                console.log(`Opened port at ${baudRate} baud`);

                // Update UI
                updateGPSStatus(true, baudRate);

                // Start reading
                isReading = true;
                readGPSData();
                connected = true;
                break;
            } catch (e) {
                console.log(`Failed at ${baudRate} baud, trying next...`);
            }
        }

        if (!connected) {
            throw new Error('Could not open port at any baud rate');
        }

    } catch (error) {
        console.error('Error connecting to GPS:', error);

        if (error.name === 'NotFoundError') {
            alert('No GPS device selected.\n\nTips:\n- Look for COM ports (COM3, COM4, etc.)\n- Look for USB-Serial devices\n- Make sure your GPS module is plugged in\n- Try refreshing the page if you don\'t see your device');
        } else {
            alert('Failed to connect to GPS module: ' + error.message);
        }
    }
}

async function disconnectGPS() {
    try {
        isReading = false;

        if (reader) {
            await reader.cancel();
            await reader.releaseLock();
        }

        if (port) {
            await port.close();
        }

        updateGPSStatus(false, 0);
        gpsData = {};
        connectedPRNs = [];

        // Clear all persistent markers and recreate on next update
        Object.values(satelliteCircleMarkers).forEach(marker => map.removeLayer(marker));
        satelliteCircleMarkers = {};

        updateSatellites();

    } catch (error) {
        console.error('Error disconnecting GPS:', error);
    }
}

async function readGPSData() {
    try {
        const textDecoder = new TextDecoderStream();
        const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
        reader = textDecoder.readable.getReader();

        while (isReading) {
            const { value, done } = await reader.read();
            if (done) {
                break;
            }

            // Add to buffer
            nmeaBuffer += value;

            // Process complete lines
            const lines = nmeaBuffer.split('\n');
            nmeaBuffer = lines.pop(); // Keep incomplete line in buffer

            lines.forEach(line => {
                line = line.trim();
                if (line.startsWith('$')) {
                    processNMEA(line);
                    logNMEA(line);
                }
            });
        }

        reader.releaseLock();

    } catch (error) {
        console.error('Error reading GPS data:', error);
        if (isReading) {
            updateGPSStatus(false, 0);
            isReading = false;
        }
    }
}

function processNMEA(sentence) {
    if (sentence.includes('$GPGSV') || sentence.includes('$GLGSV') || sentence.includes('$GAGSV')) {
        // Parse GSV (satellites in view)
        parseGSV(sentence);
    } else if (sentence.includes('$GPGSA') || sentence.includes('$GNGSA')) {
        // Parse GSA (satellites used for fix)
        parseGSA(sentence);
    } else if (sentence.includes('$GPGGA') || sentence.includes('$GNGGA')) {
        // Parse GGA (fix data)
        parseGGA(sentence);
    } else if (sentence.includes('$GPRMC') || sentence.includes('$GNRMC')) {
        // Parse RMC (recommended minimum)
        parseRMC(sentence);
    }
}

function parseGSV(sentence) {
    // $GPGSV,3,1,11,03,03,111,00,04,15,270,00,06,01,010,00,13,06,292,00*74
    // Format: $GPGSV,numMsg,msgNum,totalSats,sat1PRN,sat1elev,sat1azim,sat1SNR,...
    const parts = sentence.split(',');

    if (parts.length < 8) return;

    const totalSats = parseInt(parts[3]);

    // Parse each satellite (4 satellites per GSV message)
    for (let i = 4; i < parts.length - 1; i += 4) {
        const prn = parseInt(parts[i]);
        const elevation = parseInt(parts[i + 1]);
        const azimuth = parseInt(parts[i + 2]);
        let snr = parseInt(parts[i + 3]);

        // Handle last field which might have checksum
        if (isNaN(snr) && parts[i + 3]) {
            snr = parseInt(parts[i + 3].split('*')[0]);
        }

        if (prn && !isNaN(prn)) {
            if (!gpsData[prn]) gpsData[prn] = {};

            gpsData[prn].elevation = elevation || 0;
            gpsData[prn].azimuth = azimuth || 0;
            gpsData[prn].snr = snr || 0;
            gpsData[prn].inView = true;
        }
    }

    updateSatellites();
}

function parseGSA(sentence) {
    // $GPGSA,A,3,04,05,09,,,,,,,,,,,1.8,1.0,1.5*33
    // Format: $GPGSA,mode,fixType,sat1,sat2,...,sat12,PDOP,HDOP,VDOP*checksum
    const parts = sentence.split(',');

    if (parts.length < 18) return;

    const fixType = parseInt(parts[2]);
    connectedPRNs = [];

    // Extract PRNs used in solution (positions 3-14)
    for (let i = 3; i < 15; i++) {
        const prn = parseInt(parts[i]);
        if (prn && !isNaN(prn)) {
            connectedPRNs.push(prn);

            if (!gpsData[prn]) gpsData[prn] = {};
            gpsData[prn].used = true;
        }
    }

    document.getElementById('gps-sats-used').textContent = connectedPRNs.length;
    document.getElementById('gps-fix').textContent = fixType === 3 ? '3D Fix' : fixType === 2 ? '2D Fix' : 'No Fix';

    updateSatellites();
}

function parseGGA(sentence) {
    // $GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47
    const parts = sentence.split(',');

    if (parts.length < 10) return;

    const quality = parseInt(parts[6]);
    const numSats = parseInt(parts[7]);

    // Extract location from GGA if available
    if (parts[2] && parts[4]) {
        const latDeg = parseFloat(parts[2].substring(0, 2));
        const latMin = parseFloat(parts[2].substring(2));
        let lat = latDeg + (latMin / 60);
        if (parts[3] === 'S') lat = -lat;

        const lonDeg = parseFloat(parts[4].substring(0, 3));
        const lonMin = parseFloat(parts[4].substring(3));
        let lon = lonDeg + (lonMin / 60);
        if (parts[5] === 'W') lon = -lon;

        // Update user location
        userLocation.lat = lat;
        userLocation.lon = lon;

        document.getElementById('lat').value = lat.toFixed(6);
        document.getElementById('lon').value = lon.toFixed(6);

        updateUserMarkerPosition(lat, lon);

        // Only auto-center on first fix, then let user control the view
        if (firstGPSFix) {
            map.setView([lat, lon], 8);
            firstGPSFix = false;
        }
    }
}

function parseRMC(sentence) {
    // $GPRMC,123519,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W*6A
    const parts = sentence.split(',');

    if (parts.length < 10) return;

    // RMC also contains position data
    if (parts[3] && parts[5]) {
        const latDeg = parseFloat(parts[3].substring(0, 2));
        const latMin = parseFloat(parts[3].substring(2));
        let lat = latDeg + (latMin / 60);
        if (parts[4] === 'S') lat = -lat;

        const lonDeg = parseFloat(parts[5].substring(0, 3));
        const lonMin = parseFloat(parts[5].substring(3));
        let lon = lonDeg + (lonMin / 60);
        if (parts[6] === 'W') lon = -lon;

        userLocation.lat = lat;
        userLocation.lon = lon;

        document.getElementById('lat').value = lat.toFixed(6);
        document.getElementById('lon').value = lon.toFixed(6);

        updateUserMarkerPosition(lat, lon);

        // Only auto-center on first fix
        if (firstGPSFix) {
            map.setView([lat, lon], 8);
            firstGPSFix = false;
        }
    }
}

function logNMEA(sentence) {
    const log = document.getElementById('nmea-log');
    const line = document.createElement('div');
    line.textContent = sentence.substring(0, 80); // Truncate long lines
    line.style.color = sentence.includes('GSV') ? '#60a5fa' :
                       sentence.includes('GSA') ? '#4ade80' :
                       sentence.includes('GGA') ? '#f59e0b' : '#8b92b8';

    log.appendChild(line);

    // Keep only last 20 lines
    while (log.children.length > 20) {
        log.removeChild(log.firstChild);
    }

    // Auto scroll to bottom
    log.scrollTop = log.scrollHeight;
}

function updateGPSStatus(connected, baudRate) {
    const statusEl = document.getElementById('gps-status');
    const statusText = document.getElementById('gps-status-text');
    const baudEl = document.getElementById('gps-baud');
    const ledEl = document.getElementById('status-led');
    const btnEl = document.getElementById('gps-connect-btn');

    if (connected) {
        statusEl.classList.remove('disconnected');
        statusEl.classList.add('connected');
        statusText.textContent = 'Connected';
        baudEl.textContent = baudRate;
        ledEl.classList.remove('inactive');
        ledEl.classList.add('active');
        btnEl.textContent = 'Disconnect GPS';
        btnEl.classList.add('btn-danger');
    } else {
        statusEl.classList.remove('connected');
        statusEl.classList.add('disconnected');
        statusText.textContent = 'Disconnected';
        baudEl.textContent = '-';
        ledEl.classList.remove('active');
        ledEl.classList.add('inactive');
        btnEl.textContent = 'Connect GPS Module';
        btnEl.classList.remove('btn-danger');
    }
}

// Toggle trails
function toggleTrails() {
    showTrails = !showTrails;
    document.getElementById('trails-btn').textContent = showTrails ? 'Hide Trails' : 'Show Trails';
    if (!showTrails) {
        updateSatellites(); // Redraw without trails
    }
}

// Clear all trails
function clearTrails() {
    satelliteTrails = {};
    satelliteTrailLines.forEach(trail => map.removeLayer(trail));
    satelliteTrailLines = [];
}

// Show GPS help
function showGPSHelp() {
    const helpText = `
GPS MODULE SETUP GUIDE

What you need:
- GPS module (NEO-6M, NEO-7M, u-blox, etc.)
- USB cable or USB-TTL adapter
- Clear view of the sky

Connection Steps:
1. Plug GPS module into USB port
2. Wait 10 seconds for Windows to install drivers
3. Click "Connect GPS Module" button
4. Look for: COM3, COM4, USB-Serial Device, or CH340
5. Select your device and click "Connect"

Troubleshooting:
- Don't see your device? Refresh the page
- Still not showing? Check Device Manager for COM ports
- GPS takes 30-60 seconds to get first fix (cold start)
- GPS needs clear view of sky - won't work indoors

Supported Modules:
✓ u-blox NEO-6M, NEO-7M, NEO-8M, NEO-M9N
✓ Adafruit Ultimate GPS
✓ GlobalSat BU-353
✓ Generic NMEA GPS modules with USB

The app will auto-detect baud rate (9600, 4800, 38400, 57600, 115200)
    `;

    alert(helpText);
}

// Update location from inputs
document.getElementById('lat').addEventListener('change', (e) => {
    userLocation.lat = parseFloat(e.target.value);
    updateUserMarkerPosition(userLocation.lat, userLocation.lon);
    updateSatellites();
});

document.getElementById('lon').addEventListener('change', (e) => {
    userLocation.lon = parseFloat(e.target.value);
    updateUserMarkerPosition(userLocation.lat, userLocation.lon);
    updateSatellites();
});

// Initialize
function init() {
    satellites = parseTLE(TLE_DATA);
    console.log(`Loaded ${satellites.length} GPS satellites`);

    initMap();

    updateSatellites();

    // Update every 1 second for smooth real-time movement
    updateInterval = setInterval(updateSatellites, 1000);
}

// Start when page loads
window.addEventListener('load', init);
