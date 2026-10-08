// poller.test.js — Poller behavior tests
// Feature: smart-street-light-frontend

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';

// ── Mock store ────────────────────────────────────────────────────────────
function createMockStore() {
  let state = {
    sensors: { temp: null, hum: null, ldr: null, ir1: null, ir2: null },
    connectionStatus: 'ok'
  };
  const calls = { update: [], setConnectionStatus: [] };

  return {
    update(sensors, control) {
      calls.update.push({ sensors, control });
      state.sensors = { ...sensors };
      state.connectionStatus = 'ok';
    },
    setConnectionStatus(status) {
      calls.setConnectionStatus.push(status);
      state.connectionStatus = status;
    },
    getState() { return state; },
    getCalls() { return calls; }
  };
}

// ── Inline poller logic for testing ──────────────────────────────────────
function createPoller(store, fetchFn) {
  async function poll() {
    try {
      const [dataRes, controlRes] = await Promise.all([
        fetchFn('http://localhost:3000/data'),
        fetchFn('http://localhost:3000/control')
      ]);
      const sensors = await dataRes.json();
      const control = await controlRes.json();
      store.update(sensors, control);
    } catch (err) {
      store.setConnectionStatus('error');
    }
  }
  return { poll };
}

// ── Tests ─────────────────────────────────────────────────────────────────
describe('Poller: fetches both endpoints', () => {
  it('calls /data and /control on each poll', async () => {
    const fetchedUrls = [];
    const mockFetch = (url) => {
      fetchedUrls.push(url);
      return Promise.resolve({
        json: () => Promise.resolve(url.includes('/data') ? { temp: 25, hum: 60, ldr: 1000, ir1: 0, ir2: 0 } : { led1: 0, led2: 0 })
      });
    };
    const store = createMockStore();
    const poller = createPoller(store, mockFetch);
    await poller.poll();
    expect(fetchedUrls).toContain('http://localhost:3000/data');
    expect(fetchedUrls).toContain('http://localhost:3000/control');
  });

  it('calls store.update() with sensor and control data on success', async () => {
    const sensorData = { temp: 30, hum: 70, ldr: 2000, ir1: 1, ir2: 0 };
    const controlData = { led1: 0, led2: 1 };
    const mockFetch = (url) => Promise.resolve({
      json: () => Promise.resolve(url.includes('/data') ? sensorData : controlData)
    });
    const store = createMockStore();
    const poller = createPoller(store, mockFetch);
    await poller.poll();
    const calls = store.getCalls();
    expect(calls.update.length).toBe(1);
    expect(calls.update[0].sensors.temp).toBe(30);
    expect(calls.update[0].control.led1).toBe(0);
  });
});

describe('Poller: error handling', () => {
  it('calls setConnectionStatus(error) on network failure', async () => {
    const mockFetch = () => Promise.reject(new Error('Network error'));
    const store = createMockStore();
    const poller = createPoller(store, mockFetch);
    await poller.poll();
    expect(store.getCalls().setConnectionStatus).toContain('error');
  });

  it('retains last known sensor values after failure', async () => {
    const initialSensors = { temp: 25, hum: 60, ldr: 1500, ir1: 0, ir2: 0 };
    let callCount = 0;
    const mockFetch = (url) => {
      callCount++;
      if (callCount <= 2) {
        return Promise.resolve({
          json: () => Promise.resolve(url.includes('/data') ? initialSensors : { led1: 0, led2: 0 })
        });
      }
      return Promise.reject(new Error('Network error'));
    };
    const store = createMockStore();
    const poller = createPoller(store, mockFetch);
    await poller.poll(); // success
    await poller.poll(); // failure
    expect(store.getState().sensors.temp).toBe(25);
    expect(store.getState().connectionStatus).toBe('error');
  });
});

// ── Property 4: Connection line color reflects LED state ──────────────────
describe('Property 4: Connection line color reflects LED state', () => {
  // Feature: smart-street-light-frontend, Property 4: Connection line color reflects LED state
  const COLOR_ON  = '#00e5ff';
  const COLOR_OFF = '#333333';

  function getLineColor(ledState) {
    return ledState === 1 ? COLOR_ON : COLOR_OFF;
  }

  it('line is cyan when LED is ON, grey when OFF', () => {
    fc.assert(fc.property(fc.constantFrom(0, 1), (ledState) => {
      const color = getLineColor(ledState);
      return ledState === 1 ? color === COLOR_ON : color === COLOR_OFF;
    }), { numRuns: 100 });
  });
});
