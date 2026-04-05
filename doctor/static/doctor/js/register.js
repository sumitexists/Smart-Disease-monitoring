/**
 * register.js  —  Password strength meter for the Register page
 * Smart Disease Monitor
 */

(function () {
  "use strict";

  const levels = [
    { min: 0,  max: 4,        color: "#ef4444", text: "Weak",   pct: "25%"  },
    { min: 4,  max: 7,        color: "#f59e0b", text: "Fair",   pct: "50%"  },
    { min: 7,  max: 10,       color: "#3b82f6", text: "Good",   pct: "75%"  },
    { min: 10, max: Infinity, color: "#22c55e", text: "Strong", pct: "100%" },
  ];

  function getScore(value) {
    let score = value.length;
    if (/[A-Z]/.test(value))       score += 1;
    if (/[0-9]/.test(value))       score += 1;
    if (/[^A-Za-z0-9]/.test(value)) score += 2;
    return score;
  }

  function getLevel(score) {
    return levels.find((l) => score >= l.min && score < l.max) || levels[levels.length - 1];
  }

  document.addEventListener("DOMContentLoaded", function () {
    const pwInput = document.getElementById("password1");
    const fill    = document.getElementById("strength-fill");
    const label   = document.getElementById("strength-label");

    if (!pwInput || !fill || !label) return;

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
  });
})();
