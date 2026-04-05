/**
 * register.js  —  Password strength meter + Pincode → area lookup
 * Smart Disease Monitor
 */

(function () {
  "use strict";

  // ── Password strength ─────────────────────────────────────────
  const levels = [
    { min: 0,  max: 4,        color: "#ef4444", text: "Weak",   pct: "25%"  },
    { min: 4,  max: 7,        color: "#f59e0b", text: "Fair",   pct: "50%"  },
    { min: 7,  max: 10,       color: "#3b82f6", text: "Good",   pct: "75%"  },
    { min: 10, max: Infinity, color: "#22c55e", text: "Strong", pct: "100%" },
  ];

  function getScore(value) {
    let score = value.length;
    if (/[A-Z]/.test(value))        score += 1;
    if (/[0-9]/.test(value))        score += 1;
    if (/[^A-Za-z0-9]/.test(value)) score += 2;
    return score;
  }

  function getLevel(score) {
    return levels.find((l) => score >= l.min && score < l.max) || levels[levels.length - 1];
  }

  // ── Load NCR pincode JSON (same as report.js) ─────────────────
  const scriptEl = document.getElementById("register-script");
  const JSON_URL = scriptEl ? scriptEl.dataset.jsonUrl : "";
  let pincodeData = {};

  fetch(JSON_URL)
    .then(function (res) { return res.json(); })
    .then(function (data) {
      pincodeData = data;
      // If the page was reloaded with a pre-filled pincode (POST error), re-run lookup
      const pin = document.getElementById("reg-pincode");
      if (pin && pin.value.length === 6) lookupPincode(pin.value);
    })
    .catch(function () { console.warn("Could not load NCR pincode data."); });

  // ── Pincode lookup ────────────────────────────────────────────
  function lookupPincode(pin) {
    const areaSelect       = document.getElementById("reg-area");
    const areaWrapper      = document.getElementById("area-wrapper");
    const pincodeStatus    = document.getElementById("reg-pincode-status");
    const unavailBanner    = document.getElementById("unavailable-banner");

    // Reset state
    areaSelect.innerHTML = '<option value="">— Select area —</option>';
    pincodeStatus.textContent = "";
    pincodeStatus.className   = "pincode-status";
    areaWrapper.style.display = "none";
    unavailBanner.style.display = "none";

    if (pin.length !== 6) return;

    const entry = pincodeData[pin];

    if (!entry) {
      // Not in our JSON → service not available
      pincodeStatus.textContent = "⚠ Pincode not found in NCR database.";
      pincodeStatus.classList.add("error");
      unavailBanner.style.display = "flex";
      return;
    }

    // Found → show area dropdown
    pincodeStatus.textContent = "✓ " + entry.city;
    pincodeStatus.classList.add("ok");

    entry.areas.forEach(function (area) {
      const opt = document.createElement("option");
      opt.value = area;
      opt.textContent = area;
      areaSelect.appendChild(opt);
    });

    areaWrapper.style.display = "block";
  }

  // ── DOMContentLoaded wiring ───────────────────────────────────
  document.addEventListener("DOMContentLoaded", function () {

    // Password strength
    const pwInput = document.getElementById("password1");
    const fill    = document.getElementById("strength-fill");
    const label   = document.getElementById("strength-label");

    if (pwInput && fill && label) {
      pwInput.addEventListener("input", function () {
        const val = pwInput.value;
        if (!val) {
          fill.style.width      = "0";
          fill.style.background = "";
          label.textContent     = "";
          return;
        }
        const lvl = getLevel(getScore(val));
        fill.style.width      = lvl.pct;
        fill.style.background = lvl.color;
        label.textContent     = "Strength: " + lvl.text;
        label.style.color     = lvl.color;
      });
    }

    // Pincode input
    const pincodeInput = document.getElementById("reg-pincode");
    if (pincodeInput) {
      pincodeInput.addEventListener("input", function () {
        // Allow digits only, max 6
        const val = pincodeInput.value.replace(/\D/g, "").slice(0, 6);
        pincodeInput.value = val;
        lookupPincode(val);
      });
    }

  });

})();
