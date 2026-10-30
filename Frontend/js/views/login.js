    function getEl(id) {
      if (typeof id !== "string") return id;
      return document.getElementById(id) || (typeof window.$ === "function" ? window.$(id) : null);
    }

    // Safe session reader (prevents crashes from corrupt localStorage data)
    function getStoredUser() {
      try {
        var raw = localStorage.getItem("flightfix_current_user") || localStorage.getItem("flightfix_user");
        if (!raw || raw === "undefined" || raw === "null") return null;
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    }

    // Universal notification toast helper
    function notify(msg) {
      if (typeof window.toast === "function") {
        window.toast(msg);
      } else if (typeof window.showToast === "function") {
        window.showToast(msg);
      } else {
        console.log("[FlightFix Auth]", msg);
      }
    }

    // Persistent local user registry for offline resilience & cross-session login
function getLocalRegisteredUsers() {
  try {
    var raw = localStorage.getItem("flightfix_registered_users");
    if (!raw) return [];
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveLocalRegisteredUser(user, rawPass) {
  if (!user || !user.email) return;
  try {
    var users = getLocalRegisteredUsers();
    var emailKey = user.email.toLowerCase();
    var empKey = (user.employeeId || "").toLowerCase();

    var existingIdx = users.findIndex(function(u) {
      return (u.email && u.email.toLowerCase() === emailKey) ||
             (empKey && u.employeeId && u.employeeId.toLowerCase() === empKey);
    });

    var record = {
      id: user.id,
      name: user.name,
      email: user.email,
      employeeId: user.employeeId,
      role: user.role,
      station: user.station || "JFK",
      password: rawPass
    };

    if (existingIdx !== -1) {
      users[existingIdx] = Object.assign(users[existingIdx], record);
    } else {
      users.push(record);
    }
    localStorage.setItem("flightfix_registered_users", JSON.stringify(users));
  } catch (e) {}
}


    // ==============================================================================
    // 1. TAB CONTROLLER (SIGN IN VS REGISTER)
    // ==============================================================================
    function switchAuthTab(tab) {
      var loginBlock = getEl("form-login-block");
      var regBlock = getEl("form-register-block");
      var tabLogin = getEl("tab-login");
      var tabReg = getEl("tab-register");

      if (tab === "register") {
        if (loginBlock) loginBlock.style.display = "none";
        if (regBlock) regBlock.style.display = "block";
        if (tabLogin) tabLogin.classList.remove("active");
        if (tabReg) tabReg.classList.add("active");
      } else {
        if (loginBlock) loginBlock.style.display = "block";
        if (regBlock) regBlock.style.display = "none";
        if (tabLogin) tabLogin.classList.add("active");
        if (tabReg) tabReg.classList.remove("active");
      }
    }

    // ==============================================================================
    // 2. HANDLE SIGN IN
    // ==============================================================================
        async function handleFormLogin(event) {
      if (event && event.preventDefault) event.preventDefault();

      var emailEl = getEl("login-email") || getEl("auth-email");
      var passEl = getEl("login-password") || getEl("auth-pass");

      var ident = emailEl ? emailEl.value.trim() : "";
      var pass = passEl ? passEl.value.trim() : "";

      if (!ident || !pass) {
        return notify("Please enter both registered email/Employee ID and password.");
      }

      try {
        var res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: ident, email: ident, employeeId: ident, password: pass })
        });
        var data = await res.json();

        if (res.ok && data.success && data.user) {
          saveLocalRegisteredUser(data.user, pass);
          applyPrivateSession(data.user);
        } else {
          notify(data.error || "Login failed. Incorrect registered email/Employee ID or password.");
          return;
        }
      } catch (err) {
        // Offline / storage fallback: strictly verify credentials from persistent registry
        var localUsers = getLocalRegisteredUsers();
        var matched = localUsers.find(function(u) {
          var matchId = (u.email && u.email.toLowerCase() === ident.toLowerCase()) ||
                        (u.employeeId && u.employeeId.toLowerCase() === ident.toLowerCase());
          return matchId && (u.password === pass);
        });

        if (matched) {
          applyPrivateSession(matched);
        } else {
          notify("Login failed. No registered account found with that email/ID and password.");
        }
      }
    }

    async function handleFormRegister(event) {
      if (event && event.preventDefault) event.preventDefault();

      var nameEl = getEl("reg-name");
      var emailEl = getEl("reg-email");
      var empidEl = getEl("reg-empid");
      var roleEl = getEl("reg-role");
      var stationEl = getEl("reg-station");
      var passEl = getEl("reg-password");

      var name = nameEl ? nameEl.value.trim() : "";
      var email = emailEl ? emailEl.value.trim() : "";
      var empid = empidEl ? empidEl.value.trim() : "";
      var role = roleEl ? roleEl.value : "user"; // 'admin' or 'user'
      var station = stationEl ? stationEl.value.trim() : "";
      var pass = passEl ? passEl.value.trim() : "";

      if (!name || !email || !empid || !pass) {
        return notify("Please fill in all required registration fields.");
      }
      if (pass.length < 6) {
        return notify("Password must be at least 6 characters long for privacy and integrity.");
      }

      var payload = {
        name: name,
        email: email,
        employeeId: empid,
        role: role,
        station: station || "JFK",
        password: pass
      };

      try {
        var res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        var data = await res.json();

        if (res.ok && data.success && data.user) {
          notify("Registration successful! Welcome, " + (data.user.name || name));
          saveLocalRegisteredUser(data.user, pass);
          applyPrivateSession(data.user);
        } else {
          // Strictly reject duplicate registration and notify user
          notify(data.error || data.message || "Registration failed. That email or Employee ID is already registered.");
          return;
        }
      } catch (err) {
        // Offline registration fallback with strict duplicate verification
        var localRegistry = getLocalRegisteredUsers();
        var duplicate = localRegistry.find(function(u) {
          return (u.email && u.email.toLowerCase() === email.toLowerCase()) ||
                 (u.employeeId && u.employeeId.toLowerCase() === empid.toLowerCase());
        });

        if (duplicate) {
          return notify("Registration failed: That email or Employee ID is already registered. Duplicate IDs are prohibited.");
        }

        var newUser = {
          name: name,
          email: email,
          employeeId: empid,
          role: (role === "admin" ? "Company Admin" : "Field Technician"),
          station: station || "JFK"
        };
        saveLocalRegisteredUser(newUser, pass);
        notify("Account registered and securely saved! Welcome, " + name);
        applyPrivateSession(newUser);
      }
    }

    function applyPrivateSession(user) {
      if (!user) return;

      // Role normalization using centralized isUserAdmin
      var isAdmin = (typeof isUserAdmin === "function") ? isUserAdmin(user) : (user.role && user.role.toLowerCase().includes("admin"));
      var role = isAdmin ? "admin" : "user";
      user.role = role;

      try {
        localStorage.setItem("flightfix_current_user", JSON.stringify(user));
        localStorage.setItem("flightfix_user", JSON.stringify(user));
      } catch (e) {}

      updateNavSessionUI(user);

      var roleLabel = (role === "admin") ? "COMPANY ADMIN" : "FIELD TECHNICIAN";
      notify("Signed in as " + (user.name || user.email) + " [" + roleLabel + "]");

      // Navigate to Dashboard view
      if (typeof window.showView === "function") {
        window.showView("dash");
      }

      // Immediately render the role-authorized dashboard
      if (typeof window.renderDashboard === "function") {
        window.renderDashboard();
      } else if (typeof window.rDash === "function") {
        window.rDash();
      }
    }

    // ==============================================================================
    // 5. SECURE LOGOUT
    // ==============================================================================
    function logoutUser() {
      try {
        localStorage.removeItem("flightfix_current_user");
        localStorage.removeItem("flightfix_user");
        localStorage.removeItem("flightfix_token");
      } catch (e) {}

      if (window.Auth) {
        window.Auth.user = null;
        window.Auth.token = null;
      }

      updateNavSessionUI(null);
      notify("You have safely logged out.");

      // Clear inputs for privacy
      var inputs = document.querySelectorAll("#login input");
      inputs.forEach(function(input) { input.value = ""; });

      switchAuthTab("login");

      if (typeof window.showView === "function") {
        window.showView("home");
      }
    }

    // ==============================================================================
    // 6. NAVBAR UI SYNCHRONIZATION
    // ==============================================================================
    function updateNavSessionUI(user) {
      var loggedIn = !!(user && (user.role || user.email || user.employeeId));
      var isAdmin = loggedIn && ((typeof isUserAdmin === "function") ? isUserAdmin(user) : !!(user && user.role && user.role.toLowerCase().includes("admin")));

      document.body.classList.toggle("not-logged-in", !loggedIn);
      document.body.classList.toggle("logged-in", loggedIn);
      document.body.classList.toggle("role-admin", isAdmin);
      document.body.classList.toggle("role-technician", loggedIn && !isAdmin);
      document.body.classList.toggle("role-user", loggedIn && !isAdmin);

      var nameEl = getEl("nav-user-name");
      var badgeEl = getEl("nav-role-badge");
      var loginBtn = getEl("nav-login-btn");
      var logoutBtn = getEl("nav-logout-btn");
      var dashBtn = getEl("nav-dash");

      // Strictly hide all protected buttons when not logged in
      if (!loggedIn) {
        if (nameEl) nameEl.textContent = "Guest";
        if (badgeEl) {
          badgeEl.textContent = "Not Logged In";
          badgeEl.className = "role-badge role-guest";
        }
        if (loginBtn) loginBtn.style.display = "inline-block";
        if (logoutBtn) logoutBtn.style.display = "none";
        if (dashBtn) dashBtn.style.display = "none";

        var allProtected = document.querySelectorAll(".nav-auth-only, #nav-dash, #nav-plan, #nav-inv, #nav-erp, #nav-tech, #nav-reset");
        allProtected.forEach(function(b) {
          b.style.display = "none";
        });
        return;
      }

      // Logged in user navigation configuration
      if (nameEl) nameEl.textContent = user.name || user.email;
      if (loginBtn) loginBtn.style.display = "none";
      if (logoutBtn) logoutBtn.style.display = "inline-block";

      // Dashboard button: accessible to both roles, clearly titled
      if (dashBtn) {
        dashBtn.style.display = "inline-block";
        dashBtn.textContent = isAdmin ? "Dashboard" : "🛠️ My Assigned Tasks";
      }

      // Admin-only buttons: strictly shown ONLY for Company Admin
      var adminOnlyButtons = document.querySelectorAll(".nav-admin-only, #nav-plan, #nav-inv, #nav-erp, #nav-tech, #nav-reset");
      adminOnlyButtons.forEach(function(b) {
        b.style.display = isAdmin ? "inline-block" : "none";
      });

      if (badgeEl) {
        if (isAdmin) {
          badgeEl.textContent = "🏢 Company Admin";
          badgeEl.className = "role-badge role-admin";
        } else {
          badgeEl.textContent = "🛠️ Field Technician";
          badgeEl.className = "role-badge role-user";
        }
      }
    }

    // View Renderer fallback
    function rLogin() {
      var user = getStoredUser();
      updateNavSessionUI(user);
    }
    var renderLogin = rLogin;

    // Global Window Bindings for HTML Attributes
    window.switchAuthTab = switchAuthTab;
    window.handleFormLogin = handleFormLogin;
    window.handleFormRegister = handleFormRegister;
    window.logoutUser = logoutUser;
    window.updateNavSessionUI = updateNavSessionUI;
    window.rLogin = rLogin;
    window.renderLogin = rLogin;

    // Initialize session indicator on script load
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function() {
        updateNavSessionUI(getStoredUser());
      });
    } else {
      updateNavSessionUI(getStoredUser());
    }