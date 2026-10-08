// alerts.js — Threshold evaluation, toast notifications, alert log
const Alerts = (() => {
  const TOAST_DURATION = 4000;

  function evaluate(sensors, thresholds, breachState) {
    const newAlerts = [];
    ['temp', 'hum', 'ldr'].forEach(sensor => {
      const val = sensors[sensor];
      if (val === null || val === undefined) return;
      const th = thresholds[sensor];
      if (!th) return;

      if (val > th.high && breachState[sensor] !== 'high') {
        breachState[sensor] = 'high';
        newAlerts.push({
          id: `${sensor}_${Date.now()}`,
          timestamp: new Date().toISOString(),
          sensor,
          value: val,
          direction: 'HIGH',
          threshold: th.high
        });
      } else if (val < th.low && breachState[sensor] !== 'low') {
        breachState[sensor] = 'low';
        newAlerts.push({
          id: `${sensor}_${Date.now()}`,
          timestamp: new Date().toISOString(),
          sensor,
          value: val,
          direction: 'LOW',
          threshold: th.low
        });
      } else if (val >= th.low && val <= th.high) {
        breachState[sensor] = null;
      }
    });
    return newAlerts;
  }

  function showToast(alert) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${alert.direction.toLowerCase()}`;
    toast.innerHTML = `
      <span class="toast-icon">${alert.direction === 'HIGH' ? '🔴' : '🔵'}</span>
      <span class="toast-msg">
        <strong>${alert.sensor.toUpperCase()}</strong> ${alert.direction}: 
        ${typeof alert.value === 'number' ? alert.value.toFixed(1) : alert.value} 
        (threshold: ${alert.threshold})
      </span>
      <button class="toast-close" onclick="this.parentElement.remove()">×</button>`;

    container.appendChild(toast);
    setTimeout(() => toast.remove(), TOAST_DURATION);
  }

  function renderAlertLog(alerts) {
    const log = document.getElementById('alert-log');
    if (!log) return;
    log.innerHTML = alerts.map(a => {
      const ts = new Date(a.timestamp).toLocaleTimeString();
      return `<div class="alert-entry alert-${a.direction.toLowerCase()}">
        <span class="alert-ts">${ts}</span>
        <span class="alert-sensor">${a.sensor.toUpperCase()}</span>
        <span class="alert-dir">${a.direction}</span>
        <span class="alert-val">${typeof a.value === 'number' ? a.value.toFixed(1) : a.value}</span>
      </div>`;
    }).join('');
  }

  function init() {
    Store.subscribe('sensors', ({ sensors }) => {
      const state = Store.getState();
      const newAlerts = evaluate(sensors, state.thresholds, state.breachState);
      newAlerts.forEach(alert => {
        Store.addAlert(alert);
        showToast(alert);
      });
    });

    Store.subscribe('alert', alerts => {
      renderAlertLog(alerts);
    });
  }

  return { init, evaluate };
})();
