(function () {
  "use strict";

  // ============================================================================
  // 1. API CONFIGURATION & HELPERS
  // ============================================================================
  var API_BASE = (window.location.origin && window.location.origin.startsWith("http"))
    ? window.location.origin
    : "http://127.0.0.1:8000";

  var ADMIN_API_URL = API_BASE + "/api/admin/dashboard";
  var TECH_API_URL  = API_BASE + "/api/technician/dashboard";

  function getEl(id) {
    return document.getElementById(id);
  }

  function notify(msg) {
    if (typeof window.toast === "function") {
      window.toast(msg);
    } else if (typeof window.showToast === "function") {
      window.showToast(msg);
    } else {
      console.log("[FlightFix Notice]", msg);
    }
  }

  // ============================================================================
  // 2. STATE SEED SAFEGUARD (Guarantees data is never empty)
  // ============================================================================
  function ensureState() {
    if (!window.S) window.S = {};
    var s = window.S;

    if (!s.ac || !s.ac.length) {
      s.ac = [
        { r: "VT-FLA", m: "Boeing 737-800", h: 2840.5, c: 1420, aog: 0, st: "JFK", route: "JFK - LHR", assignedTech: "Marcus Vance" },
        { r: "VT-FLB", m: "Airbus A320neo", h: 4120.2, c: 2210, aog: 0, st: "ORD", route: "ORD - LAX", assignedTech: "Elena Rostova" },
        { r: "VT-ALX", m: "Boeing 737-800", h: 3250.0, c: 1610, aog: 1, st: "JFK", route: "JFK - DXB", assignedTech: "Field Technician" },
        { r: "VT-DEL", m: "Airbus A350-900", h: 1250.0, c: 610,  aog: 0, st: "JFK", route: "JFK - SIN", assignedTech: "Lead AME" },
        { r: "VT-BOM", m: "Boeing 787-9",   h: 3310.8, c: 1540, aog: 0, st: "DFW", route: "DFW - NRT", assignedTech: "Field Technician" }
      ];
    }

    if (!s.wo || !s.wo.length) {
      s.wo = [
        {
          id: "WO-101",
          wo_id: "WO-101",
          r: "VT-ALX",
          aircraft: "VT-ALX",
          t: "Hydraulic leak check on left main actuator",
          title: "Hydraulic leak check on left main actuator",
          k: "Hydraulic Check",
          kind: "Hydraulic Check",
          s: "in_progress",
          status: "in_progress",
          p: "urgent",
          priority: "urgent",
          ata: "ATA-29",
          tech: "Field Technician",
          assignedTo: "Field Technician",
          station: "JFK",
          bay: "Bay 1",
          b: "Bay 1",
          day: "Mon",
          d: "Mon",
          steps: [
            { text: "Depressurize hydraulic reservoir B and tag out controls", done: true },
            { text: "Inspect return line B-nut torque & O-ring seal", done: true },
            { text: "Perform 3000 PSI leak pressure run test", done: false },
            { text: "Sign technical flight logbook & certify airworthiness", done: false }
          ]
        },
        {
          id: "WO-102",
          wo_id: "WO-102",
          r: "VT-FLB",
          aircraft: "VT-FLB",
          t: "A-Check Routine Turnaround Inspection",
          title: "A-Check Routine Turnaround Inspection",
          k: "A-Check",
          kind: "A-Check",
          s: "open",
          status: "open",
          p: "routine",
          priority: "routine",
          ata: "ATA-05",
          tech: "Field Technician",
          assignedTo: "Field Technician",
          station: "JFK",
          bay: "Bay 2",
          b: "Bay 2",
          day: "Tue",
          d: "Tue",
          steps: [
            { text: "Complete walkaround exterior visual inspection", done: false },
            { text: "Measure main landing gear tire tread depth & brake wear", done: false },
            { text: "Check APU oil level & engine intake cowlings", done: false },
            { text: "Sign off transit release in airline log", done: false }
          ]
        },
        {
          id: "WO-103",
          wo_id: "WO-103",
          r: "VT-DEL",
          aircraft: "VT-DEL",
          t: "Avionics VOR/ILS Calibration & Telemetry",
          title: "Avionics VOR/ILS Calibration & Telemetry",
          k: "Avionics Check",
          kind: "Avionics Check",
          s: "done",
          status: "done",
          p: "routine",
          priority: "routine",
          ata: "ATA-34",
          tech: "Elena Rostova",
          assignedTo: "Elena Rostova",
          station: "JFK",
          bay: "Bay 3",
          b: "Bay 3",
          day: "Wed",
          d: "Wed",
          steps: [
            { text: "Connect signal generator calibration harness", done: true },
            { text: "Verify glideslope indicator deviation across ranges", done: true },
            { text: "Sign maintenance release certificate", done: true }
          ]
        }
      ];
    }

    if (!s.po || !s.po.length) {
      s.po = [
        { id: "PO-4091", p: "Hydraulic Actuator Seal Kit", q: 2, c: 840, s: "pending", status: "pending", v: "Parker Aerospace" },
        { id: "PO-4092", p: "Carbon Brake Assembly Rotor", q: 4, c: 14200, s: "pending", status: "pending", v: "Safran Landing Systems" }
      ];
    }
  }

  // ============================================================================
  // 3. UNIFIED WORK ORDER NORMALIZER
  // ============================================================================
  function normalizeWo(w) {
    var id = String(w.id || w.wo_id || "");
    var reg = w.r || w.a || w.aircraft || "VT-FLB";
    var title = w.t || w.title || (w.k ? (w.k + " Maintenance") : "") || (w.kind ? (w.kind + " Maintenance") : "Routine Inspection");
    var ata = w.ata || "ATA-05";
    var priority = w.p || w.priority || "routine";
    var status = w.s || w.status || "open";
    var bay = w.b || w.bay || (w.station ? ("Station " + w.station) : "Hangar Bay 1");
    var day = w.d || w.day || "Mon";
    var tech = w.tech || w.assignedTo || "Field Technician";

    var steps = [];
    if (Array.isArray(w.steps) && w.steps.length) {
      steps = w.steps.map(function (s) {
        if (typeof s === "string") return { text: s, done: false };
        return { text: s.text || s.step || "Inspection item", done: !!s.done };
      });
    } else if (Array.isArray(w.c) && w.c.length) {
      steps = w.c.map(function (item) {
        if (Array.isArray(item)) {
          return { text: String(item[0]), done: item[1] === 1 };
        } else if (typeof item === "object" && item !== null) {
          return { text: item.text || item.step || "Inspection item", done: !!item.done };
        }
        return { text: String(item), done: false };
      });
    } else if (Array.isArray(w.checklist) && w.checklist.length) {
      steps = w.checklist.map(function (item) {
        if (Array.isArray(item)) {
          return { text: String(item[0]), done: item[1] === 1 };
        } else if (typeof item === "object" && item !== null) {
          return { text: item.text || item.step || "Inspection item", done: !!item.done };
        }
        return { text: String(item), done: false };
      });
    } else {
      var isDone = (status === "done" || status === "closed");
      steps = [
        { text: "Safety walkaround & visual exterior inspection", done: isDone },
        { text: "Verify fluid levels, hydraulic pressures & mechanical tolerances", done: isDone },
        { text: "Confirm electrical avionics bus telemetry", done: isDone },
        { text: "Sign technical aircraft logbook & certify airworthiness", done: isDone }
      ];
    }

    var isDone = (status === "done" || status === "closed");
    var doneCount = steps.filter(function (s) { return s.done; }).length;
    var totalCount = steps.length;
    var pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    return {
      raw: w,
      id: id,
      reg: reg,
      title: title,
      ata: ata,
      priority: priority,
      status: status,
      bay: bay,
      day: day,
      tech: tech,
      steps: steps,
      isDone: isDone,
      doneCount: doneCount,
      totalCount: totalCount,
      pct: pct
    };
  }

  // ============================================================================
  // 4. CURRENT USER RESOLVER
  // ============================================================================
  function getCurrentUser() {
    if (typeof window.getStoredUser === "function") {
      return window.getStoredUser();
    }
    try {
      var raw = localStorage.getItem("flightfix_current_user") || localStorage.getItem("flightfix_user");
      if (raw && raw !== "undefined" && raw !== "null") {
        var u = JSON.parse(raw);
        if (u && (u.role || u.email || u.employeeId)) return u;
      }
    } catch (e) {}
    return null;
  }

  // ============================================================================
  // 5. MAIN ROUTER
  // ============================================================================
  function rDash() {
    var dashEl = getEl("dash");
    if (!dashEl) return;

    var user = getCurrentUser();
    if (!user) {
      dashEl.style.display = "none";
      dashEl.classList.remove("on");
      if (typeof window.go === "function") {
        window.go("login");
      }
      return;
    }

    dashEl.classList.add("on");
    dashEl.style.display = "block";

    ensureState();
    var isAdmin = (typeof window.isUserAdmin === "function") ? window.isUserAdmin(user) : !!(user && user.role && user.role.toLowerCase().includes("admin"));

    if (isAdmin) {
      renderAdminDashboard(dashEl, user);
      syncAdminApi(dashEl, user);
    } else {
      renderTechnicianDashboard(dashEl, user);
      syncTechnicianApi(dashEl, user);
    }
  }

  // ============================================================================
  // 6. COMPANY ADMIN DASHBOARD
  // ============================================================================
  function renderAdminDashboard(dashEl, user) {
    var s = window.S;
    var acList = s.ac || [];
    var totalAc = acList.length;
    var aogList = acList.filter(function (a) { return a.aog === 1 || a.status === "aog"; });
    var readyCount = totalAc - aogList.length;
    var pct = totalAc ? Math.round((readyCount / totalAc) * 100) + "%" : "100%";

    var woList = (s.wo || []).map(normalizeWo);
    var openWoCount = woList.filter(function (w) { return !w.isDone; }).length;
    var pendingPos = (s.po || []).filter(function (p) { return p.s === "pending" || p.status === "pending"; });

    var htmlParts = [];

    // Header Banner
    htmlParts.push(
      "<div style='background:#1e293b;padding:16px 20px;border-radius:10px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;border:1px solid #334155;flex-wrap:wrap;gap:12px;'>",
        "<div>",
          "<div style='display:flex;align-items:center;gap:10px;margin-bottom:4px;'>",
            "<span style='font-size:22px;'>🏢</span>",
            "<h2 style='margin:0;color:#f8fafc;font-size:20px;font-weight:700;'>Company Admin Fleet Control</h2>",
            "<span style='background:#180709;color:#fca5a5;border:1px solid #3d1215;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;'>COMPANY ADMIN</span>",
          "</div>",
          "<div style='color:#94a3b8;font-size:13px;'>Logged in as: <strong>" + (user.name || user.email) + "</strong> | Full fleet oversight, hangar scheduling, task allotment & ERP sign-off.</div>",
        "</div>",
        "<div style='display:flex;gap:8px;'>",
          "<button onclick='go(\"plan\")' style='background:#0f172a;color:#38bdf8;border:1px solid #0284c7;padding:7px 14px;border-radius:6px;font-size:12px;cursor:pointer;font-weight:600;'>📅 Hangar Plan</button>",
          "<button onclick='go(\"inv\")' style='background:#0f172a;color:#10b981;border:1px solid #059669;padding:7px 14px;border-radius:6px;font-size:12px;cursor:pointer;font-weight:600;'>📦 Spares Inventory</button>",
          "<button onclick='go(\"erp\")' style='background:#0f172a;color:#f59e0b;border:1px solid #d97706;padding:7px 14px;border-radius:6px;font-size:12px;cursor:pointer;font-weight:600;'>💼 ERP & Orders</button>",
        "</div>",
      "</div>"
    );

    // KPI Summary Cards
    htmlParts.push(
      "<div style='display:grid;grid-template-columns:repeat(auto-fit, minmax(210px, 1fr));gap:16px;margin-bottom:24px;'>",
        "<div style='background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:16px;'>",
          "<div style='color:#94a3b8;font-size:12px;text-transform:uppercase;font-weight:600;'>Fleet Availability</div>",
          "<div style='color:#38bdf8;font-size:28px;font-weight:700;margin:6px 0;'>" + pct + "</div>",
          "<div style='font-size:12px;color:" + (aogList.length > 0 ? "#f87171" : "#4ade80") + ";font-weight:600;'>",
            (aogList.length > 0 ? "⚠️ " + aogList.length + " Grounded (AOG)" : "✓ 100% Airworthy"),
          "</div>",
        "</div>",

        "<div style='background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:16px;'>",
          "<div style='color:#94a3b8;font-size:12px;text-transform:uppercase;font-weight:600;'>Open Maintenance Tasks</div>",
          "<div style='color:#818cf8;font-size:28px;font-weight:700;margin:6px 0;'>" + openWoCount + "</div>",
          "<div style='font-size:12px;color:#94a3b8;'>Assigned across hangar bays</div>",
        "</div>",

        "<div style='background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:16px;'>",
          "<div style='color:#94a3b8;font-size:12px;text-transform:uppercase;font-weight:600;'>Pending PO Approvals</div>",
          "<div style='color:#fbbf24;font-size:28px;font-weight:700;margin:6px 0;'>" + pendingPos.length + "</div>",
          "<div style='font-size:12px;color:#94a3b8;'>Requires administrative sign-off</div>",
        "</div>",

        "<div style='background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:16px;'>",
          "<div style='color:#94a3b8;font-size:12px;text-transform:uppercase;font-weight:600;'>Active Fleet Size</div>",
          "<div style='color:#34d399;font-size:28px;font-weight:700;margin:6px 0;'>" + totalAc + " Tails</div>",
          "<div style='font-size:12px;color:#94a3b8;'>" + readyCount + " in commercial service</div>",
        "</div>",
      "</div>"
    );

    // Admin Grounded (AOG) vs Serviceable Status Banner (Dark Red / Dark Green)
    if (aogList.length > 0) {
      htmlParts.push(
        "<div style='background:#150507;border:1px solid #380f12;border-radius:8px;padding:14px 18px;margin-bottom:24px;'>",
          "<div style='display:flex;align-items:center;gap:10px;margin-bottom:6px;'>",
            "<span style='font-size:18px;'>🚨</span>",
            "<h3 style='margin:0;color:#fca5a5;font-size:15px;font-weight:700;'>FLEET ALERT: AIRCRAFT GROUNDED (AOG)</h3>",
          "</div>",
          "<p style='color:#fecaca;font-size:13px;margin:0 0 10px 0;'>The following commercial aircraft are currently grounded (AOG) and restricted from flight operations:</p>",
          "<div style='display:flex;flex-wrap:wrap;gap:8px;'>" +
            aogList.map(function (a) {
              var reg = a.r || a.reg;
              var model = a.m || a.model || "Commercial Flight";
              return "<div style='background:#20080a;border:1px solid #4a1317;color:#fca5a5;padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600;'>✈️ " + reg + " (" + model + ")</div>";
            }).join("") +
          "</div>",
        "</div>"
      );
    } else {
      htmlParts.push(
        "<div style='background:#04120d;border:1px solid #0b2e21;border-radius:8px;padding:12px 16px;margin-bottom:24px;color:#86efac;font-size:13px;display:flex;align-items:center;gap:8px;'>",
          "<span>✓</span> All assigned commercial aircraft are serviceable. Fleet airworthiness is at 100%.",
        "</div>"
      );
    }

    // Section 1: Allot Work Order to Technician (Admin Task Giver)
    htmlParts.push(
      "<div style='background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:20px;margin-bottom:24px;'>",
        "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;'>",
          "<div>",
            "<h3 style='margin:0 0 4px 0;color:#f8fafc;font-size:16px;'>⚡ Assign Maintenance Task to Field Technician</h3>",
            "<p style='margin:0;color:#94a3b8;font-size:13px;'>Dispatch inspections and maintenance directly to technicians. Tasks instantly reflect on their workbench.</p>",
          "</div>",
        "</div>",
        "<form onsubmit='window.allotWorkOrder(event)' style='display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:14px;align-items:end;'>",
          "<div>",
            "<label style='display:block;font-size:12px;color:#94a3b8;margin-bottom:4px;'>Target Aircraft</label>",
            "<select id='allot-ac' style='width:100%;padding:8px 10px;background:#1e293b;color:#f8fafc;border:1px solid #334155;border-radius:6px;'>",
              acList.map(function (a) {
                var reg = a.r || a.reg;
                var model = a.m || a.model || "";
                return "<option value='" + reg + "'>" + reg + (model ? " (" + model + ")" : "") + "</option>";
              }).join(""),
            "</select>",
          "</div>",
          "<div>",
            "<label style='display:block;font-size:12px;color:#94a3b8;margin-bottom:4px;'>Task / Inspection Description</label>",
            "<input id='allot-desc' type='text' placeholder='e.g., A-Check Turnaround or Hydraulic Line Check' required style='width:100%;padding:8px 10px;background:#1e293b;color:#f8fafc;border:1px solid #334155;border-radius:6px;'/>",
          "</div>",
          "<div>",
            "<label style='display:block;font-size:12px;color:#94a3b8;margin-bottom:4px;'>Assign to Technician</label>",
            "<select id='allot-tech' style='width:100%;padding:8px 10px;background:#1e293b;color:#f8fafc;border:1px solid #334155;border-radius:6px;'>",
              "<option value='Field Technician' selected>Field Technician (Ramp / Hangar)</option>",
              "<option value='Marcus Vance'>Marcus Vance (Lead A&P Powerplant)</option>",
              "<option value='Elena Rostova'>Elena Rostova (Avionics Specialist)</option>",
              "<option value='Lead AME'>Lead AME (Aircraft Maintenance Engineer)</option>",
            "</select>",
          "</div>",
          "<div>",
            "<label style='display:block;font-size:12px;color:#94a3b8;margin-bottom:4px;'>Hangar Bay / Location</label>",
            "<select id='allot-bay' style='width:100%;padding:8px 10px;background:#1e293b;color:#f8fafc;border:1px solid #334155;border-radius:6px;'>",
              "<option value='Bay 1'>Hangar Bay 1</option>",
              "<option value='Bay 2'>Hangar Bay 2</option>",
              "<option value='Bay 3'>Hangar Bay 3</option>",
              "<option value='Bay 4'>Hangar Bay 4</option>",
              "<option value='Ramp Stand'>Ramp Stand (Transit)</option>",
            "</select>",
          "</div>",
          "<div>",
            "<label style='display:block;font-size:12px;color:#94a3b8;margin-bottom:4px;'>Priority</label>",
            "<select id='allot-prio' style='width:100%;padding:8px 10px;background:#1e293b;color:#f8fafc;border:1px solid #334155;border-radius:6px;'>",
              "<option value='routine'>Routine</option>",
              "<option value='high'>High Priority</option>",
              "<option value='urgent'>Urgent (AOG Risk)</option>",
            "</select>",
          "</div>",
          "<div>",
            "<button type='submit' style='width:100%;background:#2563eb;color:#fff;border:none;padding:10px;border-radius:6px;font-weight:600;font-size:13px;cursor:pointer;'>Assign Task ⚡</button>",
          "</div>",
        "</form>",
      "</div>"
    );

    // Section 2: Fleet Airworthiness & Grounding Controls
    htmlParts.push(
      "<div style='background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:20px;margin-bottom:24px;'>",
        "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;'>",
          "<h3 style='margin:0;color:#f8fafc;font-size:16px;'>✈️ Fleet Airworthiness & Operational Status</h3>",
          "<span style='color:#94a3b8;font-size:12px;'>One-click Ground / Release toggle</span>",
        "</div>",
        "<div style='overflow-x:auto;'>",
          "<table style='width:100%;border-collapse:collapse;font-size:13px;text-align:left;'>",
            "<thead>",
              "<tr style='border-bottom:1px solid #334155;color:#94a3b8;'>",
                "<th style='padding:10px 8px;'>Tail Number</th>",
                "<th style='padding:10px 8px;'>Model</th>",
                "<th style='padding:10px 8px;'>Route / Station</th>",
                "<th style='padding:10px 8px;'>Flight Hours</th>",
                "<th style='padding:10px 8px;'>Airworthiness</th>",
                "<th style='padding:10px 8px;text-align:right;'>Admin Action</th>",
              "</tr>",
            "</thead>",
            "<tbody>"
    );

    acList.forEach(function (a) {
      var isAog = a.aog === 1 || a.status === "aog";
      var reg = a.r || a.reg;
      var model = a.m || a.model || "Airframe";
      var route = a.route || a.st || a.location || "JFK";
      var hours = (a.h !== undefined ? a.h : (a.flightHours || 0)).toFixed(1);

      htmlParts.push(
        "<tr style='border-bottom:1px solid #1e293b;'>",
          "<td style='padding:10px 8px;font-weight:700;color:#38bdf8;'>" + reg + "</td>",
          "<td style='padding:10px 8px;color:#e2e8f0;'>" + model + "</td>",
          "<td style='padding:10px 8px;color:#cbd5e1;'>" + route + "</td>",
          "<td style='padding:10px 8px;color:#94a3b8;'>" + hours + " hrs</td>",
          "<td style='padding:10px 8px;'>",
            (isAog
              ? "<span style='background:#180709;color:#fca5a5;border:1px solid #3d1215;padding:3px 8px;border-radius:4px;font-weight:600;font-size:11px;'>⚠️ GROUNDED (AOG)</span>"
              : "<span style='background:#04140e;color:#86efac;border:1px solid #0d3b2a;padding:3px 8px;border-radius:4px;font-weight:600;font-size:11px;'>✓ SERVICEABLE</span>"),
          "</td>",
          "<td style='padding:10px 8px;text-align:right;'>",
            "<button onclick='window.toggleFlightAog(\"" + reg + "\")' style='background:" + (isAog ? "#052419" : "#2d0b0f") + ";border:1px solid " + (isAog ? "#0c422f" : "#4a1317") + ";color:" + (isAog ? "#86efac" : "#fca5a5") + ";padding:5px 12px;border-radius:4px;font-size:12px;cursor:pointer;font-weight:600;'>",
              (isAog ? "Release to Service" : "Ground Aircraft"),
            "</button>",
          "</td>",
        "</tr>"
      );
    });

    htmlParts.push(
            "</tbody>",
          "</table>",
        "</div>",
      "</div>"
    );

    // Section 3: All Fleet Work Orders Overview
    htmlParts.push(
      "<div style='background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:20px;margin-bottom:24px;'>",
        "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;'>",
          "<h3 style='margin:0;color:#f8fafc;font-size:16px;'>📋 Fleet Maintenance Work Orders Overview</h3>",
          "<span style='color:#94a3b8;font-size:12px;'>" + woList.length + " total records</span>",
        "</div>",
        "<div style='overflow-x:auto;'>",
          "<table style='width:100%;border-collapse:collapse;font-size:13px;text-align:left;'>",
            "<thead>",
              "<tr style='border-bottom:1px solid #334155;color:#94a3b8;'>",
                "<th style='padding:10px 8px;'>WO ID</th>",
                "<th style='padding:10px 8px;'>Tail Number</th>",
                "<th style='padding:10px 8px;'>Task Title</th>",
                "<th style='padding:10px 8px;'>Location</th>",
                "<th style='padding:10px 8px;'>Assigned Tech</th>",
                "<th style='padding:10px 8px;'>Progress</th>",
                "<th style='padding:10px 8px;'>Status</th>",
              "</tr>",
            "</thead>",
            "<tbody>"
    );

    woList.forEach(function (w) {
      var isDone = w.isDone;
      var pColor = w.priority === "urgent" ? "#ef4444" : w.priority === "high" ? "#f97316" : "#38bdf8";

      htmlParts.push(
        "<tr style='border-bottom:1px solid #1e293b;'>",
          "<td style='padding:10px 8px;font-family:monospace;color:#a5b4fc;font-weight:600;'>#" + w.id + "</td>",
          "<td style='padding:10px 8px;font-weight:700;color:#38bdf8;'>" + w.reg + "</td>",
          "<td style='padding:10px 8px;color:#e2e8f0;'>" + w.title + "</td>",
          "<td style='padding:10px 8px;color:#94a3b8;'>" + w.bay + "</td>",
          "<td style='padding:10px 8px;color:#cbd5e1;'>👤 " + w.tech + "</td>",
          "<td style='padding:10px 8px;color:#94a3b8;'>" + w.doneCount + "/" + w.totalCount + " (" + w.pct + "%)</td>",
          "<td style='padding:10px 8px;'>",
            (isDone
              ? "<span style='background:#04140e;color:#86efac;border:1px solid #0d3b2a;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:600;'>✓ DONE</span>"
              : "<span style='background:#1e3a8a;color:#93c5fd;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:600;'>IN PROGRESS</span>"),
          "</td>",
        "</tr>"
      );
    });

    htmlParts.push(
            "</tbody>",
          "</table>",
        "</div>",
      "</div>"
    );

    // Section 4: ERP Spares Procurement & Approvals
    htmlParts.push(
      "<div style='background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:20px;'>",
        "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;'>",
          "<div>",
            "<h3 style='margin:0 0 4px 0;color:#f8fafc;font-size:16px;'>📦 ERP Spares & Procurement Sign-Off</h3>",
            "<p style='margin:0;color:#94a3b8;font-size:13px;'>Only Company Admins can order and sign off parts from suppliers. Approved parts replenish stock for technicians.</p>",
          "</div>",
          "<button onclick='go(\"erp\")' style='background:#334155;color:#e2e8f0;border:none;padding:6px 12px;border-radius:6px;font-size:12px;cursor:pointer;'>Go to ERP Portal ➔</button>",
        "</div>",
        (pendingPos.length === 0
          ? "<p style='color:#4ade80;font-size:13px;margin:0;'>✓ All pending purchase orders have been signed off. Spares stock is up to date.</p>"
          : "<div style='display:grid;gap:10px;'>" +
              pendingPos.map(function (po) {
                var pId = po.id;
                var partName = po.p || po.partName || "Aircraft Component";
                var qty = po.q || po.quantity || 1;
                var vendor = po.v || po.vendor || "Supplier";
                var cost = (po.c || po.cost || 0).toLocaleString();

                return (
                  "<div style='background:#1e293b;padding:12px 16px;border-radius:6px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;'>" +
                    "<div>" +
                      "<div style='font-weight:600;color:#f8fafc;'>" + pId + ": " + partName + " (Qty: " + qty + ")</div>" +
                      "<div style='font-size:12px;color:#94a3b8;'>Supplier: " + vendor + " | Total: $" + cost + "</div>" +
                    "</div>" +
                    "<div style='display:flex;gap:8px;'>" +
                      "<button onclick='window.approvePo(\"" + pId + "\")' style='background:#052419;border:1px solid #0c422f;color:#86efac;padding:6px 14px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;'>Approve Order ✓</button>" +
                      "<button onclick='window.rejectPo(\"" + pId + "\")' style='background:#2d0b0f;border:1px solid #4a1317;color:#fca5a5;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;'>Reject</button>" +
                    "</div>" +
                  "</div>"
                );
              }).join("") +
            "</div>"),
      "</div>"
    );

    dashEl.innerHTML = htmlParts.join("");
  }

  // ============================================================================
  // 7. FIELD TECHNICIAN DASHBOARD (Human-Friendly & Intuitive)
  // ============================================================================
  function renderTechnicianDashboard(dashEl, user) {
    var s = window.S;
    var acList = s.ac || [];
    var aogList = acList.filter(function (a) { return a.aog === 1 || a.status === "aog"; });

    // Normalize all work orders
    var allWos = (s.wo || []).map(normalizeWo);

    // Show active and assigned tasks
    var openTasks = allWos.filter(function (w) { return !w.isDone; });
    var doneTasks = allWos.filter(function (w) { return w.isDone; });

    var htmlParts = [];

    // Friendly Greeting Header
    htmlParts.push(
      "<div style='background:#1e293b;padding:16px 20px;border-radius:10px;margin-bottom:20px;border:1px solid #334155;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;'>",
        "<div>",
          "<div style='display:flex;align-items:center;gap:10px;margin-bottom:4px;'>",
            "<span style='font-size:22px;'>👋</span>",
            "<h2 style='margin:0;color:#f8fafc;font-size:20px;font-weight:700;'>Welcome back, " + (user.name || "Technician") + "!</h2>",
            "<span style='background:#04140e;color:#86efac;border:1px solid #0d3b2a;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;'>FIELD TECHNICIAN</span>",
          "</div>",
          "<div style='color:#94a3b8;font-size:13px;'>Station: <strong>" + (user.station || "JFK Hub") + "</strong> | Here are the maintenance tasks assigned to you by Dispatch & Company Admin.</div>",
        "</div>",
        "<div style='display:flex;gap:12px;align-items:center;'>",
          "<span style='background:#0f172a;color:#38bdf8;padding:6px 14px;border-radius:6px;font-size:12px;font-weight:600;border:1px solid #1e293b;'>📋 Active Tasks: " + openTasks.length + "</span>",
          "<span style='background:#0f172a;color:#4ade80;padding:6px 14px;border-radius:6px;font-size:12px;font-weight:600;border:1px solid #1e293b;'>✓ Completed: " + doneTasks.length + "</span>",
        "</div>",
      "</div>"
    );

    // Grounded Aircraft Notice (AOG) - Dark Red & Dark Green
    if (aogList.length > 0) {
      htmlParts.push(
        "<div style='background:#150507;border:1px solid #380f12;border-radius:8px;padding:16px;margin-bottom:24px;'>",
          "<div style='display:flex;align-items:center;gap:10px;margin-bottom:6px;'>",
            "<span style='font-size:20px;'>🚨</span>",
            "<h3 style='margin:0;color:#fca5a5;font-size:15px;font-weight:700;'>AIRCRAFT GROUNDED (AOG) REQUIRING ATTENTION</h3>",
          "</div>",
          "<p style='color:#fecaca;font-size:13px;margin:0 0 10px 0;'>The following aircraft are held on ground until assigned maintenance tasks are completed and certified:</p>",
          "<div style='display:flex;flex-wrap:wrap;gap:8px;'>"
      );

      aogList.forEach(function (a) {
        var reg = a.r || a.reg;
        var model = a.m || a.model || "Commercial Flight";
        htmlParts.push(
          "<div style='background:#20080a;border:1px solid #4a1317;color:#fca5a5;padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600;'>",
            "✈️ " + reg + " (" + model + ")",
          "</div>"
        );
      });

      htmlParts.push("</div></div>");
    } else {
      htmlParts.push(
        "<div style='background:#04120d;border:1px solid #0b2e21;border-radius:8px;padding:12px 16px;margin-bottom:24px;color:#86efac;font-size:13px;display:flex;align-items:center;gap:8px;'>",
          "<span>✓</span> All assigned commercial aircraft are serviceable.",
        "</div>"
      );
    }

    // Active Assigned Tasks Section
    htmlParts.push(
      "<div style='margin-bottom:28px;'>",
        "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;'>",
          "<div>",
            "<h3 style='margin:0 0 2px 0;color:#f8fafc;font-size:17px;'>🛠️ Assigned Maintenance Tasks</h3>",
            "<small style='color:#94a3b8;'>Check off each inspection step below. Click 'Mark Complete' when all steps are verified.</small>",
          "</div>",
          "<span style='color:#94a3b8;font-size:12px;'>" + openTasks.length + " pending</span>",
        "</div>"
    );

    if (openTasks.length === 0) {
      htmlParts.push(
        "<div style='background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:28px;text-align:center;'>",
          "<div style='font-size:36px;margin-bottom:8px;'>🎉</div>",
          "<h4 style='margin:0 0 6px 0;color:#f8fafc;font-size:16px;'>All Tasks Completed!</h4>",
          "<p style='color:#94a3b8;font-size:13px;margin:0;'>You have no pending maintenance orders right now. Check back once Company Admin dispatches new work.</p>",
        "</div>"
      );
    } else {
      htmlParts.push("<div style='display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:16px;'>");

      openTasks.forEach(function (w) {
        var pColor = w.priority === "urgent" ? "#ef4444" : w.priority === "high" ? "#f97316" : "#38bdf8";

        htmlParts.push(
          "<div style='background:#0f172a;border:1px solid #334155;border-radius:10px;padding:18px;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 4px 12px rgba(0,0,0,0.2);'>",
            "<div>",
              // Card Top row
              "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;'>",
                "<span style='font-family:monospace;background:#1e293b;color:#a5b4fc;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:700;'>#" + w.id + "</span>",
                "<div style='display:flex;gap:6px;'>",
                  "<span style='background:#1e293b;color:#94a3b8;padding:2px 8px;border-radius:4px;font-size:11px;'>" + w.bay + "</span>",
                  "<span style='background:#1e293b;color:" + pColor + ";padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;text-transform:uppercase;'>" + w.priority + "</span>",
                "</div>",
              "</div>",

              // Aircraft & Task Title
              "<div style='margin-bottom:6px;'>",
                "<span style='color:#38bdf8;font-weight:700;font-size:16px;'>✈️ " + w.reg + "</span>",
              "</div>",
              "<h4 style='margin:0 0 6px 0;color:#f8fafc;font-size:15px;font-weight:600;line-height:1.3;'>" + w.title + "</h4>",
              "<div style='color:#64748b;font-size:12px;margin-bottom:12px;'>Assigned by Admin · " + w.day + "</div>",

              // Progress Bar
              "<div style='margin-bottom:12px;'>",
                "<div style='display:flex;justify-content:space-between;font-size:11px;color:#94a3b8;margin-bottom:4px;'>",
                  "<span>Inspection Progress:</span>",
                  "<span><strong>" + w.doneCount + " of " + w.totalCount + "</strong> (" + w.pct + "%)</span>",
                "</div>",
                "<div style='height:6px;background:#1e293b;border-radius:3px;overflow:hidden;'>",
                  "<div style='height:100%;width:" + w.pct + "%;background:" + (w.pct === 100 ? "#10b981" : "#38bdf8") + ";transition:width 0.3s ease;'></div>",
                "</div>",
              "</div>",

              // Step Checklist
              "<div style='background:#131c2e;border:1px solid #1e293b;border-radius:8px;padding:12px;margin-bottom:16px;'>",
                "<div style='font-size:11px;color:#94a3b8;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:8px;'>Inspection Steps:</div>"
        );

        w.steps.forEach(function (step, sIdx) {
          htmlParts.push(
            "<label style='display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;cursor:pointer;font-size:13px;color:" + (step.done ? "#94a3b8" : "#f1f5f9") + ";'>",
              "<input type='checkbox' " + (step.done ? "checked" : "") + " onchange='window.toggleStep(\"" + w.id + "\", " + sIdx + ")' style='margin-top:2px;cursor:pointer;width:16px;height:16px;accent-color:#10b981;' />",
              "<span style='" + (step.done ? "text-decoration:line-through;color:#64748b;" : "") + "'>" + step.text + "</span>",
            "</label>"
          );
        });

        htmlParts.push(
              "</div>",
            "</div>",

            // Card Bottom Action Button
            "<div style='border-top:1px solid #1e293b;padding-top:14px;display:flex;justify-content:space-between;align-items:center;'>",
              "<div>",
                "<span style='color:#fbbf24;font-size:12px;'>⏳ In Progress</span>",
              "</div>",
              "<button onclick='window.completeWorkOrder(\"" + w.id + "\")' style='background:#052419;border:1px solid #0c422f;color:#86efac;padding:9px 18px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 2px 6px rgba(6,78,59,0.4);'>",
                "Mark Complete ✓",
              "</button>",
            "</div>",
          "</div>"
        );
      });

      htmlParts.push("</div>");
    }
    htmlParts.push("</div>");

    // Completed Tasks Section
    if (doneTasks.length > 0) {
      htmlParts.push(
        "<div style='background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:20px;margin-bottom:28px;'>",
          "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;'>",
            "<h3 style='margin:0;color:#f8fafc;font-size:16px;'>✓ Completed & Certified Tasks</h3>",
            "<span style='color:#94a3b8;font-size:12px;'>" + doneTasks.length + " signed off</span>",
          "</div>",
          "<div style='display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:12px;'>"
      );

      doneTasks.forEach(function (w) {
        htmlParts.push(
          "<div style='background:#1e293b;padding:12px 14px;border-radius:6px;display:flex;justify-content:space-between;align-items:center;'>",
            "<div>",
              "<div style='font-weight:700;color:#38bdf8;font-size:13px;'>✈️ " + w.reg + " <span style='font-family:monospace;color:#a5b4fc;font-size:11px;'>#" + w.id + "</span></div>",
              "<div style='font-size:12px;color:#e2e8f0;margin-top:2px;'>" + w.title + "</div>",
              "<div style='font-size:11px;color:#94a3b8;margin-top:2px;'>Signed by " + w.tech + "</div>",
            "</div>",
            "<span style='background:#04140e;color:#86efac;border:1px solid #0d3b2a;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:600;'>CERTIFIED ✓</span>",
          "</div>"
        );
      });

      htmlParts.push("</div></div>");
    }

    // Section: Report Defect on the Tarmac (Simple Squawk Box)
    htmlParts.push(
      "<div style='background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:20px;'>",
        "<h3 style='margin:0 0 6px 0;color:#f8fafc;font-size:16px;'>📝 Report Defect / Ground Aircraft (Squawk)</h3>",
        "<p style='color:#94a3b8;font-size:13px;margin:0 0 16px 0;'>Found a problem during turnaround or walkaround inspection? Submit a report to inform Company Admin and ground aircraft if required.</p>",
        "<form onsubmit='window.reportSquawk(event)' style='display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:14px;align-items:end;'>",
          "<div>",
            "<label style='display:block;font-size:12px;color:#94a3b8;margin-bottom:4px;'>Aircraft Tail</label>",
            "<select id='squawk-ac' style='width:100%;padding:8px 10px;background:#1e293b;color:#f8fafc;border:1px solid #334155;border-radius:6px;'>",
              acList.map(function (a) {
                var reg = a.r || a.reg;
                var model = a.m || a.model || "";
                return "<option value='" + reg + "'>" + reg + (model ? " (" + model + ")" : "") + "</option>";
              }).join(""),
            "</select>",
          "</div>",
          "<div>",
            "<label style='display:block;font-size:12px;color:#94a3b8;margin-bottom:4px;'>Issue / Defect Description</label>",
            "<input id='squawk-desc' type='text' placeholder='e.g., Tire sidewall gouge found during walkaround' required style='width:100%;padding:8px 10px;background:#1e293b;color:#f8fafc;border:1px solid #334155;border-radius:6px;' />",
          "</div>",
          "<div>",
            "<label style='display:block;font-size:12px;color:#94a3b8;margin-bottom:4px;'>Urgency Level</label>",
            "<select id='squawk-aog' style='width:100%;padding:8px 10px;background:#1e293b;color:#f8fafc;border:1px solid #334155;border-radius:6px;'>",
              "<option value='0'>Routine defect (Non-critical)</option>",
              "<option value='1'>🚨 Critical defect — Ground immediately (AOG)</option>",
            "</select>",
          "</div>",
          "<div>",
            "<button type='submit' style='width:100%;background:#2d0b0f;border:1px solid #4a1317;color:#fca5a5;padding:10px;border-radius:6px;font-weight:600;font-size:13px;cursor:pointer;'>Log Defect Report 🚨</button>",
          "</div>",
        "</form>",
      "</div>"
    );

    dashEl.innerHTML = htmlParts.join("");
  }

  // ============================================================================
  // 8. BACKGROUND API SYNC
  // ============================================================================
  function syncAdminApi(dashEl, user) {
    fetch(ADMIN_API_URL)
      .then(function (res) {
        if (!res.ok) throw new Error("API status " + res.status);
        return res.json();
      })
      .then(function (data) {
        if (data && data.aircraft && data.aircraft.length) {
          window.S.ac = data.aircraft;
        }
        if (data && data.pendingPurchaseOrders) {
          window.S.po = data.pendingPurchaseOrders;
        }
        var curr = getCurrentUser();
        var isAdm = (typeof window.isUserAdmin === "function") ? window.isUserAdmin(curr) : !!(curr && curr.role && curr.role.toLowerCase().includes("admin"));
        if (isAdm) {
          renderAdminDashboard(dashEl, curr);
        }
      })
      .catch(function (err) {
        console.warn("[FlightFix] Using local state for Admin Dashboard:", err.message);
      });
  }

  function syncTechnicianApi(dashEl, user) {
    var url = TECH_API_URL + "?station=" + encodeURIComponent(user.station || "JFK");
    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error("API status " + res.status);
        return res.json();
      })
      .then(function (data) {
        if (data && data.assignedWorkOrders && data.assignedWorkOrders.length) {
          data.assignedWorkOrders.forEach(function (apiWo) {
            var exists = (window.S.wo || []).some(function (w) {
              return String(w.id || w.wo_id) === String(apiWo.id || apiWo.wo_id);
            });
            if (!exists) window.S.wo.push(apiWo);
          });
        }
        var curr = getCurrentUser();
        var isAdm = (typeof window.isUserAdmin === "function") ? window.isUserAdmin(curr) : !!(curr && curr.role && curr.role.toLowerCase().includes("admin"));
        if (!isAdm) {
          renderTechnicianDashboard(dashEl, curr);
        }
      })
      .catch(function (err) {
        console.warn("[FlightFix] Using local state for Tech Dashboard:", err.message);
      });
  }

  // ============================================================================
  // 9. INTERACTIVE ACTIONS (Exposed to window)
  // ============================================================================
  window.toggleFlightAog = function (reg) {
    ensureState();
    var flight = (window.S.ac || []).find(function (a) { return (a.r === reg || a.reg === reg); });
    if (flight) {
      flight.aog = (flight.aog === 1 || flight.status === "aog") ? 0 : 1;
      flight.status = (flight.aog === 1) ? "aog" : "in_service";
      notify(flight.r + (flight.aog === 1 ? " is now GROUNDED (AOG)" : " released to active service"));
      if (typeof window.save === "function") window.save();
      rDash();
    }
  };

  window.allotWorkOrder = function (e) {
    if (e && e.preventDefault) e.preventDefault();
    ensureState();
    var ac = (getEl("allot-ac") ? getEl("allot-ac").value : "").trim() || "VT-FLB";
    var desc = (getEl("allot-desc") ? getEl("allot-desc").value : "").trim() || "Routine Inspection";
    var prio = (getEl("allot-prio") ? getEl("allot-prio").value : "routine") || "routine";
    var tech = (getEl("allot-tech") ? getEl("allot-tech").value : "").trim() || "Field Technician";
    var bay = (getEl("allot-bay") ? getEl("allot-bay").value : "Bay 1") || "Bay 1";

    var newId = "WO-" + Math.floor(100 + Math.random() * 900);
    var defaultSteps = [
      { text: "Safety tagout & preliminary walkaround", done: false },
      { text: "Execute component check per maintenance manual", done: false },
      { text: "Functional test & logbook airworthiness sign-off", done: false }
    ];
    var checklistPairs = defaultSteps.map(function(s) { return [s.text, 0]; });

    var newWo = {
      id: newId,
      wo_id: newId,
      a: ac,
      r: ac,
      aircraft: ac,
      t: desc,
      title: desc,
      k: desc,
      kind: desc,
      ata: "ATA-05",
      p: prio,
      priority: prio,
      s: "open",
      status: "open",
      tech: tech,
      assignedTo: tech,
      b: bay,
      bay: bay,
      d: "Mon",
      day: "Mon",
      steps: defaultSteps,
      c: checklistPairs,
      checklist: checklistPairs
    };

    if (!window.S.wo) window.S.wo = [];
    window.S.wo.unshift(newWo);
    if (typeof window.save === "function") window.save();

    // POST to Django Backend
    fetch('/api/workorders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: newId,
        aircraft: ac,
        kind: desc,
        title: desc,
        bay: bay,
        day: "Mon",
        priority: prio,
        assignedTo: tech,
        checklist: checklistPairs
      })
    }).catch(function(e) {});

    notify("✓ Task " + newId + " assigned to " + tech + " on " + ac);
    rDash();
  };

  window.toggleStep = function (woId, stepIdx) {
    ensureState();
    var wo = (window.S.wo || []).find(function (w) {
      return String(w.id || w.wo_id) === String(woId);
    });
    if (!wo) return;

    var norm = normalizeWo(wo);
    if (norm.steps && norm.steps[stepIdx]) {
      norm.steps[stepIdx].done = !norm.steps[stepIdx].done;
    }

    wo.steps = norm.steps;
    wo.c = norm.steps.map(function (s) { return [s.text, s.done ? 1 : 0]; });
    wo.checklist = wo.c;

    if (wo.s === "open") {
      wo.s = "progress";
      wo.status = "progress";
    }

    if (typeof window.save === "function") window.save();

    // Sync to Django Backend
    fetch('/api/workorders/' + encodeURIComponent(woId) + '/checklist', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemIndex: stepIdx, completed: norm.steps[stepIdx].done })
    }).catch(function(e) {});

    rDash();
  };

  window.completeWorkOrder = function (woId) {
    ensureState();
    var wo = (window.S.wo || []).find(function (w) {
      return String(w.id || w.wo_id) === String(woId);
    });
    if (wo) {
      wo.s = "done";
      wo.status = "done";
      if (wo.steps) {
        wo.steps.forEach(function (s) { s.done = true; });
      }
      if (wo.c) {
        wo.c = wo.c.map(function (pair) {
          return [Array.isArray(pair) ? pair[0] : String(pair), 1];
        });
      }
      if (wo.checklist) {
        wo.checklist = wo.c;
      }

      var reg = wo.r || wo.a || wo.aircraft;
      if (reg && window.S.ac) {
        var plane = window.S.ac.find(function (a) {
          return a.r === reg || a.reg === reg;
        });
        if (plane) {
          plane.aog = 0;
          plane.status = "in_service";
        }
      }

      if (typeof window.save === "function") window.save();

      // POST to Django Backend Signoff
      fetch('/api/workorders/' + encodeURIComponent(woId) + '/signoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signoffNotes: "Task completed and certified by Field Technician." })
      }).catch(function(e) {});

      notify("✓ Task #" + woId + " marked as COMPLETED & certified!");
      rDash();
    }
  };

  window.reportSquawk = function (e) {
    if (e && e.preventDefault) e.preventDefault();
    ensureState();
    var ac = (getEl("squawk-ac") ? getEl("squawk-ac").value : "VT-FLB");
    var desc = (getEl("squawk-desc") ? getEl("squawk-desc").value : "").trim();
    var isAog = parseInt(getEl("squawk-aog") ? getEl("squawk-aog").value : "0", 10);

    if (!desc) return notify("Please describe the issue or defect found.");

    var newId = "WO-" + Math.floor(100 + Math.random() * 900);
    var defaultSteps = [
      { text: "Inspect defect area & assess limits per maintenance manual", done: false },
      { text: "Perform defect rectification or deferral per MEL", done: false },
      { text: "Post-rectification operational test & logbook entry", done: false }
    ];
    var checklistPairs = defaultSteps.map(function(s) { return [s.text, 0]; });

    var newWo = {
      id: newId,
      wo_id: newId,
      r: ac,
      a: ac,
      aircraft: ac,
      t: desc,
      title: desc,
      k: "Ramp Defect Check",
      kind: "Ramp Defect Check",
      ata: "ATA-05",
      p: isAog ? "urgent" : "routine",
      priority: isAog ? "urgent" : "routine",
      s: "open",
      status: "open",
      tech: "Field Technician",
      assignedTo: "Field Technician",
      b: "Ramp Stand",
      bay: "Ramp Stand",
      d: "Mon",
      day: "Mon",
      steps: defaultSteps,
      c: checklistPairs,
      checklist: checklistPairs
    };

    window.S.wo.unshift(newWo);

    if (isAog) {
      var plane = (window.S.ac || []).find(function (a) { return a.r === ac || a.reg === ac; });
      if (plane) {
        plane.aog = 1;
        plane.status = "aog";
      }
      notify("🚨 URGENT: " + ac + " has been GROUNDED (AOG) and defect reported!");
    } else {
      notify("✓ Defect report submitted for " + ac + " (" + newId + ")");
    }

    if (typeof window.save === "function") window.save();

    // POST to Django Backend
    fetch('/api/workorders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: newId,
        aircraft: ac,
        kind: desc,
        title: desc,
        bay: "Ramp Stand",
        day: "Mon",
        priority: isAog ? "urgent" : "routine",
        assignedTo: "Field Technician",
        checklist: checklistPairs
      })
    }).catch(function(e) {});

    rDash();
  };

  window.approvePo = function (poId) {
    ensureState();
    var po = (window.S.po || []).find(function (p) { return String(p.id) === String(poId); });
    if (po) {
      po.s = "approved";
      po.status = "approved";
      if (typeof window.save === "function") window.save();

      fetch('/api/procurement/' + encodeURIComponent(poId) + '/approve', {
        method: 'POST'
      }).catch(function(e) {});

      notify("✓ Purchase Order " + poId + " approved for procurement");
      rDash();
    }
  };

  window.rejectPo = function (poId) {
    ensureState();
    var po = (window.S.po || []).find(function (p) { return String(p.id) === String(poId); });
    if (po) {
      po.s = "rejected";
      po.status = "rejected";
      if (typeof window.save === "function") window.save();
      notify("Purchase Order " + poId + " rejected");
      rDash();
    }
  };

  // Expose router globally
  window.rDash = rDash;
  window.renderDashboard = rDash;

  // Run immediately if DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", rDash);
  } else {
    rDash();
  }
})();
