function rInv() {
      var invEl = $("inv");
      if (!invEl) return;

      var qVal = S.q || "";

      invEl.innerHTML =
        "<div class='card'>" +
          "<h3>Add part</h3>" +
          "<div class='row'>" +
            "<input id='pi' " +
            "placeholder='Part no.' size=9> " +
            "<input id='pn' " +
            "placeholder='Name'> " +
            "<input id='pq' type='number' " +
            "placeholder='Qty' style='width:60px'> " +
            "<input id='pm' type='number' " +
            "placeholder='Min' style='width:60px'> " +
            "<button class='btn' " +
            "onclick='addPart()'>Add</button>" +
          "</div>" +
        "</div>" +
        "<div class='card'>" +
          "<h3>Inventory</h3>" +
          "<div class='row'>" +
            "<input id='q' " +
            "placeholder='Search...' " +
            "oninput='drawParts()' " +
            "value='" + qVal + "'> " +
            "<select id='f' " +
            "onchange='drawParts()'>" +
              "<option value=''>All</option>" +
              "<option value='low'>Low stock</option>" +
            "</select>" +
          "</div>" +
          "<div class='scroll' id='pt'></div>" +
        "</div>";

      drawParts();
    }

    function drawParts() {
      var qEl = $("q");
      var fEl = $("f");
      var ptEl = $("pt");
      if (!qEl || !fEl || !ptEl) return;

      var q = (qEl.value || "").toLowerCase();
      var f = fEl.value;
      S.q = qEl.value;

      var filtered = S.parts.filter(function(p) {
        var matchText = (p.id + p.n).toLowerCase();
        var matchFilter = (!f || p.q <= p.m);
        return matchText.indexOf(q) > -1 && matchFilter;
      });

      var rows = filtered.map(function(p) {
        var i = S.parts.indexOf(p);
        var statusTag = "";
        if (p.q === 0) {
          statusTag = tag("er", "Out");
        } else if (p.q <= p.m) {
          statusTag = tag("wn", "Low");
        } else {
          statusTag = tag("ok", "OK");
        }

        return "<tr>" +
          "<td><code>" + p.id + "</code></td>" +
          "<td>" + p.n + "</td>" +
          "<td>" + p.q + "</td>" +
          "<td>" + p.m + "</td>" +
          "<td>" + statusTag + "</td>" +
          "<td>" +
            "<button class='btn sec' " +
            "onclick='adj(" + i + ",-1)'>-</button> " +
            "<button class='btn sec' " +
            "onclick='adj(" + i + ",1)'>+</button> " +
            "<button class='btn' " +
            "onclick='manualReorder(" + i + ")'>" +
            "Reorder</button> " +
            "<button class='btn red' " +
            "onclick='delPart(" + i + ")'>x</button>" +
          "</td>" +
          "</tr>";
      }).join("");

      ptEl.innerHTML =
        "<table>" +
          "<tr>" +
            "<th>Part</th>" +
            "<th>Name</th>" +
            "<th>Stock</th>" +
            "<th>Min</th>" +
            "<th>Status</th>" +
            "<th>Actions</th>" +
          "</tr>" +
          rows +
        "</table>";
    }

    function adj(i, d) {
      var p = S.parts[i];
      p.q = Math.max(0, p.q + d);
      save();
      drawParts();
      autoReorder(p);

      fetch('/api/parts/' + p.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: p.q })
      }).catch(function(e) {});
    }

    function manualReorder(i) {
      var p = S.parts[i];
      var qty = Math.max(p.m * 2 - p.q, 1);
      po(p.id, qty, "manual");
      save();
      render();

      fetch('/api/procurement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partId: p.id,
          quantity: qty,
          note: "manual reorder"
        })
      }).catch(function(e) {});
    }

    function delPart(i) {
      var p = S.parts[i];
      S.parts.splice(i, 1);
      save();
      render();

      fetch('/api/parts/' + p.id, {
        method: 'DELETE'
      }).catch(function(e) {});
    }

    function autoReorder(p) {
      var hasPending = S.po.some(function(o) {
        return o.p === p.id && o.s === "pending";
      });

      if (p.q <= p.m && !hasPending) {
        var qty = p.m * 2 - p.q || p.m;
        po(p.id, qty, "auto: below min");
        save();
        toast("Auto-reorder for " + p.id);

        fetch('/api/procurement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            partId: p.id,
            quantity: qty,
            note: "auto: below min"
          })
        }).catch(function(e) {});
      }
    }

    function addPart() {
      var id = $("pi").value.trim().toUpperCase();
      var n = $("pn").value.trim();
      if (!id || !n || part(id)) {
        return toast("Unique part number needed");
      }

      var newPart = {
        id: id,
        n: n,
        q: +$("pq").value || 0,
        m: +$("pm").value || 1
      };

      S.parts.push(newPart);
      note("Inventory", id + " added");
      save();
      render();

      fetch('/api/parts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPart)
      }).catch(function(e) {});
    }