/* ==============================================================================
   FlightFix MRO — Plan & Hangar Work Orders (Integrated with Django REST API)
   ============================================================================== */

function rPlan() {
  var planEl = $("plan");
  if (!planEl) return;

  var loggedIn = (typeof isUserLoggedIn === "function") ? isUserLoggedIn() : false;
  var user = (typeof getStoredUser === "function") ? getStoredUser() : null;
  var isAdmin = loggedIn && ((typeof isUserAdmin === "function") ? isUserAdmin(user) : !!(user && user.role && user.role.toLowerCase().includes("admin")));

  if (!loggedIn) {
    planEl.style.display = "none";
    if (typeof go === "function") go("login");
    return;
  }
  if (!isAdmin) {
    planEl.style.display = "none";
    if (typeof go === "function") go("dash");
    return;
  }

  // Build clean options for aircraft
  var aircraftList = (S && S.ac && S.ac.length) ? S.ac : [];
  var acOpts = opts(aircraftList, function(a) {
    var reg = a.r || a.reg;
    var model = a.m || a.model || a.t || "Aircraft";
    return [reg, reg + " (" + model + ")"];
  });

  // Task / Check options
  var durKeys = (typeof DUR !== "undefined") ? Object.keys(DUR) : ["A-Check", "C-Check", "Engine Insp."];
  var taskOpts = opts(durKeys, function(k) {
    var span = (typeof DUR !== "undefined" && DUR[k]) ? DUR[k] : 1;
    return [k, k + " (" + span + " " + (span > 1 ? "Days" : "Day") + ")"];
  });

  // Hangar Bay options
  var bayOpts = "<option value='Bay 1'>Hangar Bay 1 (Main Overhaul)</option>" +
                "<option value='Bay 2'>Hangar Bay 2 (Avionics & Radar)</option>" +
                "<option value='Bay 3'>Hangar Bay 3 (Powerplant & APU)</option>" +
                "<option value='Bay 4'>Hangar Bay 4 (Quick Turnaround)</option>";

  // Days
  var dayList = (typeof DAYS !== "undefined") ? DAYS : ["Mon", "Tue", "Wed", "Thu", "Fri"];
  var dayOpts = opts(dayList, function(d) {
    return [d, d];
  });

  // Spares
  var partsList = (S && S.parts && S.parts.length) ? S.parts : [];
  var partOpts = opts(partsList, function(p) {
    var pid = p.id || p.partNo;
    var name = p.n || p.name || pid;
    var stock = p.q !== undefined ? p.q : (p.qty || 0);
    return [pid, name + " [" + stock + " in stock]"];
  });

  // Gantt chart headers
  var ganttHeaders = dayList.map(function(d) {
    return "<th style='text-align:center;min-width:90px;'>" + d + "</th>";
  }).join("");

  // Work orders list normalization
  var orders = (S && S.wo && S.wo.length) ? S.wo : [];

  // Gantt rows
  var ganttRows = orders.map(function(w) {
    var dayVal = w.d || w.day || "Mon";
    var startDay = dayList.indexOf(dayVal);
    if (startDay === -1) startDay = 0;

    var kindVal = w.k || w.kind || "A-Check";
    var spanDays = (typeof DUR !== "undefined" && DUR[kindVal]) ? DUR[kindVal] : 1;
    var st = w.s || w.status || "open";
    var isDone = (st === "done" || st === "closed");
    var inProgress = (st === "progress" || st === "in_progress");

    var opVal = isDone ? "0.4" : "1";
    var bgClr = isDone ? "var(--ok, #10b981)" : (inProgress ? "var(--ac, #0284c7)" : "var(--wn, #f59e0b)");

    var dayCells = dayList.map(function(d, j) {
      var inRange = (j >= startDay && j < startDay + spanDays);
      if (!inRange) {
        return "<td style='border:1px solid rgba(255,255,255,0.06);background:rgba(0,0,0,0.1);'></td>";
      }
      var label = (j === startDay) ? (w.a || w.aircraft) + " · " + kindVal : "";
      return "<td style='border:1px solid rgba(255,255,255,0.06);padding:3px;'>" +
             "<div class='gb' style='opacity:" + opVal + ";background:" + bgClr + ";text-align:center;font-size:11px;' title='" + (w.b || w.bay || "Bay 1") + "'>" +
             label +
             "</div></td>";
    }).join("");

    var woIdDisplay = String(w.id).startsWith("wo_") ? w.id : "#" + w.id;
    var acDisplay = w.a || w.aircraft || "VT-FLB";
    var bayDisplay = w.b || w.bay || "Bay 1";

    return "<tr>" +
      "<td style='font-weight:600;white-space:nowrap;padding:8px 12px;'>" + woIdDisplay + " <span style='color:var(--mu,#94a3b8);font-size:12px;'>" + acDisplay + " (" + bayDisplay + ")</span></td>" +
      dayCells +
      "</tr>";
  }).join("");

  if (!ganttRows) {
    ganttRows = "<tr><td colspan='6' style='text-align:center;padding:16px;color:var(--mu);'>No active hangar maintenance scheduled. Create a work order above!</td></tr>";
  }

  // Work Orders table rows
  var woRows = orders.map(function(w) {
    var st = w.s || w.status || "open";
    var badgeClass = "wn";
    var badgeLabel = "Scheduled";
    if (st === "progress" || st === "in_progress") {
      badgeClass = "in";
      badgeLabel = "In Progress";
    } else if (st === "done" || st === "closed") {
      badgeClass = "ok";
      badgeLabel = "Certified";
    }

    var partsTxt = "–";
    var rawParts = w.p || w.parts || [];
    if (rawParts.length) {
      partsTxt = rawParts.map(function(p) {
        var pid = p.id || p.partNo || "Part";
        var qty = p.q || p.qty || 1;
        return qty + "× " + pid;
      }).join(", ");
    }

    var woIdRaw = w.id;
    var startBtn = "";
    if (st === "open") {
      startBtn = "<button class='btn sm' style='margin-right:6px;' onclick='startWo(\"" + woIdRaw + "\")' title='Allocate parts and begin maintenance'>▶ Start</button>";
    }

    var mobBtn = "";
    if (st === "progress" || st === "in_progress") {
      mobBtn = "<button class='btn sm sec' style='margin-right:6px;' onclick='openOnMobile(\"" + woIdRaw + "\")' title='Open in Technician mobile workbench'>📱 Tech View</button>";
    }

    var delBtn = "<button class='btn sm red' onclick='delWo(\"" + woIdRaw + "\")' title='Cancel work order'>✕</button>";

    var woIdDisplay = String(w.id).startsWith("wo_") ? w.id : "#" + w.id;
    var acDisplay = w.a || w.aircraft || "VT-FLB";
    var taskDisplay = w.k || w.kind || w.title || "A-Check";
    var locationDisplay = (w.b || w.bay || "Bay 1") + " · " + (w.d || w.day || "Mon");

    return "<tr>" +
      "<td style='font-weight:700;'>" + woIdDisplay + "</td>" +
      "<td><b style='color:#38bdf8;'>" + acDisplay + "</b></td>" +
      "<td>" + taskDisplay + "<br><small style='color:var(--mu);'>" + locationDisplay + "</small></td>" +
      "<td style='font-size:12px;'>" + partsTxt + "</td>" +
      "<td>" + tag(badgeClass, badgeLabel) + "</td>" +
      "<td style='white-space:nowrap;'>" + startBtn + mobBtn + delBtn + "</td>" +
      "</tr>";
  }).join("");

  if (!woRows) {
    woRows = "<tr><td colspan='6' style='text-align:center;padding:20px;color:var(--mu);'>No work orders recorded yet. Use the planning tool above to dispatch maintenance.</td></tr>";
  }

  planEl.innerHTML =
    "<div class='card' style='margin-bottom:20px;'>" +
      "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;'>" +
        "<div>" +
          "<h3 style='margin:0;font-size:18px;'>✈️ Schedule Maintenance Work Order</h3>" +
          "<small style='color:var(--mu,#94a3b8);'>Dispatch airframes to hangar bays, schedule inspections, and allocate components</small>" +
        "</div>" +
      "</div>" +
      "<div class='row' style='display:flex;gap:10px;flex-wrap:wrap;align-items:center;'>" +
        "<div style='flex:1;min-width:180px;'>" +
          "<label style='display:block;font-size:11px;color:var(--mu);margin-bottom:4px;'>Target Aircraft</label>" +
          "<select id='wa' style='width:100%;padding:8px;border-radius:6px;'>" + acOpts + "</select>" +
        "</div>" +
        "<div style='flex:1;min-width:160px;'>" +
          "<label style='display:block;font-size:11px;color:var(--mu);margin-bottom:4px;'>Inspection Task</label>" +
          "<select id='wk' style='width:100%;padding:8px;border-radius:6px;'>" + taskOpts + "</select>" +
        "</div>" +
        "<div style='flex:1;min-width:150px;'>" +
          "<label style='display:block;font-size:11px;color:var(--mu);margin-bottom:4px;'>Hangar Bay</label>" +
          "<select id='wb' style='width:100%;padding:8px;border-radius:6px;'>" + bayOpts + "</select>" +
        "</div>" +
        "<div style='flex:1;min-width:90px;'>" +
          "<label style='display:block;font-size:11px;color:var(--mu);margin-bottom:4px;'>Day</label>" +
          "<select id='wd' style='width:100%;padding:8px;border-radius:6px;'>" + dayOpts + "</select>" +
        "</div>" +
        "<div style='flex:1.5;min-width:180px;'>" +
          "<label style='display:block;font-size:11px;color:var(--mu);margin-bottom:4px;'>Required Spare</label>" +
          "<select id='wp' style='width:100%;padding:8px;border-radius:6px;'>" +
            "<option value=''>No spares needed</option>" +
            partOpts +
          "</select>" +
        "</div>" +
        "<div style='width:70px;'>" +
          "<label style='display:block;font-size:11px;color:var(--mu);margin-bottom:4px;'>Qty</label>" +
          "<input id='wq' type='number' min='1' value='1' style='width:100%;padding:8px;border-radius:6px;text-align:center;'>" +
        "</div>" +
        "<div style='padding-top:18px;'>" +
          "<button class='btn' style='padding:9px 18px;font-weight:600;' onclick='addWo()'>+ Create Order</button>" +
        "</div>" +
      "</div>" +
    "</div>" +

    "<div class='card' style='margin-bottom:20px;'>" +
      "<h3 style='margin:0 0 12px 0;font-size:16px;'>📅 Weekly Hangar Bay Schedule (Mon – Fri)</h3>" +
      "<div class='scroll' style='overflow-x:auto;'>" +
        "<table class='gantt' style='width:100%;border-collapse:collapse;'>" +
          "<thead><tr style='background:rgba(255,255,255,0.04);'>" +
            "<th style='text-align:left;padding:10px;'>Aircraft / Bay Assignment</th>" +
            ganttHeaders +
          "</tr></thead>" +
          "<tbody>" +
            ganttRows +
          "</tbody>" +
        "</table>" +
      "</div>" +
    "</div>" +

    "<div class='card'>" +
      "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;'>" +
        "<h3 style='margin:0;font-size:16px;'>📋 Active & Completed Work Orders</h3>" +
        "<span style='font-size:12px;color:var(--mu);'>" + orders.length + " total records</span>" +
      "</div>" +
      "<div class='scroll' style='overflow-x:auto;'>" +
        "<table style='width:100%;border-collapse:collapse;'>" +
          "<thead><tr style='border-bottom:1px solid rgba(255,255,255,0.1);text-align:left;'>" +
            "<th style='padding:10px;'>WO #</th>" +
            "<th>Aircraft</th>" +
            "<th>Maintenance Task</th>" +
            "<th>Allocated Spares</th>" +
            "<th>Status</th>" +
            "<th style='text-align:right;'>Actions</th>" +
          "</tr></thead>" +
          "<tbody>" +
            woRows +
          "</tbody>" +
        "</table>" +
      "</div>" +
    "</div>";
}

