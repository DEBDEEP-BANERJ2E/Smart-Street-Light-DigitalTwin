// store.js — Central State Store with pub/sub event bus
const Store = (() => {
  const THRESHOLDS_KEY = 'slt_thresholds';
  const POSITIONS_KEY = 'slt_node_positions';

  const defaultThresholds = {
    temp: { high: 40, low: 0 },
    hum:  { high: 90, low: 10 },
    ldr:  { high: 4000, low: 0 }
  };

  function loadFromStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }

  function saveToStorage(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  const state = {
    sensors: { temp: null, hum: null, ldr: null, ir1: null, ir2: null },
    control: { led1: 0, led2: 0 },
    history: { temp: [], hum: [], ldr: [], ir1: [], ir2: [], timestamps: [] },
    ldrHistory: [],
    alerts: [],
    timeline: [],
    thresholds: loadFromStorage(THRESHOLDS_KEY, defaultThresholds),
    nodePositions: loadFromStorage(POSITIONS_KEY, {}),
    connectionStatus: 'ok',
    lastUpdated: null,
    breachState: { temp: null, hum: null, ldr: null }
  };

  const listeners = {};

  function subscribe(event, cb) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(cb);
  }

  function emit(event, data) {
    (listeners[event] || []).forEach(cb => cb(data));
  }

  const MAX_HISTORY = 100;
  const MAX_LDR_HISTORY = 60;
  const MAX_ALERTS = 50;
  const MAX_TIMELINE = 200;

  function pushCapped(arr, val, max) {
    arr.push(val);
    if (arr.length > max) arr.shift();
  }

  function formatTime(d) {
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  function update(sensors, control) {
    const prev = { ...state.sensors };
    const prevControl = { ...state.control };

    // Merge — only update keys that exist in response
    if (sensors && typeof sensors === 'object') {
      ['temp', 'hum', 'ldr', 'ir1', 'ir2'].forEach(k => {
        if (sensors[k] !== undefined) state.sensors[k] = sensors[k];
      });
    }
    if (control && typeof control === 'object') {
      ['led1', 'led2'].forEach(k => {
        if (control[k] !== undefined) state.control[k] = control[k];
      });
    }

    state.lastUpdated = new Date();
    state.connectionStatus = 'ok';

    // Update history buffers (skip null)
    const ts = formatTime(state.lastUpdated);
    let hasData = false;
    ['temp', 'hum', 'ldr', 'ir1', 'ir2'].forEach(k => {
      if (state.sensors[k] !== null && state.sensors[k] !== undefined) {
        pushCapped(state.history[k], state.sensors[k], MAX_HISTORY);
        hasData = true;
      }
    });
    if (hasData) pushCapped(state.history.timestamps, ts, MAX_HISTORY);

    // LDR history for heatmap
    if (state.sensors.ldr !== null && state.sensors.ldr !== undefined) {
      pushCapped(state.ldrHistory, state.sensors.ldr, MAX_LDR_HISTORY);
    }

    // Timeline: LED state changes
    ['led1', 'led2'].forEach(k => {
      if (prevControl[k] !== state.control[k]) {
        const entry = {
          id: Date.now() + '_' + k,
          timestamp: state.lastUpdated.toISOString(),
          type: 'LED',
          label: `${k.toUpperCase()} turned ${state.control[k] === 1 ? 'ON' : 'OFF'}`
        };
        state.timeline.unshift(entry);
        if (state.timeline.length > MAX_TIMELINE) state.timeline.pop();
        emit('timeline', state.timeline);
      }
    });

    // Timeline: IR state changes
    ['ir1', 'ir2'].forEach(k => {
      if (prev[k] !== null && prev[k] !== state.sensors[k] && state.sensors[k] !== null) {
        const entry = {
          id: Date.now() + '_' + k,
          timestamp: state.lastUpdated.toISOString(),
          type: 'Motion',
          label: `${k.toUpperCase()} ${state.sensors[k] === 1 ? 'MOTION detected' : 'CLEAR'}`
        };
        state.timeline.unshift(entry);
        if (state.timeline.length > MAX_TIMELINE) state.timeline.pop();
        emit('timeline', state.timeline);
      }
    });

    emit('sensors', { sensors: state.sensors, history: state.history });
    emit('control', { control: state.control });
    emit('connection', { status: 'ok' });
  }

  function setConnectionStatus(status) {
    state.connectionStatus = status;
    emit('connection', { status });
  }

  function getState() {
    return state;
  }

  function setThresholds(thresholds) {
    Object.assign(state.thresholds, thresholds);
    saveToStorage(THRESHOLDS_KEY, state.thresholds);
    emit('thresholds', state.thresholds);
  }

  function setNodePosition(id, x, y) {
    state.nodePositions[id] = { x, y };
    saveToStorage(POSITIONS_KEY, state.nodePositions);
  }

  function addAlert(alert) {
    state.alerts.unshift(alert);
    if (state.alerts.length > MAX_ALERTS) state.alerts.pop();
    // Also add to timeline
    const entry = {
      id: alert.id + '_tl',
      timestamp: alert.timestamp,
      type: 'Alert',
      label: `${alert.sensor.toUpperCase()} ${alert.direction}: ${alert.value} (threshold: ${alert.threshold})`
    };
    state.timeline.unshift(entry);
    if (state.timeline.length > MAX_TIMELINE) state.timeline.pop();
    emit('alert', state.alerts);
    emit('timeline', state.timeline);
  }

  return { update, subscribe, getState, setThresholds, setNodePosition, setConnectionStatus, addAlert };
})();
