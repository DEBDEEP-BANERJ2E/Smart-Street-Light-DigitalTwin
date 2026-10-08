// store.test.js — State store unit + property tests
// Feature: smart-street-light-frontend

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';

// ── localStorage mock ─────────────────────────────────────────────────────
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; }
  };
})();

// ── Inline store implementation for testing ───────────────────────────────
function createStore(ls = localStorageMock) {
  const THRESHOLDS_KEY = 'slt_thresholds';
  const POSITIONS_KEY  = 'slt_node_positions';

  const defaultThresholds = {
    temp: { high: 40, low: 0 },
    hum:  { high: 90, low: 10 },
    ldr:  { high: 4000, low: 0 }
  };

  function loadFromStorage(key, fallback) {
    try {
      const raw = ls.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }

  function saveToStorage(key, value) {
    try { ls.setItem(key, JSON.stringify(value)); } catch {}
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

  function update(sensors, control) {
    const prevControl = { ...state.control };
    const prevSensors = { ...state.sensors };

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

    ['temp', 'hum', 'ldr', 'ir1', 'ir2'].forEach(k => {
      if (state.sensors[k] !== null && state.sensors[k] !== undefined) {
        pushCapped(state.history[k], state.sensors[k], MAX_HISTORY);
      }
    });

    if (state.sensors.ldr !== null && state.sensors.ldr !== undefined) {
      pushCapped(state.ldrHistory, state.sensors.ldr, MAX_LDR_HISTORY);
    }

    emit('sensors', { sensors: state.sensors, history: state.history });
    emit('control', { control: state.control });
    emit('connection', { status: 'ok' });
  }

  function setConnectionStatus(status) {
    state.connectionStatus = status;
    emit('connection', { status });
  }

  function getState() { return state; }

  function setThresholds(thresholds) {
    Object.assign(state.thresholds, thresholds);
    saveToStorage(THRESHOLDS_KEY, state.thresholds);
    emit('thresholds', state.thresholds);
  }

  function setNodePosition(id, x, y) {
    state.nodePositions[id] = { x, y };
    saveToStorage(POSITIONS_KEY, state.nodePositions);
  }

  return { update, subscribe, getState, setThresholds, setNodePosition, setConnectionStatus };
}

// ── Tests ─────────────────────────────────────────────────────────────────
describe('Store: basic update', () => {
  it('updates sensor values on update()', () => {
    const store = createStore();
    store.update({ temp: 25.5, hum: 60, ldr: 1500, ir1: 0, ir2: 1 }, { led1: 1, led2: 0 });
    const s = store.getState();
    expect(s.sensors.temp).toBe(25.5);
    expect(s.control.led1).toBe(1);
  });

  it('sets connectionStatus to ok on successful update', () => {
    const store = createStore();
    store.setConnectionStatus('error');
    store.update({ temp: 25 }, { led1: 0, led2: 0 });
    expect(store.getState().connectionStatus).toBe('ok');
  });
});

// ── Property 2: Polling failure retains last known values ─────────────────
describe('Property 2: Polling failure retains last known values', () => {
  // Feature: smart-street-light-frontend, Property 2: Polling failure retains last known values
  it('sensor values unchanged after setConnectionStatus(error)', () => {
    fc.assert(fc.property(
      fc.record({
        temp: fc.float({ min: -50, max: 100, noNaN: true }),
        hum:  fc.float({ min: 0,   max: 100, noNaN: true }),
        ldr:  fc.integer({ min: 0, max: 4095 }),
        ir1:  fc.constantFrom(0, 1),
        ir2:  fc.constantFrom(0, 1)
      }),
      (sensors) => {
        const store = createStore();
        store.update(sensors, { led1: 0, led2: 0 });
        const before = { ...store.getState().sensors };
        store.setConnectionStatus('error');
        const after = store.getState().sensors;
        return after.temp === before.temp &&
               after.hum  === before.hum  &&
               after.ldr  === before.ldr  &&
               store.getState().connectionStatus === 'error';
      }
    ), { numRuns: 100 });
  });
});

// ── Property 3: Polling recovery clears error state ───────────────────────
describe('Property 3: Polling recovery clears error state', () => {
  // Feature: smart-street-light-frontend, Property 3: Polling recovery clears error state
  it('connectionStatus becomes ok and sensors updated after recovery', () => {
    fc.assert(fc.property(
      fc.record({
        temp: fc.float({ min: -50, max: 100, noNaN: true }),
        hum:  fc.float({ min: 0,   max: 100, noNaN: true }),
        ldr:  fc.integer({ min: 0, max: 4095 }),
        ir1:  fc.constantFrom(0, 1),
        ir2:  fc.constantFrom(0, 1)
      }),
      (newSensors) => {
        const store = createStore();
        store.setConnectionStatus('error');
        store.update(newSensors, { led1: 0, led2: 0 });
        const s = store.getState();
        return s.connectionStatus === 'ok' &&
               s.sensors.temp === newSensors.temp;
      }
    ), { numRuns: 100 });
  });
});

// ── Property 20: Threshold config round-trips through localStorage ─────────
describe('Property 20: Threshold config round-trips through localStorage', () => {
  // Feature: smart-street-light-frontend, Property 20: Threshold config round-trips through localStorage
  it('parsed localStorage value deeply equals original config', () => {
    fc.assert(fc.property(
      fc.record({
        temp: fc.record({ high: fc.float({ min: 0, max: 100, noNaN: true }), low: fc.float({ min: -50, max: 0, noNaN: true }) }),
        hum:  fc.record({ high: fc.float({ min: 50, max: 100, noNaN: true }), low: fc.float({ min: 0, max: 50, noNaN: true }) }),
        ldr:  fc.record({ high: fc.integer({ min: 2000, max: 4095 }), low: fc.integer({ min: 0, max: 500 }) })
      }),
      (config) => {
        const ls = (() => {
          let store = {};
          return {
            getItem: (k) => store[k] ?? null,
            setItem: (k, v) => { store[k] = String(v); },
          };
        })();
        const store = createStore(ls);
        store.setThresholds(config);
        const raw = ls.getItem('slt_thresholds');
        const parsed = JSON.parse(raw);
        return parsed.temp.high === config.temp.high &&
               parsed.temp.low  === config.temp.low  &&
               parsed.hum.high  === config.hum.high  &&
               parsed.hum.low   === config.hum.low   &&
               parsed.ldr.high  === config.ldr.high  &&
               parsed.ldr.low   === config.ldr.low;
      }
    ), { numRuns: 100 });
  });
});

// ── Property 5: Node positions persist to localStorage ────────────────────
describe('Property 5: Node positions persist to localStorage', () => {
  // Feature: smart-street-light-frontend, Property 5: Node positions persist to localStorage
  it('stored position equals the set position', () => {
    fc.assert(fc.property(
      fc.string({ minLength: 1, maxLength: 20 }),
      fc.integer({ min: 0, max: 2000 }),
      fc.integer({ min: 0, max: 1200 }),
      (nodeId, x, y) => {
        const ls = (() => {
          let store = {};
          return {
            getItem: (k) => store[k] ?? null,
            setItem: (k, v) => { store[k] = String(v); },
          };
        })();
        const store = createStore(ls);
        store.setNodePosition(nodeId, x, y);
        const raw = ls.getItem('slt_node_positions');
        const parsed = JSON.parse(raw);
        return parsed[nodeId] && parsed[nodeId].x === x && parsed[nodeId].y === y;
      }
    ), { numRuns: 100 });
  });
});
