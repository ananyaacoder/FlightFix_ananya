 setInterval(function() {
      var clockEl = $("clock");
      if (clockEl) {
        clockEl.textContent = "Live " +
          new Date().toLocaleTimeString();
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
      var isTyping = (activeTag === "INPUT" ||
        activeTag === "SELECT");

      if (changed && S.tab === "dash" && !isTyping) {
        if (typeof rDash === "function") {
          rDash();
        }
      }
    }, 1000);

    /* App shell: navigation, render loop, live ticker */
    var TABS = [
      ["home", "Radar & 3D"],
      ["dash", "Fleet Matrix"],
      ["plan", "Hangar Orders"],
      ["inv", "Spares"],
      ["erp", "ERP & POs"],
      ["tech", "Tech Portal"],
      ["login", "Login/SignUp"]
    ];

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
      if (!S) S = {};
      S.tab = tab;
      render();
      window.scrollTo(0, 0);
    }

    window.go = go;
    window.showView = go;

    function renderNav() {
      var navEl = $("nav") ||
        document.querySelector("nav");
      if (!navEl) return;

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
      if (!S.tab) S.tab = "home";

      renderNav();
      document.body.classList.toggle("home",
        S.tab === "home");

      document.querySelectorAll("section").forEach(
        function(s) {
          var isTarget = (s.id === S.tab ||
            s.id === "view-" + S.tab);
          s.className = isTarget ?
            "on view active" : "view";
          s.style.display = isTarget ?
            "block" : "none";
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
        clockEl.textContent = "Live " +
          new Date().toLocaleTimeString();
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
      var isTyping = (activeTag === "INPUT" ||
        activeTag === "SELECT");

      if (changed && S.tab === "dash" && !isTyping) {
        if (typeof rDash === "function") {
          rDash();
        }
      }
    }, 1000);

    if (!S.tab) S.tab = "home";
    render();