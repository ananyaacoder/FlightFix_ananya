    (function () {
      "use strict";

      // 1. API CONFIGURATION & HELPERS
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

      // 2. SEED STATE SAFEGUARD (Guarantees data is never blank)
      function ensureState() {
        if (!window.S) window.S = {};
        var s = window.S;

        if (!s.ac || !s.ac.length) {
          s.ac = [
            { r: "VT-BLR", m: "Airbus A320neo", h: 2840.5, c: 1420, aog: 0, st: "JFK", route: "JFK - LHR", assignedTech: "technician@flightfix.aero" },
            { r: "VT-ALX", m: "Boeing 737-800", h: 4120.2, c: 2210, aog: 1, st: "ORD", route: "ORD - LAX", assignedTech: "technician@flightfix.aero" },
            { r: "VT-DEL", m: "Airbus A350-900", h: 1250.0, c: 610,  aog: 0, st: "JFK", route: "JFK - DXB", assignedTech: "line.tech@flightfix.aero" },
            { r: "VT-BOM", m: "Boeing 787-9",   h: 3310.8, c: 1540, aog: 0, st: "DFW", route: "DFW - NRT", assignedTech: "tech@flightfix.aero" }
          ];
        }

        if (!s.wo || !s.wo.length) {
          s.wo = [
            {
              id: "WO-101",
              r: "VT-ALX",
              t: "Hydraulic leak check on left main actuator",
              s: "in_progress",
              p: "urgent",
              ata: "ATA-29",
              tech: "technician@flightfix.aero",
              station: "ORD",
              steps: [
                { text: "Depressurize hydraulic reservoir B", done: true },
                { text: "Inspect return B-nut torque", done: false },
                { text: "Perform 3000 PSI leak pressure test", done: false }
              ]
            },
            {
              id: "WO-102",
              r: "VT-BLR",
              t: "Turnaround line transit inspection",
              s: "open",
              p: "medium",
              ata: "ATA-05",
              tech: "technician@flightfix.aero",
              station: "JFK",
              steps: [
                { text: "Perform walkaround inspection", done: false },
                { text: "Check main gear tire tread depth", done: false },
                { text: "Sign technical flight logbook", done: false }
              ]
            },
            {
              id: "WO-103",
              r: "VT-DEL",
              t: "Avionics VOR/ILS calibration",
              s: "done",
              p: "low",
              ata: "ATA-34",
              tech: "technician@flightfix.aero",
              station: "JFK",
              steps: [
                { text: "Connect signal generator harness", done: true },
                { text: "Verify glideslope indicator deviation", done: true }
              ]
            }
          ];
        }

        if (!s.po || !s.po.length) {
          s.po = [
            { id: "PO-4091", p: "Hydraulic Actuator Seal Kit", q: 2, c: 840, s: "pending", v: "Parker Aerospace" },
            { id: "PO-4092", p: "Carbon Brake Assembly Rotor", q: 4, c: 14200, s: "pending", v: "Safran Landing Systems" }
          ];
        }
      }

      // 3. USER RESOLVER
      function getCurrentUser() {
        try {
          var raw = localStorage.getItem("flightfix_current_user") || localStorage.getItem("flightfix_user");
          if (raw && raw !== "undefined" && raw !== "null") {
            var u = JSON.parse(raw);
            if (u && (u.role || u.email)) return u;
          }
        } catch (e) {}
        return { name: "Crew Technician", role: "user", email: "technician@flightfix.aero", station: "JFK" };
      }

      // 4. MAIN ROUTER
      function rDash() {
        var dashEl = getEl("dash");
        if (!dashEl) return;

        dashEl.classList.add("on");
        dashEl.style.display = "block";

        ensureState();
        var user = getCurrentUser();
        var isAdmin = user.role && user.role.toLowerCase().includes("admin");

        if (isAdmin) {
          renderAdminDashboard(dashEl, user);
          syncAdminApi(dashEl, user);
        } else {
          renderTechnicianDashboard(dashEl, user);
          syncTechnicianApi(dashEl, user);
        }
      }

      // ============================================================================
      // 5. COMPANY ADMIN DASHBOARD
      // ============================================================================
      function renderAdminDashboard(dashEl, user) {
        var s = window.S;
        var acList = s.ac || [];
        var total = acList.length;
        var aogList = acList.filter(function (a) { return a.aog === 1; });
        var readyCount = total - aogList.length;
        var pct = total ? Math.round((readyCount / total) * 100) + "%" : "100%";

        var woList = s.wo || [];
        var openWoCount = woList.filter(function (w) { return w.s !== "done"; }).length;
        var pendingPos = (s.po || []).filter(function (p) { return p.s === "pending"; });

        var htmlParts = [];

        // Switcher Banner
        htmlParts.push(
          "<div style='background:#1e293b;padding:10px 16px;border-radius:8px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;border:1px solid #334155;'>",
            "<div style='display:flex;align-items:center;gap:10px;'>",
              "<span style='color:#94a3b8;font-size:13px;'>Active Role:</span>",
              "<span style='background:#2563eb;color:#fff;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;'>Company Admin</span>",
              "<span style='color:#64748b;font-size:12px;'>Logged in as: " + (user.name || user.email) + "</span>",
            "</div>",
            "<div>",
              "<button onclick='window.switchDashboardRole(\"user\")' style='background:#334155;color:#e2e8f0;border:1px solid #475569;padding:6px 14px;border-radius:6px;font-size:12px;cursor:pointer;'>Switch to Field Tech View 🛠️</button>",
            "</div>",
          "</div>"
        );

        // Title
        htmlParts.push(
          "<div style='margin-bottom:20px;'>",
            "<h2 style='margin:0 0 4px 0;color:#f8fafc;font-size:24px;'>🏢 Company Admin Fleet Control</h2>",
            "<p style='margin:0;color:#94a3b8;font-size:14px;'>Executive fleet airworthiness, AOG groundings, work allotment, and Part-145 maintenance sign-off.</p>",
          "</div>"
        );

        // KPI Cards
        htmlParts.push(
          "<div style='display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:16px;margin-bottom:24px;'>",
            "<div style='background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:16px;'>",
              "<div style='color:#94a3b8;font-size:12px;text-transform:uppercase;font-weight:600;'>Fleet Availability</div>",
              "<div style='color:#38bdf8;font-size:28px;font-weight:700;margin:8px 0;'>" + pct + "</div>",
              "<div style='font-size:12px;color:" + (aogList.length > 0 ? "#f87171" : "#4ade80") + ";'>",
                (aogList.length > 0 ? "⚠️ " + aogList.length + " Aircraft Grounded (AOG)" : "✓ All Aircraft Airworthy"),
              "</div>",
            "</div>",

            "<div style='background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:16px;'>",
              "<div style='color:#94a3b8;font-size:12px;text-transform:uppercase;font-weight:600;'>Pending PO Approvals</div>",
              "<div style='color:#fbbf24;font-size:28px;font-weight:700;margin:8px 0;'>" + pendingPos.length + "</div>",
              "<div style='font-size:12px;color:#94a3b8;'>Requires administrative sign-off</div>",
            "</div>",

            "<div style='background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:16px;'>",
              "<div style='color:#94a3b8;font-size:12px;text-transform:uppercase;font-weight:600;'>Active Work Orders</div>",
              "<div style='color:#818cf8;font-size:28px;font-weight:700;margin:8px 0;'>" + openWoCount + "</div>",
              "<div style='font-size:12px;color:#94a3b8;'>Open Part-145 tasks</div>",
            "</div>",

            "<div style='background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:16px;'>",
              "<div style='color:#94a3b8;font-size:12px;text-transform:uppercase;font-weight:600;'>Commercial Fleet Size</div>",
              "<div style='color:#34d399;font-size:28px;font-weight:700;margin:8px 0;'>" + total + " Tails</div>",
              "<div style='font-size:12px;color:#94a3b8;'>" + readyCount + " serviceable in rotation</div>",
            "</div>",
          "</div>"
        );

        // Fleet Table
        htmlParts.push(
          "<div style='background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:20px;margin-bottom:24px;'>",
            "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;'>",
              "<h3 style='margin:0;color:#f8fafc;font-size:16px;'>✈️ Assigned Commercial Flights & Airworthiness</h3>",
              "<span style='color:#94a3b8;font-size:12px;'>Click Ground/Release to toggle AOG</span>",
            "</div>",
            "<div style='overflow-x:auto;'>",
              "<table style='width:100%;border-collapse:collapse;font-size:13px;text-align:left;'>",
                "<thead>",
                  "<tr style='border-bottom:1px solid #334155;color:#94a3b8;'>",
                    "<th style='padding:10px 8px;'>Tail Number</th>",
                    "<th style='padding:10px 8px;'>Model</th>",
                    "<th style='padding:10px 8px;'>Assigned Station / Route</th>",
                    "<th style='padding:10px 8px;'>Flight Hours</th>",
                    "<th style='padding:10px 8px;'>Airworthiness Status</th>",
                    "<th style='padding:10px 8px;text-align:right;'>Admin Action</th>",
                  "</tr>",
                "</thead>",
                "<tbody>"
        );

        acList.forEach(function (a) {
          var isAog = a.aog === 1;
          htmlParts.push(
            "<tr style='border-bottom:1px solid #1e293b;'>",
              "<td style='padding:10px 8px;font-weight:700;color:#38bdf8;'>" + a.r + "</td>",
              "<td style='padding:10px 8px;color:#e2e8f0;'>" + a.m + "</td>",
              "<td style='padding:10px 8px;color:#cbd5e1;'>" + (a.route || a.st || "JFK") + "</td>",
              "<td style='padding:10px 8px;color:#94a3b8;'>" + (a.h || 0).toFixed(1) + " hrs</td>",
              "<td style='padding:10px 8px;'>",
                (isAog
                  ? "<span style='background:#7f1d1d;color:#fca5a5;padding:3px 8px;border-radius:4px;font-weight:600;font-size:11px;'>⚠️ GROUNDED (AOG)</span>"
                  : "<span style='background:#14532d;color:#86efac;padding:3px 8px;border-radius:4px;font-weight:600;font-size:11px;'>✓ SERVICEABLE</span>"),
              "</td>",
              "<td style='padding:10px 8px;text-align:right;'>",
                "<button onclick='window.toggleFlightAog(\"" + a.r + "\")' style='background:" + (isAog ? "#059669" : "#dc2626") + ";color:#fff;border:none;padding:5px 12px;border-radius:4px;font-size:12px;cursor:pointer;font-weight:600;'>",
                  (isAog ? "Release to Service" : "Ground (AOG)"),
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

        // Work Allotment Form
        htmlParts.push(
          "<div style='background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:20px;margin-bottom:24px;'>",
            "<h3 style='margin:0 0 12px 0;color:#f8fafc;font-size:16px;'>📋 Allot Maintenance Work to Field Technicians</h3>",
            "<p style='color:#94a3b8;font-size:13px;margin:0 0 16px 0;'>Assign line maintenance, component inspections, or emergency work orders to ramp personnel.</p>",
            "<form onsubmit='window.allotWorkOrder(event)' style='display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:14px;align-items:end;'>",
              "<div>",
                "<label style='display:block;font-size:12px;color:#94a3b8;margin-bottom:4px;'>Aircraft / Flight</label>",
                "<select id='allot-ac' style='width:100%;padding:8px;background:#1e293b;color:#f8fafc;border:1px solid #334155;border-radius:4px;'>",
                  acList.map(function (a) { return "<option value='" + a.r + "'>" + a.r + " (" + a.m + ")</option>"; }).join(""),
                "</select>",
              "</div>",
              "<div>",
                "<label style='display:block;font-size:12px;color:#94a3b8;margin-bottom:4px;'>Task Description</label>",
                "<input id='allot-desc' type='text' placeholder='e.g., Replace O-ring seal on pump' required style='width:100%;padding:8px;background:#1e293b;color:#f8fafc;border:1px solid #334155;border-radius:4px;' />",
              "</div>",
              "<div>",
                "<label style='display:block;font-size:12px;color:#94a3b8;margin-bottom:4px;'>ATA Chapter</label>",
                "<select id='allot-ata' style='width:100%;padding:8px;background:#1e293b;color:#f8fafc;border:1px solid #334155;border-radius:4px;'>",
                  "<option value='ATA-29'>ATA-29 Hydraulics</option>",
                  "<option value='ATA-32'>ATA-32 Landing Gear</option>",
                  "<option value='ATA-34'>ATA-34 Navigation & Avionics</option>",
                  "<option value='ATA-05'>ATA-05 Periodic Checks</option>",
                  "<option value='ATA-72'>ATA-72 Engine Powerplant</option>",
                "</select>",
              "</div>",
              "<div>",
                "<label style='display:block;font-size:12px;color:#94a3b8;margin-bottom:4px;'>Priority</label>",
                "<select id='allot-prio' style='width:100%;padding:8px;background:#1e293b;color:#f8fafc;border:1px solid #334155;border-radius:4px;'>",
                  "<option value='urgent'>Urgent (AOG)</option>",
                  "<option value='high'>High</option>",
                  "<option value='medium' selected>Medium</option>",
                  "<option value='low'>Low / Scheduled</option>",
                "</select>",
              "</div>",
              "<div>",
                "<label style='display:block;font-size:12px;color:#94a3b8;margin-bottom:4px;'>Assign Technician / Station</label>",
                "<input id='allot-tech' type='text' value='technician@flightfix.aero' required style='width:100%;padding:8px;background:#1e293b;color:#f8fafc;border:1px solid #334155;border-radius:4px;'/>",
              "</div>",
              "<div>",
                "<button type='submit' style='width:100%;background:#2563eb;color:#fff;border:none;padding:9px;border-radius:4px;font-weight:600;cursor:pointer;'>Allot Work Order ⚡</button>",
              "</div>",
            "</form>",
          "</div>"
        );

        // Work Orders Report Table
        htmlParts.push(
          "<div style='background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:20px;margin-bottom:24px;'>",
            "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;'>",
              "<h3 style='margin:0;color:#f8fafc;font-size:16px;'>📊 Fleet Work Orders & Maintenance Report</h3>",
              "<span style='color:#94a3b8;font-size:12px;'>" + woList.length + " total records</span>",
            "</div>",
            "<div style='overflow-x:auto;'>",
              "<table style='width:100%;border-collapse:collapse;font-size:13px;text-align:left;'>",
                "<thead>",
                  "<tr style='border-bottom:1px solid #334155;color:#94a3b8;'>",
                    "<th style='padding:10px 8px;'>WO ID</th>",
                    "<th style='padding:10px 8px;'>Flight / Tail</th>",
                    "<th style='padding:10px 8px;'>Task Description</th>",
                    "<th style='padding:10px 8px;'>ATA</th>",
                    "<th style='padding:10px 8px;'>Priority</th>",
                    "<th style='padding:10px 8px;'>Assigned Tech</th>",
                    "<th style='padding:10px 8px;'>Status</th>",
                  "</tr>",
                "</thead>",
                "<tbody>"
        );

        woList.forEach(function (w) {
          var pColor = w.p === "urgent" ? "#ef4444" : w.p === "high" ? "#f97316" : "#38bdf8";
          var isDone = w.s === "done";
          htmlParts.push(
            "<tr style='border-bottom:1px solid #1e293b;'>",
              "<td style='padding:10px 8px;font-family:monospace;color:#a5b4fc;'>" + w.id + "</td>",
              "<td style='padding:10px 8px;font-weight:600;color:#f8fafc;'>" + w.r + "</td>",
              "<td style='padding:10px 8px;color:#e2e8f0;'>" + w.t + "</td>",
              "<td style='padding:10px 8px;color:#94a3b8;'>" + (w.ata || "ATA-00") + "</td>",
              "<td style='padding:10px 8px;'><span style='color:" + pColor + ";font-weight:600;text-transform:uppercase;font-size:11px;'>" + w.p + "</span></td>",
              "<td style='padding:10px 8px;color:#cbd5e1;'>" + (w.tech || "Ramp Tech") + "</td>",
              "<td style='padding:10px 8px;'>",
                (isDone
                  ? "<span style='background:#14532d;color:#86efac;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;'>DONE</span>"
                  : "<span style='background:#312e81;color:#c7d2fe;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;'>IN PROGRESS</span>"),
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

        // Purchase Orders Section
        htmlParts.push(
          "<div style='background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:20px;'>",
            "<h3 style='margin:0 0 12px 0;color:#f8fafc;font-size:16px;'>📦 Procurement & Purchase Orders (PO) Sign-Off</h3>",
            (pendingPos.length === 0
              ? "<p style='color:#4ade80;font-size:13px;margin:0;'>✓ All pending purchase orders have been signed off.</p>"
              : "<div style='display:grid;gap:10px;'>" +
                  pendingPos.map(function (po) {
                    return (
                      "<div style='background:#1e293b;padding:12px;border-radius:6px;display:flex;justify-content:space-between;align-items:center;'>" +
                        "<div>" +
                          "<div style='font-weight:600;color:#f8fafc;'>" + po.id + ": " + po.p + " (Qty: " + po.q + ")</div>" +
                          "<div style='font-size:12px;color:#94a3b8;'>Supplier: " + po.v + " | Cost: $" + (po.c || 0).toLocaleString() + "</div>" +
                        "</div>" +
                        "<div style='display:flex;gap:8px;'>" +
                          "<button onclick='window.approvePo(\"" + po.id + "\")' style='background:#10b981;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;'>Approve</button>" +
                          "<button onclick='window.rejectPo(\"" + po.id + "\")' style='background:#ef4444;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;'>Reject</button>" +
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
      // 6. FIELD TECHNICIAN DASHBOARD
      // ============================================================================
      function renderTechnicianDashboard(dashEl, user) {
        var s = window.S;
        var acList = s.ac || [];
        var aogList = acList.filter(function (a) { return a.aog === 1; });
        var woList = s.wo || [];

        var myTasks = woList.filter(function (w) {
          if (w.tech && w.tech.toLowerCase().includes("tech")) return true;
          if (w.station && user.station && w.station.toLowerCase() === user.station.toLowerCase()) return true;
          return true;
        });

        var htmlParts = [];

        // Switcher Banner
        htmlParts.push(
          "<div style='background:#1e293b;padding:10px 16px;border-radius:8px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;border:1px solid #334155;'>",
            "<div style='display:flex;align-items:center;gap:10px;'>",
              "<span style='color:#94a3b8;font-size:13px;'>Active Role:</span>",
              "<span style='background:#10b981;color:#fff;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;'>Field Technician</span>",
              "<span style='color:#64748b;font-size:12px;'>Station: " + (user.station || "JFK") + " | " + (user.name || user.email) + "</span>",
            "</div>",
            "<div>",
              "<button onclick='window.switchDashboardRole(\"admin\")' style='background:#334155;color:#e2e8f0;border:1px solid #475569;padding:6px 14px;border-radius:6px;font-size:12px;cursor:pointer;'>Switch to Admin View 🏢</button>",
            "</div>",
          "</div>"
        );

        // Title
        htmlParts.push(
          "<div style='margin-bottom:20px;'>",
            "<h2 style='margin:0 0 4px 0;color:#f8fafc;font-size:24px;'>🛠️ Field Technician Ramp Maintenance</h2>",
            "<p style='margin:0;color:#94a3b8;font-size:14px;'>Line maintenance tasks, step-by-step sign-offs, and urgent AOG grounding alerts.</p>",
          "</div>"
        );

        // Grounded AOG Emergency Banner
        if (aogList.length > 0) {
          htmlParts.push(
            "<div style='background:#450a0a;border:1px solid #ef4444;border-radius:8px;padding:16px;margin-bottom:24px;'>",
              "<div style='display:flex;align-items:center;gap:10px;margin-bottom:8px;'>",
                "<span style='font-size:20px;'>🚨</span>",
                "<h3 style='margin:0;color:#fca5a5;font-size:16px;'>GROUNDED AOG AIRCRAFT REQUIRING IMMEDIATE ATTENTION</h3>",
              "</div>",
              "<p style='color:#fecaca;font-size:13px;margin:0 0 12px 0;'>The following aircraft are currently AOG (Aircraft On Ground) and grounded from commercial departure until repairs and sign-off areverified.</p>",
              "<div style='display:flex;flex-wrap:wrap;gap:10px;'>"
          );

          aogList.forEach(function (a) {
            htmlParts.push(
              "<div style='background:#7f1d1d;color:#fff;padding:8px 14px;border-radius:6px;font-size:13px;'>",
                "<strong>" + a.r + "</strong> (" + a.m + ") - Station: " + (a.st || "ORD"),
              "</div>"
            );
          });

          htmlParts.push("</div></div>");
        } else {
          htmlParts.push(
            "<div style='background:#064e3b;border:1px solid #10b981;border-radius:8px;padding:12px 16px;margin-bottom:24px;color:#a7f3d0;font-size:13px;'>",
              "✓ No aircraft currently grounded at your station. Fleet is fully airworthy.",
            "</div>"
          );
        }

        // Work Orders Checklists
        htmlParts.push(
          "<div style='margin-bottom:24px;'>",
            "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;'>",
              "<h3 style='margin:0;color:#f8fafc;font-size:16px;'>📋 My Assigned Maintenance Work Orders</h3>",
              "<span style='color:#94a3b8;font-size:12px;'>" + myTasks.length + " tasks assigned</span>",
            "</div>",
            "<div style='display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:16px;'>"
        );

        myTasks.forEach(function (w) {
          var isDone = w.s === "done";
          var pColor = w.p === "urgent" ? "#ef4444" : w.p === "high" ? "#f97316" : "#38bdf8";
          var steps = w.steps || [
            { text: "Perform initial visual inspection", done: isDone },
            { text: "Verify torque specifications", done: isDone },
            { text: "Log maintenance action in flight log", done: isDone }
          ];

          htmlParts.push(
            "<div style='background:#0f172a;border:1px solid " + (isDone ? "#1e293b" : "#334155") + ";border-radius:8px;padding:16px;display:flex;flex-direction:column;justify-content:space-between;'>",
              "<div>",
                "<div style='display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;'>",
                  "<span style='font-family:monospace;color:#a5b4fc;font-size:12px;font-weight:600;'>" + w.id + "</span>",
                  "<div style='display:flex;gap:6px;'>",
                    "<span style='background:#1e293b;color:#cbd5e1;padding:2px 6px;border-radius:4px;font-size:11px;'>" + (w.ata || "ATA-00") + "</span>",
                    "<span style='background:#1e293b;color:" + pColor + ";padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;text-transform:uppercase;'>" + w.p + "</span>",
                  "</div>",
                "</div>",
                "<h4 style='margin:0 0 4px 0;color:#f8fafc;font-size:15px;'>" + w.t + "</h4>",
                "<div style='color:#94a3b8;font-size:12px;margin-bottom:12px;'>Tail: <strong style='color:#38bdf8;'>" + w.r + "</strong> | Station: " + (w.station || "JFK") + "</div>",

                "<div style='background:#1e293b;border-radius:6px;padding:10px;margin-bottom:14px;'>",
                  "<div style='font-size:11px;color:#94a3b8;text-transform:uppercase;margin-bottom:6px;font-weight:600;'>Inspection Checklist:</div>"
          );

          steps.forEach(function (step, sIdx) {
            htmlParts.push(
              "<div style='display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:12px;color:" + (step.done ? "#94a3b8" : "#f1f5f9") + ";'>",
                "<input type='checkbox' " + (step.done ? "checked" : "") + " onchange='window.toggleStep(\"" + w.id + "\", " + sIdx + ")' style='cursor:pointer;' />",
                "<span style='" + (step.done ? "text-decoration:line-through;color:#64748b;" : "") + "'>" + step.text + "</span>",
              "</div>"
            );
          });

          htmlParts.push(
                "</div>",
              "</div>",

              "<div style='border-top:1px solid #1e293b;padding-top:12px;display:flex;justify-content:space-between;align-items:center;'>",
                "<div>",
                  (isDone
                    ? "<span style='color:#4ade80;font-size:12px;font-weight:600;'>✓ Task Completed & Signed</span>"
                    : "<span style='color:#fbbf24;font-size:12px;'>⏳ In Progress</span>"),
                "</div>",
                (isDone
                  ? "<button disabled style='background:#1e293b;color:#64748b;border:none;padding:6px 12px;border-radius:4px;font-size:12px;'>Signed Off</button>"
                  : "<button onclick='window.completeWorkOrder(\"" + w.id + "\")' style='background:#10b981;color:#fff;border:none;padding:6px 14px;border-radius:4px;font-size:12px;font-weight:600;cursor:pointer;'>Sign Off Task ✓</button>"),
              "</div>",
            "</div>"
          );
        });

        htmlParts.push("</div></div>");

        // Defect Squawk Form
        htmlParts.push(
          "<div style='background:#0f172a;border:1px solid #1e293b;border-radius:8px;padding:20px;'>",
            "<h3 style='margin:0 0 8px 0;color:#f8fafc;font-size:16px;'>📝 Report Defect / Ground Aircraft (Squawk)</h3>",
            "<p style='color:#94a3b8;font-size:13px;margin:0 0 16px 0;'>Found a defect on the ramp? Submit a squawk report to notify dispatch and ground aircraft if unsafe to fly.</p>",
            "<form onsubmit='window.reportSquawk(event)' style='display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:14px;align-items:end;'>",
              "<div>",
                "<label style='display:block;font-size:12px;color:#94a3b8;margin-bottom:4px;'>Aircraft Tail</label>",
                "<select id='squawk-ac' style='width:100%;padding:8px;background:#1e293b;color:#f8fafc;border:1px solid #334155;border-radius:4px;'>",
                  acList.map(function (a) { return "<option value='" + a.r + "'>" + a.r + " (" + a.m + ")</option>"; }).join(""),
                "</select>",
              "</div>",
              "<div>",
                "<label style='display:block;font-size:12px;color:#94a3b8;margin-bottom:4px;'>Defect Description</label>",
                "<input id='squawk-desc' type='text' placeholder='e.g., Tire sidewall gouge found during walkaround' required style='width:100%;padding:8px;background:#1e293b;color:#f8fafc;border:1px solid #334155;border-radius:4px;' />",
              "</div>",
              "<div>",
                "<label style='display:block;font-size:12px;color:#94a3b8;margin-bottom:4px;'>Ground Aircraft (AOG)?</label>",
                "<select id='squawk-aog' style='width:100%;padding:8px;background:#1e293b;color:#f8fafc;border:1px solid #334155;border-radius:4px;'>",
                  "<option value='1'>Yes - Ground immediately (AOG)</option>",
                  "<option value='0'>No - Non-critical line item</option>",
                "</select>",
              "</div>",
              "<div>",
                "<button type='submit' style='width:100%;background:#dc2626;color:#fff;border:none;padding:9px;border-radius:4px;font-weight:600;cursor:pointer;'>Log Squawk Report 🚨</button>",
              "</div>",
            "</form>",
          "</div>"
        );

        dashEl.innerHTML = htmlParts.join("");
      }

      // ============================================================================
      // 7. BACKGROUND API SYNC (Graceful enhancement)
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
            if (curr.role && curr.role.toLowerCase().includes("admin")) {
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
                var exists = (window.S.wo || []).some(function (w) { return w.id === apiWo.id; });
                if (!exists) window.S.wo.push(apiWo);
              });
            }
            var curr = getCurrentUser();
            if (!curr.role || !curr.role.toLowerCase().includes("admin")) {
              renderTechnicianDashboard(dashEl, curr);
            }
          })
          .catch(function (err) {
            console.warn("[FlightFix] Using local state for Tech Dashboard:", err.message);
          });
      }

      // ============================================================================
      // 8. INTERACTIVE ACTIONS (Exposed to window)
      // ============================================================================
      window.switchDashboardRole = function (targetRole) {
        var user = getCurrentUser();
        user.role = targetRole;
        if (targetRole === "admin") {
          user.name = "Fleet Admin";
          user.email = "admin@flightfix.aero";
        } else {
          user.name = "Line Technician";
          user.email = "technician@flightfix.aero";
          user.station = "JFK";
        }
        localStorage.setItem("flightfix_current_user", JSON.stringify(user));
        notify("Switched view to: " + (targetRole === "admin" ? "Company Admin 🏢" : "Field Technician 🛠️"));
        rDash();
      };

      window.toggleFlightAog = function (reg) {
        ensureState();
        var flight = (window.S.ac || []).find(function (a) { return a.r === reg; });
        if (flight) {
          flight.aog = flight.aog === 1 ? 0 : 1;
          notify(flight.r + (flight.aog === 1 ? " is now GROUNDED (AOG)" : " released to active service"));
          rDash();
        }
      };

      window.allotWorkOrder = function (e) {
        e.preventDefault();
        ensureState();
        var ac = getEl("allot-ac").value;
        var desc = getEl("allot-desc").value;
        var ata = getEl("allot-ata").value;
        var prio = getEl("allot-prio").value;
        var tech = getEl("allot-tech").value;

        var newId = "WO-" + Math.floor(100 + Math.random() * 900);
        var newWo = {
          id: newId,
          r: ac,
          t: desc,
          ata: ata,
          p: prio,
          s: "open",
          tech: tech,
          station: "JFK",
          steps: [
            { text: "Safety tagout & flight deck briefing", done: false },
            { text: "Execute component check per manual", done: false },
            { text: "Ramp engine run or functional test", done: false }
          ]
        };

        window.S.wo.unshift(newWo);
        notify("Work order " + newId + " allotted to " + tech);
        rDash();
      };

      window.toggleStep = function (woId, stepIdx) {
        ensureState();
        var wo = (window.S.wo || []).find(function (w) { return w.id === woId; });
        if (wo && wo.steps && wo.steps[stepIdx]) {
          wo.steps[stepIdx].done = !wo.steps[stepIdx].done;
          rDash();
        }
      };

      window.completeWorkOrder = function (woId) {
        ensureState();
        var wo = (window.S.wo || []).find(function (w) { return w.id === woId; });
        if (wo) {
          wo.s = "done";
          if (wo.steps) {
            wo.steps.forEach(function (s) { s.done = true; });
          }
          notify("Work Order " + woId + " marked as DONE & signed off ✓");
          rDash();
        }
      };

      window.reportSquawk = function (e) {
        e.preventDefault();
        ensureState();
        var ac = getEl("squawk-ac").value;
        var desc = getEl("squawk-desc").value;
        var isAog = parseInt(getEl("squawk-aog").value, 10);

        var newId = "WO-" + Math.floor(100 + Math.random() * 900);
        window.S.wo.unshift({
          id: newId,
          r: ac,
          t: desc,
          ata: "ATA-05",
          p: isAog ? "urgent" : "high",
          s: "open",
          tech: "technician@flightfix.aero",
          station: "JFK",
          steps: [
            { text: "Inspect defect area and assess limits", done: false },
            { text: "Take corrective action or defer via MEL", done: false }
          ]
        });

        if (isAog) {
          var plane = (window.S.ac || []).find(function (a) { return a.r === ac; });
          if (plane) plane.aog = 1;
          notify("🚨 SQUAWK LOGGED: " + ac + " has been GROUNDED (AOG)!");
        } else {
          notify("Squawk logged for " + ac + " (WO " + newId + ")");
        }

        rDash();
      };

      window.approvePo = function (poId) {
        ensureState();
        var po = (window.S.po || []).find(function (p) { return p.id === poId; });
        if (po) {
          po.s = "approved";
          notify("Purchase Order " + poId + " approved for procurement ✓");
          rDash();
        }
      };

      window.rejectPo = function (poId) {
        ensureState();
        var po = (window.S.po || []).find(function (p) { return p.id === poId; });
        if (po) {
          po.s = "rejected";
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