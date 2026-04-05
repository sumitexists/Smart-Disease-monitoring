(function () {
  "use strict";

  var pincodeInput = document.getElementById("heatmap-pincode");
  var pincodeDatalist = document.getElementById("heatmap-pincode-suggestions");
  var areaSelect = document.getElementById("heatmap-area");
  var cityInput = document.getElementById("heatmap-city");
  var heatmapForm = document.getElementById("heatmap-location-form");
  var isReadonly = pincodeInput && pincodeInput.hasAttribute("readonly");
  var urlParams = new URLSearchParams(window.location.search);
  var urlSelectedPincode = urlParams.get("pincode") || "";
  var urlSelectedArea = urlParams.get("area") || "";

  function getJSON(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    try {
      return JSON.parse(el.textContent);
    } catch (err) {
      return null;
    }
  }

  var pincodeMap = getJSON("heatmap-pincode-map") || {};
  var pincodeList = getJSON("heatmap-pincode-list") || [];
  var selectedArea = getJSON("selected-area") || "";
  var selectedCity = getJSON("selected-city") || "";

  document.querySelectorAll(".heat-cell[data-heat-alpha]").forEach(function (cell) {
    var alpha = cell.getAttribute("data-heat-alpha") || "0.06";
    cell.style.setProperty("--heat-alpha", alpha);
  });

  function renderPincodeSuggestions(query) {
    if (!pincodeDatalist) return;

    var q = (query || "").trim();
    var suggestions = pincodeList;

    if (q) {
      suggestions = pincodeList.filter(function (pin) {
        return pin.indexOf(q) !== -1;
      });
    }

    suggestions = suggestions.slice(0, 15);
    pincodeDatalist.innerHTML = "";

    suggestions.forEach(function (pin) {
      var opt = document.createElement("option");
      opt.value = pin;
      pincodeDatalist.appendChild(opt);
    });
  }

  function populateAreas(pin, keepArea) {
    if (!areaSelect) return;
    var entry = pincodeMap[pin] || {};
    var areas = Array.isArray(entry.areas) ? entry.areas : [];

    areaSelect.innerHTML = '<option value="">Select area</option>';
    areas.forEach(function (name) {
      var opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      if (keepArea && name === keepArea) {
        opt.selected = true;
      }
      areaSelect.appendChild(opt);
    });

    if (keepArea) {
      areaSelect.value = keepArea;
    }
  }

  function syncCity(pin, fallbackCity) {
    if (!cityInput) return;
    var entry = pincodeMap[pin] || null;
    if (entry && entry.city) {
      cityInput.value = entry.city;
      cityInput.setAttribute("title", "Auto-matched from pincode");
      return;
    }
    if (fallbackCity) {
      cityInput.value = fallbackCity;
      return;
    }
    cityInput.value = "";
  }

  function submitSelectedLocation(pin, area) {
    if (!heatmapForm || !pincodeInput || !areaSelect) return;

    pincodeInput.value = pin;
    areaSelect.disabled = false;
    populateAreas(pin, area);
    syncCity(pin, "");
    areaSelect.value = area;

    if (pincodeInput.hasAttribute("readonly")) {
      pincodeInput.setAttribute("readonly", "readonly");
    }

    heatmapForm.requestSubmit ? heatmapForm.requestSubmit() : heatmapForm.submit();
  }

  function setupCanvas(canvas) {
    if (!canvas) return null;
    var rect = canvas.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, width: rect.width, height: rect.height };
  }

  function drawNoData(canvas, text) {
    var setup = setupCanvas(canvas);
    if (!setup) return;
    var ctx = setup.ctx;
    ctx.clearRect(0, 0, setup.width, setup.height);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "14px Inter, sans-serif";
    ctx.fillText(text, 18, 28);
  }

  function drawLineChart(canvas, labels, values) {
    var setup = setupCanvas(canvas);
    if (!setup) return;
    var ctx = setup.ctx;
    var width = setup.width;
    var height = setup.height;
    ctx.clearRect(0, 0, width, height);

    if (!values.length) {
      drawNoData(canvas, "No trend data available for this location.");
      return;
    }

    var pad = { top: 18, right: 16, bottom: 34, left: 36 };
    var plotW = width - pad.left - pad.right;
    var plotH = height - pad.top - pad.bottom;
    var maxVal = Math.max.apply(null, values.concat([1]));
    var stepX = labels.length > 1 ? plotW / (labels.length - 1) : plotW;

    ctx.strokeStyle = "rgba(148, 163, 184, 0.18)";
    ctx.lineWidth = 1;
    for (var i = 0; i <= 4; i++) {
      var y = pad.top + (plotH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
    }

    var points = values.map(function (value, index) {
      var x = pad.left + stepX * index;
      var y = pad.top + plotH - (value / maxVal) * plotH;
      return { x: x, y: y, value: value };
    });

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (var p = 1; p < points.length; p++) {
      ctx.lineTo(points[p].x, points[p].y);
    }
    ctx.strokeStyle = "#818cf8";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(points[0].x, pad.top + plotH);
    points.forEach(function (point) {
      ctx.lineTo(point.x, point.y);
    });
    ctx.lineTo(points[points.length - 1].x, pad.top + plotH);
    ctx.closePath();
    ctx.fillStyle = "rgba(129, 140, 248, 0.18)";
    ctx.fill();

    points.forEach(function (point) {
      ctx.beginPath();
      ctx.fillStyle = "#818cf8";
      ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px Inter, sans-serif";
    labels.forEach(function (label, index) {
      var x = pad.left + stepX * index;
      ctx.save();
      ctx.translate(x, height - 10);
      ctx.rotate(-0.25);
      ctx.fillText(label, -18, 0);
      ctx.restore();
    });
  }

  function drawBarChart(canvas, labels, values) {
    var setup = setupCanvas(canvas);
    if (!setup) return;
    var ctx = setup.ctx;
    var width = setup.width;
    var height = setup.height;
    ctx.clearRect(0, 0, width, height);

    if (!values.length) {
      drawNoData(canvas, "No city comparison data available.");
      return;
    }

    var pad = { top: 18, right: 16, bottom: 54, left: 40 };
    var plotW = width - pad.left - pad.right;
    var plotH = height - pad.top - pad.bottom;
    var maxVal = Math.max.apply(null, values.concat([1]));
    var gap = 12;
    var barW = Math.max(16, (plotW - gap * (values.length - 1)) / values.length);

    ctx.strokeStyle = "rgba(148, 163, 184, 0.18)";
    ctx.lineWidth = 1;
    for (var i = 0; i <= 4; i++) {
      var y = pad.top + (plotH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
    }

    values.forEach(function (value, index) {
      var barH = (value / maxVal) * plotH;
      var x = pad.left + index * (barW + gap);
      var y = pad.top + plotH - barH;
      ctx.fillStyle = "rgba(245, 158, 11, 0.72)";
      ctx.fillRect(x, y, barW, barH);
      ctx.fillStyle = "#f1f5f9";
      ctx.font = "11px Inter, sans-serif";
      ctx.fillText(String(value), x + 2, y - 6);

      ctx.save();
      ctx.translate(x + barW / 2, height - 12);
      ctx.rotate(-0.35);
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(labels[index] || "", -24, 0);
      ctx.restore();
    });
  }

  function drawPieChart(canvas, labels, values) {
    var setup = setupCanvas(canvas);
    if (!setup) return;
    var ctx = setup.ctx;
    var width = setup.width;
    var height = setup.height;
    ctx.clearRect(0, 0, width, height);

    if (!values.length) {
      drawNoData(canvas, "No disease data available.");
      return;
    }

    var total = values.reduce(function (sum, val) { return sum + val; }, 0);
    if (total === 0) {
      drawNoData(canvas, "No disease data available.");
      return;
    }

    var centerX = width / 2;
    var centerY = height / 2.2;
    var radius = Math.min(width, height) / 2.8;
    var colors = [
      "#818cf8", "#f87171", "#fbbf24", "#34d399", "#60a5fa",
      "#a78bfa", "#fb7185", "#f97316", "#10b981", "#6366f1"
    ];

    var currentAngle = -Math.PI / 2;
    var labelRadius = radius + 40;

    values.forEach(function (value, index) {
      var sliceAngle = (value / total) * 2 * Math.PI;

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      ctx.lineTo(centerX, centerY);
      ctx.closePath();
      ctx.fillStyle = colors[index % colors.length];
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.stroke();

      if (value > total * 0.05) {
        var labelAngle = currentAngle + sliceAngle / 2;
        var labelX = centerX + Math.cos(labelAngle) * labelRadius;
        var labelY = centerY + Math.sin(labelAngle) * labelRadius;

        var percentage = ((value / total) * 100).toFixed(1);
        ctx.fillStyle = "#1e293b";
        ctx.font = "bold 12px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(percentage + "%", labelX, labelY);
      }

      currentAngle += sliceAngle;
    });

    var legendX = 10;
    var legendY = height - 80;
    ctx.font = "11px Inter, sans-serif";
    ctx.textAlign = "left";
    labels.forEach(function (label, index) {
      var color = colors[index % colors.length];
      ctx.fillStyle = color;
      ctx.fillRect(legendX, legendY + index * 14, 10, 10);
      ctx.fillStyle = "#475569";
      ctx.fillText(labels[index] + " (" + values[index] + ")", legendX + 16, legendY + index * 14 + 5);
    });
  }

  function drawDiseaseTrendChart(canvas, days, diseaseNames, trendData) {
    var setup = setupCanvas(canvas);
    if (!setup) return;
    var ctx = setup.ctx;
    var width = setup.width;
    var height = setup.height;
    ctx.clearRect(0, 0, width, height);

    if (!days.length || !diseaseNames.length) {
      drawNoData(canvas, "No disease trend data available.");
      return;
    }

    var colors = [
      "#818cf8", "#f87171", "#fbbf24", "#34d399", "#60a5fa",
      "#a78bfa", "#fb7185", "#f97316", "#10b981", "#6366f1"
    ];

    var pad = { top: 18, right: 16, bottom: 54, left: 40 };
    var plotW = width - pad.left - pad.right;
    var plotH = height - pad.top - pad.bottom;

    // Find max value for scaling
    var maxVal = 0;
    diseaseNames.forEach(function (disease) {
      var values = trendData[disease] || [];
      values.forEach(function (val) {
        maxVal = Math.max(maxVal, val);
      });
    });
    maxVal = Math.max(maxVal, 1);

    // Draw grid lines
    ctx.strokeStyle = "rgba(148, 163, 184, 0.18)";
    ctx.lineWidth = 1;
    for (var i = 0; i <= 4; i++) {
      var y = pad.top + (plotH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
    }

    // Draw stacked bars
    var barW = Math.floor(plotW / days.length * 0.7);
    var gap = plotW / days.length;

    for (var dayIndex = 0; dayIndex < days.length; dayIndex++) {
      var stackedY = pad.top + plotH;
      var barX = pad.left + dayIndex * gap + (gap - barW) / 2;

      diseaseNames.forEach(function (disease, colorIndex) {
        var values = trendData[disease] || [];
        var value = values[dayIndex] || 0;
        var barH = (value / maxVal) * plotH;

        ctx.fillStyle = colors[colorIndex % colors.length];
        ctx.fillRect(barX, stackedY - barH, barW, barH);

        stackedY -= barH;
      });
    }

    // Draw x-axis labels
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px Inter, sans-serif";
    days.forEach(function (day, index) {
      var x = pad.left + index * gap + gap / 2;
      ctx.save();
      ctx.translate(x, height - 12);
      ctx.rotate(-0.25);
      ctx.textAlign = "right";
      ctx.fillText(day, 0, 0);
      ctx.restore();
    });

    // Draw legend
    var legendX = 10;
    var legendY = Math.max(height - 80, pad.top + plotH + 20);
    ctx.font = "11px Inter, sans-serif";
    ctx.textAlign = "left";
    diseaseNames.forEach(function (disease, colorIndex) {
      var color = colors[colorIndex % colors.length];
      ctx.fillStyle = color;
      ctx.fillRect(legendX, legendY + colorIndex * 14, 10, 10);
      ctx.fillStyle = "#475569";
      ctx.fillText(disease, legendX + 16, legendY + colorIndex * 14 + 5);
    });
  }


  if (pincodeInput && areaSelect) {
    var initialPincode = urlSelectedPincode || pincodeInput.value;
    var initialArea = urlSelectedArea || selectedArea;

    renderPincodeSuggestions(initialPincode);
    populateAreas(initialPincode, initialArea);
    syncCity(initialPincode, selectedCity);
    pincodeInput.value = initialPincode;
    if (initialArea) {
      areaSelect.value = initialArea;
    }

    if (!isReadonly) {
      pincodeInput.addEventListener("input", function () {
        var value = pincodeInput.value.replace(/\D/g, "").slice(0, 6);
        pincodeInput.value = value;
        renderPincodeSuggestions(value);

        if (value.length === 6) {
          populateAreas(value, "");
          syncCity(value, "");
        } else {
          areaSelect.innerHTML = '<option value="">Select area</option>';
          syncCity("", "");
        }
      });
    }
  }

  document.querySelectorAll(".heat-cell-button[data-pincode][data-area]").forEach(function (cell) {
    cell.addEventListener("click", function () {
      submitSelectedLocation(cell.getAttribute("data-pincode") || "", cell.getAttribute("data-area") || "");
    });
  });

  drawBarChart(document.getElementById("disease-bar-chart"), getJSON("disease-labels") || [], getJSON("disease-values") || []);
  drawPieChart(document.getElementById("disease-pie-chart"), getJSON("disease-labels") || [], getJSON("disease-values") || []);
  drawDiseaseTrendChart(document.getElementById("disease-trend-chart"), getJSON("trend-days") || [], getJSON("disease-names-7d") || [], getJSON("trend-data") || {});
  drawBarChart(document.getElementById("city-compare-chart"), getJSON("city-area-labels") || [], getJSON("city-area-values") || []);
})();
