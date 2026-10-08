/**
 * prediction-page.js — Logic for prediction.html
 */

let chartLdrForecast  = null;
let chartTempForecast = null;

const CHART_BASE = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 300 },
  plugins: { legend: { labels: { color: '#c8d8e8', font: { family: 'Share Tech Mono', size: 11 } } } },
  scales: {
    x: { ticks: { color: '#5a6a7a', maxTicksLimit: 10, font: { size: 10 } }, grid: { color: 'rgba(0,212,255,0.06)' } },
    y: { ticks: { color: '#5a6a7a', font: { size: 10 } }, grid: { color: 'rgba(0,212,255,0.06)' } },
  },
};

// ── LED Prediction ────────────────────────────────────────────────────────────

function renderLedResult(data) {
  const box = document.getElementById('led-result');
  if (!box) return;
  if (data.error) {
    box.innerHTML = `<div style="color:var(--red);font-size:0.82rem">Error: ${data.error}</div>`;
    return;
  }
  const led1 = data.led1_prediction;
  const led2 = data.led2_prediction;
  const conf = data.confidence != null ? data.confidence : 0;
  const badge = (val, label) =>
    `<span style="margin-right:8px;font-size:0.75rem;color:var(--muted)">${label}</span>
     <span class="badge ${val ? 'badge-on' : 'badge-off'}">${val ? 'ON' : 'OFF'}</span>`;
  box.innerHTML = `
    <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;margin-bottom:12px">
      <div>${badge(led1, 'LED 1')}</div>
      <div>${badge(led2, 'LED 2')}</div>
    </div>
    <div class="confidence-bar-wrap">
      <div class="confidence-label">Confidence: ${(conf * 100).toFixed(1)}%</div>
      <div class="confidence-bar-bg">
        <div class="confidence-bar-fill" style="width:${(conf * 100).toFixed(1)}%"></div>
      </div>
    </div>`;
}

// Prevent form from navigating — use button click instead of form submit
document.getElementById('led-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  e.stopPropagation();
  const features = {
    ldr:  parseFloat(document.getElementById('in-ldr').value),
    ir1:  parseFloat(document.getElementById('in-ir1').value),
    ir2:  parseFloat(document.getElementById('in-ir2').value),
    temp: parseFloat(document.getElementById('in-temp').value),
    hum:  parseFloat(document.getElementById('in-hum').value),
  };
  if (Object.values(features).some(isNaN)) {
    document.getElementById('led-result').innerHTML =
      '<div style="color:var(--red);font-size:0.82rem">Please fill in all fields with valid numbers.</div>';
    return;
  }
  const result = await predictLed(features);
  if (result) renderLedResult(result);
  return false;
});

// ── Forecast chart helper ─────────────────────────────────────────────────────

function buildForecastChart(canvasId, existing, historical, forecast, label, histColor) {
  if (existing) existing.destroy();
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  const histLen = historical.length;
  const foreLen = forecast.length;

  // Labels: negative indices for history, positive for forecast
  const labels = [
    ...historical.map((_, i) => `t-${histLen - i}`),
    ...forecast.map((_, i) => `+${i + 1}`)
  ];

  // Bridge: last historical value repeated as first forecast point for visual continuity
  const lastHist = historical.length ? historical[historical.length - 1] : null;
  const histData = [...historical, ...new Array(foreLen).fill(null)];
  // Forecast starts one step before the end of history for visual connection
  const foreData = [
    ...new Array(histLen - 1).fill(null),
    lastHist,  // bridge point
    ...forecast
  ];

  return new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: `${label} — actual`,
          data: histData,
          borderColor: histColor,
          backgroundColor: `${histColor}18`,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.3,
          fill: true,
          order: 2,
        },
        {
          label: `${label} — forecast`,
          data: foreData,
          borderColor: '#ffaa00',
          backgroundColor: 'rgba(255,170,0,0.1)',
          borderWidth: 2.5,
          segment: { borderDash: () => [7, 4] },
          pointRadius: (ctx) => ctx.dataIndex >= histLen ? 4 : 0,
          pointBackgroundColor: '#ffaa00',
          pointBorderColor: '#ffaa00',
          tension: 0.3,
          fill: true,
          order: 1,
        },
      ],
    },
    options: {
      ...CHART_BASE,
      plugins: {
        ...CHART_BASE.plugins,
        annotation: {
          annotations: {
            divider: {
              type: 'line',
              xMin: histLen - 1,
              xMax: histLen - 1,
              borderColor: 'rgba(255,255,255,0.25)',
              borderWidth: 1,
              borderDash: [4, 4],
              label: {
                display: true,
                content: 'NOW',
                color: 'rgba(255,255,255,0.4)',
                font: { size: 9, family: 'Orbitron' },
                position: 'start',
              }
            }
          }
        }
      }
    },
  });
}

// ── LDR Forecast ──────────────────────────────────────────────────────────────

async function refreshLdrForecast() {
  const steps = parseInt(document.getElementById('ldr-steps').value, 10);

  // Fetch historical from Node backend directly (always available)
  let historical = [];
  try {
    const res = await fetch('http://localhost:3000/history?limit=80');
    const rows = await res.json();
    historical = rows.map(r => r.ldr).filter(v => v != null);
  } catch (_) {}

  const forecastData = await predictLdr(steps);
  if (!forecastData) return;

  chartLdrForecast = buildForecastChart(
    'chart-ldr-forecast', chartLdrForecast,
    historical, forecastData.forecast.map(f => f.value), 'LDR', '#00d4ff'
  );
}

const ldrSlider = document.getElementById('ldr-steps');
const ldrVal    = document.getElementById('ldr-steps-val');
ldrSlider.addEventListener('input', () => { ldrVal.textContent = ldrSlider.value; refreshLdrForecast(); });

// ── Temperature Forecast ──────────────────────────────────────────────────────

async function refreshTempForecast() {
  const steps = parseInt(document.getElementById('temp-steps').value, 10);

  // Fetch historical from Node backend directly
  let historical = [];
  try {
    const res = await fetch('http://localhost:3000/history?limit=80');
    const rows = await res.json();
    historical = rows.map(r => r.temp).filter(v => v != null);
  } catch (_) {}

  const forecastData = await predictTemp(steps);
  if (!forecastData) return;

  chartTempForecast = buildForecastChart(
    'chart-temp-forecast', chartTempForecast,
    historical, forecastData.forecast.map(f => f.value), 'Temp (°C)', '#ff6b6b'
  );
}

const tempSlider = document.getElementById('temp-steps');
const tempVal    = document.getElementById('temp-steps-val');
tempSlider.addEventListener('input', () => { tempVal.textContent = tempSlider.value; refreshTempForecast(); });

// ── Auto-refresh ──────────────────────────────────────────────────────────────

async function refresh() {
  await Promise.all([refreshLdrForecast(), refreshTempForecast()]);
}

refresh();
setInterval(refresh, 30000);
