/* ==============================================================================
   FlightFix MRO — Field Technician Portal & Mobile Workbench (Integrated with Django)
   ============================================================================== */

function rTech() {
  var techEl = $("tech");
  if (!techEl) return;

  var loggedIn = (typeof isUserLoggedIn === "function") ? isUserLoggedIn() : false;
  var user = (typeof getStoredUser === "function") ? getStoredUser() : null;
  var isAdmin = loggedIn && ((typeof isUserAdmin === "function") ? isUserAdmin(user) : !!(user && user.role && user.role.toLowerCase().includes("admin")));

  if (!loggedIn) {
    techEl.style.display = "none";
    if (typeof go === "function") go("login");
    return;
  }
  if (!isAdmin) {
    techEl.style.display = "none";
    if (typeof go === "function") go("dash");
    return;
  }

  var orders = (S && S.wo && S.wo.length) ? S.wo : [];

  // Find active work order
  var activeWo = null;
  if (S.tech) {
    activeWo = woById(S.tech);
  }
  if (!activeWo) {
    activeWo = orders.find(function(w) {
      var st = w.s || w.status;
      return st === "progress" || st === "in_progress";
    }) || orders[0];
  }

  // If no work orders exist
  if (!activeWo) {
    techEl.innerHTML =
      "<div class='phone' style='text-align:center;padding:40px 20px;'>" +
        "<div style='font-size:42px;margin-bottom:12px;'>🛠️</div>" +
        "<h3 style='margin:0 0 8px 0;font-size:18px;'>No Active Work Orders</h3>" +
        "<p style='color:var(--mu,#94a3b8);font-size:13px;line-height:1.5;margin-bottom:20px;'>" +
          "There are currently no maintenance orders assigned to the hangar bay. Visit the planning deck to create and start a work order." +
        "</p>" +
        "<button class='btn' style='padding:10px 20px;' onclick='go(\"plan\")'>Go to Maintenance Plan</button>" +
      "</div>";
    return;
  }

  // Normalize checklist
  if (!activeWo.c || !activeWo.c.length) {
    var rawC = activeWo.checklist;
    if (rawC && rawC.length) {
      activeWo.c = rawC;
    } else {
      var kindVal = activeWo.k || activeWo.kind || "A-Check";
      var defaultTasks = (typeof TASKS !== "undefined" && TASKS[kindVal]) ?
        TASKS[kindVal] :
        ["Visual walk-around inspection", "Check fluid levels & hydraulic lines", "Inspect tyres and brakes", "Test avionics & radio flight telemetry"];
      activeWo.c = defaultTasks.map(function(t) { return [t, 0]; });
    }
  }

  // Normalize checklist items to [stepName, doneInt]
  activeWo.c = activeWo.c.map(function(item) {
    if (Array.isArray(item) && item.length >= 2) {
      return [String(item[0]), item[1] ? 1 : 0];
    } else if (typeof item === "object" && item !== null) {
      var txt = item.step || item.text || item.task || "Inspection step";
      var d = item.done ? 1 : 0;
      return [String(txt), d];
    } else {
      return [String(item), 0];
    }
  });

  // Calculate completion
  var totalSteps = activeWo.c.length;
  var doneSteps = activeWo.c.filter(function(t) { return t[1] === 1; }).length;
  var pct = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;
  var allDone = (totalSteps > 0 && doneSteps === totalSteps);

  // Selector dropdown for all work orders
  var woOptions = orders.map(function(w) {
    var isSel = (String(w.id) === String(activeWo.id));
    var selAttr = isSel ? "selected" : "";
    var acReg = w.a || w.aircraft || "VT-FLB";
    var taskName = w.k || w.kind || "A-Check";
    var bayName = w.b || w.bay || "Bay 1";
    var st = w.s || w.status || "open";
    var stLabel = (st === "done" || st === "closed") ? " [Done]" : (st === "progress" || st === "in_progress" ? " [Active]" : " [Scheduled]");
    return "<option value='" + w.id + "' " + selAttr + ">" +
      "WO #" + w.id + " · " + acReg + " (" + taskName + " - " + bayName + ")" + stLabel +
      "</option>";
  }).join("");

  // Checklist items HTML
  var jobsHtml = activeWo.c.map(function(t, idx) {
    var isDone = (t[1] === 1);
    var cls = isDone ? "job done" : "job";
    var chk = isDone ? "checked" : "";
    var iconBadge = isDone ? "<span style='color:#10b981;font-size:12px;font-weight:700;'>✓</span>" : "<span style='color:var(--mu);font-size:12px;'>○</span>";

    return "<div class='" + cls + "' style='display:flex;align-items:center;padding:10px 12px;margin-bottom:8px;border-radius:8px;background:rgba(255,255,255,0.03);cursor:pointer;' onclick='toggleJob(\"" + activeWo.id + "\"," + idx + ")'>" +
      "<input type='checkbox' " + chk + " style='margin-right:10px;cursor:pointer;width:18px;height:18px;' onclick='event.stopPropagation(); toggleJob(\"" + activeWo.id + "\"," + idx + ");'> " +
      "<div style='flex:1;font-size:13px;line-height:1.4;'>" +
        "<span style='" + (isDone ? "color:var(--mu);text-decoration:line-through;" : "color:#f8fafc;") + "'>" + t[0] + "</span>" +
      "</div>" +
      "<div>" + iconBadge + "</div>" +
    "</div>";
  }).join("");

  // Sign-off status logic
  var st = activeWo.s || activeWo.status || "open";
  var isDone = (st === "done" || st === "closed");

  var signBtnText = "Complete all steps before sign-off (" + (totalSteps - doneSteps) + " remaining)";
  var signBtnDis = "disabled style='width:100%;padding:12px;border-radius:8px;font-weight:700;opacity:0.6;cursor:not-allowed;'";

  if (isDone) {
    signBtnText = "✅ Certified Airworthy & Released";
    signBtnDis = "disabled style='width:100%;padding:12px;border-radius:8px;background:#10b98122;color:#6ee7b7;border:1px solid #10b981;font-weight:700;cursor:default;'";
  } else if (allDone) {
    signBtnText = "✍️ Sign Off & Release to Service";
    signBtnDis = "style='width:100%;padding:12px;border-radius:8px;background:#10b981;color:#fff;border:none;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(16,185,129,0.4);'";
  }

  var acDisplay = activeWo.a || activeWo.aircraft || "VT-FLB";
  var taskDisplay = activeWo.k || activeWo.kind || activeWo.title || "C-Check Overhaul";
  var bayDisplay = activeWo.b || activeWo.bay || "Bay 1";
  var dayDisplay = activeWo.d || activeWo.day || "Mon";
  var techDisplay = activeWo.assignedTo || "Marcus Vance (AME Lead)";

  techEl.innerHTML =
    "<div class='phone' style='max-width:440px;margin:10px auto;border-radius:24px;border:4px solid #1e293b;background:#09101f;box-shadow:0 16px 40px rgba(0,0,0,0.6);padding:18px;color:#f8fafc;'>" +

      "<!-- Tablet Header -->" +
      "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid rgba(255,255,255,0.08);padding-bottom:10px;'>" +
        "<div style='display:flex;align-items:center;gap:8px;'>" +
          "<span style='font-size:18px;'>🛠️</span>" +
          "<div>" +
            "<b style='font-size:14px;letter-spacing:0.5px;'>FIELD WORKBENCH</b><br>" +
            "<small style='font-size:11px;color:#38bdf8;'>Handheld Maintenance Terminal</small>" +
          "</div>" +
        "</div>" +
        "<span class='tag in' style='font-size:11px;padding:3px 8px;font-weight:700;'>WO #" + activeWo.id + "</span>" +
      "</div>" +

      "<!-- Work Order Switcher -->" +
      "<div style='margin-bottom:14px;'>" +
        "<label style='display:block;font-size:11px;color:var(--mu,#94a3b8);margin-bottom:4px;'>Select Active Hangar Order:</label>" +
        "<select id='tsel' onchange='changeTechWo(this.value)' style='width:100%;padding:8px 10px;background:#0f172a;color:#f8fafc;border:1px solid rgba(56,189,248,0.3);border-radius:6px;font-size:12px;'>" +
          woOptions +
        "</select>" +
      "</div>" +

      "<!-- Aircraft & Task Info Card -->" +
      "<div class='card' style='background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:12px;margin-bottom:14px;'>" +
        "<div style='display:flex;justify-content:space-between;align-items:flex-start;'>" +
          "<div>" +
            "<div style='font-size:16px;font-weight:700;color:#38bdf8;'>" + acDisplay + "</div>" +
            "<div style='font-size:13px;font-weight:600;margin-top:2px;'>" + taskDisplay + "</div>" +
          "</div>" +
          "<div>" +
            "<span class='tag " + (isDone ? "ok" : "in") + "' style='font-size:10px;'>" + (isDone ? "Certified" : "In Progress") + "</span>" +
          "</div>" +
        "</div>" +
        "<div style='display:flex;justify-content:space-between;margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);font-size:11px;color:var(--mu,#94a3b8);'>" +
          "<span>📍 " + bayDisplay + " (" + dayDisplay + ")</span>" +
          "<span>👤 " + techDisplay + "</span>" +
        "</div>" +
      "</div>" +

      "<!-- Progress Indicator -->" +
      "<div style='margin-bottom:14px;background:rgba(255,255,255,0.02);padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.06);'>" +
        "<div style='display:flex;justify-content:space-between;font-size:11px;margin-bottom:6px;'>" +
          "<span>Inspection Checklist Progress</span>" +
          "<b style='color:#38bdf8;'>" + doneSteps + " / " + totalSteps + " Steps (" + pct + "%)</b>" +
        "</div>" +
        "<div style='height:6px;background:#1e293b;border-radius:4px;overflow:hidden;'>" +
          "<div style='height:100%;width:" + pct + "%;background:" + (allDone ? "#10b981" : "#38bdf8") + ";transition:width 0.3s;'></div>" +
        "</div>" +
      "</div>" +

      "<!-- Checklist Items -->" +
      "<div style='margin-bottom:16px;max-height:280px;overflow-y:auto;padding-right:4px;'>" +
        jobsHtml +
      "</div>" +

      "<!-- Signoff Button -->" +
      "<div>" +
        "<button class='btn' " + signBtnDis + " onclick='signOff(\"" + activeWo.id + "\")'>" +
          signBtnText +
        "</button>" +
      "</div>" +

    "</div>";
}

