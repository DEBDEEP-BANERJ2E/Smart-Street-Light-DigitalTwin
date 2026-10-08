// ui.test.js — Label rendering property tests
// Feature: smart-street-light-frontend

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// ── Pure logic extracted from ui.js ──────────────────────────────────────
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

function formatSensorTemp(temp) {
  if (temp === null || temp === undefined) return '--';
  return `${parseFloat(temp).toFixed(1)}°C`;
}

function formatSensorHum(hum) {
  if (hum === null || hum === undefined) return '--';
  return `${parseFloat(hum).toFixed(1)}%`;
}

// ── Property 6: LED node label matches state ──────────────────────────────
describe('Property 6: LED node label matches state', () => {
  // Feature: smart-street-light-frontend, Property 6: LED node label matches state
  it('returns ON when value is 1, OFF when value is 0', () => {
    fc.assert(fc.property(fc.constantFrom(0, 1), (val) => {
      const label = getLedLabel(val);
      return val === 1 ? label === 'ON' : label === 'OFF';
    }), { numRuns: 100 });
  });
});

// ── Property 7: Sensor unit labels are always present ────────────────────
describe('Property 7: Sensor unit labels are always present', () => {
  // Feature: smart-street-light-frontend, Property 7: Sensor unit labels are always present
  it('temperature label contains value and °C', () => {
    fc.assert(fc.property(fc.float({ min: -50, max: 100, noNaN: true }), (temp) => {
      const label = formatSensorTemp(temp);
      return label.includes('°C') && label.includes(temp.toFixed(1));
    }), { numRuns: 100 });
  });

  it('humidity label contains value and %', () => {
    fc.assert(fc.property(fc.float({ min: 0, max: 100, noNaN: true }), (hum) => {
      const label = formatSensorHum(hum);
      return label.includes('%') && label.includes(hum.toFixed(1));
    }), { numRuns: 100 });
  });
});

// ── Property 8: LDR label reflects threshold boundary ────────────────────
describe('Property 8: LDR label reflects threshold boundary', () => {
  // Feature: smart-street-light-frontend, Property 8: LDR label reflects threshold boundary
  it('returns DARK when ldr < 2000, BRIGHT when >= 2000', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 4095 }), (ldr) => {
      const label = getLdrLabel(ldr);
      return ldr < 2000 ? label === 'DARK' : label === 'BRIGHT';
    }), { numRuns: 100 });
  });

  it('boundary value 2000 produces BRIGHT', () => {
    expect(getLdrLabel(2000)).toBe('BRIGHT');
  });

  it('value 1999 produces DARK', () => {
    expect(getLdrLabel(1999)).toBe('DARK');
  });
});

// ── Property 9: IR sensor labels match motion state ───────────────────────
describe('Property 9: IR sensor labels match motion state', () => {
  // Feature: smart-street-light-frontend, Property 9: IR sensor labels match motion state
  it('returns MOTION when value is 1, CLEAR when value is 0', () => {
    fc.assert(fc.property(fc.constantFrom(0, 1), (val) => {
      const label = getIrLabel(val);
      return val === 1 ? label === 'MOTION' : label === 'CLEAR';
    }), { numRuns: 100 });
  });
});
