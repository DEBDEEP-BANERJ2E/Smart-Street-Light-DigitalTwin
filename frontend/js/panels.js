// panels.js — Environmental, Light Condition, and System Status panels
const Panels = (() => {
  function computeHeatIndex(temp, hum) {
    if (temp === null || hum === null || temp === undefined || hum === undefined) return null;
    return parseFloat((temp + 0.33 * hum - 4).toFixed(1));
  }

  function computeBrightness(ldr) {
    if (ldr === null || ldr === undefined) return null;
    return parseFloat((Math.min(ldr / 4095 * 100, 100)).toFixed(1));
  }

  function getLightCondition(ldr) {
    if (ldr === null || ldr === undefined) return '--';
    if (ldr < 500)  return 'NIGHT';
    if (ldr < 2000) return 'DIM';
    return 'DAY';
  }

  function getLightIcon(condition) {
    if (condition === 'NIGHT') return '🌙';
    if (condition === 'DIM')   return '🌤';
    return '☀️';
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function updateEnvironmental(sensors) {
    const hi = computeHeatIndex(sensors.temp, sensors.hum);
    setText('env-temp',  sensors.temp !== null && sensors.temp !== undefined ? `${parseFloat(sensors.temp).toFixed(1)}°C` : '--');
    setText('env-hum',   sensors.hum  !== null && sensors.hum  !== undefined ? `${parseFloat(sensors.hum).toFixed(1)}%`  : '--');
    setText('env-hi',    hi !== null ? `${hi}°C` : '--');
  }

  function updateLightCondition(sensors) {
    const brightness = computeBrightness(sensors.ldr);
    const condition  = getLightCondition(sensors.ldr);
    const icon       = getLightIcon(condition);

    setText('light-ldr',        sensors.ldr !== null && sensors.ldr !== undefined ? String(Math.round(sensors.ldr)) : '--');
    setText('light-brightness', brightness !== null ? `${brightness}%` : '--');
    setText('light-condition',  `${icon} ${condition}`);
  }

  function updateSystemStatus(sensors, control, lastUpdated) {
    const ledCount    = (control.led1 === 1 ? 1 : 0) + (control.led2 === 1 ? 1 : 0);
    const motionCount = (sensors.ir1 === 1 ? 1 : 0) + (sensors.ir2 === 1 ? 1 : 0);

    setText('status-leds',    `${ledCount} / 2`);
    setText('status-motion',  `${motionCount} sensor${motionCount !== 1 ? 's' : ''}`);
    setText('status-updated', lastUpdated ? lastUpdated.toLocaleTimeString() : '--');
  }

  function init() {
    Store.subscribe('sensors', ({ sensors }) => {
      const state = Store.getState();
      updateEnvironmental(sensors);
      updateLightCondition(sensors);
      updateSystemStatus(sensors, state.control, state.lastUpdated);
    });

    Store.subscribe('control', ({ control }) => {
      const state = Store.getState();
      updateSystemStatus(state.sensors, control, state.lastUpdated);
    });
  }

  return { init, computeHeatIndex, computeBrightness, getLightCondition };
})();
