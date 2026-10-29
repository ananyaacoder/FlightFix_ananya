var AUTH_API = ((window.location.protocol.startsWith('http') && window.location.port !== '')
  ? window.location.origin
  : 'http://localhost:8000') + '/api/auth';

    var Auth = {
      user: null,
      token: null,
      activeTab: 'login',

      init: function() {
        this.token = localStorage.getItem(
          'flightfix_token'
        );
        var saved = localStorage.getItem(
          'flightfix_user'
        );
        if (saved) {
          try {
            this.user = JSON.parse(saved);
          } catch (e) {
            this.user = null;
          }
        }

        if (this.token) {
          this.verifySession();
        } else {
          this.setDefaultEmployee();
        }

        this.renderUserBadge();
      },

      setDefaultEmployee: function() {
        this.user = {
          name: "Capt. Ananya",
          role: "Lead Dispatcher",
          employeeId: "EMP-001",
          clearance: "Alpha",
          station: "JFK"
        };
        this.renderUserBadge();
      },

      verifySession: function() {
        var self = this;
        fetch(AUTH_API + '/me', {
          headers: {
            'Authorization': 'Bearer ' + self.token
          }
        })
        .then(function(res) {
          return res.json();
        })
        .then(function(data) {
          if (data.success && data.user) {
            self.user = data.user;
            localStorage.setItem(
              'flightfix_user',
              JSON.stringify(self.user)
            );
            self.renderUserBadge();
          }
        })
        .catch(function(e) {});
      },

      showModal: function(tab) {
        this.activeTab = tab || 'login';
        var m = $("aeroAuthModal");
        if (!m) {
          m = document.createElement('div');
          m.id = 'aeroAuthModal';
          document.body.appendChild(m);
        }
        m.style.display = 'flex';
        this.renderModalContent();
      },

      closeModal: function() {
        var m = $("aeroAuthModal");
        if (m) m.style.display = 'none';
      },

      fillDemo: function(num) {
        if (num === 1) {
          this.quickFill(
            'ananya@flightfix.aero',
            'Admin123!'
          );
        } else if (num === 2) {
          this.quickFill(
            'marcus.vance@flightfix.aero',
            'Admin123!'
          );
        } else {
          this.quickFill(
            'engineer@flightfix.com',
            'password123'
          );
        }
      },

      renderModalContent: function() {
        var m = $("aeroAuthModal");
        if (!m) return;

        var isLogin = (this.activeTab === 'login');
        var logBg = isLogin ?
          '#0284c7' : 'transparent';
        var signBg = !isLogin ?
          '#0284c7' : 'transparent';

        var formHtml = isLogin ?
          this.renderLoginForm() :
          this.renderSignupForm();

        m.innerHTML =
          "<div style='position:fixed;inset:0;" +
          "background:rgba(2,6,12,0.85);" +
          "backdrop-filter:blur(14px);" +
          "z-index:9999;display:flex;" +
          "justify-content:center;" +
          "align-items:center;'>" +
            "<div style='position:relative;" +
            "width:440px;max-width:92vw;" +
            "background:#0b1329;" +
            "border:1px solid #38bdf8;" +
            "border-radius:14px;padding:22px;" +
            "color:#f8fafc;box-shadow:0 12px 36px #000;'>" +

              "<button onclick='Auth.closeModal()' " +
              "style='position:absolute;top:12px;" +
              "right:12px;background:none;border:none;" +
              "color:#94a3b8;font-size:18px;" +
              "cursor:pointer;'>✕</button>" +

              "<div style='text-align:center;" +
              "margin-bottom:14px;'>" +
                "<h3 style='margin:0 0 4px;color:#38bdf8;'>" +
                "FlightFix Crew Auth</h3>" +
                "<small style='color:#94a3b8;'>" +
                "Authorized MRO & Crew Portal</small>" +
              "</div>" +

              "<div style='background:#0f172a;" +
              "padding:8px;border-radius:8px;" +
              "margin-bottom:12px;'>" +
                "<small style='color:#64748b;display:block;" +
                "margin-bottom:4px;'>Quick Demo Logins:</small>" +
                "<div style='display:flex;gap:4px;" +
                "flex-wrap:wrap;'>" +
                  "<button class='btn sm' " +
                  "onclick='Auth.fillDemo(1)'>" +
                  "Capt. Ananya</button>" +
                  "<button class='btn sm sec' " +
                  "onclick='Auth.fillDemo(2)'>" +
                  "Marcus (AME)</button>" +
                  "<button class='btn sm sec' " +
                  "onclick='Auth.fillDemo(3)'>" +
                  "Lead Tech</button>" +
                "</div>" +
              "</div>" +

              "<div style='display:flex;gap:6px;" +
              "margin-bottom:12px;'>" +
                "<button onclick=\"Auth.switchTab('login')\" " +
                "style='flex:1;padding:8px;border:none;" +
                "border-radius:6px;cursor:pointer;" +
                "background:" + logBg + ";color:#fff;'>" +
                "Sign In</button>" +
                "<button onclick=\"Auth.switchTab('signup')\" " +
                "style='flex:1;padding:8px;border:none;" +
                "border-radius:6px;cursor:pointer;" +
                "background:" + signBg + ";color:#fff;'>" +
                "Register</button>" +
              "</div>" +

              "<div id='authAlertBox' style='display:none;" +
              "padding:8px;border-radius:6px;" +
              "font-size:12px;margin-bottom:10px;'></div>" +

              formHtml +
            "</div>" +
          "</div>";
      },

      renderLoginForm: function() {
        return "<form onsubmit='Auth.handleLogin(event)' " +
          "style='display:flex;flex-direction:column;gap:10px;'>" +
          "<div>" +
            "<label style='font-size:11px;color:#cbd5e1;'>" +
            "Email or Employee ID</label>" +
            "<input id='loginIdentifier' " +
            "value='ananya@flightfix.aero' " +
            "required style='width:100%;padding:8px;'>" +
          "</div>" +
          "<div>" +
            "<label style='font-size:11px;color:#cbd5e1;'>" +
            "Password</label>" +
            "<input type='password' id='loginPassword' " +
            "value='Admin123!' required " +
            "style='width:100%;padding:8px;'>" +
          "</div>" +
          "<button type='submit' class='btn' " +
          "style='width:100%;padding:10px;margin-top:6px;'>" +
          "Verify & Enter</button>" +
          "</form>";
      },

      renderSignupForm: function() {
        return "<form onsubmit='Auth.handleSignup(event)' " +
          "style='display:flex;flex-direction:column;gap:8px;" +
          "max-height:300px;overflow-y:auto;'>" +
          "<div>" +
            "<label style='font-size:11px;'>Full Name</label>" +
            "<input id='regName' placeholder='Capt. Sarah' " +
            "required style='width:100%;padding:7px;'>" +
          "</div>" +
          "<div>" +
            "<label style='font-size:11px;'>Email</label>" +
            "<input type='email' id='regEmail' " +
            "placeholder='sarah@flightfix.aero' " +
            "required style='width:100%;padding:7px;'>" +
          "</div>" +
          "<div>" +
            "<label style='font-size:11px;'>Role</label>" +
            "<select id='regRole' style='width:100%;padding:7px;'>" +
              "<option value='Lead Flight Dispatcher'>Dispatch</option>" +
              "<option value='Lead A&P Powerplant Inspector'>A&P Tech</option>" +
              "<option value='Avionics Specialist'>Avionics</option>" +
            "</select>" +
          "</div>" +
          "<div>" +
            "<label style='font-size:11px;'>Password</label>" +
            "<input type='password' id='regPassword' " +
            "placeholder='Min 6 chars' required " +
            "style='width:100%;padding:7px;'>" +
          "</div>" +
          "<button type='submit' class='btn' " +
          "style='width:100%;padding:9px;margin-top:4px;'>" +
          "Create Badge</button>" +
          "</form>";
      },

      switchTab: function(tab) {
        this.activeTab = tab;
        this.renderModalContent();
      },

      quickFill: function(email, pwd) {
        this.switchTab('login');
        setTimeout(function() {
          var idIn = $("loginIdentifier");
          var pwIn = $("loginPassword");
          if (idIn && pwIn) {
            idIn.value = email;
            pwIn.value = pwd;
          }
        }, 50);
      },

      handleLogin: function(e) {
        e.preventDefault();
        var self = this;
        var id = ($("loginIdentifier").value || "").trim();
        var pw = ($("loginPassword").value || "").trim();

        this.showStatus("Verifying credentials...", "info");

        fetch(AUTH_API + '/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifier: id,
            email: id,
            password: pw
          })
        })
        .then(function(res) {
          return res.json();
        })
        .then(function(data) {
          if (data.success && data.user) {
            self.token = data.token;
            self.user = data.user;
            localStorage.setItem('flightfix_token', self.token);
            localStorage.setItem(
              'flightfix_user',
              JSON.stringify(self.user)
            );
            self.showStatus("Access Granted!", "success");
            self.renderUserBadge();
            setTimeout(function() {
              self.closeModal();
              if (typeof go === "function") go("dash");
            }, 600);
          } else {
            self.showStatus(data.error || "Login failed", "error");
          }
        })
        .catch(function(err) {
          self.user = {
            name: id.indexOf("@") > -1 ? id.split("@")[0] : id,
            role: "Lead Dispatcher",
            employeeId: "EMP-001",
            clearance: "Alpha",
            station: "JFK"
          };
          self.renderUserBadge();
          self.showStatus("Local mode active", "success");
          setTimeout(function() {
            self.closeModal();
            if (typeof go === "function") go("dash");
          }, 600);
        });
      },

      handleSignup: function(e) {
        e.preventDefault();
        var self = this;
        var name = ($("regName").value || "").trim();
        var email = ($("regEmail").value || "").trim();
        var role = $("regRole").value;
        var pw = ($("regPassword").value || "").trim();

        var payload = {
          name: name,
          email: email,
          role: role,
          clearance: "Alpha",
          station: "JFK",
          password: pw
        };

        this.showStatus("Provisioning badge...", "info");

        fetch(AUTH_API + '/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        .then(function(res) {
          return res.json();
        })
        .then(function(data) {
          if (data.success) {
            self.showStatus("Badge created! Signing in...", "success");
            setTimeout(function() {
              self.quickFill(email, pw);
            }, 600);
          } else {
            self.showStatus(data.error || "Signup failed", "error");
          }
        })
        .catch(function(err) {
          self.showStatus("Server unreachable on port 5000", "error");
        });
      },

      showStatus: function(msg, type) {
        var box = $("authAlertBox");
        if (!box) return;
        box.style.display = 'block';
        box.innerText = msg;
        if (type === 'error') {
          box.style.background = '#ef444422';
          box.style.color = '#fca5a5';
          box.style.border = '1px solid #ef4444';
        } else if (type === 'success') {
          box.style.background = '#10b98122';
          box.style.color = '#6ee7b7';
          box.style.border = '1px solid #10b981';
        } else {
          box.style.background = '#38bdf822';
          box.style.color = '#7dd3fc';
          box.style.border = '1px solid #38bdf8';
        }
      },

      logout: function() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('flightfix_token');
        localStorage.removeItem('flightfix_user');
        this.setDefaultEmployee();
        this.renderUserBadge();
        if (typeof toast === 'function') {
          toast("Employee signed out.");
        }
      },

      renderUserBadge: function() {
        var badge = $("userNavBadge");
        if (!badge) return;
        var u = this.user || {
          name: "Capt. Ananya",
          clearance: "Alpha"
        };

        badge.innerHTML =
          "<span style='color:#38bdf8;font-weight:700;'>" +
          u.name + "</span> " +
          "<button class='btn sm sec' " +
          "onclick='Auth.showModal()'>Switch</button> " +
          "<button class='btn sm red' " +
          "onclick='Auth.logout()'>Logout</button>";
      }
    };

    window.Auth = Auth;
    document.addEventListener('DOMContentLoaded', function() {
      Auth.init();
    });