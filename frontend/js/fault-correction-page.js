/**
 * fault-correction-page.js — Logic for fault-correction.html
 */

// ── Recommendations ──────────────────────────────────────────────────────────

const FAULT_BADGE = {
  stuck_sensor:        'badge-amber',
  outlier:             'badge-cyan',
  persistent_anomaly:  'badge-red',
};

function renderRecommendations(data) {
  const grid = document.getElementById('rec-grid');
  if (!grid) return;

  if (!data || !data.length) {
    grid.innerHTML = '<div class="empty-state">No recommendations — system looks healthy</div>';
    return;
  }

  grid.innerHTML = data.map(rec => {
    const badgeCls = FAULT_BADGE[rec.fault_type] || 'badge-cyan';
    return `
      <div class="rec-card">
        <div class="rec-card-header">
          <span class="badge ${badgeCls}">${(rec.fault_type || '').replace(/_/g, ' ').toUpperCase()}</span>
          <span class="rec-card-channel">${rec.affected_channel || ''}</span>
        </div>
        <div class="rec-card-desc">${rec.description || ''}</div>
        <div class="rec-card-action">→ ${rec.suggested_action || ''}</div>
      </div>
    `;
  }).join('');
}

// ── Health / model status ────────────────────────────────────────────────────

function renderHealth(data) {
  const panel = document.getElementById('health-panel');
  if (!panel) return;

  if (!data) {
    panel.innerHTML = '<div class="empty-state">ML Service unreachable</div>';
    return;
  }

  const rows = Object.entries(data).map(([k, v]) => `
    <div class="health-row">
      <span class="health-key">${k}</span>
      <span class="health-val">${JSON.stringify(v)}</span>
    </div>
  `).join('');

  panel.innerHTML = rows || '<div class="empty-state">No health data</div>';
}

// ── Retrain button ───────────────────────────────────────────────────────────

document.getElementById('retrain-btn').addEventListener('click', async () => {
  const btn = document.getElementById('retrain-btn');
  const resultEl = document.getElementById('retrain-result');
  btn.disabled = true;
  btn.textContent = '⏳ Retraining...';

  const result = await retrain();

  btn.disabled = false;
  btn.textContent = '🔄 Retrain Models';

  if (!result) {
    resultEl.textContent = 'Retrain failed — check ML service.';
    resultEl.classList.add('visible');
    return;
  }
  if (result.error) {
    resultEl.textContent = `Error: ${result.error}`;
    resultEl.classList.add('visible');
    return;
  }

  const ts = result.trained_at ? new Date(result.trained_at).toLocaleString() : result.trained_at;
  resultEl.textContent = `✅ Retrained on ${result.rows_used} rows — completed at ${ts}`;
  resultEl.classList.add('visible');

  // Refresh health after retrain
  const health = await getHealth();
  renderHealth(health);
});

// ── Main refresh ─────────────────────────────────────────────────────────────

async function refresh() {
  const [recs, health] = await Promise.all([
    getRecommendations(),
    getHealth(),
  ]);
  renderRecommendations(recs);
  renderHealth(health);
}

refresh();
setInterval(refresh, 30000);
