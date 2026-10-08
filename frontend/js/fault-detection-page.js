/**
 * fault-detection-page.js — Logic for fault-detection.html
 */

let chartAnomalyLdr = null;

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

// ── LDR anomaly chart ────────────────────────────────────────────────────────

function renderAnomalyChart(rows) {
  if (chartAnomalyLdr) { chartAnomalyLdr.destroy(); chartAnomalyLdr = null; }
  const ctx = document.getElementById('chart-anomaly-ldr');
  if (!ctx) return;

  if (!rows || !rows.length) {
    ctx.parentElement.innerHTML = '<div class="empty-state">No data available</div>';
    return;
  }

  const labels = rows.map((_, i) => i);
  const values = rows.map(r => r.ldr);
  const colors = rows.map(r => r.is_anomaly ? '#ffaa00' : '#00d4ff');
  const radii  = rows.map(r => r.is_anomaly ? 5 : 2);

  chartAnomalyLdr = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'LDR (cyan=normal, amber=anomaly)',
        data: values,
        borderColor: '#00d4ff',
        borderWidth: 1,
        pointBackgroundColor: colors,
        pointRadius: radii,
        pointHoverRadius: 6,
        tension: 0.3,
        fill: false,
      }],
    },
    options: CHART_BASE,
  });
}

// ── Count cards ──────────────────────────────────────────────────────────────

function updateCounts(anomalyCount, stuckCount, outlierCount) {
  const el = id => document.getElementById(id);
  el('count-anomalies').textContent = anomalyCount != null ? anomalyCount : '--';
  el('count-stuck').textContent     = stuckCount    != null ? stuckCount    : '--';
  el('count-outliers').textContent  = outlierCount  != null ? outlierCount  : '--';
}

// ── Stuck sensors table ──────────────────────────────────────────────────────

function renderStuckTable(data) {
  const wrap = document.getElementById('stuck-table-wrap');
  if (!wrap) return;

  if (!data || !data.length) {
    wrap.innerHTML = '<div class="empty-state">No stuck sensors detected</div>';
    return;
  }

  const rows = data.map(s => `
    <tr>
      <td><span class="badge badge-amber">${s.channel}</span></td>
      <td>${s.consecutive_count}</td>
      <td>${s.value}</td>
    </tr>
  `).join('');

  wrap.innerHTML = `
    <table class="ml-table">
      <thead><tr><th>Channel</th><th>Consecutive Count</th><th>Value</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ── Outliers table ───────────────────────────────────────────────────────────

function renderOutliersTable(data) {
  const wrap = document.getElementById('outliers-table-wrap');
  if (!wrap) return;

  if (!data || !data.length) {
    wrap.innerHTML = '<div class="empty-state">No outlier readings detected</div>';
    return;
  }

  const rows = data.map(o => {
    const ts = o.timestamp ? new Date(o.timestamp).toLocaleString() : '--';
    const fields = (o.outlier_fields || []).map(f => `<span class="badge badge-red">${f}</span>`).join(' ');
    const vals = (o.outlier_fields || []).map(f => o[f] != null ? `${f}: ${o[f]}` : '').filter(Boolean).join(', ');
    return `<tr><td>${ts}</td><td>${fields}</td><td>${vals}</td></tr>`;
  }).join('');

  wrap.innerHTML = `
    <table class="ml-table">
      <thead><tr><th>Timestamp</th><th>Affected Fields</th><th>Values</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ── Main refresh ─────────────────────────────────────────────────────────────

async function refresh() {
  const [faults, stuck, outliers] = await Promise.all([
    detectFaults(200),
    getStuckSensors(),
    getOutliers(),
  ]);

  const anomalyCount = faults ? faults.filter(r => r.is_anomaly).length : null;
  const stuckCount   = stuck  ? stuck.length  : null;
  const outlierCount = outliers ? outliers.length : null;

  updateCounts(anomalyCount, stuckCount, outlierCount);
  renderAnomalyChart(faults);
  renderStuckTable(stuck);
  renderOutliersTable(outliers);
}

refresh();
setInterval(refresh, 30000);
