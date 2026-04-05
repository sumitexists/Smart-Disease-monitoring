(function () {
  "use strict";

  function getJSON(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    try {
      return JSON.parse(el.textContent);
    } catch (err) {
      return null;
    }
  }

  var trendLabels = getJSON("trend-labels") || [];
  var diseaseTrendData = getJSON("disease-trend-data") || {};
  var diseaseList = getJSON("disease-list") || [];
  var topDiseaseNames = getJSON("top-disease-names") || [];
  var topDiseaseCounts = getJSON("top-disease-counts") || [];
  var areaLabels = getJSON("area-labels") || [];
  var areaCounts = getJSON("area-counts") || [];
  var severityLabels = getJSON("severity-labels") || [];
  var severityCounts = getJSON("severity-counts") || [];

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

  function drawMultilineChart(canvas, labels, dataObj) {
    var setup = setupCanvas(canvas);
    if (!setup) return;
    var ctx = setup.ctx;
    var width = setup.width;
    var height = setup.height;
    ctx.clearRect(0, 0, width, height);

    var diseasesToShow = Object.keys(dataObj).slice(0, 10);
    if (!diseasesToShow.length || !labels.length) {
      drawNoData(canvas, "No data available.");
      return;
    }

    var colors = [
      "#818cf8", "#f87171", "#fbbf24", "#34d399", "#60a5fa",
      "#a78bfa", "#fb7185", "#f97316", "#10b981", "#6366f1"
    ];

    var pad = { top: 18, right: 16, bottom: 54, left: 40 };
    var plotW = width - pad.left - pad.right;
    var plotH = height - pad.top - pad.bottom;

    var maxVal = 0;
    diseasesToShow.forEach(function (disease) {
      var values = dataObj[disease] || [];
      values.forEach(function (val) {
        maxVal = Math.max(maxVal, val);
      });
    });
    maxVal = Math.max(maxVal, 1);

    // Grid lines
    ctx.strokeStyle = "rgba(148, 163, 184, 0.18)";
    ctx.lineWidth = 1;
    for (var i = 0; i <= 4; i++) {
      var y = pad.top + (plotH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
    }

    var stepX = labels.length > 1 ? plotW / (labels.length - 1) : plotW;

    // Draw lines for each disease
    diseasesToShow.forEach(function (disease, colorIndex) {
      var values = dataObj[disease] || [];
      var points = values.map(function (value, index) {
        var x = pad.left + stepX * index;
        var y = pad.top + plotH - (value / maxVal) * plotH;
        return { x: x, y: y };
      });

      if (points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (var p = 1; p < points.length; p++) {
          ctx.lineTo(points[p].x, points[p].y);
        }
        ctx.strokeStyle = colors[colorIndex % colors.length];
        ctx.lineWidth = 2;
        ctx.stroke();

        points.forEach(function (point) {
          ctx.beginPath();
          ctx.fillStyle = colors[colorIndex % colors.length];
          ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    });

    // X-axis labels
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

    // Legend
    var legendX = 10;
    var legendY = height - 80;
    ctx.font = "10px Inter, sans-serif";
    ctx.textAlign = "left";
    diseasesToShow.forEach(function (disease, colorIndex) {
      var color = colors[colorIndex % colors.length];
      ctx.fillStyle = color;
      ctx.fillRect(legendX, legendY + colorIndex * 12, 8, 8);
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(disease.substring(0, 20), legendX + 12, legendY + colorIndex * 12 + 4);
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
      drawNoData(canvas, "No data available.");
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
      ctx.fillStyle = "rgba(129, 140, 248, 0.72)";
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
      drawNoData(canvas, "No data available.");
      return;
    }

    var total = values.reduce(function (sum, val) { return sum + val; }, 0);
    if (total === 0) {
      drawNoData(canvas, "No data available.");
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
      ctx.fillText(label + " (" + values[index] + ")", legendX + 16, legendY + index * 14 + 5);
    });
  }

  // Render charts
  drawMultilineChart(document.getElementById("disease-trend-main"), trendLabels, diseaseTrendData);
  drawBarChart(document.getElementById("top-diseases-chart"), topDiseaseNames, topDiseaseCounts);
  drawBarChart(document.getElementById("areas-chart"), areaLabels, areaCounts);
  drawPieChart(document.getElementById("severity-chart"), severityLabels, severityCounts);

  // Update metrics
  var totalReports = severityCounts.reduce(function (sum, val) { return sum + val; }, 0);
  document.getElementById("total-reports").textContent = totalReports;
  if (topDiseaseNames.length > 0) {
    document.getElementById("top-disease").textContent = topDiseaseNames[0];
  }

  // Populate table
  var tableBody = document.getElementById("diseases-table-body");
  if (tableBody) {
    tableBody.innerHTML = "";
    diseaseList.forEach(function (disease) {
      var counts = diseaseTrendData[disease] || [];
      var total = counts.reduce(function (sum, val) { return sum + val; }, 0);
      if (counts.length > 1) {
        var prev = counts[counts.length - 2];
        var curr = counts[counts.length - 1];
        var trendClass = curr > prev ? "trend-up" : (curr < prev ? "trend-down" : "trend-stable");
        var trendText = curr > prev ? "↑ Up" : (curr < prev ? "↓ Down" : "→ Stable");
      } else {
        var trendClass = "trend-stable";
        var trendText = "→ New";
      }

      var row = document.createElement("tr");
      row.innerHTML = 
        '<td class="disease-name">' + disease + '</td>' +
        '<td class="disease-count">' + total + '</td>' +
        '<td><span class="trend-indicator ' + trendClass + '">' + trendText + '</span></td>';
      tableBody.appendChild(row);
    });
  }
})();
