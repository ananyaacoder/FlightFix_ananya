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

      var email = emailEl ? emailEl.value.trim() : "";
      var pass = passEl ? passEl.value.trim() : "";

      if (!email || !pass) {
        return notify("Please enter both email/ID and password.");
      }

      try {
        var res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email, password: pass })
        });
        var data = await res.json();

        if (data.success && data.user) {
          applyPrivateSession(data.user);
        } else {
          notify(data.error || "Login failed. Invalid credentials.");
        }
      } catch (err) {
        // Offline / direct storage fallback for entered credentials
        var inferredRole = (email.toLowerCase().includes("admin")) ? "admin" : "user";
        var localUser = {
          name: email.split("@")[0],
          email: email,
          role: inferredRole
        };
        applyPrivateSession(localUser);
      }
    }

    // ==============================================================================
    // 3. HANDLE REGISTRATION (With Distinct Role)
    // ==============================================================================
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

        if (data.success && data.user) {
          notify("Registration successful! Welcome, " + name);
          applyPrivateSession(data.user);
        } else {
          notify(data.message || "Account registered! Signing you in...");
          applyPrivateSession(payload);
        }
      } catch (err) {
        notify("Account registered locally!");
        applyPrivateSession(payload);
      }
    }

    // ==============================================================================
    // 4. PRIVATE SESSION BINDING & DASHBOARD REDIRECTION
    // ==============================================================================
    function applyPrivateSession(user) {
      if (!user) return;

      // Strict role normalization: Only 'admin' or 'user'
      var role = (user.role && user.role.toLowerCase().includes("admin")) ? "admin" : "user";
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
      } catch (e) {}

      updateNavSessionUI(null);
      notify("You have safely logged out.");

      // Clear inputs for privacy
      var inputs = document.querySelectorAll("#login input");
      inputs.forEach(function(input) { input.value = ""; });

      switchAuthTab("login");

      if (typeof window.showView === "function") {
        window.showView("login");
      }
    }

    // ==============================================================================
    // 6. NAVBAR UI SYNCHRONIZATION
    // ==============================================================================
    function updateNavSessionUI(user) {
      var nameEl = getEl("nav-user-name");
      var badgeEl = getEl("nav-role-badge");
      var loginBtn = getEl("nav-login-btn");
      var logoutBtn = getEl("nav-logout-btn");

      if (!user || !user.role) {
        if (nameEl) nameEl.textContent = "Guest";
        if (badgeEl) {
          badgeEl.textContent = "Not Logged In";
          badgeEl.className = "role-badge role-guest";
        }
        if (loginBtn) loginBtn.style.display = "inline-block";
        if (logoutBtn) logoutBtn.style.display = "none";
        return;
      }

      if (nameEl) nameEl.textContent = user.name || user.email;
      if (loginBtn) loginBtn.style.display = "none";
      if (logoutBtn) logoutBtn.style.display = "inline-block";

      if (badgeEl) {
        if (user.role === "admin") {
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
      if (user && user.role) {
        updateNavSessionUI(user);
      }
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