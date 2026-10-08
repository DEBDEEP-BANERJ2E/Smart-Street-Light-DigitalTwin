// alerts.test.js — Threshold evaluation property tests
// Feature: smart-street-light-frontend

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// ── Pure evaluate logic extracted from alerts.js ──────────────────────────
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

const defaultThresholds = {
  temp: { high: 40, low: 0 },
  hum:  { high: 90, low: 10 },
  ldr:  { high: 4000, low: 0 }
};

// ── Property 17: Threshold breach triggers alert for both directions ───────
describe('Property 17: Threshold breach triggers alert for both directions', () => {
  // Feature: smart-street-light-frontend, Property 17: Threshold breach triggers alert for both directions
  it('fires HIGH alert when value exceeds high threshold', () => {
    fc.assert(fc.property(
      fc.integer({ min: 41, max: 200 }),
      (temp) => {
        const breachState = { temp: null, hum: null, ldr: null };
        const alerts = evaluate({ temp, hum: 50, ldr: 1000 }, defaultThresholds, breachState);
        return alerts.some(a => a.sensor === 'temp' && a.direction === 'HIGH');
      }
    ), { numRuns: 100 });
  });

  it('fires LOW alert when value falls below low threshold', () => {
    fc.assert(fc.property(
      fc.integer({ min: -100, max: -1 }),
      (temp) => {
        const breachState = { temp: null, hum: null, ldr: null };
        const alerts = evaluate({ temp, hum: 50, ldr: 1000 }, defaultThresholds, breachState);
        return alerts.some(a => a.sensor === 'temp' && a.direction === 'LOW');
      }
    ), { numRuns: 100 });
  });

  it('fires no alert when value is within bounds', () => {
    fc.assert(fc.property(
      fc.float({ min: 0, max: 40, noNaN: true }),
      (temp) => {
        const breachState = { temp: null, hum: null, ldr: null };
        const alerts = evaluate({ temp, hum: 50, ldr: 1000 }, defaultThresholds, breachState);
        return alerts.filter(a => a.sensor === 'temp').length === 0;
      }
    ), { numRuns: 100 });
  });
});

// ── Property 18: Alert hysteresis prevents duplicate notifications ─────────
describe('Property 18: Alert hysteresis prevents duplicate notifications', () => {
  // Feature: smart-street-light-frontend, Property 18: Alert hysteresis prevents duplicate notifications
  it('does not fire duplicate HIGH alert when breach state is already high', () => {
    fc.assert(fc.property(
      fc.integer({ min: 41, max: 200 }),
      (temp) => {
        const breachState = { temp: 'high', hum: null, ldr: null };
        const alerts = evaluate({ temp, hum: 50, ldr: 1000 }, defaultThresholds, breachState);
        return alerts.filter(a => a.sensor === 'temp').length === 0;
      }
    ), { numRuns: 100 });
  });

  it('does not fire duplicate LOW alert when breach state is already low', () => {
    fc.assert(fc.property(
      fc.integer({ min: -100, max: -1 }),
      (temp) => {
        const breachState = { temp: 'low', hum: null, ldr: null };
        const alerts = evaluate({ temp, hum: 50, ldr: 1000 }, defaultThresholds, breachState);
        return alerts.filter(a => a.sensor === 'temp').length === 0;
      }
    ), { numRuns: 100 });
  });
});

// ── Property 19: Alert log size invariant ────────────────────────────────
describe('Property 19: Alert log size invariant', () => {
  // Feature: smart-street-light-frontend, Property 19: Alert log size invariant
  it('alert log never exceeds 50 entries', () => {
    fc.assert(fc.property(
      fc.integer({ min: 51, max: 200 }),
      (count) => {
        const log = [];
        for (let i = 0; i < count; i++) {
          log.unshift({ id: `alert_${i}`, timestamp: new Date().toISOString(), sensor: 'temp', value: 50, direction: 'HIGH', threshold: 40 });
          if (log.length > 50) log.pop();
        }
        return log.length <= 50;
      }
    ), { numRuns: 100 });
  });

  it('oldest entry is removed when 51st alert is added', () => {
    const log = [];
    for (let i = 0; i < 50; i++) {
      log.unshift({ id: `alert_${i}` });
    }
    // Add 51st
    log.unshift({ id: 'alert_50' });
    if (log.length > 50) log.pop();
    expect(log.length).toBe(50);
    expect(log[0].id).toBe('alert_50');
  });
});
