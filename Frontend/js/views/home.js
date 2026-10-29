// ============================================================================
// FlightFix MRO — Home View: High-Performance Lag-Free Video + 3D Cutaway
// Hardware-Accelerated Video, Viewport-Aware Canvas Engine &
// Photorealistic 3D Globe with Environmental Features (Auroras, Sun Glint,
// Twilight Terminator Ring, Night City Lights, Elevated 3D Arcs & Jetliners)
// ============================================================================

const D2R = Math.PI / 180;
let homeMode = 'aircraft';
let homeAnimId = null;
let isCanvasVisible = false; // Viewport throttle flag to prevent video lag

const VideoStore = {
  dbName: 'FlightFixMediaDB',
  storeName: 'media',

  openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async saveDefaultVideo(fileOrBlob) {
    try {
      const db = await this.openDB();
      const tx = db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).put(fileOrBlob, 'default_flight_video');
      return true;
    } catch (e) {
      return false;
    }
  },

  async getSavedVideo() {
    try {
      const db = await this.openDB();
      return new Promise((resolve) => {
        const tx = db.transaction(this.storeName, 'readonly');
        const req = tx.objectStore(this.storeName).get('default_flight_video');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      return null;
    }
  }
};

function getMroState() {
  return window.S || { ac: [], parts: [], wo: [], po: [], routes: [] };
}

// 3D Aircraft Camera State (Preserved 100%)
const acCam = {
  yaw: 0.65,
  pitch: 0.32,
  zoom: 0.95,
  panX: 0,
  panY: -10,
  targetYaw: 0.65,
  targetPitch: 0.32,
  targetZoom: 0.95,
  targetPanX: 0,
  targetPanY: -10,
  isDragging: false,
  lastMouseX: 0,
  lastMouseY: 0,
  autoSpin: true,
  explode: 0.0,
  targetExplode: 0.0,
  showLabels: true,
  filter: 'all',
  hoveredPart: null,
  selectedPart: null,
  spinBlade: 0,
  radarSweep: 0
};

// 3D Globe State with Environmental Telemetry
const globeState = {
  lon: -55,
  lat: 10,
  tlon: -55,
  tlat: 10,
  zoom: 1.0,
  t: 0,
  idle: 0,
  isDragging: false,
  dragM: 0,
  lastMouseX: 0,
  lastMouseY: 0,
  autoSpin: true,
  satelliteAngle: 0,
  stars: [],
  arcs: {},
  cx: window.innerWidth / 2,
  cy: window.innerHeight / 2,
  R: 300
};

// Global Airport Dictionary
const AP = {
  JFK: [40.6, -73.8, "New York"], MIA: [25.8, -80.3, "Miami"], LAX: [33.9, -118.4, "Los Angeles"],
  ORD: [41.9, -87.9, "Chicago"], MEX: [19.4, -99.1, "Mexico City"], BOG: [4.7, -74.1, "Bogotá"],
  LIM: [-12.0, -77.1, "Lima"], GRU: [-23.4, -46.5, "São Paulo"], GIG: [-22.8, -43.2, "Rio de Janeiro"],
  EZE: [-34.8, -58.5, "Buenos Aires"], SCL: [-33.4, -70.8, "Santiago"], LHR: [51.5, -0.5, "London"],
  CDG: [49.0, 2.5, "Paris"], DXB: [25.3, 55.4, "Dubai"], DEL: [28.6, 77.2, "Delhi"],
  BOM: [19.1, 72.9, "Mumbai"], SIN: [1.4, 103.9, "Singapore"], HND: [35.5, 139.8, "Tokyo"],
  SYD: [-33.9, 151.2, "Sydney"], JNB: [-26.1, 28.2, "Johannesburg"], FRA: [50.0, 8.6, "Frankfurt"],
  AMS: [52.3, 4.8, "Amsterdam"], MAD: [40.5, -3.6, "Madrid"], FCO: [41.8, 12.2, "Rome"]
};

const AIRPORTS = Object.keys(AP).map(k => ({
  code: k,
  name: `${AP[k][2]} (${k})`,
  lat: AP[k][0],
  lon: AP[k][1]
}));

// Procedural Continental Polygons
const LAND = [
  [[-168,66],[-155,71],[-125,70],[-95,72],[-80,70],[-62,58],[-55,50],[-66,44],[-76,36],[-81,30],[-80,25],[-88,30],[-97,27],[-97,20],[-88,21],[-83,10],[-77,8],[-86,12],[-95,16],[-105,20],[-112,30],[-118,34],[-124,42],[-125,49],[-135,58],[-150,60],[-165,60]],
  [[-83,9],[-77,8],[-79,9],[-82,10],[-85,13],[-88,16],[-90,15],[-88,14]],
  [[-78,8],[-72,11],[-62,10],[-50,0],[-35,-6],[-39,-16],[-44,-23],[-48,-26],[-52,-32],[-58,-38],[-66,-46],[-72,-52],[-75,-48],[-74,-42],[-71,-30],[-70,-18],[-76,-14],[-81,-5],[-80,2]],
  [[-10,36],[-9,43],[-2,48],[5,52],[12,55],[22,58],[30,70],[60,70],[100,77],[140,72],[170,68],[160,58],[142,50],[130,42],[122,38],[122,30],[118,22],[108,20],[106,10],[100,3],[104,1],[98,8],[92,20],[88,22],[80,14],[78,8],[72,20],[66,25],[57,25],[51,27],[56,17],[45,13],[40,20],[35,30],[30,36],[26,40],[20,40],[14,42],[8,44],[3,42],[-6,36]],
  [[-17,21],[-10,35],[10,37],[32,31],[43,12],[51,12],[40,-3],[40,-16],[33,-28],[20,-35],[14,-22],[12,-5],[9,4],[-8,5],[-17,14]],
  [[114,-22],[122,-18],[136,-12],[142,-11],[146,-19],[153,-27],[150,-37],[140,-38],[130,-32],[115,-34]]
];

// Dense City Lights Matrix (Europe, Americas, Asia)
const CITY_LIGHTS = [
  [51.5,-0.1],[52.5,1.9],[53.4,-2.2],[52.4,-1.8],[55.8,-4.2],[48.8,2.3],[50.8,4.3],[52.3,4.9],[51.2,3.2],
  [52.5,13.4],[50.1,8.6],[48.1,11.5],[53.5,9.9],[51.4,6.9],[41.9,12.5],[45.4,9.1],[40.8,14.2],[43.7,11.2],
  [40.4,-3.7],[41.3,2.1],[37.3,-5.9],[38.7,-9.1],[47.3,8.5],[48.2,16.3],[50.0,14.4],[52.2,21.0],[37.9,23.7],
  [40.7,-74.0],[42.3,-71.0],[39.9,-75.1],[38.9,-77.0],[33.7,-84.3],[25.7,-80.2],[41.8,-87.6],[42.3,-83.0],
  [34.0,-118.2],[37.7,-122.4],[47.6,-122.3],[29.7,-95.3],[32.7,-96.8],[43.6,-79.3],[45.5,-73.5],
  [-23.5,-46.6],[-22.9,-43.1],[-34.6,-58.3],[-33.4,-70.6],[-12.0,-77.0],[4.7,-74.0],[19.4,-99.1],
  [25.2,55.3],[24.4,54.3],[24.7,46.7],[30.0,31.2],[28.6,77.2],[19.0,72.8],[12.9,77.5],[1.3,103.8],[13.7,100.5],
  [22.3,114.1],[31.2,121.4],[39.9,116.4],[23.1,113.2],[35.6,139.6],[34.6,135.5],[37.5,126.9],[-33.8,151.2],[-37.8,144.9]
];

// 21 Detailed Aircraft Subsystems (Preserved 100%)
const AIRCRAFT_PARTS = [
  { id: 'radar', ata: 'ATA 34-41', category: 'avionics', title: 'Multiscan Weather Radar', shortName: 'Weather Radar', pos: [310, -5, 0], explodeDir: [1.2, 0, 0], leadOffset: [-70, -70], desc: 'Planar phased array radar scanner antenna with auto-tilt and predictive windshear detection.', specs: { 'Band': 'X-Band (9.33 GHz)', 'Scan': '±90° Azimuth', 'Range': '320 NM' }, health: '99.4% Nominal', telemetry: { 'RF Power': '150W Solid State', 'Tilt': '+1.4°', 'RPM': '32 RPM' } },
  { id: 'cockpit', ata: 'ATA 31-60', category: 'avionics', title: 'Integrated Glass Flight Deck', shortName: 'Flight Deck (PFD/ND)', pos: [255, -22, 0], explodeDir: [0.6, -0.6, 0], leadOffset: [-80, -90], desc: 'Dual pilot stations with 6 active-matrix LCD screens, dual yokes, throttle pedestal, and MCP.', specs: { 'Displays': '6x 10.4" AMLCD', 'FMS': 'Dual Collins FMS-4200', 'Cert': 'CAT IIIb Autoland' }, health: '98.8% Operational', telemetry: { 'Bus Voltage': '28.4 VDC', 'Nav Sync': 'Active / GPS L1', 'Cabin Alt': '6,100 ft' } },
  { id: 'nose_gear', ata: 'ATA 32-20', category: 'airframe', title: 'Nose Landing Gear & Steerable Wheels', shortName: 'Nose Landing Gear', pos: [240, 58, 0], explodeDir: [0.2, 1.2, 0], leadOffset: [-70, 75], desc: 'Forward-retracting oleo-pneumatic shock strut with dual steerable wheels and taxi floodlights.', specs: { 'Strut': 'Nitrogen/Oil Shock', 'Tires': 'Dual 32x8.8 Radial', 'Steer': '±65° Authority' }, health: '97.2% Good', telemetry: { 'Extension': '14.2 cm', 'Tire Pressure': '185 PSI' } },
  { id: 'fwd_door', ata: 'ATA 52-10', category: 'cabin', title: 'Forward Passenger Entry Door (L1)', shortName: 'Forward Entry Door (L1)', pos: [210, -22, 38], explodeDir: [0.1, -0.2, 1.0], leadOffset: [-60, -75], desc: 'Plug-type outward-translating entry door with integrated pneumatic emergency evacuation slide.', specs: { 'Opening': '76" x 36"', 'Slide Deploy': '4.8 Seconds' }, health: '100% Armed', telemetry: { 'Slide Bottle': '3,100 PSI', 'Flight Lock': 'Engaged' } },
  { id: 'first_class', ata: 'ATA 25-20', category: 'cabin', title: 'First / Business Class Suites', shortName: 'First / Business Cabin', pos: [150, -12, 0], explodeDir: [0, -0.4, 0], leadOffset: [-50, -95], desc: 'Staggered lie-flat luxury passenger suites with 18" 4K touch IFE and escape path lighting.', specs: { 'Pitch': '62" (Lie-Flat 78")', 'Shell': 'Carbon Composite' }, health: '100% Operational', telemetry: { 'Cabin Temp': '21.5°C', 'IFE Server': 'Online / 1.2 Gbps' } },
  { id: 'overhead_bins', ata: 'ATA 25-15', category: 'cabin', title: 'Overhead Luggage Stowage Bins', shortName: 'Overhead Storage Bins', pos: [90, -38, 0], explodeDir: [0, -1.2, 0], leadOffset: [-30, -85], desc: 'Pivot-drop lightweight composite stowage compartments with integrated air gaspers.', specs: { 'Volume': '3.4 cu ft/bin', 'Weight Limit': '45 kg' }, health: 'Normal', telemetry: { 'Latches': 'Locked', 'Gasper Flow': '42 CFM' } },
  { id: 'cargo_hold', ata: 'ATA 25-50', category: 'airframe', title: 'Underfloor Baggage & Cargo Hold', shortName: 'Underfloor Cargo (LD-3)', pos: [80, 26, 0], explodeDir: [0, 1.2, 0], leadOffset: [-50, 85], desc: 'Pressurized underfloor cargo compartment with roller ball plates and LD-3 container locks.', specs: { 'Capacity': '14x LD-3 Bins', 'Fire Suppression': 'Halon 1301 Dual Bottle' }, health: 'Fire Loops Active', telemetry: { 'Hold Temp': '14.0°C', 'Smoke Optical': 'Clear' } },
  { id: 'turbofan_l', ata: 'ATA 72-00', category: 'engines', title: 'High-Bypass Turbofan Jet Engine', shortName: 'Turbofan Engine (CFM/GE)', pos: [35, 24, 150], explodeDir: [0.6, 0, 1.2], leadOffset: [75, 75], desc: 'Twin-spool axial-flow turbofan engine with spinning titanium wide-chord fan blades and FADEC.', specs: { 'Thrust': '72,000 lbf', 'Bypass': '10.5:1', 'Fan Dia': '112 Inches' }, health: '98.2% High Performance', telemetry: { 'N1 Fan': '88.4% (Spinning)', 'N2 Core': '94.2%', 'EGT': '642°C', 'Vibration': '0.14 in/s' } },
  { id: 'wing_fuel', ata: 'ATA 28-10', category: 'airframe', title: 'Internal Wing Fuel Tanks & Spars', shortName: 'Internal Fuel Tanks', pos: [0, 0, 110], explodeDir: [0, 0, 0.4], leadOffset: [65, -80], desc: 'Integral wet-wing fuel cells sealed between primary titanium spars with submerged AC boost pumps.', specs: { 'Capacity': '48,500 L Jet-A1', 'Inerting': 'Nitrogen Generating' }, health: 'Fuel Balance 100%', telemetry: { 'Fuel Qty': '14,200 kg', 'Fuel Temp': '-12°C' } },
  { id: 'slats', ata: 'ATA 27-80', category: 'controls', title: 'Leading-Edge Aerodynamic Slats', shortName: 'Leading-Edge Slats', pos: [25, -6, 175], explodeDir: [0.8, -0.4, 0.8], leadOffset: [80, -75], desc: 'Movable aerodynamic slat surfaces on the wing leading edge, driven by rotary torque shafts.', specs: { 'Positions': 'Retracted, 15°, 25°', 'Anti-Ice': 'Engine Bleed Thermal' }, health: '3,000 PSI Synced', telemetry: { 'Position': '0° (Clean)', 'Hydraulics': 'Sys B Normal' } },
  { id: 'main_gear_l', ata: 'ATA 32-10', category: 'airframe', title: 'Main Landing Gear Bogie & Brakes', shortName: 'Main Landing Gear & Brakes', pos: [-20, 62, 55], explodeDir: [0, 1.2, 0.6], leadOffset: [-80, 85], desc: 'Four-wheel truck bogie with carbon-carbon multi-disc brake packs and anti-skid modulation.', specs: { 'Tires': '4x H49x19.0-22', 'Brakes': 'Carbon-Carbon Discs' }, health: 'Brake Wear 38% Left', telemetry: { 'Brake Temp #1': '145°C', 'Tire Pressure': '205 PSI' } },
  { id: 'spoilers', ata: 'ATA 27-60', category: 'controls', title: 'Flight Spoilers & Speedbrakes', shortName: 'Flight Spoilers', pos: [-40, -10, 130], explodeDir: [-0.4, -0.8, 0.4], leadOffset: [70, -70], desc: 'Hydraulically actuated upper wing spoiler panels for roll trim and ground lift-dumping.', specs: { 'Panels': '6 Panels/Wing', 'Deflection': '55° on Touchdown' }, health: 'FBW Dual OK', telemetry: { 'Deflection': '0° (Stowed)', 'Pressure': '3,020 PSI' } },
  { id: 'economy_cabin', ata: 'ATA 25-20', category: 'cabin', title: 'Economy Passenger Cabin & IFE', shortName: 'Economy Cabin & IFE', pos: [-50, -14, 0], explodeDir: [0, -0.4, 0], leadOffset: [-50, -90], desc: 'High-density seating with ergonomic slimline frames and individual 11" touchscreen displays.', specs: { 'Pitch': '32 Inches', 'Layout': '3-3-3 Config' }, health: '100% Seats Inspected', telemetry: { 'Cabin Alt': '6,100 ft', 'Pax': '248 Pax' } },
  { id: 'overwing_exit', ata: 'ATA 52-20', category: 'cabin', title: 'Over-Wing Emergency Escape Hatch', shortName: 'Emergency Escape Hatch', pos: [-30, -22, 38], explodeDir: [0, -0.4, 1.0], leadOffset: [55, -85], desc: 'Automatic outward-opening emergency exit doors with pneumatic off-wing slide ramp deployment.', specs: { 'Opening': '40" x 20"', 'Deploy': '3.5s Off-Wing' }, health: 'Armed & Monitored', telemetry: { 'Bottle Pressure': '2,950 PSI' } },
  { id: 'flaps', ata: 'ATA 27-50', category: 'controls', title: 'Double-Slotted Trailing-Edge Flaps', shortName: 'Double-Slotted Flaps', pos: [-65, 2, 140], explodeDir: [-1.0, 0.4, 0.4], leadOffset: [80, 80], desc: 'High-lift trailing-edge double-slotted Fowler flaps guided along aerodynamic track fairings.', specs: { 'Settings': 'Flaps 1, 5, 15, 20, 25, 30', 'Drive': 'Ball Screws' }, health: 'Asymmetry Monitor OK', telemetry: { 'Flap Angle': '0.0° (Up)' } },
  { id: 'aileron', ata: 'ATA 27-10', category: 'controls', title: 'Wingtip Aileron & Blended Sharklet', shortName: 'Wingtip Aileron & Sharklet', pos: [-70, -10, 240], explodeDir: [-0.6, -0.2, 1.2], leadOffset: [75, -50], desc: 'High-speed roll control aileron with 2.4m carbon composite aerodynamic sharklet wingtip.', specs: { 'Deflection': '±25°', 'Winglet Height': '2.4 m' }, health: 'Actuator Synced', telemetry: { 'Aileron Angle': '+0.2° (Trim)' } },
  { id: 'aft_galley', ata: 'ATA 25-30', category: 'cabin', title: 'Aft Service Galley & Lavatories', shortName: 'Aft Galley & Lavatory', pos: [-160, -12, 0], explodeDir: [-0.3, -0.4, 0], leadOffset: [-65, -85], desc: 'Stainless steel and composite rear service galley with convection ovens and vacuum lavatories.', specs: { 'Water Tank': '450 L Pressurized', 'Ovens': '4x Convection' }, health: 'Potable Water 88%', telemetry: { 'Water Pump': '35 PSI' } },
  { id: 'bulkhead', ata: 'ATA 53-10', category: 'airframe', title: 'Aft Hemispherical Pressure Bulkhead', shortName: 'Pressure Bulkhead Dome', pos: [-200, -8, 0], explodeDir: [-0.5, 0, 0], leadOffset: [-75, -80], desc: 'Carbon composite hemispherical dome separating the pressurized cabin from unpressurized tailcone.', specs: { 'Diameter': '3.8m', 'Material': 'Carbon Polymer' }, health: 'NDT Ultrasonic Clear', telemetry: { 'Delta P': '8.15 PSI' } },
  { id: 'vert_fin', ata: 'ATA 55-10', category: 'tail', title: 'Vertical Stabilizer & Articulated Rudder', shortName: 'Vertical Fin & Rudder', pos: [-240, -85, 0], explodeDir: [-0.8, -1.2, 0], leadOffset: [-80, -75], desc: 'Swept vertical stabilizer fin with leading-edge deice boot and two-segment articulated rudder.', specs: { 'Fin Height': '6.8m', 'Sweep': '38°' }, health: 'Yaw Damper Active', telemetry: { 'Rudder Angle': '0.0°' } },
  { id: 'horiz_stab', ata: 'ATA 55-20', category: 'tail', title: 'Trimmable Horizontal Stabilizer (THS)', shortName: 'Horizontal Tail & Elevators', pos: [-260, -15, 60], explodeDir: [-0.8, 0, 1.0], leadOffset: [80, 75], desc: 'All-moving variable-incidence horizontal tailplane driven by a central mechanical ballscrew.', specs: { 'Span': '14.2m', 'THS Range': '+4° to -14°' }, health: 'Ballscrew Lubricated', telemetry: { 'THS Trim': '-2.2° UP' } },
  { id: 'apu', ata: 'ATA 49-10', category: 'engines', title: 'Auxiliary Power Unit (APU) & Exhaust', shortName: 'APU Turbine & Exhaust', pos: [-300, -5, 0], explodeDir: [-1.2, 0, 0], leadOffset: [80, -60], desc: 'Gas turbine engine housed in the tailcone providing 90 kVA electrical power and 45 PSI bleed air.', specs: { 'Model': 'Honeywell 131-9A', 'Speed': '48,800 RPM' }, health: '99.1% Standby', telemetry: { 'APU EGT': '415°C' } }
];

const CAMERA_PRESETS = {
  cutaway: { yaw: 0.65, pitch: 0.32, zoom: 0.95, panX: 0, panY: -10, explode: 0.05, label: 'Full Cutaway' },
  cockpit: { yaw: 0.95, pitch: 0.22, zoom: 1.65, panX: -160, panY: 20, explode: 0.15, label: 'Flight Deck' },
  cabin:   { yaw: 0.45, pitch: 0.42, zoom: 1.40, panX: -40, panY: 15, explode: 0.25, label: 'Cabin & Cargo' },
  engine:  { yaw: 1.20, pitch: 0.22, zoom: 1.85, panX: -80, panY: -30, explode: 0.40, label: 'Turbofan' },
  wings:   { yaw: 0.35, pitch: 0.65, zoom: 1.30, panX: -40, panY: -10, explode: 0.30, label: 'Wing & Controls' },
  tail:    { yaw: -0.85, pitch: 0.28, zoom: 1.45, panX: 180, panY: 20, explode: 0.35, label: 'Tail & APU' }
};

// ============================================================================
// MAIN HOME ROUTE RENDERER
// ============================================================================
function renderHome() {
  const c = document.getElementById('view-home') || document.getElementById('home');
  if (!c) return;

  const state = getMroState();
  const totalAircraft = (state.ac || []).length;
  const inService = (state.ac || []).filter(a => a.status === 'in_service').length;
  const inMaint = (state.ac || []).filter(a => a.status === 'in_maintenance').length;
  const openWOs = (state.wo || []).filter(w => w.status !== 'closed').length;
  const activeRoutes = (state.routes || []).filter(r => r.active).length;

  c.innerHTML = `
    <div style="width:100%; min-height:100%; background:#060b13; color:#f8fafc; overflow-x:hidden;">
      
      <!-- SECTION 1: HARDWARE-ACCELERATED FLIGHT VIDEO HERO HEADER -->
      <section style="position:relative; width:100%; height:94vh; min-height:620px; display:flex; flex-direction:column; justify-content:space-between; overflow:hidden; background:#020612;">
        
        <!-- Native Hardware Video (No Heavy CSS Filters = Zero Lag) -->
        <video id="flightHeroVideo" autoplay loop playsinline preload="auto" style="position:absolute; top:50%; left:50%; width:100%; height:100%; object-fit:cover; transform:translate(-50%, -50%) translateZ(0); will-change:transform; z-index:1;">
          <source src="assets/flight-hero.mp4" type="video/mp4">
          <source src="flight-hero.mp4" type="video/mp4">
          <source src="/assets/flight-hero.mp4" type="video/mp4">
          <source src="/flight-hero.mp4" type="video/mp4">
        </video>

        <!-- Lightweight Dark Gradient Overlay -->
        <div style="position:absolute; top:0; left:0; width:100%; height:100%; background:linear-gradient(180deg, rgba(6,12,24,0.7) 0%, rgba(6,12,24,0.3) 50%, rgba(6,12,24,0.95) 100%); z-index:2; pointer-events:none;"></div>

        <!-- Top Header Bar (Clean Text, No Emojis) -->
        <div style="position:relative; z-index:10; display:flex; justify-content:space-between; align-items:center; padding:20px 32px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <span style="font-size:16px; font-weight:800; letter-spacing:1.5px; color:#ffffff; text-shadow:0 0 18px rgba(56,189,248,0.7);">FLIGHTFIX // AEROSPEC</span>
            <span style="font-size:10px; padding:3px 8px; background:rgba(56,189,248,0.15); border:1px solid rgba(56,189,248,0.3); border-radius:12px; color:#38bdf8; font-weight:700;">FLIGHT RADAR ACTIVE</span>
          </div>

          <div style="display:flex; align-items:center; gap:12px;">
            
            <div id="userNavBadge"></div>
          </div>
        </div>

        <!-- Center Typography -->
        <div style="position:relative; z-index:10; max-width:980px; margin:0 auto; padding:0 32px; text-align:center;">
          

          <h1 style="margin:0 0 16px 0; font-size:68px; font-weight:900; letter-spacing:-0.5px; color:#ffffff; line-height:1.15; text-shadow:2px 4px 30px rgba(0,0,0,0.85);">
            FlightFIX<br/>
            <div style="display:inline-flex; align-items:center; gap:8px; padding:6px 18px; background:rgba(14,165,233,0.15); border:1px solid rgba(56,189,248,0.35); border-radius:30px; margin-bottom:18px;">
            <span style="font-size:11px; font-weight:700; color:#38bdf8; letter-spacing:1px; text-transform:uppercase;">COMMERCIAL AVIATION AIRWORTHINESS & TELEMETRY</span>
          </div>
            <span style="background:linear-gradient(135deg, #38bdf8 0%, #818cf8 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent;"></span>
          </h1>

           <br>
           <br>
           <br>
           <br>
           <br>
           <br>
           <br>
           <br>
           <br>
           <br>
           <br>
           <br>
          <div style="display:flex; justify-content:center; align-items:center; gap:16px; flex-wrap:wrap; margin-bottom:34px;">
            <button onclick="scrollToModel()" style="padding:13px 30px; font-size:13px; font-weight:800; background:linear-gradient(135deg, #0284c7, #38bdf8); color:#fff; border:none; border-radius:30px; cursor:pointer; box-shadow:0 0 24px rgba(56,189,248,0.5);">
              Inspect 3D Cutaway Airframe
            </button>
            <button onclick="scrollToGlobe()" style="padding:13px 30px; font-size:13px; font-weight:800; background:rgba(15,23,42,0.8); border:1px solid rgba(56,189,248,0.4); color:#f8fafc; border-radius:30px; cursor:pointer;">
              Orbital Flight Network
            </button>
          </div>

          <div style="display:inline-flex; flex-wrap:wrap; justify-content:center; gap:18px; background:rgba(199, 206, 219, 0.7); padding:10px 26px; border-radius:14px; border:1px solid rgba(255,255,255,0.08); opacity:0.4">
            <div style="font-size:12px; color:white;">Fleet Readiness: <strong style="color:white; opacity:1;">99.4%</strong></div>
            <div style="font-size:12px; color:white;">Commercial Fleet: <strong style="color:white;opacity:1;">${totalAircraft} (${inService} In Service)</strong></div>
            <div style="font-size:12px; color:white;">Active MRO Orders: <strong style="color:white; opacity:1;">${openWOs}</strong></div>
            <div style="font-size:12px; color:white;">Avionics Clearance: <strong style="color:white; opacity:1;">CAT IIIb Verified</strong></div>
          </div>
        </div>
<br>
<br>
        <div onclick="scrollToModel()" style="position:relative; z-index:10; padding-bottom:18px; text-align:center; cursor:pointer;">
          <span style="font-size:11px; text-transform:uppercase; letter-spacing:2px; color:#38bdf8; font-weight:700; display:block; margin-bottom:4px;">SCROLL DOWN TO INSPECT 3D AIRFRAME & ORBITAL NETWORK</span>
          <div style="display:inline-block; animation:bounceDown 2s infinite; font-size:16px; color:#38bdf8;">↓</div>
        </div>
      </section>

      <!-- SECTION 2: 3D AIRCRAFT CUTAWAY & GLOBE (POSITIONED DIRECTLY BELOW VIDEO) -->
      <section id="mroModelSection" style="position:relative; width:100%; min-height:860px; height:90vh; background:radial-gradient(ellipse at 50% 30%, #0d1726 0%, #060b13 70%, #020408 100%); display:flex; flex-direction:column; border-top:1px solid rgba(56,189,248,0.25);">
        
        <div class="home-top-bar" style="z-index:20; display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; padding:12px 24px; background:rgba(6,12,22,0.85); backdrop-filter:blur(16px); border-bottom:1px solid rgba(56,189,248,0.2);">
          <div style="display:flex; align-items:center; gap:16px;">
            <div style="display:inline-flex; background:rgba(15,23,42,0.8); border:1px solid rgba(56,189,248,0.3); border-radius:30px; padding:3px;">
              <button id="btnModeAircraft" class="hud-tab-btn ${homeMode === 'aircraft' ? 'active' : ''}" style="padding:6px 16px; border:none; border-radius:24px; font-size:12px; font-weight:600; cursor:pointer; background:${homeMode === 'aircraft' ? 'linear-gradient(135deg, #0284c7, #38bdf8)' : 'transparent'}; color:${homeMode === 'aircraft' ? '#fff' : '#94a3b8'};">
                3D Aircraft Cutaway
              </button>
              <button id="btnModeGlobe" class="hud-tab-btn ${homeMode === 'globe' ? 'active' : ''}" style="padding:6px 16px; border:none; border-radius:24px; font-size:12px; font-weight:600; cursor:pointer; background:${homeMode === 'globe' ? 'linear-gradient(135deg, #0284c7, #38bdf8)' : 'transparent'}; color:${homeMode === 'globe' ? '#fff' : '#94a3b8'};">
                Orbital Flight Network
              </button>
            </div>
          </div>

          <div style="display:flex; gap:16px; font-size:12px; color:#94a3b8;">
            <div style="padding:4px 12px; background:rgba(30,41,59,0.5); border-radius:8px; border:1px solid rgba(255,255,255,0.06);">
              Fleet: <strong style="color:#38bdf8;">${totalAircraft}</strong> (${inService} Active / <span style="color:#f59e0b;">${inMaint} MRO</span>)
            </div>
            <div style="padding:4px 12px; background:rgba(30,41,59,0.5); border-radius:8px; border:1px solid rgba(255,255,255,0.06);">
              Active Routes: <strong style="color:#10b981;">${activeRoutes}</strong>
            </div>
          </div>
        </div>

        ${homeMode === 'aircraft' ? `
          <div class="aircraft-hud-toolbar" style="z-index:20; display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; padding:8px 24px; background:rgba(10,18,32,0.7); backdrop-filter:blur(10px); border-bottom:1px solid rgba(56,189,248,0.12); gap:10px;">
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <span style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:700; margin-right:4px;">Angles:</span>
              ${Object.keys(CAMERA_PRESETS).map(key => `
                <button class="cam-preset-btn" data-preset="${key}" style="padding:4px 10px; font-size:11px; border-radius:14px; border:1px solid rgba(56,189,248,0.25); background:rgba(15,23,42,0.6); color:#cbd5e1; cursor:pointer;">
                  ${CAMERA_PRESETS[key].label}
                </button>
              `).join('')}
            </div>

            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <span style="font-size:11px; text-transform:uppercase; color:#64748b; font-weight:700; margin-right:4px;">Filters:</span>
              ${['all', 'avionics', 'cabin', 'airframe', 'engines', 'controls', 'tail'].map(f => `
                <button class="filter-pill-btn ${acCam.filter === f ? 'active' : ''}" data-filter="${f}" style="padding:3px 10px; font-size:11px; border-radius:12px; border:1px solid ${acCam.filter === f ? '#38bdf8' : 'rgba(255,255,255,0.08)'}; background:${acCam.filter === f ? 'rgba(56,189,248,0.25)' : 'rgba(15,23,42,0.5)'}; color:${acCam.filter === f ? '#38bdf8' : '#94a3b8'}; cursor:pointer; text-transform:capitalize; font-weight:${acCam.filter === f ? '700' : '500'};">
                  ${f === 'all' ? 'All (21)' : f}
                </button>
              `).join('')}
            </div>

            <div style="display:flex; align-items:center; gap:14px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:11px; font-weight:600; color:#cbd5e1;">Explode:</span>
                <input type="range" id="explodeSlider" min="0" max="100" value="${Math.round(acCam.explode * 100)}" style="width:100px; accent-color:#38bdf8; cursor:pointer;" />
                <span id="explodeValText" style="font-size:11px; color:#38bdf8; min-width:32px;">${Math.round(acCam.explode * 100)}%</span>
              </div>

              <button id="btnToggleLabels" style="padding:4px 12px; font-size:11px; border-radius:14px; border:1px solid ${acCam.showLabels ? '#10b981' : 'rgba(255,255,255,0.1)'}; background:${acCam.showLabels ? 'rgba(16,185,129,0.15)' : 'rgba(15,23,42,0.6)'}; color:${acCam.showLabels ? '#10b981' : '#94a3b8'}; cursor:pointer; font-weight:600;">
                ${acCam.showLabels ? 'Labels: ON' : 'Labels: OFF'}
              </button>

              <button id="btnToggleSpin" style="padding:4px 12px; font-size:11px; border-radius:14px; border:1px solid ${acCam.autoSpin ? '#38bdf8' : 'rgba(255,255,255,0.1)'}; background:${acCam.autoSpin ? 'rgba(56,189,248,0.15)' : 'rgba(15,23,42,0.6)'}; color:${acCam.autoSpin ? '#38bdf8' : '#94a3b8'}; cursor:pointer; font-weight:600;">
                ${acCam.autoSpin ? 'Orbit: ON' : 'Orbit: PAUSED'}
              </button>
            </div>
          </div>
        ` : ''}

        <div style="position:relative; flex:1; width:100%; height:100%; min-height:640px; overflow:hidden;">
          <canvas id="homeCanvas" style="display:block; width:100%; height:100%; cursor:grab;"></canvas>

          <div style="position:absolute; bottom:16px; left:20px; z-index:15; pointer-events:none; font-size:11px; color:#64748b; background:rgba(6,12,22,0.7); padding:8px 14px; border-radius:8px; border:1px solid rgba(255,255,255,0.06); backdrop-filter:blur(8px);">
            <div style="color:#94a3b8; font-weight:600; margin-bottom:2px;">3D Model Controls</div>
            <div>• <strong>Left Click + Drag:</strong> 360° Orbit</div>
            <div>• <strong>Mouse Wheel / Pinch:</strong> Zoom In / Out</div>
            <div>• <strong>Click Hub / Pin:</strong> Inspect Telemetry & Specs</div>
          </div>

          <div id="partDetailDrawer" style="position:absolute; top:20px; right:24px; width:380px; max-height:calc(100% - 40px); background:rgba(10,18,34,0.92); backdrop-filter:blur(20px); border:1px solid rgba(56,189,248,0.3); border-radius:16px; box-shadow:0 16px 40px rgba(0,0,0,0.6); padding:20px; z-index:25; display:${acCam.selectedPart ? 'flex' : 'none'}; flex-direction:column; overflow-y:auto;">
          </div>

          ${homeMode === 'globe' ? `
            <div style="position:absolute; top:20px; left:24px; width:340px; background:rgba(10,18,34,0.88); backdrop-filter:blur(16px); border:1px solid rgba(56,189,248,0.25); border-radius:14px; padding:16px; z-index:20;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <span style="font-size:13px; font-weight:700; color:#38bdf8;">Flight Route Dispatch</span>
                <span style="font-size:11px; background:#10b98122; color:#10b981; padding:2px 8px; border-radius:10px;">Live GPS & Auroras</span>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px;">
                <div>
                  <label style="font-size:10px; color:#64748b;">Origin</label>
                  <select id="routeOriginSel" style="width:100%; padding:6px; font-size:11px; background:#0f172a; border:1px solid rgba(56,189,248,0.25); color:#f8fafc; border-radius:6px;">
                    ${AIRPORTS.map(a => `<option value="${a.code}">${a.code} - ${a.name.split(' ')[0]}</option>`).join('')}
                  </select>
                </div>
                <div>
                  <label style="font-size:10px; color:#64748b;">Destination</label>
                  <select id="routeDestSel" style="width:100%; padding:6px; font-size:11px; background:#0f172a; border:1px solid rgba(56,189,248,0.25); color:#f8fafc; border-radius:6px;">
                    ${AIRPORTS.slice().reverse().map(a => `<option value="${a.code}">${a.code} - ${a.name.split(' ')[0]}</option>`).join('')}
                  </select>
                </div>
              </div>
              <div style="display:flex; gap:8px; margin-bottom:12px;">
                <input type="text" id="routeFlightNo" value="FX-${Math.floor(100 + Math.random()*899)}" style="flex:1; padding:6px 10px; font-size:11px; background:#0f172a; border:1px solid rgba(56,189,248,0.25); color:#f8fafc; border-radius:6px;" />
                <button id="btnAddRoute" style="padding:6px 14px; font-size:11px; font-weight:700; background:linear-gradient(135deg, #0284c7, #38bdf8); color:#fff; border:none; border-radius:6px; cursor:pointer;">+ Add Route</button>
              </div>
              <div id="routeListItems" style="max-height:160px; overflow-y:auto; display:flex; flex-direction:column; gap:6px;"></div>
            </div>
          ` : ''}

        </div>
      </section>

    </div>
  `;

  initHomeEvents();
  initHomeCanvas();
  initDefaultMedia();

  if (homeMode === 'aircraft' && acCam.selectedPart) {
    updatePartDrawer(acCam.selectedPart);
  } else if (homeMode === 'globe') {
    updateGlobeRouteList();
  }
}

function rHome() { renderHome(); }
window.rHome = rHome;
window.renderHome = renderHome;

// Audio Default Engine (Plays unmuted by default with user-gesture unlock fallback)
function initDefaultMedia() {
  const vid = document.getElementById('flightHeroVideo');
  if (!vid) return;
  // Always keep hero video silent
  vid.muted = true;
  vid.volume = 0;
  VideoStore.getSavedVideo().then(cachedBlob => {
    if (cachedBlob) {
      vid.src = URL.createObjectURL(cachedBlob);
    }
    // Play video silently
    vid.play().catch(() => {});
  });
}



window.scrollToModel = function() {
  const el = document.getElementById('mroModelSection');
  if (el) el.scrollIntoView({ behavior: 'smooth' });
};

window.scrollToGlobe = function() {
  homeMode = 'globe';
  renderHome();
  const el = document.getElementById('mroModelSection');
  if (el) el.scrollIntoView({ behavior: 'smooth' });
};

function initHomeEvents() {
  const btnAircraft = document.getElementById('btnModeAircraft');
  const btnGlobe = document.getElementById('btnModeGlobe');
  if (btnAircraft && btnGlobe) {
    btnAircraft.onclick = () => { homeMode = 'aircraft'; renderHome(); window.scrollToModel(); };
    btnGlobe.onclick = () => { homeMode = 'globe'; renderHome(); window.scrollToModel(); };
  }

  document.querySelectorAll('.cam-preset-btn').forEach(btn => {
    btn.onclick = (e) => {
      const p = CAMERA_PRESETS[e.currentTarget.dataset.preset];
      if (p) {
        acCam.targetYaw = p.yaw;
        acCam.targetPitch = p.pitch;
        acCam.targetZoom = p.zoom;
        acCam.targetPanX = p.panX;
        acCam.targetPanY = p.panY;
        acCam.targetExplode = p.explode;
        const slider = document.getElementById('explodeSlider');
        if (slider) slider.value = Math.round(p.explode * 100);
        const valText = document.getElementById('explodeValText');
        if (valText) valText.innerText = Math.round(p.explode * 100) + '%';
      }
    };
  });

  document.querySelectorAll('.filter-pill-btn').forEach(btn => {
    btn.onclick = (e) => {
      acCam.filter = e.currentTarget.dataset.filter;
      document.querySelectorAll('.filter-pill-btn').forEach(b => {
        const active = b.dataset.filter === acCam.filter;
        b.style.border = active ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.08)';
        b.style.background = active ? 'rgba(56,189,248,0.25)' : 'rgba(15,23,42,0.5)';
        b.style.color = active ? '#38bdf8' : '#94a3b8';
      });
    };
  });

  const slider = document.getElementById('explodeSlider');
  if (slider) {
    slider.oninput = (e) => {
      acCam.explode = parseFloat(e.target.value) / 100;
      acCam.targetExplode = acCam.explode;
      const valText = document.getElementById('explodeValText');
      if (valText) valText.innerText = Math.round(acCam.explode * 100) + '%';
    };
  }

  const btnLabels = document.getElementById('btnToggleLabels');
  if (btnLabels) {
    btnLabels.onclick = () => {
      acCam.showLabels = !acCam.showLabels;
      btnLabels.innerText = acCam.showLabels ? 'Labels: ON' : 'Labels: OFF';
      btnLabels.style.borderColor = acCam.showLabels ? '#10b981' : 'rgba(255,255,255,0.1)';
      btnLabels.style.background = acCam.showLabels ? 'rgba(16,185,129,0.15)' : 'rgba(15,23,42,0.6)';
      btnLabels.style.color = acCam.showLabels ? '#10b981' : '#94a3b8';
    };
  }

  const btnSpin = document.getElementById('btnToggleSpin');
  if (btnSpin) {
    btnSpin.onclick = () => {
      acCam.autoSpin = !acCam.autoSpin;
      btnSpin.innerText = acCam.autoSpin ? 'Orbit: ON' : 'Orbit: PAUSED';
      btnSpin.style.borderColor = acCam.autoSpin ? '#38bdf8' : 'rgba(255,255,255,0.1)';
      btnSpin.style.background = acCam.autoSpin ? 'rgba(56,189,248,0.15)' : 'rgba(15,23,42,0.6)';
      btnSpin.style.color = acCam.autoSpin ? '#38bdf8' : '#94a3b8';
    };
  }

  const btnAdd = document.getElementById('btnAddRoute');
  if (btnAdd) {
    btnAdd.onclick = () => {
      const orig = document.getElementById('routeOriginSel').value;
      const dest = document.getElementById('routeDestSel').value;
      const fn = document.getElementById('routeFlightNo').value.trim() || `FX-${Math.floor(100 + Math.random()*899)}`;
      if (orig === dest) {
        if (typeof toast === 'function') toast('Origin and destination cannot match', 'error');
        return;
      }
      const state = getMroState();
      if (!state.routes) state.routes = [];
      state.routes.push({ id: 'rt_' + Date.now(), flightNo: fn, origin: orig, dest: dest, active: true });
      if (typeof saveState === 'function') saveState();
      updateGlobeRouteList();
    };
  }
}

