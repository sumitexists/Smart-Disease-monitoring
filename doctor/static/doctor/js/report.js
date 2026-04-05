/**
 * report.js  —  Pincode → area dropdown + symptom chip selection
 * Smart Disease Monitor
 */

(function () {
  "use strict";

  // Path to the JSON data file (injected from template via data-attribute)
  const scriptEl   = document.getElementById("report-script");
  const JSON_URL   = scriptEl ? scriptEl.dataset.jsonUrl : "";

  let pincodeData  = {};

  // ── Load JSON ────────────────────────────────────────────────
  fetch(JSON_URL)
    .then(function (res) { return res.json(); })
    .then(function (data) { pincodeData = data; })
    .catch(function () { console.warn("Could not load NCR pincode data."); });

  document.addEventListener("DOMContentLoaded", function () {

    const pincodeInput  = document.getElementById("pincode");
    const areaSelect    = document.getElementById("area");
    const areaWrapper   = document.getElementById("area-wrapper");
    const pincodeStatus = document.getElementById("pincode-status");

    // ── Pincode lookup ────────────────────────────────────────
    function lookupPincode(pin) {
      const entry = pincodeData[pin];

      // Reset
      areaSelect.innerHTML = '<option value="">— Select area —</option>';
      pincodeStatus.textContent = "";
      pincodeStatus.className   = "pincode-status";

      if (!entry) {
        areaWrapper.style.display = "none";
        if (pin.length === 6) {
          pincodeStatus.textContent = "⚠ Pincode not found in NCR database.";
          pincodeStatus.classList.add("error");
        }
        return;
      }

      // Populate
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

    if (pincodeInput) {
      pincodeInput.addEventListener("input", function () {
        const val = pincodeInput.value.replace(/\D/g, "").slice(0, 6);
        pincodeInput.value = val;
        if (val.length === 6) lookupPincode(val);
        else {
          areaWrapper.style.display = "none";
          pincodeStatus.textContent = "";
        }
      });
    }

    // ── Symptom chip toggle ───────────────────────────────────
    document.querySelectorAll(".symptom-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        chip.classList.toggle("selected");
        const cb = chip.querySelector("input[type='checkbox']");
        if (cb) cb.checked = !cb.checked;
      });
    });

    // ── Form validation ───────────────────────────────────────
    const form = document.getElementById("report-form");
    if (form) {
      form.addEventListener("submit", function (e) {
        const anySymptom = form.querySelectorAll(".symptom-chip.selected").length > 0
                        || form.querySelector("#other_symptoms").value.trim().length > 0;
        const pin    = (pincodeInput ? pincodeInput.value : "").length === 6;
        const area   = areaSelect && areaSelect.value;

        if (!anySymptom) {
          e.preventDefault();
          showFormError("Please select at least one symptom.");
          return;
        }
        if (!pin) {
          e.preventDefault();
          showFormError("Please enter a valid 6-digit NCR pincode.");
          return;
        }
        if (!area) {
          e.preventDefault();
          showFormError("Please select your area.");
        }
      });
    }

    function showFormError(msg) {
      let el = document.getElementById("form-error");
      if (!el) {
        el = document.createElement("div");
        el.id = "form-error";
        el.className = "alert-strip error";
        form.prepend(el);
      }
      el.textContent = "⚠ " + msg;
      el.style.display = "flex";
    }

  });

})();
