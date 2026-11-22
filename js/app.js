(function () {
  "use strict";

  var OFFERS_KEY = "lastbite.offers";
  var PICKUPS_KEY = "lastbite.pickups";
  var FAVS_KEY = "lastbite.favs";
  var CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

  function $(id) {
    return document.getElementById(id);
  }

  function read(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch (e) {
      return [];
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* private mode: the page still works until it is reloaded */
    }
  }

  function euro(n) {
    return "€" + Number(n).toFixed(2);
  }

  function minutes(hhmm) {
    var p = hhmm.split(":");
    return Number(p[0]) * 60 + Number(p[1]);
  }

  function dayKey(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function nowMinutes() {
    var d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }

  // An offer whose window has passed is the store's offer for tomorrow.
  function offerDay(o) {
    var d = new Date();
    if (nowMinutes() >= minutes(o.until)) {
      d.setDate(d.getDate() + 1);
      return { key: dayKey(d), label: "Tomorrow", today: false };
    }
    return { key: dayKey(d), label: "Today", today: true };
  }

  function allOffers() {
    return read(OFFERS_KEY).concat(window.LB_OFFERS || []);
  }

  function findOffer(id) {
    return allOffers().filter(function (o) {
      return o.id === id;
    })[0];
  }

  function leftOf(o) {
    var key = offerDay(o).key;
    var taken = read(PICKUPS_KEY).reduce(function (sum, p) {
      return p.offerId === o.id && p.day === key && p.status !== "cancelled" ? sum + p.qty : sum;
    }, 0);
    return Math.max(0, o.qty - taken);
  }

  function closing(o) {
    var day = offerDay(o);
    if (!day.today) return null;
    var mins = minutes(o.until) - nowMinutes();
    if (mins > 180) return null;
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    return { text: "Closes in " + (h ? h + " h " : "") + m + " min", soon: mins <= 60 };
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function newCode() {
    var used = read(PICKUPS_KEY).map(function (p) {
      return p.code;
    });
    var code;
    do {
      code = "";
      for (var i = 0; i < 6; i++) {
        code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
      }
    } while (used.indexOf(code) !== -1);
    return code;
  }

  function showCode(code) {
    return code.slice(0, 3) + " " + code.slice(3);
  }

  function isFav(store) {
    return read(FAVS_KEY).indexOf(store) !== -1;
  }

  function toggleFav(store) {
    var favs = read(FAVS_KEY);
    var i = favs.indexOf(store);
    if (i === -1) favs.push(store);
    else favs.splice(i, 1);
    write(FAVS_KEY, favs);
  }

  // Ratings come from collected pickups that the customer rated.
  function ratingOf(store) {
    var rated = read(PICKUPS_KEY).filter(function (p) {
      return p.store === store && p.rating;
    });
    if (!rated.length) return "";
    var avg = rated.reduce(function (sum, p) {
      return sum + p.rating;
    }, 0) / rated.length;
    return ", rated " + avg.toFixed(1) + " of 5 (" + rated.length + (rated.length === 1 ? " rating)" : " ratings)");
  }

  function ticket(p, withState) {
    var frag = document.createDocumentFragment();
    var stub = el("div", "stub");
    stub.appendChild(el("span", "lab", "Pickup code"));
    stub.appendChild(el("span", "code", showCode(p.code)));
    frag.appendChild(stub);

    var body = el("div", "body");
    body.appendChild(el("h3", "", p.store));
    body.appendChild(el("p", "", (p.qty > 1 ? p.qty + " x " : "") + p.title));
    body.appendChild(el("p", "", "Collect " + p.dayLabel.toLowerCase() + ", " + p.from + " to " + p.until + ", " + p.area));
    body.appendChild(el("p", "", euro(p.total) + ", name on the bag: " + p.name));
    if (withState) {
      var words = { reserved: "Reserved", collected: "Collected", cancelled: "Cancelled" };
      var cls = p.status === "collected" ? "state done" : p.status === "cancelled" ? "state off" : "state";
      body.appendChild(el("span", cls, words[p.status]));
      if (p.rating) body.appendChild(el("p", "rated", "You rated it " + p.rating + " of 5"));
    }
    frag.appendChild(body);
    return frag;
  }

  /* ---------- offers page ---------- */

  function offersPage() {
    var list = $("list");
    var state = { type: "", area: "", veg: false, fav: false, sort: "time" };
    var dialog = $("reserve");
    var modal = new bootstrap.Modal(dialog);
    var current = null;

    $("today").textContent = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

    (window.LB_AREAS || []).forEach(function (a) {
      var opt = el("option", "", a);
      opt.value = a;
      $("f-area").appendChild(opt);
    });

    function row(o) {
      var left = leftOf(o);
      var day = offerDay(o);
      var li = el("li", "offer");

      var pic = el("div", "pic");
      var img = document.createElement("img");
      img.src = window.LB_PHOTOS[o.photo] || window.LB_PHOTOS.bread;
      img.alt = "";
      img.width = 720;
      img.height = 540;
      img.loading = "lazy";
      pic.appendChild(img);
      li.appendChild(pic);

      var info = el("div", "info");
      info.appendChild(el("h3", "", o.store));
      info.appendChild(el("p", "where", o.type + ", " + o.area + ratingOf(o.store)));
      info.appendChild(el("p", "what", o.title));
      info.appendChild(el("p", "inside", o.contents));
      if (o.date) info.appendChild(el("span", "datemark", o.date));
      li.appendChild(info);

      var collect = el("div", "collect");
      collect.appendChild(el("span", "lab", "Collect " + day.label.toLowerCase()));
      collect.appendChild(el("span", "time", o.from + " to " + o.until));
      var c = closing(o);
      if (c) collect.appendChild(el("span", "closing" + (c.soon ? " soon" : ""), c.text));
      li.appendChild(collect);

      var price = el("div", "price");
      var tag = el("div", "tag");
      tag.appendChild(el("span", "was", "Was " + euro(o.was)));
      tag.appendChild(el("span", "now", euro(o.now)));
      price.appendChild(tag);
      li.appendChild(price);

      var go = el("div", "go");
      var btn = el("button", "btn btn-bite", left ? "Reserve" : "Gone");
      btn.type = "button";
      btn.disabled = !left;
      btn.setAttribute("aria-label", left ? "Reserve " + o.title + " from " + o.store : o.title + " from " + o.store + " is gone");
      btn.addEventListener("click", function () {
        open(o);
      });
      go.appendChild(btn);
      go.appendChild(el("p", "left" + (left && left <= 2 ? " last" : ""), left === 0 ? "None left" : left <= 2 ? "Last " + left : left + " left"));
      var save = el("button", "save");
      save.type = "button";
      save.dataset.store = o.store;
      save.setAttribute("aria-label", "Save " + o.store);
      markSave(save, isFav(o.store));
      save.addEventListener("click", function () {
        toggleFav(o.store);
        if (state.fav) {
          render("enter");
          return;
        }
        list.querySelectorAll(".save").forEach(function (b) {
          if (b.dataset.store === o.store) markSave(b, isFav(o.store));
        });
      });
      go.appendChild(save);
      li.appendChild(go);
      return li;
    }

    function markSave(b, on) {
      b.textContent = on ? "Saved" : "Save store";
      b.setAttribute("aria-pressed", String(on));
    }

    // how: "reveal" on first load (rows appear as they are scrolled to),
    // "enter" after a filter change, nothing for the minute-by-minute refresh
    function render(how) {
      if (how === "reveal" && !window.lbWatch) how = "";
      var offers = allOffers().filter(function (o) {
        return (!state.type || o.type === state.type) && (!state.area || o.area === state.area) && (!state.veg || o.veg) && (!state.fav || isFav(o.store));
      });
      offers.sort(function (a, b) {
        if (state.sort === "price") return a.now - b.now;
        if (state.sort === "saving") return b.was - b.now - (a.was - a.now);
        var da = offerDay(a).today ? 0 : 1440;
        var db = offerDay(b).today ? 0 : 1440;
        return da + minutes(a.from) - (db + minutes(b.from));
      });
      list.textContent = "";
      offers.forEach(function (o, i) {
        var li = row(o);
        if (how) {
          li.classList.add(how);
          li.style.setProperty("--d", (how === "enter" ? Math.min(i, 8) * 0.05 : (i % 3) * 0.08) + "s");
        }
        list.appendChild(li);
      });
      if (how === "reveal") window.lbWatch(list);
      $("none").hidden = offers.length > 0;
      $("none").textContent = state.fav ? "None of your saved stores has an offer that matches. Tap Save store under an offer to add a store." : "Nothing left that matches. Try another area or kind of food.";
      $("count").textContent = offers.length === 1 ? "1 offer" : offers.length + " offers";

      var stillOpen = allOffers().filter(function (o) {
        return leftOf(o) > 0;
      }).length;
      $("sticker-n").textContent = stillOpen;
    }

    document.querySelectorAll(".chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        document.querySelectorAll(".chip").forEach(function (c) {
          c.setAttribute("aria-pressed", String(c === chip));
        });
        state.type = chip.dataset.type;
        render("enter");
      });
    });
    $("f-area").addEventListener("change", function (e) {
      state.area = e.target.value;
      render("enter");
    });
    $("f-sort").addEventListener("change", function (e) {
      state.sort = e.target.value;
      render("enter");
    });
    $("f-veg").addEventListener("change", function (e) {
      state.veg = e.target.checked;
      render("enter");
    });
    $("f-fav").addEventListener("change", function (e) {
      state.fav = e.target.checked;
      render("enter");
    });

    function total() {
      return current.now * Number($("r-qty").value);
    }

    function open(o) {
      current = o;
      var left = leftOf(o);
      var day = offerDay(o);
      $("reserve-title").textContent = "Reserve from " + o.store;
      $("r-what").textContent = o.title;
      $("r-inside").textContent = o.contents;
      $("r-collect").textContent = "Collect " + day.label.toLowerCase() + ", " + o.from + " to " + o.until + ", " + o.area;
      $("r-was").textContent = "Was " + euro(o.was);
      $("r-now").textContent = euro(o.now);
      var qty = $("r-qty");
      qty.textContent = "";
      for (var i = 1; i <= Math.min(left, 3); i++) {
        var opt = el("option", "", String(i));
        opt.value = i;
        qty.appendChild(opt);
      }
      $("r-submit").textContent = "Reserve for " + euro(total());
      $("r-name").removeAttribute("aria-invalid");
      $("r-name-err").hidden = true;
      $("reserve-step").hidden = false;
      $("reserve-done").hidden = true;
      modal.show();
    }

    $("r-qty").addEventListener("change", function () {
      $("r-submit").textContent = "Reserve for " + euro(total());
    });

    $("reserve-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var name = $("r-name").value.trim();
      if (!name) {
        $("r-name").setAttribute("aria-invalid", "true");
        $("r-name-err").hidden = false;
        $("r-name").focus();
        return;
      }
      var day = offerDay(current);
      var qty = Math.min(Number($("r-qty").value), leftOf(current));
      if (!qty) {
        modal.hide();
        render();
        return;
      }
      var pickup = {
        code: newCode(),
        offerId: current.id,
        store: current.store,
        area: current.area,
        title: current.title,
        from: current.from,
        until: current.until,
        day: day.key,
        dayLabel: day.label,
        qty: qty,
        total: current.now * qty,
        saved: (current.was - current.now) * qty,
        name: name,
        status: "reserved"
      };
      var all = read(PICKUPS_KEY);
      all.unshift(pickup);
      write(PICKUPS_KEY, all);

      var box = $("done-ticket");
      box.textContent = "";
      box.appendChild(ticket(pickup, false));
      $("reserve-step").hidden = true;
      $("reserve-done").hidden = false;
      $("done-title").focus();
      render();
    });

    dialog.addEventListener("shown.bs.modal", function () {
      if (!$("reserve-step").hidden) $("r-name").focus();
    });

    render("reveal");
    setInterval(function () {
      render();
    }, 60000);
  }

  /* ---------- my pickups ---------- */

  function pickupsPage() {
    var box = $("tickets");
    var first = true;

    function render() {
      var all = read(PICKUPS_KEY);
      box.textContent = "";
      all.forEach(function (p, i) {
        var li = el("li", first ? "ticket enter" : "ticket");
        li.style.setProperty("--d", Math.min(i, 6) * 0.08 + "s");
        li.appendChild(ticket(p, true));
        if (p.status === "reserved") {
          var cancel = el("button", "btn btn-plain btn-sm", "Cancel this pickup");
          cancel.type = "button";
          cancel.addEventListener("click", function () {
            p.status = "cancelled";
            write(PICKUPS_KEY, all);
            render();
          });
          var holder = el("div");
          holder.appendChild(cancel);
          li.querySelector(".body").appendChild(holder);
        }
        if (p.status === "collected" && !p.rating) {
          var rate = el("div", "rate");
          rate.setAttribute("role", "group");
          rate.setAttribute("aria-label", "Rate your pickup from " + p.store);
          rate.appendChild(el("span", "", "How was it?"));
          [1, 2, 3, 4, 5].forEach(function (n) {
            var b = el("button", "", String(n));
            b.type = "button";
            b.setAttribute("aria-label", n + " of 5");
            b.addEventListener("click", function () {
              p.rating = n;
              write(PICKUPS_KEY, all);
              render();
            });
            rate.appendChild(b);
          });
          li.querySelector(".body").appendChild(rate);
        }
        box.appendChild(li);
      });
      $("empty").hidden = all.length > 0;
      first = false;

      var done = all.filter(function (p) {
        return p.status === "collected";
      });
      var bags = done.reduce(function (s, p) {
        return s + p.qty;
      }, 0);
      var saved = done.reduce(function (s, p) {
        return s + p.saved;
      }, 0);
      $("tally").hidden = bags === 0;
      $("tally").textContent = "So far you have collected " + bags + (bags === 1 ? " bag" : " bags") + " and paid " + euro(saved) + " less than the shelf price.";
    }

    render();
  }

  /* ---------- for stores ---------- */

  function storesPage() {
    var form = $("post-form");

    (window.LB_AREAS || []).forEach(function (a) {
      var opt = el("option", "", a);
      opt.value = a;
      $("p-area").appendChild(opt);
    });

    function fail(id, message) {
      var input = $(id);
      var err = $(id + "-err");
      input.setAttribute("aria-invalid", "true");
      err.textContent = message;
      err.hidden = false;
      return input;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      form.querySelectorAll("[aria-invalid]").forEach(function (n) {
        n.removeAttribute("aria-invalid");
      });
      form.querySelectorAll(".error").forEach(function (n) {
        n.hidden = true;
      });

      var first = null;
      function check(ok, id, message) {
        if (!ok) {
          var input = fail(id, message);
          first = first || input;
        }
      }

      var was = parseFloat($("p-was").value);
      var now = parseFloat($("p-now").value);
      var qty = parseInt($("p-qty").value, 10);
      check($("p-store").value.trim(), "p-store", "Enter the name of your store.");
      check($("p-title").value.trim(), "p-title", "Give the offer a short name, such as Bread bag.");
      check($("p-contents").value.trim(), "p-contents", "List what the customer gets.");
      check(was > 0, "p-was", "Enter the normal price.");
      check(now > 0 && now < was, "p-now", "The reduced price has to be lower than the normal price.");
      check(qty >= 1 && qty <= 50, "p-qty", "Enter how many you have, between 1 and 50.");
      check($("p-from").value && $("p-until").value && minutes($("p-until").value) > minutes($("p-from").value), "p-until", "The collection has to end after it starts.");
      if (first) {
        first.focus();
        return;
      }

      var offer = {
        id: "store-" + Date.now(),
        store: $("p-store").value.trim(),
        area: $("p-area").value,
        type: $("p-type").value,
        title: $("p-title").value.trim(),
        contents: $("p-contents").value.trim(),
        photo: $("p-photo").value,
        was: was,
        now: now,
        qty: qty,
        from: $("p-from").value,
        until: $("p-until").value,
        date: $("p-date").value.trim(),
        veg: $("p-veg").checked
      };
      var mine = read(OFFERS_KEY);
      mine.unshift(offer);
      write(OFFERS_KEY, mine);

      $("posted-text").textContent = offer.title + " from " + offer.store + " is listed: " + offer.qty + " at " + euro(offer.now) + ", collection " + offer.from + " to " + offer.until + ". You keep " + euro(offer.now * 0.8) + " from each one sold.";
      $("posted").hidden = false;
      $("posted").focus();
      form.reset();
      board();
    });

    $("clear-mine").addEventListener("click", function () {
      write(OFFERS_KEY, []);
      $("posted").hidden = true;
      board();
    });

    function bags(list) {
      return list.reduce(function (sum, p) {
        return sum + p.qty;
      }, 0);
    }

    function board() {
      var mine = read(OFFERS_KEY);
      var ids = mine.map(function (o) {
        return o.id;
      });
      var picks = read(PICKUPS_KEY).filter(function (p) {
        return ids.indexOf(p.offerId) !== -1 && p.status !== "cancelled";
      });
      var done = picks.filter(function (p) {
        return p.status === "collected";
      });
      $("b-listed").textContent = mine.length;
      $("b-reserved").textContent = bags(picks);
      $("b-collected").textContent = bags(done);
      $("b-paid").textContent = euro(done.reduce(function (sum, p) {
        return sum + p.total;
      }, 0) * 0.8);

      var ul = $("mine");
      ul.textContent = "";
      mine.forEach(function (o) {
        var li = el("li");
        var txt = el("div");
        txt.appendChild(el("p", "what", o.title + ", " + o.store));
        txt.appendChild(el("p", "", o.qty + " at " + euro(o.now) + ", collection " + o.from + " to " + o.until + ", " + leftOf(o) + " left"));
        li.appendChild(txt);
        var acts = el("div", "row-actions");
        var again = el("button", "btn btn-plain btn-sm", "Use as template");
        again.type = "button";
        again.addEventListener("click", function () {
          fill(o);
        });
        var del = el("button", "btn btn-plain btn-sm", "Remove");
        del.type = "button";
        del.addEventListener("click", function () {
          write(OFFERS_KEY, read(OFFERS_KEY).filter(function (x) {
            return x.id !== o.id;
          }));
          board();
        });
        acts.appendChild(again);
        acts.appendChild(del);
        li.appendChild(acts);
        ul.appendChild(li);
      });
      $("mine-none").hidden = mine.length > 0;
    }

    // A past offer fills the form, so the store only changes what is different tonight.
    function fill(o) {
      ["store", "area", "title", "type", "contents", "was", "now", "from", "until", "qty", "photo"].forEach(function (k) {
        $("p-" + k).value = o[k];
      });
      $("p-date").value = o.date || "";
      $("p-veg").checked = !!o.veg;
      $("posted").hidden = true;
      var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      $("post").scrollIntoView({ behavior: still ? "auto" : "smooth" });
      $("p-store").focus({ preventScroll: true });
    }

    board();

    var found = null;

    function showResult() {
      var out = $("check-out");
      out.textContent = "";
      out.hidden = false;
      if (!found) {
        out.appendChild(el("p", "", "No reservation with this code. Check the letters with the customer."));
        return;
      }
      var t = el("div", "ticket");
      t.appendChild(ticket(found, true));
      out.appendChild(t);
      if (found.status === "reserved") {
        var done = el("button", "btn btn-bite", "Hand over and mark as collected");
        done.type = "button";
        done.addEventListener("click", function () {
          var all = read(PICKUPS_KEY);
          all.forEach(function (p) {
            if (p.code === found.code) p.status = "collected";
          });
          write(PICKUPS_KEY, all);
          found.status = "collected";
          showResult();
          board();
        });
        out.appendChild(done);
      }
    }

    $("check-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var code = $("c-code").value.toUpperCase().replace(/[^A-Z0-9]/g, "");
      found = read(PICKUPS_KEY).filter(function (p) {
        return p.code === code;
      })[0] || null;
      showResult();
    });
  }

  if ($("list")) offersPage();
  if ($("tickets")) pickupsPage();
  if ($("post-form")) storesPage();
})();