/* ==============================================================================
   Technician Action Handlers (Change Order, Toggle Step, Airworthiness Sign-Off)
   ============================================================================== */

function changeTechWo(val) {
  S.tech = val;
  save();
  render();
}

function toggleJob(woId, idx) {
  var w = woById(woId);
  if (!w || !w.c || !w.c[idx]) return;

  // Toggle checklist step
  w.c[idx][1] = (w.c[idx][1] === 1) ? 0 : 1;
  w.checklist = w.c;

  // If order was open, advance to progress
  var currentSt = w.s || w.status;
  if (currentSt === "open") {
    w.s = "progress";
    w.status = "progress";
  }

  save();
  render();

  var stepLabel = w.c[idx][0] || "Task step";
  var stepState = w.c[idx][1] ? "completed" : "marked incomplete";
  toast("Step #" + (idx + 1) + " " + stepState + ": " + stepLabel);

  // Sync to Django Backend
  fetch('/api/workorders/' + woId + '/checklist/' + idx, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ done: w.c[idx][1] === 1 })
  }).catch(function(e) {
    // Fallback sync
    fetch('/api/workorders/' + woId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checklist: w.c, status: w.s })
    }).catch(function() {});
  });
}

function signOff(woId) {
  var w = woById(woId);
  if (!w) return toast("Work order not found");

  w.s = "done";
  w.status = "done";

  // Mark all checklist items complete
  if (w.c && w.c.length) {
    w.c.forEach(function(item) { item[1] = 1; });
    w.checklist = w.c;
  }

  // Clear AOG status for target aircraft
  var acReg = w.a || w.aircraft;
  var acObj = null;
  if (S && S.ac) {
    acObj = S.ac.find(function(ac) {
      return (ac.r === acReg || ac.reg === acReg);
    });
    if (acObj) {
      acObj.aog = 0;
      acObj.status = "in_service";
    }
  }

  note("Technician", "Airworthiness release: " + acReg + " signed off by Lead Tech");
  save();
  render();
  toast("🎉 " + acReg + " certified airworthy! Work Order #" + woId + " closed.");

  // Sync to Django Backend
  fetch('/api/workorders/' + woId + '/signoff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      aircraft: acReg,
      status: 'done'
    })
  }).then(function(res) {
    return res.json();
  }).then(function(data) {
    if (data && data.message) {
      console.log("[Django MRO]", data.message);
    }
  }).catch(function(e) {});
}

// Global window bindings
window.rTech = rTech;
window.renderTech = rTech;
window.changeTechWo = changeTechWo;
window.toggleJob = toggleJob;
window.signOff = signOff;
