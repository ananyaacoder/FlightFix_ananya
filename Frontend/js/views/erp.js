function rErp() {
      var erpEl = $("erp");
      if (!erpEl) return;

      var poRows = "";
      if (!S.po.length) {
        poRows = "<tr>" +
          "<td colspan=6 style='color:var(--mu);'>" +
          "No purchase orders" +
          "</td></tr>";
      } else {
        poRows = S.po.map(function(o, i) {
          var p = part(o.p);
          var pName = p ? p.n : "–";
          var isPend = (o.s === "pending");
          var sTag = isPend ?
            tag("wn", "Pending") :
            tag("ok", "Received");
          var actBtn = isPend ?
            "<button class='btn' " +
            "onclick='receivePo(" + i + ")'>" +
            "Receive delivery</button>" :
            "Stocked";

          return "<tr>" +
            "<td><b>" + o.id + "</b></td>" +
            "<td>" + o.p + "</td>" +
            "<td>" + pName + "</td>" +
            "<td>" + o.q + "</td>" +
            "<td>" + sTag + "</td>" +
            "<td>" + actBtn + "</td>" +
            "</tr>";
        }).join("");
      }

      var partOptions = opts(S.parts, function(p) {
        return [p.id, p.id + " – " + p.n];
      });

      erpEl.innerHTML =
        "<div class='card'>" +
          "<h3>Raise purchase order (ERP)</h3>" +
          "<div class='row'>" +
            "<select id='ep'>" +
            partOptions +
            "</select>" +
            "<input id='eq' type='number' " +
            "min='1' value='2' style='width:60px'> " +
            "<button class='btn' onclick='addPo()'>" +
            "Issue PO</button>" +
          "</div>" +
        "</div>" +
        "<div class='card'>" +
          "<h3>Purchase orders</h3>" +
          "<div class='scroll'><table>" +
            "<tr>" +
              "<th>PO #</th>" +
              "<th>Part</th>" +
              "<th>Name</th>" +
              "<th>Qty</th>" +
              "<th>Status</th>" +
              "<th>Actions</th>" +
            "</tr>" +
            poRows +
          "</table></div>" +
        "</div>";
    }

    function addPo() {
      var pId = $("ep").value;
      var qVal = +$("eq").value || 1;
      po(pId, qVal, "manual ERP order");
      save();
      render();
      toast("PO created");

      fetch('/api/procurement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partId: pId,
          quantity: qVal,
          note: "manual ERP order"
        })
      }).catch(function(e) {});
    }

    function receivePo(i) {
      var o = S.po[i];
      o.s = "received";
      var p = part(o.p);
      if (p) p.q += o.q;

      note("ERP", o.id + " received: " + o.q + "x " + o.p);
      save();
      render();
      toast(o.p + " restocked");

      fetch('/api/procurement/' + o.id + '/receive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partId: o.p,
          quantity: o.q
        })
      }).catch(function(e) {});
    }