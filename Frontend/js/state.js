/* Application state + persistence (localStorage) */
var KEY = "flightfix-v2";
var DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
var DUR = { "A-Check": 1, "C-Check": 3, "Engine Insp.": 2 };
var TASKS = {
  "A-Check": ["Visual walk-around", "Check fluid levels", "Inspect tyres and brakes", "Test avionics"],
  "C-Check": ["Structural inspection", "Landing gear overhaul", "Cabin systems test", "Engine borescope", "Flight control check"],
  "Engine Insp.": ["Borescope inspection", "Oil analysis", "Torque-check mounts"]
};

function seed() {
  return {
    tab: "home", tech: null, n: 2,
    ac: [
      { r: "VT-FLA", t: "A320", h: 12400, aog: 0 },
      { r: "VT-FLB", t: "A320", h: 15850, aog: 0 },
      { r: "VT-FLC", t: "B737", h: 9200,  aog: 0 },
      { r: "VT-FLD", t: "B777", h: 30110, aog: 1 },
      { r: "VT-FLE", t: "B787", h: 18400, aog: 0 }
    ],
    // Dynamic Company Flight Routes (matches reference image network)
    routes: [
      { id: "FL-101", ac: "VT-FLA", from: "JFK", to: "LHR", s: "active",  prog: 0.65 },
      { id: "FL-204", ac: "VT-FLB", from: "MIA", to: "BOG", s: "active",  prog: 0.40 },
      { id: "FL-309", ac: "VT-FLC", from: "GRU", to: "JFK", s: "active",  prog: 0.25 },
      { id: "FL-412", ac: "VT-FLE", from: "LAX", to: "HND", s: "active",  prog: 0.80 },
      { id: "FL-515", ac: "VT-FLB", from: "DXB", to: "DEL", s: "active",  prog: 0.55 },
      { id: "FL-618", ac: "VT-FLC", from: "EZE", to: "LIM", s: "active",  prog: 0.70 },
      { id: "FL-720", ac: "VT-FLD", from: "SIN", to: "SYD", s: "grounded",prog: 0.00 } // Grounded by AOG
    ],
    parts: [
      { id: "MW-2231", n: "Main wheel assembly", q: 2,  m: 3 },
      { id: "HP-887",  n: "Hydraulic pump",       q: 0,  m: 2 },
      { id: "BP-104",  n: "Brake pad set",        q: 18, m: 8 },
      { id: "FF-552",  n: "Fuel filter",          q: 5,  m: 6 }
    ],
    wo: [
      { id: 1, a: "VT-FLB", k: "C-Check", b: "Bay 1", d: "Mon", s: "progress", p: [{ id: "BP-104", q: 4 }], c: [0, 1] }
    ],
    po: [
      { id: "PO-1001", p: "HP-887", q: 2, s: "pending" }
    ],
    feed: [
      ["Flight Ops", "Transatlantic corridors active. 6 company airframes in flight."],
      ["Fleet", "VT-FLD grounded in Bay 4 due to turbine inspection"]
    ]
  };
}

var S;
try { S = JSON.parse(localStorage.getItem(KEY)); } catch(e){}
if (!S || !S.ac || !S.parts) S = seed();
if (!S.routes) S.routes = seed().routes; // Seamless upgrade

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(e){}
}

function resetAll() {
  S = seed();
  save();
  render();
  toast("Fleet & flight network restored");
}