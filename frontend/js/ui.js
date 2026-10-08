// ui.js — Sensor and LED node rendering + Motion Detection Indicators
const UI = (() => {
  let prevSensors = {};
  let prevControl = {};

  // ── Helpers ──────────────────────────────────────────────────────────────
  function fmt(val, decimals = 1) {
    if (val === null || val === undefined) return '--';
    return typeof val === 'number' ? val.toFixed(decimals) : val;
  }

  function getLdrLabel(ldr) {
    if (ldr === null || ldr === undefined) return '--';
    return ldr < 2000 ? 'DARK' : 'BRIGHT';
  }

  function getIrLabel(val) {
    if (val === null || val === undefined) return '--';
    return val === 1 ? 'MOTION' : 'CLEAR';
  }

  function getLedLabel(val) {
    return val === 1 ? 'ON' : 'OFF';
  }

  function pulse(el) {
    if (!el) return;
    el.classList.add('pulse-update');
    setTimeout(() => el.classList.remove('pulse-update'), 800);
  }

  // ── Sensor Nodes ─────────────────────────────────────────────────────────
  function updateSensorNodes(sensors) {
    // Temperature
    const tempVal = document.getElementById('temp-value');
    if (tempVal) {
      const newText = sensors.temp !== null && sensors.temp !== undefined
        ? `${parseFloat(sensors.temp).toFixed(1)}°C` : '--';
      if (tempVal.textContent !== newText) { tempVal.textContent = newText; pulse(tempVal.closest('.node-card')); }
    }

    // Humidity
    const humVal = document.getElementById('hum-value');
    if (humVal) {
      const newText = sensors.hum !== null && sensors.hum !== undefined
        ? `${parseFloat(sensors.hum).toFixed(1)}%` : '--';
      if (humVal.textContent !== newText) { humVal.textContent = newText; pulse(humVal.closest('.node-card')); }
    }

    // LDR
    const ldrVal = document.getElementById('ldr-value');
    const ldrLabel = document.getElementById('ldr-label');
    if (ldrVal) {
      const newText = sensors.ldr !== null && sensors.ldr !== undefined ? String(Math.round(sensors.ldr)) : '--';
      if (ldrVal.textContent !== newText) { ldrVal.textContent = newText; pulse(ldrVal.closest('.node-card')); }
    }
    if (ldrLabel) {
      ldrLabel.textContent = getLdrLabel(sensors.ldr);
      ldrLabel.className = 'ldr-badge ' + (sensors.ldr !== null && sensors.ldr < 2000 ? 'dark' : 'bright');
    }

    // IR1
    const ir1Val = document.getElementById('ir1-value');
    if (ir1Val) {
      const newText = getIrLabel(sensors.ir1);
      if (ir1Val.textContent !== newText) { ir1Val.textContent = newText; pulse(ir1Val.closest('.node-card')); }
      ir1Val.className = 'ir-state ' + (sensors.ir1 === 1 ? 'motion' : 'clear');
    }

    // IR2
    const ir2Val = document.getElementById('ir2-value');
    if (ir2Val) {
      const newText = getIrLabel(sensors.ir2);
      if (ir2Val.textContent !== newText) { ir2Val.textContent = newText; pulse(ir2Val.closest('.node-card')); }
      ir2Val.className = 'ir-state ' + (sensors.ir2 === 1 ? 'motion' : 'clear');
    }

    // Motion indicators
    updateMotionIndicators(sensors);
  }

  // ── LED Nodes ─────────────────────────────────────────────────────────────
  function updateLedNodes(control) {
    ['led1', 'led2'].forEach(k => {
      const card = document.getElementById(`node-${k}`);
      const label = document.getElementById(`${k}-label`);
      if (!card || !label) return;

      const isOn = control[k] === 1;
      const newText = getLedLabel(control[k]);

      if (label.textContent !== newText) {
        label.textContent = newText;
        if (typeof gsap !== 'undefined') {
          if (isOn) {
            gsap.fromTo(card, { boxShadow: '0 0 0px #ffab00' },
              { boxShadow: '0 0 30px #ffab00, 0 0 60px #ffab0066', duration: 0.6, ease: 'power2.out' });
          } else {
            gsap.to(card, { boxShadow: '0 0 0px #ffab00', duration: 0.6, ease: 'power2.in' });
          }
        }
      }

      card.classList.toggle('led-on', isOn);
      card.classList.toggle('led-off', !isOn);
    });
  }

  // ── Motion Indicators ─────────────────────────────────────────────────────
  function updateMotionIndicators(sensors) {
    ['ir1', 'ir2'].forEach(k => {
      const indicator = document.getElementById(`${k}-indicator`);
      if (!indicator) return;
      const isActive = sensors[k] === 1;
      indicator.classList.toggle('motion-active', isActive);
      indicator.classList.toggle('motion-inactive', !isActive);
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    Store.subscribe('sensors', ({ sensors }) => {
      updateSensorNodes(sensors);
      prevSensors = { ...sensors };
    });

    Store.subscribe('control', ({ control }) => {
      updateLedNodes(control);
      prevControl = { ...control };
    });
  }

  // Expose helpers for testing
  return { init, getLdrLabel, getIrLabel, getLedLabel, fmt };
})();
