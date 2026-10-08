/**
 * analytics-page.js — Logic for analytics.html
 */

// ── Chart instances ──────────────────────────────────────────────────────────
let chartTempHum = null;
let chartLdr     = null;
let chartIr      = null;
let histLdr      = null;
let histTemp     = null;
let histHum      = null;

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 300 },
  plugins: { legend: { labels: { color: '#c8d8e8', font: { family: 'Share Tech Mono', size: 11 } } } },
  scales: {
    x: { ticks: { color: '#5a6a7a', maxTicksLimit: 8, font: { size: 10 } }, grid: { color: 'rgba(0,212,255,0.06)' } },
    y: { ticks: { color: '#5a6a7a', font: { size: 10 } }, grid: { color: 'rgba(0,212,255,0.06)' } },
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v, d = 2) {
  return v == null ? '--' : Number(v).toFixed(d);
}

function buildHistogram(values, bins = 20) {
  if (!values || !values.length) return { labels: [], counts: [] };
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = (max - min) / bins || 1;
  const counts = new Array(bins).fill(0);
  const labels = [];
  for (let i = 0; i < bins; i++) {
    labels.push(fmt(min + i * step, 1));
  }
  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / step), bins - 1);
    counts[idx]++;
  }
  return { labels, counts };
}

function makeOrUpdate(existing, canvasId, config) {
  if (existing) { existing.destroy(); }
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;
  return new Chart(ctx, config);
}

// ── Summary stats ────────────────────────────────────────────────────────────

function populateStats(summary) {
  if (!summary) return;
  const channels = ['temp', 'hum', 'ldr', 'ir1', 'ir2'];
  for (const ch of channels) {
    const s = summary[ch];
    if (!s) continue;
    const el = (id) => document.getElementById(`stat-${ch}-${id}`);
    el('mean').textContent = fmt(s.mean);
    el('min').textContent  = fmt(s.min);
    el('max').textContent  = fmt(s.max);
    el('std').textContent  = fmt(s.std);
  }
}

// ── Time-series charts ───────────────────────────────────────────────────────

function renderTimeSeries(history) {
  if (!history || !history.length) {
    ['chart-temphum', 'chart-ldr', 'chart-ir'].forEach(id => {
      const ctx = document.getElementById(id);
      if (ctx) ctx.parentElement.innerHTML = '<div class="empty-state">No data available</div>';
    });
    return;
  }

  const labels = history.map((_, i) => i);

  // Temp + Hum dual-axis
  chartTempHum = makeOrUpdate(chartTempHum, 'chart-temphum', {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Temp (°C)',
          data: history.map(r => r.temp),
          borderColor: '#ff6b6b',
          backgroundColor: 'rgba(255,107,107,0.08)',
          borderWidth: 1.5,
          pointRadius: 0,
          yAxisID: 'y',
          tension: 0.3,
        },
        {
          label: 'Humidity (%)',
          data: history.map(r => r.hum),
          borderColor: '#00d4ff',
          backgroundColor: 'rgba(0,212,255,0.06)',
          borderWidth: 1.5,
          pointRadius: 0,
          yAxisID: 'y1',
          tension: 0.3,
        },
      ],
    },
    options: {
      ...CHART_DEFAULTS,
      scales: {
        x: CHART_DEFAULTS.scales.x,
        y:  { ...CHART_DEFAULTS.scales.y, position: 'left',  title: { display: true, text: '°C',  color: '#ff6b6b', font: { size: 10 } } },
        y1: { ...CHART_DEFAULTS.scales.y, position: 'right', title: { display: true, text: '%',   color: '#00d4ff', font: { size: 10 } }, grid: { drawOnChartArea: false } },
      },
    },
  });

  // LDR
  chartLdr = makeOrUpdate(chartLdr, 'chart-ldr', {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'LDR',
        data: history.map(r => r.ldr),
        borderColor: '#ffaa00',
        backgroundColor: 'rgba(255,170,0,0.07)',
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.3,
      }],
    },
    options: CHART_DEFAULTS,
  });

  // IR1 + IR2
  chartIr = makeOrUpdate(chartIr, 'chart-ir', {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'IR1',
          data: history.map(r => r.ir1),
          borderColor: '#00d4ff',
          borderWidth: 1.5,
          pointRadius: 0,
          stepped: true,
        },
        {
          label: 'IR2',
          data: history.map(r => r.ir2),
          borderColor: '#ffaa00',
          borderWidth: 1.5,
          pointRadius: 0,
          stepped: true,
        },
      ],
    },
    options: CHART_DEFAULTS,
  });
}

