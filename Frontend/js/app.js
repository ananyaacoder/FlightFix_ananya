/* ==============================================================================
   FlightFix MRO — Main Application Controller & Navigation Router
   ============================================================================== */

var TABS = [
  ["home", "Radar & 3D"],
  ["dash", "Fleet Matrix"],
  ["plan", "Hangar Orders"],
  ["inv", "Spares"],
  ["erp", "ERP & POs"],
  ["tech", "Tech Portal"],
  ["login", "Login/SignUp"]
];

// Public tabs accessible without authentication
var PUBLIC_TABS = ["home", "login"];
// Admin-only tabs strictly blocked for technicians & guests
var ADMIN_ONLY_TABS = ["plan", "inv", "erp", "tech"];

var VIEWS = {
  home: function() {
    if (typeof rHome === "function") rHome();
  },
  dash: function() {
    if (typeof rDash === "function") rDash();
  },
  plan: function() {
    if (typeof rPlan === "function") rPlan();
  },
  inv: function() {
    if (typeof rInv === "function") rInv();
  },
  erp: function() {
    if (typeof rErp === "function") rErp();
  },
  tech: function() {
    if (typeof rTech === "function") rTech();
  },
  login: function() {
    if (typeof rLogin === "function") rLogin();
  }
};

function go(tab) {
  if (!tab) tab = "home";

  var loggedIn = (typeof isUserLoggedIn === "function") ? isUserLoggedIn() : false;
  var user = (typeof getStoredUser === "function") ? getStoredUser() : null;
  var isAdmin = loggedIn && ((typeof isUserAdmin === "function") ? isUserAdmin(user) : !!(user && user.role && user.role.toLowerCase().includes("admin")));

  // Authentication Route Guard
  if (!loggedIn && PUBLIC_TABS.indexOf(tab) === -1) {
    if (typeof notify === "function") {
      notify("🔒 Access Restricted: Please sign in to access FlightFix MRO portals.");
    } else if (typeof toast === "function") {
      toast("🔒 Access Restricted: Please sign in to access FlightFix MRO portals.");
    }
    tab = "login";
  }
  // Role-Based Route Guard: Prevent technicians from accessing admin-only pages
  else if (loggedIn && !isAdmin && ADMIN_ONLY_TABS.indexOf(tab) !== -1) {
    if (typeof notify === "function") {
      notify("🚫 Access Restricted: Only Company Admins can manage Planning, Spares & ERP.");
    } else if (typeof toast === "function") {
      toast("🚫 Access Restricted: Only Company Admins can manage Planning, Spares & ERP.");
    }
    tab = "dash";
  }

  if (!S) S = {};
  S.tab = tab;
  render();
  window.scrollTo(0, 0);
}

window.go = go;
window.showView = go;

function renderNav() {
  var navEl = $("nav") || document.querySelector("nav");
  if (!navEl) return;

  var loggedIn = (typeof isUserLoggedIn === "function") ? isUserLoggedIn() : false;
  if (typeof updateNavSessionUI === "function") {
    updateNavSessionUI(typeof getStoredUser === "function" ? getStoredUser() : null);
  }

  var btns = navEl.querySelectorAll("button");
  if (btns.length) {
    btns.forEach(function(b) {
      var oc = b.getAttribute("onclick") || "";
      var isOn = oc.indexOf("'" + S.tab + "'") > -1;
      b.classList.toggle("on", isOn);
    });
  }
}

function render() {
  var loggedIn = (typeof isUserLoggedIn === "function") ? isUserLoggedIn() : false;
  var user = (typeof getStoredUser === "function") ? getStoredUser() : null;
  var isAdmin = loggedIn && ((typeof isUserAdmin === "function") ? isUserAdmin(user) : !!(user && user.role && user.role.toLowerCase().includes("admin")));

  // Enforce public restriction for visitors who are not logged in
  if (!loggedIn && PUBLIC_TABS.indexOf(S.tab) === -1) {
    S.tab = "home";
  }
  // Enforce admin restriction for technicians
  else if (loggedIn && !isAdmin && ADMIN_ONLY_TABS.indexOf(S.tab) !== -1) {
    S.tab = "dash";
  }

  renderNav();
  document.body.classList.toggle("home", S.tab === "home");
  document.body.classList.toggle("not-logged-in", !loggedIn);
  document.body.classList.toggle("logged-in", loggedIn);
  document.body.classList.toggle("role-admin", isAdmin);
  document.body.classList.toggle("role-technician", loggedIn && !isAdmin);
  document.body.classList.toggle("role-user", loggedIn && !isAdmin);

  document.querySelectorAll("section").forEach(
    function(s) {
      var isTarget = (s.id === S.tab || s.id === "view-" + S.tab);
      // Strictly prevent protected views from rendering when unauthenticated
      if (!loggedIn && PUBLIC_TABS.indexOf(s.id) === -1) {
        isTarget = false;
      }
      // Strictly prevent admin views from rendering for technicians
      if (loggedIn && !isAdmin && ADMIN_ONLY_TABS.indexOf(s.id) !== -1) {
        isTarget = false;
      }
      s.className = isTarget ? "on view active" : "view";
      s.style.display = isTarget ? "block" : "none";
    }
  );

  if (VIEWS[S.tab]) {
    VIEWS[S.tab]();
  }

  if (typeof save === "function") save();
}

/* Live clock + flight hours accrual engine */
setInterval(function() {
  var clockEl = $("clock");
  if (clockEl) {
    clockEl.textContent = "Live " + new Date().toLocaleTimeString();
  }

  var changed = false;
  if (S && S.ac) {
    S.ac.forEach(function(a) {
      if (typeof status === "function") {
        if (status(a)[1] === "In check") {
          a.h = (a.h || 0) + 0.1;
          changed = true;
        }
      }
    });
  }

  var activeTag = "";
  if (document.activeElement) {
    activeTag = document.activeElement.tagName;
  }
  var isTyping = (activeTag === "INPUT" || activeTag === "SELECT");

  var loggedIn = (typeof isUserLoggedIn === "function") ? isUserLoggedIn() : false;
  if (changed && S.tab === "dash" && !isTyping && loggedIn) {
    if (typeof rDash === "function") {
      rDash();
    }
  }
}, 1000);

// Initial boot
var loggedInBoot = (typeof isUserLoggedIn === "function") ? isUserLoggedIn() : false;
if (!S) S = {};
if (!S.tab || (!loggedInBoot && PUBLIC_TABS.indexOf(S.tab) === -1)) {
  S.tab = "home";
}
render();
