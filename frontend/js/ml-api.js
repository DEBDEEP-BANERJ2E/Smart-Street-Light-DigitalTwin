/**
 * ml-api.js — Thin fetch wrapper for the ML microservice (http://localhost:5001)
 * Handles error banners, status dot, and exposes typed endpoint helpers.
 */

const ML_BASE = 'http://localhost:5001';

// ── Banner helpers ──────────────────────────────────────────────────────────

function showBanner(msg, type = 'error') {
  let el = document.getElementById('ml-banner');
  if (!el) return;
  el.textContent = msg;
  el.className = `ml-banner visible ${type === 'warn' ? 'ml-banner-warn' : 'ml-banner-error'}`;
}

function hideBanner() {
  const el = document.getElementById('ml-banner');
  if (el) { el.className = 'ml-banner'; el.textContent = ''; }
}

// ── Status dot ──────────────────────────────────────────────────────────────

function setStatusDot(online) {
  const dot = document.getElementById('ml-status-dot');
  if (!dot) return;
  if (online) {
    dot.classList.remove('offline');
    dot.title = 'ML Service online';
  } else {
    dot.classList.add('offline');
    dot.title = 'ML Service offline';
  }
}

// ── Core fetch wrapper ──────────────────────────────────────────────────────

async function mlFetch(path, options = {}) {
  const url = ML_BASE + path;
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });

    if (res.status === 503) {
      showBanner('Models not ready — service is training', 'warn');
      setStatusDot(true);
      return { ok: false, status: 503, data: null };
    }

    let data = null;
    try { data = await res.json(); } catch (_) { /* non-JSON body */ }

    if (!res.ok) {
      const msg = (data && data.error) ? data.error : `HTTP ${res.status}`;
      return { ok: false, status: res.status, data, error: msg };
    }

    hideBanner();
    setStatusDot(true);
    return { ok: true, status: res.status, data };

  } catch (err) {
    showBanner('ML Service offline — retrying in 30s', 'error');
    setStatusDot(false);
    return { ok: false, status: 0, data: null, error: err.message };
  }
}

// ── Health ping (auto every 30s) ────────────────────────────────────────────

async function getHealth() {
  const r = await mlFetch('/health');
  return r.data;
}

(function startHealthPing() {
  getHealth();
  setInterval(getHealth, 30000);
})();

// ── Analytics endpoints ─────────────────────────────────────────────────────

async function getSummary() {
  const r = await mlFetch('/analytics/summary');
  return r.ok ? r.data : null;
}

async function getHistory(limit = 200) {
  const r = await mlFetch(`/analytics/history?limit=${limit}`);
  return r.ok ? r.data : null;
}

async function getCorrelation() {
  const r = await mlFetch('/analytics/correlation');
  return r.ok ? r.data : null;
}

// ── Prediction endpoints ────────────────────────────────────────────────────

async function predictLed(features) {
  const r = await mlFetch('/predict/led', {
    method: 'POST',
    body: JSON.stringify(features),
  });
  return r.ok ? r.data : (r.error ? { error: r.error } : null);
}

async function predictLdr(steps = 10) {
  const r = await mlFetch(`/predict/ldr?steps=${steps}`);
  return r.ok ? r.data : null;
}

async function predictTemp(steps = 10) {
  const r = await mlFetch(`/predict/temperature?steps=${steps}`);
  return r.ok ? r.data : null;
}

// ── Fault endpoints ─────────────────────────────────────────────────────────

async function detectFaults(limit = 200) {
  const r = await mlFetch(`/faults/detect?limit=${limit}`);
  return r.ok ? r.data : null;
}

async function detectSingle(features) {
  const r = await mlFetch('/faults/detect-single', {
    method: 'POST',
    body: JSON.stringify(features),
  });
  return r.ok ? r.data : null;
}

async function getStuckSensors() {
  const r = await mlFetch('/faults/stuck-sensors');
  return r.ok ? r.data : null;
}

async function getOutliers() {
  const r = await mlFetch('/faults/outliers');
  return r.ok ? r.data : null;
}

async function getRecommendations() {
  const r = await mlFetch('/faults/recommendations');
  return r.ok ? r.data : null;
}

async function retrain() {
  const r = await mlFetch('/retrain', { method: 'POST' });
  return r.ok ? r.data : (r.error ? { error: r.error } : null);
}