// ── Histograms ───────────────────────────────────────────────────────────────

function renderHistograms(history) {
  if (!history || !history.length) return;

  const barOpts = {
    ...CHART_DEFAULTS,
    plugins: { legend: { display: false } },
  };

  const ldrH  = buildHistogram(history.map(r => r.ldr));
  const tempH = buildHistogram(history.map(r => r.temp));
  const humH  = buildHistogram(history.map(r => r.hum));

  histLdr = makeOrUpdate(histLdr, 'hist-ldr', {
    type: 'bar',
    data: { labels: ldrH.labels, datasets: [{ label: 'LDR', data: ldrH.counts, backgroundColor: 'rgba(255,170,0,0.5)', borderColor: '#ffaa00', borderWidth: 1 }] },
    options: barOpts,
  });

  histTemp = makeOrUpdate(histTemp, 'hist-temp', {
    type: 'bar',
    data: { labels: tempH.labels, datasets: [{ label: 'Temp', data: tempH.counts, backgroundColor: 'rgba(255,107,107,0.5)', borderColor: '#ff6b6b', borderWidth: 1 }] },
    options: barOpts,
  });

  histHum = makeOrUpdate(histHum, 'hist-hum', {
    type: 'bar',
    data: { labels: humH.labels, datasets: [{ label: 'Humidity', data: humH.counts, backgroundColor: 'rgba(0,212,255,0.4)', borderColor: '#00d4ff', borderWidth: 1 }] },
    options: barOpts,
  });
}

// ── Correlation heatmap ──────────────────────────────────────────────────────

const CORR_CHANNELS = ['temp', 'hum', 'ldr', 'ir1', 'ir2'];

function corrKey(a, b) {
  // API returns keys like "temp_hum", always smaller-index first
  const order = CORR_CHANNELS;
  const ia = order.indexOf(a), ib = order.indexOf(b);
  if (ia === ib) return null; // diagonal
  return ia < ib ? `${a}_${b}` : `${b}_${a}`;
}

function corrColor(v) {
  // blue (-1) → white (0) → red (+1)
  if (v > 0) {
    const t = v;
    const r = Math.round(255);
    const g = Math.round(255 * (1 - t));
    const b = Math.round(255 * (1 - t));
    return `rgb(${r},${g},${b})`;
  } else {
    const t = -v;
    const r = Math.round(255 * (1 - t));
    const g = Math.round(255 * (1 - t));
    const b = Math.round(255);
    return `rgb(${r},${g},${b})`;
  }
}

function drawCorrelationHeatmap(corr) {
  const canvas = document.getElementById('corr-canvas');
  if (!canvas) return;
  const n = CORR_CHANNELS.length;
  const cell = Math.floor(canvas.width / n);
  canvas.height = cell * n;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const a = CORR_CHANNELS[row];
      const b = CORR_CHANNELS[col];
      let val = 0;
      if (row === col) {
        val = 1;
      } else {
        const key = corrKey(a, b);
        val = (corr && key && corr[key] != null) ? corr[key] : 0;
      }

      ctx.fillStyle = corrColor(val);
      ctx.fillRect(col * cell, row * cell, cell, cell);

      // border
      ctx.strokeStyle = 'rgba(10,10,15,0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(col * cell, row * cell, cell, cell);

      // value text
      ctx.fillStyle = Math.abs(val) > 0.5 ? '#fff' : '#222';
      ctx.font = `bold ${Math.floor(cell * 0.22)}px Share Tech Mono, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(val.toFixed(2), col * cell + cell / 2, row * cell + cell / 2);
    }
  }

  // axis labels
  ctx.font = `${Math.floor(cell * 0.18)}px Orbitron, sans-serif`;
  ctx.fillStyle = '#5a6a7a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < n; i++) {
    // top labels
    ctx.fillText(CORR_CHANNELS[i].toUpperCase(), i * cell + cell / 2, -8);
  }
}

// ── Main refresh ─────────────────────────────────────────────────────────────

async function refresh() {
  const [summary, history, corr] = await Promise.all([
    getSummary(),
    getHistory(200),
    getCorrelation(),
  ]);

  populateStats(summary);
  renderTimeSeries(history);
  renderHistograms(history);
  drawCorrelationHeatmap(corr);
}

refresh();
setInterval(refresh, 30000);