function updateGlobeRouteList() {
  const container = document.getElementById('routeListItems');
  if (!container) return;
  const state = getMroState();
  const routes = (state.routes && state.routes.length) ? state.routes : [
    { id: 'rt_1', flightNo: 'BA-178', origin: 'LHR', dest: 'JFK', active: true },
    { id: 'rt_2', flightNo: 'AF-006', origin: 'CDG', dest: 'JFK', active: true },
    { id: 'rt_3', flightNo: 'EK-202', origin: 'DXB', dest: 'LHR', active: true },
    { id: 'rt_4', flightNo: 'JL-002', origin: 'HND', dest: 'LAX', active: true }
  ];
  container.innerHTML = routes.map(r => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:5px 8px; background:rgba(15,23,42,0.6); border-radius:6px; font-size:11px;">
      <div><strong style="color:#38bdf8;">${r.flightNo}</strong> ${r.origin || r.from} ➔ ${r.dest || r.to}</div>
      <button onclick="toggleRouteStatus('${r.id}')" style="background:${r.active !== false ? '#10b98133' : '#64748b33'}; color:${r.active !== false ? '#10b981' : '#94a3b8'}; border:none; border-radius:4px; font-size:9px; padding:2px 6px; cursor:pointer;">${r.active !== false ? 'ACTIVE' : 'OFF'}</button>
    </div>
  `).join('');
}

window.toggleRouteStatus = function(id) {
  const state = getMroState();
  const r = (state.routes || []).find(x => x.id === id);
  if (r) { r.active = !r.active; if (typeof saveState === 'function') saveState(); updateGlobeRouteList(); }
};

// ============================================================================
// 3D Canvas Graphics Engine with Viewport-Throttling (Zero Lag)
// ============================================================================
function initHomeCanvas() {
  const canvas = document.getElementById('homeCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width, height;

  function resize() {
    const parent = canvas.parentElement;
    width = parent.clientWidth || window.innerWidth;
    height = Math.max(parent.clientHeight || 0, 720);
    // Clamp DPR to 1.5 to eliminate rendering lag on high-DPI screens
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
  }
  resize();
  window.addEventListener('resize', resize);

  // IntersectionObserver: PAUSES 3D rendering while viewing the video
  const observer = new IntersectionObserver((entries) => {
    isCanvasVisible = entries[0].isIntersecting;
  }, { threshold: 0.05 });
  observer.observe(canvas);

  canvas.onmousedown = (e) => {
    if (homeMode === 'aircraft') {
      acCam.isDragging = true;
      acCam.lastMouseX = e.clientX;
      acCam.lastMouseY = e.clientY;
    } else {
      globeState.isDragging = true;
      globeState.dragM = 0;
      globeState.lastMouseX = e.clientX;
      globeState.lastMouseY = e.clientY;
    }
    canvas.style.cursor = 'grabbing';
  };

  window.onmousemove = (e) => {
    if (homeMode === 'aircraft') {
      if (acCam.isDragging) {
        const dx = e.clientX - acCam.lastMouseX;
        const dy = e.clientY - acCam.lastMouseY;
        acCam.targetYaw += dx * 0.008;
        acCam.targetPitch = Math.max(-1.1, Math.min(1.1, acCam.targetPitch + dy * 0.008));
        acCam.lastMouseX = e.clientX;
        acCam.lastMouseY = e.clientY;
      } else if (isCanvasVisible) {
        checkCalloutHover(e.clientX, e.clientY, canvas);
      }
    } else {
      if (globeState.isDragging) {
        const dx = e.clientX - globeState.lastMouseX;
        const dy = e.clientY - globeState.lastMouseY;
        globeState.dragM += Math.abs(dx) + Math.abs(dy);
        globeState.lon -= dx * 0.35;
        globeState.tlon = globeState.lon;
        globeState.lat = Math.max(-80, Math.min(80, globeState.lat + dy * 0.25));
        globeState.tlat = globeState.lat;
        globeState.idle = globeState.t;
        globeState.lastMouseX = e.clientX;
        globeState.lastMouseY = e.clientY;
      }
    }
  };

  window.onmouseup = (e) => {
    if (homeMode === 'aircraft') {
      acCam.isDragging = false;
    } else {
      const wasClick = globeState.isDragging && globeState.dragM < 6;
      globeState.isDragging = false;
      if (wasClick && canvas) {
        const r = canvas.getBoundingClientRect();
        tapGlobe(e.clientX - r.left, e.clientY - r.top);
      }
    }
    canvas.style.cursor = 'grab';
  };

  canvas.onwheel = (e) => {
    e.preventDefault();
    if (homeMode === 'aircraft') {
      const factor = e.deltaY < 0 ? 1.08 : 0.92;
      acCam.targetZoom = Math.max(0.45, Math.min(2.8, acCam.targetZoom * factor));
    } else {
      const factor = e.deltaY < 0 ? 1.08 : 0.92;
      globeState.zoom = Math.max(0.55, Math.min(2.5, globeState.zoom * factor));
      globeState.tlon += e.deltaY * 0.15;
      globeState.idle = globeState.t;
    }
  };

  canvas.onclick = (e) => {
    if (homeMode === 'aircraft' && isCanvasVisible) {
      const hit = checkCalloutHover(e.clientX, e.clientY, canvas);
      if (hit) {
        acCam.selectedPart = hit;
        updatePartDrawer(hit);
      }
    }
  };

  if (homeAnimId) cancelAnimationFrame(homeAnimId);

  let lastTs = performance.now();
  function loop(ts) {
    const dt = Math.min(0.06, (ts - lastTs) / 1000);
    lastTs = ts;

    if (isCanvasVisible) {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      if (homeMode === 'aircraft') {
        acCam.yaw += (acCam.targetYaw - acCam.yaw) * 0.12;
        acCam.pitch += (acCam.targetPitch - acCam.pitch) * 0.12;
        acCam.zoom += (acCam.targetZoom - acCam.zoom) * 0.12;
        acCam.panX += (acCam.targetPanX - acCam.panX) * 0.12;
        acCam.panY += (acCam.targetPanY - acCam.panY) * 0.12;
        acCam.explode += (acCam.targetExplode - acCam.explode) * 0.14;

        if (acCam.autoSpin && !acCam.isDragging) acCam.targetYaw += 0.0028;
        acCam.spinBlade += 0.32;
        acCam.radarSweep += 0.06;

        drawAircraftScene(ctx, width, height);
      } else {
        globeState.t += dt;
        if (!globeState.isDragging && (globeState.t - globeState.idle > 4)) {
          globeState.tlon += dt * 3.5;
        }
        globeState.lon += (globeState.tlon - globeState.lon) * 0.07;
        globeState.lat += (globeState.tlat - globeState.lat) * 0.05;
        globeState.satelliteAngle += 0.015;

        drawGlobeScene(ctx, width, height);
      }

      ctx.restore();
    }

    homeAnimId = requestAnimationFrame(loop);
  }
  homeAnimId = requestAnimationFrame(loop);
}

function checkCalloutHover(clientX, clientY, canvas) {
  const rect = canvas.getBoundingClientRect();
  const mouseX = clientX - rect.left;
  const mouseY = clientY - rect.top;

  let found = null;
  if (window._currentCalloutBoxes) {
    for (let i = 0; i < window._currentCalloutBoxes.length; i++) {
      const box = window._currentCalloutBoxes[i];
      if (mouseX >= box.x && mouseX <= box.x + box.w && mouseY >= box.y && mouseY <= box.y + box.h) {
        found = box.part;
        break;
      }
    }
  }

  acCam.hoveredPart = found;
  canvas.style.cursor = found ? 'pointer' : (acCam.isDragging ? 'grabbing' : 'grab');
  return found;
}

// -------------------------------------------------------------
// GLOBE MATHEMATICS & SPHERICAL PROJECTIONS
// -------------------------------------------------------------
function rnd(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function sunVec() {
  return vec(20 * Math.sin(globeState.t * 0.02), -globeState.t * 1.8 + 60);
}

function vec(lat, lon) {
  const c = Math.cos(lat * D2R);
  return [c * Math.cos(lon * D2R), c * Math.sin(lon * D2R), Math.sin(lat * D2R)];
}

function proj(v, h) {
  const s = 1 + (h || 0);
  const l = globeState.lon * D2R;
  const f = globeState.lat * D2R;
  const x1 = v[0] * Math.cos(l) + v[1] * Math.sin(l);
  const y1 = -v[0] * Math.sin(l) + v[1] * Math.cos(l);
  const z1 = v[2];
  const cx = globeState.cx || (window.innerWidth / 2);
  const cy = globeState.cy || (window.innerHeight / 2);
  const R = globeState.R || 300;
  return [
    cx + R * s * y1,
    cy - R * s * (z1 * Math.cos(f) - x1 * Math.sin(f)),
    x1 * Math.cos(f) + z1 * Math.sin(f)
  ];
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function arc(a, b) {
  const w = Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
  const n = 60;
  const o = [];
  const sw = Math.sin(w) || 1;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const w1 = Math.sin((1 - t) * w) / sw;
    const w2 = Math.sin(t * w) / sw;
    // Elevated altitude curve clearance above globe surface (Ref 1 & 2)
    o.push([
      a[0] * w1 + b[0] * w2,
      a[1] * w1 + b[1] * w2,
      a[2] * w1 + b[2] * w2,
      Math.sin(Math.PI * t) * (0.06 + 0.18 * w / Math.PI)
    ]);
  }
  return o;
}

function at(A, t) {
  const i = Math.max(0, Math.min(t, 0.9999)) * (A.length - 1);
  const i0 = Math.floor(i);
  const f = i - i0;
  const a = A[i0];
  const b = A[i0 + 1];
  return proj([
    a[0] + (b[0] - a[0]) * f,
    a[1] + (b[1] - a[1]) * f,
    a[2] + (b[2] - a[2]) * f
  ], a[3] + (b[3] - a[3]) * f);
}

function getOrCreateArc(key, a, b) {
  if (!globeState.arcs[key]) globeState.arcs[key] = arc(a, b);
  return globeState.arcs[key];
}

function tapGlobe(px, py) {
  let hit = null;
  Object.keys(AP).forEach(k => {
    const p = proj(vec(AP[k][0], AP[k][1]));
    if (p[2] > 0.05 && Math.hypot(p[0] - px, p[1] - py) < 18) hit = k;
  });
  if (hit) {
    const selOrig = document.getElementById('routeOriginSel');
    if (selOrig) selOrig.value = hit;
    if (typeof toast === 'function') toast(`Selected Hub: ${AP[hit][2]} (${hit})`);
  }
}

// -------------------------------------------------------------
// PHOTOREALISTIC GLOBE WITH RICH ENVIRONMENTAL FEATURES
// (Auroras, Sun Glint, Polar Ice, Twilight Ring & 3D Arcs)
// -------------------------------------------------------------
function drawGlobeScene(ctx, width, height) {
  const c = ctx;
  const cx = width / 2;
  const cy = height / 2;
  const R = Math.min(width * 0.38, height * 0.44) * globeState.zoom;
  globeState.cx = cx;
  globeState.cy = cy;
  globeState.R = R;

  const sun = sunVec();
  const sp = proj(sun);
  const sx = (sp[0] - cx) / R;
  const sy = (sp[1] - cy) / R;

  // 1. Deep Space Void with Realistic Starfield
  c.clearRect(0, 0, width, height);
  c.fillStyle = "#02040a";
  c.fillRect(0, 0, width, height);

  if (!globeState.stars || !globeState.stars.length) {
    globeState.stars = [];
    for (let i = 0; i < 280; i++) {
      globeState.stars.push({ x: rnd(i * 1.7), y: rnd(i * 4.3 + 100), size: 0.5 + rnd(i * 9) * 1.5 });
    }
  }

  globeState.stars.forEach(s => {
    const alpha = 0.3 + 0.6 * Math.abs(Math.sin(globeState.t * 2 + s.x * 20));
    c.globalAlpha = alpha;
    c.fillStyle = "#ffffff";
    c.fillRect((s.x * width) % width, (s.y * height) % height, s.size, s.size);
  });
  c.globalAlpha = 1;

  // 2. Solar Glare from Sun
  const sunGlare = c.createRadialGradient(cx + R * 1.15, cy - R * 0.3, 0, cx + R * 1.15, cy - R * 0.3, R * 0.9);
  sunGlare.addColorStop(0, "rgba(255, 255, 255, 0.95)");
  sunGlare.addColorStop(0.2, "rgba(180, 230, 255, 0.4)");
  sunGlare.addColorStop(0.6, "rgba(56, 189, 248, 0.12)");
  sunGlare.addColorStop(1, "rgba(0, 0, 0, 0)");
  c.fillStyle = sunGlare;
  c.fillRect(0, 0, width, height);

  // 3. Electric Cyan / Deep Blue Atmospheric Limb Scattering Halo
  const atmoHalo = c.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.34);
  atmoHalo.addColorStop(0, "rgba(56, 189, 248, 0.95)");
  atmoHalo.addColorStop(0.25, "rgba(14, 165, 233, 0.55)");
  atmoHalo.addColorStop(0.65, "rgba(2, 132, 199, 0.22)");
  atmoHalo.addColorStop(0.88, "rgba(139, 92, 246, 0.08)");
  atmoHalo.addColorStop(1, "rgba(0, 0, 0, 0)");
  c.fillStyle = atmoHalo;
  c.beginPath();
  c.arc(cx, cy, R * 1.34, 0, Math.PI * 2);
  c.fill();

  // 4. Planet Sphere Clip
  c.save();
  c.beginPath();
  c.arc(cx, cy, R, 0, Math.PI * 2);
  c.clip();

  // Deep Blue Oceanic Water Surface
  const oceanGrad = c.createRadialGradient(cx + R * 0.3, cy - R * 0.2, R * 0.1, cx, cy, R);
  oceanGrad.addColorStop(0, "#0ea5e9");   // Turquoise sunlit waters
  oceanGrad.addColorStop(0.35, "#0284c7"); // Royal blue
  oceanGrad.addColorStop(0.7, "#033b8a");  // Deep ocean
  oceanGrad.addColorStop(1, "#020d24");    // Abyssal marine blue
  c.fillStyle = oceanGrad;
  c.fillRect(cx - R, cy - R, 2 * R, 2 * R);

  // [ENVIRONMENTAL ELEMENT 1]: Ocean Sun Glint / Specular Light Reflection
  const glintX = cx + sx * R * 0.45;
  const glintY = cy + sy * R * 0.45;
  const glintGrad = c.createRadialGradient(glintX, glintY, 0, glintX, glintY, R * 0.35);
  glintGrad.addColorStop(0, "rgba(255, 255, 255, 0.65)");
  glintGrad.addColorStop(0.4, "rgba(186, 230, 253, 0.25)");
  glintGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
  c.fillStyle = glintGrad;
  c.beginPath();
  c.arc(glintX, glintY, R * 0.35, 0, Math.PI * 2);
  c.fill();

  // 5. Continents with Coastal Shelf Glow
  LAND.forEach(P => {
    let vis = 0;
    const pts = P.map(q => {
      let p = proj(vec(q[1], q[0]));
      if (p[2] > 0) {
        vis++;
      } else {
        const dx = p[0] - cx;
        const dy = p[1] - cy;
        const l = Math.hypot(dx, dy) || 1;
        p = [cx + dx / l * R, cy + dy / l * R, -1];
      }
      return p;
    });
    if (!vis) return;

    c.beginPath();
    pts.forEach((p, k) => { k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); });
    c.closePath();
    c.fillStyle = "#15803d"; // Forest green
    c.fill();
    c.strokeStyle = "rgba(56, 189, 248, 0.65)"; // Coastal shelf glow
    c.lineWidth = 1.5;
    c.stroke();
  });

  // [ENVIRONMENTAL ELEMENT 2]: Polar Glacial Ice Caps (Arctic & Antarctic)
  const northPole = proj(vec(85, globeState.lon));
  if (northPole[2] > -0.2) {
    const iceGradN = c.createRadialGradient(northPole[0], northPole[1] - R * 0.05, 0, northPole[0], northPole[1], R * 0.28);
    iceGradN.addColorStop(0, "rgba(255, 255, 255, 0.95)");
    iceGradN.addColorStop(0.7, "rgba(224, 242, 254, 0.8)");
    iceGradN.addColorStop(1, "rgba(224, 242, 254, 0)");
    c.fillStyle = iceGradN;
    c.beginPath();
    c.ellipse(cx, cy - R * 0.88, R * 0.32, R * 0.14, 0, 0, Math.PI * 2);
    c.fill();
  }

  const southPole = proj(vec(-85, globeState.lon));
  if (southPole[2] > -0.2) {
    const iceGradS = c.createRadialGradient(southPole[0], southPole[1] + R * 0.05, 0, southPole[0], southPole[1], R * 0.3);
    iceGradS.addColorStop(0, "rgba(255, 255, 255, 0.95)");
    iceGradS.addColorStop(0.7, "rgba(224, 242, 254, 0.8)");
    iceGradS.addColorStop(1, "rgba(224, 242, 254, 0)");
    c.fillStyle = iceGradS;
    c.beginPath();
    c.ellipse(cx, cy + R * 0.88, R * 0.34, R * 0.15, 0, 0, Math.PI * 2);
    c.fill();
  }

  // 6. Day / Night Terminator Shadow
  const termGrad = c.createRadialGradient(cx + R * 0.5, cy - R * 0.2, 0, cx + R * 0.5, cy - R * 0.2, R * 1.6);
  termGrad.addColorStop(0.4, "rgba(0, 0, 0, 0)");
  termGrad.addColorStop(0.7, "rgba(2, 6, 23, 0.75)");
  termGrad.addColorStop(0.95, "rgba(2, 6, 23, 0.96)");
  c.fillStyle = termGrad;
  c.fillRect(cx - R, cy - R, 2 * R, 2 * R);

  // [ENVIRONMENTAL ELEMENT 3]: Sunset / Twilight Golden Ring along Terminator
  const twilight = c.createLinearGradient(cx - R * 0.1, cy - R, cx + R * 0.3, cy + R);
  twilight.addColorStop(0, "rgba(249, 115, 22, 0)");
  twilight.addColorStop(0.48, "rgba(249, 115, 22, 0.32)");
  twilight.addColorStop(0.52, "rgba(244, 63, 94, 0.22)");
  twilight.addColorStop(1, "rgba(249, 115, 22, 0)");
  c.fillStyle = twilight;
  c.fillRect(cx - R, cy - R, 2 * R, 2 * R);

  // 7. Glowing Golden & Violet Night City Lights
  CITY_LIGHTS.forEach((coord, idx) => {
    const v = vec(coord[0], coord[1]);
    const p = proj(v);
    if (p[2] < 0.05) return;
    const sunDot = dot(v, sun);
    if (sunDot < 0.3) {
      const intensity = Math.min(1, Math.max(0.35, (0.3 - sunDot) * 2.2));
      c.beginPath();
      c.arc(p[0], p[1], 1.6, 0, Math.PI * 2);
      if (idx % 4 === 0) {
        c.fillStyle = "rgba(216, 180, 254, " + (intensity * 0.85) + ")"; // Violet
      } else {
        c.fillStyle = "rgba(253, 224, 71, " + (intensity * 0.95) + ")"; // Golden Amber
      }
      c.fill();
    }
  });

  // [ENVIRONMENTAL ELEMENT 4]: Dynamic Aurora Borealis & Australis (Dancing Curtains)
  const auroraColor = "rgba(16, 185, 129, " + (0.35 + Math.sin(globeState.t * 3) * 0.15) + ")";
  c.strokeStyle = auroraColor;
  c.lineWidth = 4;
  c.beginPath();
  for (let aLon = -180; aLon <= 180; aLon += 10) {
    const waveLat = 72 + Math.sin((aLon + globeState.t * 40) * D2R * 2) * 5;
    const aPt = proj(vec(waveLat, aLon));
    if (aPt[2] > 0) {
      if (aLon === -180) c.moveTo(aPt[0], aPt[1]); else c.lineTo(aPt[0], aPt[1]);
    }
  }
  c.stroke();

  // Southern Aurora Australis
  c.strokeStyle = "rgba(6, 182, 212, " + (0.3 + Math.cos(globeState.t * 2.5) * 0.12) + ")";
  c.beginPath();
  for (let sLon = -180; sLon <= 180; sLon += 10) {
    const waveLatS = -74 + Math.cos((sLon + globeState.t * 35) * D2R * 2) * 4;
    const aPtS = proj(vec(waveLatS, sLon));
    if (aPtS[2] > 0) {
      if (sLon === -180) c.moveTo(aPtS[0], aPtS[1]); else c.lineTo(aPtS[0], aPtS[1]);
    }
  }
  c.stroke();

  // Atmospheric Inner Fresnel Grazing Glow
  const innerFresnel = c.createRadialGradient(cx, cy, R * 0.82, cx, cy, R);
  innerFresnel.addColorStop(0, "rgba(56, 189, 248, 0)");
  innerFresnel.addColorStop(0.85, "rgba(56, 189, 248, 0.18)");
  innerFresnel.addColorStop(1, "rgba(56, 189, 248, 0.45)");
  c.fillStyle = innerFresnel;
  c.fillRect(cx - R, cy - R, 2 * R, 2 * R);

  c.restore(); // Exit planet clip

  // 8. Outer Rim Precision Ring
  c.strokeStyle = "rgba(125, 211, 255, 0.75)";
  c.lineWidth = 1.5;
  c.beginPath();
  c.arc(cx, cy, R, 0, Math.PI * 2);
  c.stroke();

  // 9. Elevated 3D Flight Routes & Photorealistic 3D Aircraft
  const state = getMroState();
  const routes = (state.routes && state.routes.length) ? state.routes : [
    { origin: "LHR", dest: "JFK", active: true, flightNo: "BA-178" },
    { origin: "CDG", dest: "JFK", active: true, flightNo: "AF-006" },
    { origin: "DXB", dest: "LHR", active: true, flightNo: "EK-202" },
    { origin: "HND", dest: "LAX", active: true, flightNo: "JL-002" },
    { origin: "SIN", dest: "DXB", active: true, flightNo: "SQ-321" },
    { origin: "FRA", dest: "HND", active: true, flightNo: "LH-716" },
    { origin: "SYD", dest: "SIN", active: true, flightNo: "QF-001" },
    { origin: "JFK", dest: "LAX", active: true, flightNo: "DL-445" }
  ];

  routes.forEach((r, rIdx) => {
    const fromCode = r.origin || r.from;
    const toCode = r.dest || r.to;
    const fromAp = AP[fromCode];
    const toAp = AP[toCode];
    if (!fromAp || !toAp) return;
    if (r.active === false) return;

    const a = vec(fromAp[0], fromAp[1]);
    const b = vec(toAp[0], toAp[1]);
    const A = getOrCreateArc(fromCode + "-" + toCode, a, b);

    // Render Elevated Great-Circle Arc (Electric Cyan Neon)
    c.save();
    c.beginPath();
    let first = true;
    for (let i = 0; i < A.length; i++) {
      const pt = proj(A[i], A[i][3]);
      if (pt[2] > -0.05) {
        if (first) { c.moveTo(pt[0], pt[1]); first = false; } else c.lineTo(pt[0], pt[1]);
      }
    }
    c.strokeStyle = "rgba(56, 189, 248, 0.75)";
    c.setLineDash([6, 5]);
    c.lineDashOffset = -globeState.t * 22;
    c.lineWidth = 1.6;
    c.stroke();
    c.restore();

    // 3D Airplane Flying with Navigation Strobes & Drop-Shadow Pin
    r.prog = ((r.prog || (rIdx * 0.13)) + 0.0007) % 1;
    const cur = at(A, r.prog);
    const nxt = at(A, Math.min(0.999, r.prog + 0.012));

    // Ground point directly beneath the plane (altitude = 0)
    const iFloor = Math.max(0, Math.min(r.prog, 0.9999)) * (A.length - 1);
    const i0 = Math.floor(iFloor), f = iFloor - i0;
    const groundPt = proj([
      A[i0][0] + (A[i0 + 1][0] - A[i0][0]) * f,
      A[i0][1] + (A[i0 + 1][1] - A[i0][1]) * f,
      A[i0][2] + (A[i0 + 1][2] - A[i0][2]) * f
    ], 0);

    if (cur[2] > 0) {
      // Altitude Drop-Shadow Pin connecting jet to the globe surface
      c.beginPath();
      c.moveTo(groundPt[0], groundPt[1]);
      c.lineTo(cur[0], cur[1]);
      c.strokeStyle = "rgba(56, 189, 248, 0.35)";
      c.setLineDash([2, 3]);
      c.lineWidth = 1;
      c.stroke();
      c.setLineDash([]);

      // Surface shadow contact dot
      c.beginPath();
      c.arc(groundPt[0], groundPt[1], 1.8, 0, Math.PI * 2);
      c.fillStyle = "rgba(56, 189, 248, 0.55)";
      c.fill();

      // 3D Aircraft Silhouette
      const flightAngle = Math.atan2(nxt[1] - cur[1], nxt[0] - cur[0]);
      c.save();
      c.translate(cur[0], cur[1]);
      c.rotate(flightAngle);

      // Jet engine exhaust glow
      c.strokeStyle = "rgba(0, 240, 255, 0.65)";
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(-10, 0); c.lineTo(-3, 0);
      c.stroke();

      // Swept-Wing Airliner Body
      c.fillStyle = "#ffffff";
      c.shadowColor = "#38bdf8";
      c.shadowBlur = 10;
      c.beginPath();
      c.moveTo(10, 0);
      c.lineTo(2, 2);
      c.lineTo(-2, 10);
      c.lineTo(-4, 9);
      c.lineTo(-1, 2);
      c.lineTo(-7, 1);
      c.lineTo(-10, 4);
      c.lineTo(-11, 0);
      c.lineTo(-10, -4);
      c.lineTo(-7, -1);
      c.lineTo(-1, -2);
      c.lineTo(-4, -9);
      c.lineTo(-2, -10);
      c.lineTo(2, -2);
      c.closePath();
      c.fill();
      c.shadowBlur = 0;

      // Flashing Wingtip Strobes (Green right, Red left)
      if (Math.sin(globeState.t * 10) > 0) {
        c.fillStyle = "#22c55e";
        c.beginPath(); c.arc(-3, 9.5, 1.4, 0, Math.PI * 2); c.fill();
        c.fillStyle = "#ef4444";
        c.beginPath(); c.arc(-3, -9.5, 1.4, 0, Math.PI * 2); c.fill();
      }

      c.restore();
    }
  });

  // [ENVIRONMENTAL ELEMENT 5]: Orbiting Low Earth Orbit Space Satellite (ISS)
  const satRad = R * 1.18;
  const satX = cx + Math.cos(globeState.satelliteAngle) * satRad;
  const satY = cy + Math.sin(globeState.satelliteAngle) * satRad * 0.45;
  // Satellite Body & Solar Panels
  c.fillStyle = "#ffffff";
  c.fillRect(satX - 4, satY - 2, 8, 4);
  c.fillStyle = "#00f0ff";
  c.fillRect(satX - 10, satY - 1.5, 5, 3);
  c.fillRect(satX + 5, satY - 1.5, 5, 3);
  // Blinking Beacon
  if (Math.sin(globeState.t * 8) > 0.5) {
    c.fillStyle = "#ef4444";
    c.beginPath(); c.arc(satX, satY - 3, 1.8, 0, Math.PI * 2); c.fill();
  }

  // 10. Airport Hubs with Pulsing Radar Rings
  Object.keys(AP).forEach(k => {
    const p = proj(vec(AP[k][0], AP[k][1]), 0.005);
    if (p[2] < 0.05) return;

    // Pulsing radar beacon ring
    const pulseR = 3.5 + Math.abs(Math.sin(globeState.t * 2 + AP[k][0])) * 5;
    c.strokeStyle = "rgba(56, 189, 248, 0.45)";
    c.lineWidth = 1;
    c.beginPath(); c.arc(p[0], p[1], pulseR, 0, Math.PI * 2); c.stroke();

    // Center hub dot
    c.strokeStyle = "rgba(253, 224, 71, 0.85)"; c.lineWidth = 1.2;
    c.beginPath(); c.arc(p[0], p[1], 3.5, 0, Math.PI * 2); c.stroke();
    c.fillStyle = "#ffffff"; c.beginPath(); c.arc(p[0], p[1], 1.8, 0, Math.PI * 2); c.fill();

    // Hub Code Text Badge
    c.fillStyle = "#ffffff"; c.font = "bold 10px monospace"; c.shadowColor = "#000"; c.shadowBlur = 4;
    c.fillText(k, p[0] + 6, p[1] + 3); c.shadowBlur = 0;
  });
}

// -------------------------------------------------------------
// 3D AIRCRAFT CUTAWAY SCENE (Preserved 100%)
// -------------------------------------------------------------
function project3D(x, y, z, cx, cy, cam) {
  const cyaw = Math.cos(cam.yaw), syaw = Math.sin(cam.yaw);
  const cpitch = Math.cos(cam.pitch), spitch = Math.sin(cam.pitch);

  const x1 = x * cyaw + z * syaw;
  const z1 = -x * syaw + z * cyaw;
  const y1 = y;

  const y2 = y1 * cpitch - z1 * spitch;
  const z2 = y1 * spitch + z1 * cpitch;
  const x2 = x1;

  const focal = 680;
  const depth = z2 + 820;
  if (depth <= 10) return { x: 0, y: 0, scale: 0, depth: -9999, visible: false };

  const scale = (focal / depth) * cam.zoom;
  return {
    x: cx + cam.panX + x2 * scale,
    y: cy + cam.panY + y2 * scale,
    scale: scale,
    depth: z2,
    visible: depth > 30
  };
}

function drawAircraftScene(ctx, width, height) {
  const cx = width / 2;
  const cy = height / 2;
  const E = acCam.explode;

  ctx.save();
  ctx.fillStyle = '#060b13';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(56,189,248,0.04)';
  for (let x = 0; x < width; x += 45) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
  for (let y = 0; y < height; y += 45) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
  ctx.restore();

  const items = [];
  const pr = (x, y, z, ex = 0, ey = 0, ez = 0) => project3D(x + ex * E * 90, y + ey * E * 90, z + ez * E * 90, cx, cy, acCam);

  // 1. Radome & Weather Radar Dish
  items.push({
    depth: pr(310, -5, 0, 1.2, 0, 0).depth,
    draw: () => {
      const pNose = pr(310, -5, 0, 1.2, 0, 0);
      if (!pNose.visible) return;
      ctx.save();
      ctx.beginPath();
      ctx.arc(pNose.x, pNose.y, 22 * pNose.scale, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(56,189,248,0.12)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fill();

      const sweepX = Math.sin(acCam.radarSweep) * 12 * pNose.scale;
      ctx.beginPath();
      ctx.ellipse(pNose.x + sweepX, pNose.y, 6 * pNose.scale, 14 * pNose.scale, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#0284c7';
      ctx.fill();
      ctx.restore();
    }
  });

  // 2. Cockpit Flight Deck
  items.push({
    depth: pr(255, -20, 0, 0.6, -0.6, 0).depth,
    draw: () => {
      const pCockpit = pr(255, -20, 0, 0.6, -0.6, 0);
      if (!pCockpit.visible) return;
      ctx.save();
      const pDash = pr(262, -18, 0, 0.6, -0.6, 0);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(pDash.x - 14 * pDash.scale, pDash.y - 8 * pDash.scale, 28 * pDash.scale, 10 * pDash.scale);
      [-10, -3, 4, 11].forEach((off, idx) => {
        ctx.fillStyle = idx % 2 === 0 ? '#38bdf8' : '#10b981';
        ctx.fillRect(pDash.x + (off - 2) * pDash.scale, pDash.y - 6 * pDash.scale, 5 * pDash.scale, 6 * pDash.scale);
      });
      ctx.restore();
    }
  });

  // 3. Cabin Deck & Seats
  items.push({
    depth: pr(0, -14, 0, 0, -0.4, 0).depth,
    draw: () => {
      const pFwdL = pr(210, -6, -24, 0, 0, 0);
      const pFwdR = pr(210, -6, 24, 0, 0, 0);
      const pAftR = pr(-170, -6, 24, 0, 0, 0);
      const pAftL = pr(-170, -6, -24, 0, 0, 0);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pFwdL.x, pFwdL.y); ctx.lineTo(pFwdR.x, pFwdR.y);
      ctx.lineTo(pAftR.x, pAftR.y); ctx.lineTo(pAftL.x, pAftL.y);
      ctx.closePath();
      ctx.fillStyle = '#1e293b'; ctx.fill();
      ctx.strokeStyle = 'rgba(56,189,248,0.4)'; ctx.stroke();

      for (let x = 180; x >= 110; x -= 35) {
        [-14, 14].forEach(z => {
          const pPod = pr(x, -14, z, 0, -0.4, 0);
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(pPod.x - 6 * pPod.scale, pPod.y - 8 * pPod.scale, 12 * pPod.scale, 12 * pPod.scale);
        });
      }
      for (let x = 80; x >= -140; x -= 22) {
        [-16, -9, 9, 16].forEach(z => {
          const pSeat = pr(x, -14, z, 0, -0.4, 0);
          ctx.fillStyle = '#0284c7';
          ctx.fillRect(pSeat.x - 3 * pSeat.scale, pSeat.y - 6 * pSeat.scale, 6 * pSeat.scale, 8 * pSeat.scale);
        });
      }
      ctx.restore();
    }
  });

  // 4. Wings & Rotating Titanium Turbofans
  [-1, 1].forEach(side => {
    items.push({
      depth: pr(0, 0, side * 140, 0, 0, side * 0.4).depth,
      draw: () => {
        ctx.save();
        const pRootLE = pr(80, -2, side * 28, 0, 0, side * 0.2);
        const pRootTE = pr(-80, 2, side * 28, 0, 0, side * 0.2);
        const pTipLE  = pr(-60, -8, side * 240, 0, 0, side * 0.8);
        const pTipTE  = pr(-85, -6, side * 240, 0, 0, side * 0.8);

        ctx.beginPath();
        ctx.moveTo(pRootLE.x, pRootLE.y); ctx.lineTo(pTipLE.x, pTipLE.y);
        ctx.lineTo(pTipTE.x, pTipTE.y); ctx.lineTo(pRootTE.x, pRootTE.y);
        ctx.closePath();
        ctx.fillStyle = 'rgba(15,23,42,0.75)'; ctx.fill();
        ctx.strokeStyle = 'rgba(56,189,248,0.5)'; ctx.stroke();

        const pEng = pr(35, 24, side * 150, 0.6, 0, side * 1.2);
        if (pEng.visible) {
          ctx.beginPath();
          ctx.ellipse(pEng.x, pEng.y, 20 * pEng.scale, 18 * pEng.scale, 0, 0, Math.PI * 2);
          ctx.fillStyle = '#1e293b'; ctx.fill();
          ctx.strokeStyle = '#38bdf8'; ctx.stroke();

          for (let b = 0; b < 12; b++) {
            const angle = acCam.spinBlade + (b * Math.PI * 2) / 12;
            ctx.beginPath();
            ctx.moveTo(pEng.x, pEng.y);
            ctx.lineTo(pEng.x + Math.cos(angle) * 12 * pEng.scale, pEng.y + Math.sin(angle) * 12 * pEng.scale);
            ctx.strokeStyle = '#cbd5e1'; ctx.stroke();
          }
        }
        ctx.restore();
      }
    });
  });

  // 5. Tail Fin & APU
  items.push({
    depth: pr(-250, -40, 0, -0.8, -0.8, 0).depth,
    draw: () => {
      ctx.save();
      const pFinRootLE = pr(-200, -16, 0, -0.8, -1.2, 0);
      const pFinTipLE  = pr(-270, -110, 0, -0.8, -1.2, 0);
      const pFinTipTE  = pr(-285, -105, 0, -0.8, -1.2, 0);
      const pFinRootTE = pr(-260, -16, 0, -0.8, -1.2, 0);

      ctx.beginPath();
      ctx.moveTo(pFinRootLE.x, pFinRootLE.y); ctx.lineTo(pFinTipLE.x, pFinTipLE.y);
      ctx.lineTo(pFinTipTE.x, pFinTipTE.y); ctx.lineTo(pFinRootTE.x, pFinRootTE.y);
      ctx.closePath();
      ctx.fillStyle = '#1e293b'; ctx.fill();
      ctx.strokeStyle = '#38bdf8'; ctx.stroke();
      ctx.restore();
    }
  });

  items.sort((a, b) => a.depth - b.depth);
  items.forEach(it => it.draw());

  if (acCam.showLabels) drawCallouts(ctx, cx, cy);
}

function drawCallouts(ctx, cx, cy) {
  const boxes = [];
  const E = acCam.explode;

  AIRCRAFT_PARTS.forEach(part => {
    if (acCam.filter !== 'all' && part.category !== acCam.filter) return;
    const pAnchor = project3D(part.pos[0] + part.explodeDir[0] * E * 90, part.pos[1] + part.explodeDir[1] * E * 90, part.pos[2] + part.explodeDir[2] * E * 90, cx, cy, acCam);
    if (!pAnchor.visible) return;

    const isHovered = acCam.hoveredPart && acCam.hoveredPart.id === part.id;
    const isSelected = acCam.selectedPart && acCam.selectedPart.id === part.id;
    const badgeX = pAnchor.x + part.leadOffset[0];
    const badgeY = pAnchor.y + part.leadOffset[1];

    ctx.save();
    ctx.beginPath();
    ctx.arc(pAnchor.x, pAnchor.y, isHovered || isSelected ? 5 : 3.5, 0, Math.PI * 2);
    ctx.fillStyle = isSelected ? '#ec4899' : (isHovered ? '#38bdf8' : '#7dd3fc');
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(pAnchor.x, pAnchor.y);
    ctx.lineTo(pAnchor.x + part.leadOffset[0] * 0.5, badgeY);
    ctx.lineTo(badgeX, badgeY);
    ctx.strokeStyle = isSelected ? '#ec4899' : (isHovered ? '#38bdf8' : 'rgba(125,211,252,0.4)');
    ctx.stroke();

    const tagText = part.ata.split('-')[0];
    const nameText = part.shortName;
    ctx.font = '600 11px sans-serif';
    const tagW = ctx.measureText(tagText).width + 8;
    const nameW = ctx.measureText(nameText).width + 12;
    const totalW = tagW + nameW;
    const leftX = part.leadOffset[0] < 0 ? badgeX - totalW : badgeX;
    const topY = badgeY - 11;

    ctx.fillStyle = 'rgba(10,18,34,0.85)';
    ctx.strokeStyle = isSelected ? '#ec4899' : (isHovered ? '#38bdf8' : 'rgba(56,189,248,0.3)');
    ctx.fillRect(leftX, topY, totalW, 22);
    ctx.strokeRect(leftX, topY, totalW, 22);

    ctx.fillStyle = '#0284c7';
    ctx.fillRect(leftX, topY, tagW, 22);
    ctx.fillStyle = '#fff';
    ctx.fillText(tagText, leftX + 4, topY + 15);
    ctx.fillText(nameText, leftX + tagW + 6, topY + 15);
    ctx.restore();

    boxes.push({ part, x: leftX, y: topY, w: totalW, h: 22 });
  });

  window._currentCalloutBoxes = boxes;
}

function updatePartDrawer(part) {
  const drawer = document.getElementById('partDetailDrawer');
  if (!drawer) return;
  drawer.style.display = 'flex';
  drawer.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; border-bottom:1px solid rgba(56,189,248,0.2); padding-bottom:8px;">
      <div>
        <span style="font-size:10px; font-weight:700; background:#0284c7; color:#fff; padding:2px 6px; border-radius:4px;">${part.ata}</span>
        <h3 style="margin:4px 0 2px 0; font-size:15px; color:#f8fafc;">${part.title}</h3>
      </div>
      <button onclick="closePartDrawer()" style="background:none; border:none; color:#64748b; font-size:18px; cursor:pointer;">✕</button>
    </div>
    <div style="padding:6px 10px; background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.3); border-radius:6px; margin-bottom:10px; font-size:11px; color:#10b981; font-weight:700;">
      ● ${part.health}
    </div>
    <div style="font-size:12px; color:#cbd5e1; line-height:1.4; margin-bottom:12px;">${part.desc}</div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:12px;">
      ${Object.keys(part.telemetry).map(k => `
        <div style="padding:6px; background:#0f172a; border-radius:6px; font-size:10px;">
          <div style="color:#64748b;">${k}</div>
          <div style="color:#38bdf8; font-weight:700;">${part.telemetry[k]}</div>
        </div>
      `).join('')}
    </div>
    <button onclick="jumpToWorkOrder('${part.title}')" style="padding:8px; font-size:11px; font-weight:700; background:linear-gradient(135deg, #0284c7, #38bdf8); color:#fff; border:none; border-radius:6px; cursor:pointer;">
      Create Work Order
    </button>
  `;
}

window.closePartDrawer = function() {
  acCam.selectedPart = null;
  const drawer = document.getElementById('partDetailDrawer');
  if (drawer) drawer.style.display = 'none';
};

window.jumpToWorkOrder = function(title) {
  const planTab = document.querySelector('[data-tab="plan"]');
  if (planTab) planTab.click();
};

// Global DOM Mount
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderHome);
} else {
  renderHome();
}