/* ==============================================================================
   Work Order Actions (Add, Delete, Start, Tech View)
   ============================================================================== */

function addWo() {
  var a = $("wa") ? $("wa").value : "";
  if (!a) return toast("Please select an aircraft first");

  var k = $("wk") ? $("wk").value : "A-Check";
  var b = $("wb") ? $("wb").value : "Bay 1";
  var d = $("wd") ? $("wd").value : "Mon";

  var dayList = (typeof DAYS !== "undefined") ? DAYS : ["Mon", "Tue", "Wed", "Thu", "Fri"];
  var start = dayList.indexOf(d);
  if (start === -1) start = 0;

  var durMap = (typeof DUR !== "undefined") ? DUR : { "A-Check": 1, "C-Check": 3, "Engine Insp.": 2 };
  var spanDays = durMap[k] || 1;
  var end = start + spanDays;

  if (end > 5) {
    return toast("Task duration (" + spanDays + " days) exceeds Friday hangar cutoff!");
  }

  // Prevent double booking in same bay on overlapping days
  var orders = (S && S.wo) ? S.wo : [];
  var clash = orders.some(function(w) {
    var st = w.s || w.status || "open";
    if (st === "done" || st === "closed") return false;
    var wBay = w.b || w.bay;
    if (wBay !== b) return false;

    var s = dayList.indexOf(w.d || w.day);
    if (s === -1) s = 0;
    var wSpan = durMap[w.k || w.kind] || 1;
    var timeOverlap = (start < s + wSpan && end > s);
    return timeOverlap;
  });

  if (clash) {
    return toast(b + " is already occupied on those scheduled days!");
  }

  // Parts allocation
  var pid = $("wp") ? $("wp").value : "";
  var partsList = [];
  if (pid) {
    var qVal = $("wq") ? (parseInt($("wq").value, 10) || 1) : 1;
    partsList.push({ id: pid, partNo: pid, q: qVal, qty: qVal });
  }

  // Build task checklist
  var taskArr = [];
  if (typeof TASKS !== "undefined" && TASKS[k]) {
    taskArr = TASKS[k];
  } else {
    taskArr = ["Standard walk-around inspection", "Verify fluids and hydraulic lines", "System function sign-off"];
  }
  var checklist = taskArr.map(function(t) { return [t, 0]; });

  var newId = (S.n ? S.n++ : (orders.length + 1));
  var newWo = {
    id: String(newId),
    wo_id: String(newId),
    a: a,
    aircraft: a,
    k: k,
    kind: k,
    title: k + " on " + a,
    b: b,
    bay: b,
    d: d,
    day: d,
    s: "open",
    status: "open",
    p: partsList,
    parts: partsList,
    c: checklist,
    checklist: checklist,
    assignedTo: "Marcus Vance"
  };

  if (!S.wo) S.wo = [];
  S.wo.push(newWo);
  note("Planning", "Work order #" + newId + " created for " + a + " in " + b);
  save();
  render();
  toast("Work order #" + newId + " successfully dispatched to " + b);

  // Sync to Django Backend
  fetch('/api/workorders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newWo)
  }).catch(function(e) {
    console.warn("Django offline fallback:", e);
  });
}

