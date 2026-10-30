/* Shared helpers */
function $(id) { return document.getElementById(id); }

function toast(msg) {
  var t = $("toast") || document.getElementById("toast");

  // Create element if missing
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast";
    document.body.appendChild(t);
  }

  t.textContent = msg;
  t.className = "toast on";

  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(function() {
    t.className = "toast";
  }, 2500);
}

function note(who, text) {
  if (!S.feed) S.feed = [];
  S.feed.unshift([who, text]);
  S.feed = S.feed.slice(0, 15);
}

function tag(cls, text) {
  return '<span class="tag ' + cls + '">' + text + '</span>';
}

function part(id) {
  if (!S || !S.parts) return null;
  return S.parts.find(function(p) { return p.id === id || p.partNo === id; });
}

function woById(id) {
  if (!S || !S.wo) return null;
  for (var i = 0; i < S.wo.length; i++) {
    if (String(S.wo[i].id) === String(id) || S.wo[i].id == id) {
      return S.wo[i];
    }
  }
  return null;
}

function opts(arr, f) {
  if (!arr) return "";
  return arr.map(function(x) {
    var v = f(x);
    return "<option value='" + v[0] + "'>" + v[1] + "</option>";
  }).join("");
}

function low() {
  if (!S || !S.parts) return [];
  return S.parts.filter(function(p) { return (p.q || 0) <= (p.m || 1); });
}

/* Derived aircraft status: [css class, label] */
function status(a) {
  if (a.aog) return ["er", "AOG"];
  var reg = a.r || a.reg;
  if (S.wo && S.wo.some(function(w) { return (w.a === reg || w.aircraft === reg) && (w.s === "progress" || w.status === "in_progress"); })) {
    return ["in", "In check"];
  }
  if (S.wo && S.wo.some(function(w) { return (w.a === reg || w.aircraft === reg) && (w.s === "open" || w.status === "open"); })) {
    return ["wn", "Scheduled"];
  }
  return ["ok", "Serviceable"];
}

/* Raise a purchase order */
function po(partId, qty, why) {
  if (!S.po) S.po = [];
  var newId = "PO-" + (1000 + S.po.length + 1);
  S.po.unshift({ id: newId, p: partId, q: parseInt(qty, 10), s: "pending" });
  note("Procurement", "PO raised for " + qty + "× " + partId + " (" + why + ")");
}

/* Centralized Session & Authentication Status */
function getStoredUser() {
  try {
    var raw = sessionStorage.getItem("flightfix_current_user") || sessionStorage.getItem("flightfix_user");
    if (!raw || raw === "undefined" || raw === "null") return null;
    var u = JSON.parse(raw);
    if (u && (u.role || u.email || u.employeeId)) return u;
    return null;
  } catch (e) {
    return null;
  }
}

function isUserLoggedIn() {
  var u = getStoredUser();
  return !!(u && (u.role || u.email || u.employeeId));
}

window.getStoredUser = getStoredUser;
window.isUserLoggedIn = isUserLoggedIn;

function isUserAdmin(u) {
  if (!u) u = getStoredUser();
  if (!u) return false;
  var role = (u.role || "").toLowerCase();
  var email = (u.email || "").toLowerCase();
  return role.includes("admin") || role.includes("dispatcher") || email.includes("admin") || email === "ananya@flightfix.aero";
}
window.isUserAdmin = isUserAdmin;