function delWo(id) {
  if (!confirm("Are you sure you want to cancel and delete Work Order #" + id + "?")) {
    return;
  }

  if (S && S.wo) {
    S.wo = S.wo.filter(function(w) {
      return String(w.id) !== String(id) && w.id != id;
    });
  }

  if (String(S.tech) === String(id)) {
    S.tech = null;
  }

  note("Planning", "Cancelled Work Order #" + id);
  save();
  render();
  toast("Work order #" + id + " cancelled");

  // Sync to Django Backend
  fetch('/api/workorders/' + id, {
    method: 'DELETE'
  }).catch(function(e) {});
}

function openOnMobile(id) {
  S.tab = "tech";
  S.tech = id;
  render();
  window.scrollTo(0, 0);
  toast("Switched to Field Technician Workbench for WO #" + id);
}

function startWo(id) {
  var w = woById(id);
  if (!w) return toast("Work order not found");

  var partsList = w.p || w.parts || [];
  var short = [];

  if (partsList.length) {
    short = partsList.filter(function(p) {
      var pid = p.id || p.partNo;
      var itm = part(pid);
      if (!itm) return false;
      var currentStock = (itm.q !== undefined) ? itm.q : (itm.qty || 0);
      var req = p.q || p.qty || 1;
      return currentStock < req;
    });
  }

  if (short.length) {
    short.forEach(function(p) {
      var pid = p.id || p.partNo;
      var itm = part(pid) || { q: 0, m: 2 };
      var needed = ((p.q || 1) - (itm.q || 0)) + (itm.m || 1);
      po(pid, needed, "Shortage on WO #" + id);
    });
    save();
    render();
    return toast("Parts inventory shortage! Purchase Order automatically raised.");
  }

  // Deduct parts from stock
  partsList.forEach(function(p) {
    var pid = p.id || p.partNo;
    var itm = part(pid);
    if (itm) {
      var req = p.q || p.qty || 1;
      if (itm.q !== undefined) itm.q = Math.max(0, itm.q - req);
      if (itm.qty !== undefined) itm.qty = Math.max(0, itm.qty - req);
    }
  });

  w.s = "progress";
  w.status = "progress";

  // Ensure checklist is loaded
  if (!w.c || !w.c.length) {
    var kindVal = w.k || w.kind || "A-Check";
    var taskArr = (typeof TASKS !== "undefined" && TASKS[kindVal]) ? TASKS[kindVal] : ["Visual inspection", "Hydraulic check", "Telemetry sign-off"];
    w.c = taskArr.map(function(t) { return [t, 0]; });
    w.checklist = w.c;
  }

  S.tech = id;
  note("Hangar", "Work Order #" + id + " initiated in " + (w.b || w.bay || "Bay 1") + " for " + (w.a || w.aircraft));
  save();
  render();
  toast("Work order #" + id + " active! Parts allocated & workbench ready.");

  // Sync to Django Backend
  fetch('/api/workorders/' + id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: "progress",
      s: "progress",
      checklist: w.c,
      c: w.c
    })
  }).catch(function(e) {});
}

// Global window bindings
window.rPlan = rPlan;
window.renderPlan = rPlan;
window.addWo = addWo;
window.delWo = delWo;
window.openOnMobile = openOnMobile;
window.startWo = startWo;
